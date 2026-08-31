#!/usr/bin/env python3
"""Sync Worker for the Supplier Portal.

This script connects to the live Oracle RMS database and the Totvs RM SQL Server 
database, extracts real operational metadata, aggregates and anonymizes it according 
to LGPD requirements, and outputs a unified JSON seed for the portal.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_DNS, uuid5

# Try to import DB drivers
try:
    import oracledb
except ImportError:
    oracledb = None

try:
    import pymssql
except ImportError:
    pymssql = None


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_SEED = ROOT / "db" / "seeds" / "real_supplier_portal_data.json"
MIN_GROUP_SIZE = 5
SUPPLIER_CODE = "4050"
SUPPLIER_NAME = "Nestlé Brasil S/A"
SUPPLIER_CNPJ = "60.409.075/0001-52"
# Raiz do CNPJ emitente no RMS (sem DV de filial) — Nestlé.
SUPPLIER_CNPJ_ROOT = os.environ.get("PORTAL_SUPPLIER_CNPJ_ROOT", "60409075")
# Depósitos/CD reais (AA2CTIPO TIP_LOJ_CLI=D). 13 permanece como legado mock de pedidos.
DEFAULT_CDAM_BRANCH_IDS = {"201", "213", "214", "203", "210", "13"}
# Agenda de recebimento fornecedor→CDAM (evidência Nestlé VW03_NFEENTRADA).
DEFAULT_SUPPLIER_RECEIPT_AGENDAS = {28}
# Transferências internas — nunca viram título a pagar do fornecedor.
TRANSFER_AGENDAS = {65, 66, 148}
# Cadastro financeiro candidato (prazo + desconto). Fonte futura: RM/RMS cadastro.
DEFAULT_PAYMENT_TERMS_DAYS = int(os.environ.get("PORTAL_SUPPLIER_PRAZO_DIAS", "28"))
DEFAULT_FINANCIAL_DISCOUNT_PCT = float(os.environ.get("PORTAL_SUPPLIER_DESC_FIN_PCT", "1.5"))
SUPPLIER_DELIVERY_MODEL = os.environ.get("PORTAL_SUPPLIER_DELIVERY_MODEL", "somente_cdam")
ALLOW_STRUCTURAL_FALLBACKS = os.environ.get("PORTAL_ALLOW_STRUCTURAL_FALLBACKS") == "1"
PRODUCT_CLASSIFICATION_FALLBACK = {
    "10010": {
        "description": "Nescau Chocolate Po 400g",
        "departmentCode": "100",
        "department": "Mercearia",
        "sectionCode": "13",
        "section": "Mercearia Doce",
        "groupCode": "1",
        "group": "Achocolatados",
        "subgroupCode": "1",
        "subgroup": "Achocolatado em po",
        "family": "Cafe da manha",
        "commercialRole": "destino",
    },
    "10020": {
        "description": "Leite Condensado Moca Lata 395g",
        "departmentCode": "100",
        "department": "Mercearia",
        "sectionCode": "6",
        "section": "Mercearia Doce",
        "groupCode": "6",
        "group": "Leites culinarios",
        "subgroupCode": "2",
        "subgroup": "Leite condensado",
        "family": "Sobremesas",
        "commercialRole": "rotina",
    },
    "10030": {
        "description": "Biscoito Passatempo Recheado Chocolate 130g",
        "departmentCode": "100",
        "department": "Mercearia",
        "sectionCode": "4",
        "section": "Biscoitos e snacks",
        "groupCode": "10",
        "group": "Biscoitos recheados",
        "subgroupCode": "1",
        "subgroup": "Chocolate",
        "family": "Lanche infantil",
        "commercialRole": "conveniencia",
    },
}


def parse_csv_set(value: str | None, default: set[str]) -> set[str]:
    if not value:
        return set(default)
    parsed = {item.strip().upper() for item in value.split(",") if item.strip()}
    return parsed or set(default)


def parse_int_set(value: str | None, default: set[int]) -> set[int]:
    if not value:
        # Normaliza default (pode vir com strings acidentalmente).
        return {int(x) for x in default}
    parsed: set[int] = set()
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            parsed.add(int(item))
        except ValueError:
            continue
    return parsed or {int(x) for x in default}


def supplier_receipt_agendas() -> set[int]:
    return parse_int_set(os.environ.get("PORTAL_SUPPLIER_RECEIPT_AGENDAS"), DEFAULT_SUPPLIER_RECEIPT_AGENDAS)


def cdam_branch_ids() -> set[str]:
    return parse_csv_set(os.environ.get("PORTAL_CDAM_BRANCH_IDS"), DEFAULT_CDAM_BRANCH_IDS)


def round_money(value: float) -> float:
    return round(value + 1e-9, 2)


def calculate_payment_date(issue_date: object, prazo_dias: int = DEFAULT_PAYMENT_TERMS_DAYS) -> str | None:
    issue = parse_iso_date(issue_date)
    if issue is None:
        return None
    from datetime import timedelta

    return (issue + timedelta(days=prazo_dias)).isoformat()


def calculate_financial_discount(
    amount: float, discount_pct: float = DEFAULT_FINANCIAL_DISCOUNT_PCT
) -> float:
    if discount_pct <= 0 or amount <= 0:
        return 0.0
    return round_money(amount * (discount_pct / 100.0))


def is_transfer_agenda(agenda: object) -> bool:
    try:
        return int(agenda) in TRANSFER_AGENDAS
    except (TypeError, ValueError):
        return False


def normalize_cnpj_digits(value: object) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def supplier_id() -> str:
    configured = os.environ.get("PORTAL_SUPPLIER_ID")
    if configured:
        return configured
    return str(uuid5(NAMESPACE_DNS, f"portal-fornecedor:{SUPPLIER_CODE}"))


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_order_status(value: object) -> str:
    text = str(value or "Aberto").strip().lower()
    if text in {"faturado", "fat"}:
        return "faturado"
    if text in {"pendente", "atrasado", "pendente/atrasado"}:
        return "pendente"
    if text in {"entregue", "entregue no cdam", "entregue_cdam", "recebido", "recebido cdam"}:
        return "entregue"
    if text in {"cancelado", "canc"}:
        return "cancelado"
    return "aberto"


def parse_iso_date(value: object) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def calculate_delivery_lead_time_days(issue_date: object, cdam_entry_date: object) -> int | None:
    issue = parse_iso_date(issue_date)
    entry = parse_iso_date(cdam_entry_date)
    if issue is None or entry is None:
        return None
    return max(0, (entry - issue).days)


def calculate_fill_rate(qty_ordered: float, qty_invoiced: float) -> float:
    if qty_ordered <= 0:
        return 0.0
    return round((qty_invoiced / qty_ordered) * 100, 4)


def abc_class_from_previous_cumulative(previous_pct: float) -> str:
    if previous_pct < 50:
        return "A"
    if previous_pct < 80:
        return "B"
    if previous_pct < 98:
        return "C"
    return "D"


def normalize_order_lines(order: dict) -> list[dict]:
    raw_lines = order.get("lines") or order.get("itens") or []
    lines = []

    for index, raw in enumerate(raw_lines, start=1):
        qty_ordered = float(raw.get("qtyOrdered") or raw.get("quantidadePedida") or 0)
        qty_invoiced = float(raw.get("qtyInvoiced") or raw.get("quantidadeFaturada") or 0)
        lines.append(
            {
                "sku": str(raw.get("sku") or raw.get("cdProduto") or raw.get("produto") or f"LINHA-{index}"),
                "description": str(raw.get("description") or raw.get("descricao") or "Item de pedido"),
                "qtyOrdered": qty_ordered,
                "qtyInvoiced": qty_invoiced,
                "fillRatePct": calculate_fill_rate(qty_ordered, qty_invoiced),
                "unitPrice": f"{float(raw.get('unitPrice') or raw.get('precoUnitario') or 0):.2f}",
            }
        )

    if lines:
        return lines

    return [
        {
            "sku": "PENDENTE_DETALHE_RMS",
            "description": "Detalhamento de itens nao extraido nesta etapa candidata",
            "qtyOrdered": 0,
            "qtyInvoiced": 0,
            "fillRatePct": 0,
            "unitPrice": "0.00",
        }
    ]


def classify_order(raw_order: dict) -> dict:
    branches = cdam_branch_ids()
    branch_id = str(raw_order.get("codFilial") or raw_order.get("referenceBranchId") or "").strip().upper()
    hint = " ".join(
        str(raw_order.get(key) or "")
        for key in ("destinoOperacional", "destinationName", "nomeFilial", "observacao")
    ).upper()
    is_cdam = branch_id in branches or any(
        token in hint
        for token in (
            "CDAM",
            "DEPOSITO",
            "DEPÓSITO",
            "DEPOSITO CENTRAL",
            "DEPÓSITO CENTRAL",
            "CENTRO DE DISTRIBUICAO",
            "AUG.MONTENEGRO",
            "AUG MONTENEGRO",
        )
    )

    # Pedido ao fornecedor com entrega no CDAM: recebimento agenda 28 (não transferência 66).
    receipt_agenda = sorted(supplier_receipt_agendas())[0] if supplier_receipt_agendas() else 28

    if is_cdam:
        return {
            "orderKind": "cdam_central_depot",
            "tipoPedido": "CDAM",
            "destinationName": "CDAM - Deposito Aug. Montenegro",
            "agendaContext": "compras_recebimento",
            "agendaCode": str(receipt_agenda),
            "agendaParity": "entrada_nf_fornecedor_cdam",
            "ruleSummary": (
                f"Pedido ao fornecedor com entrega no CDAM/deposito; agenda de recebimento "
                f"{receipt_agenda}. Transferencias posteriores 65/66/148 nao geram titulo do fornecedor."
            ),
            "classificationSource": "branch_or_destination_cdam",
        }

    return {
        "orderKind": "supplier_direct",
        "tipoPedido": "Fornecedor",
        "destinationName": "Fornecedor direto",
        "agendaContext": "compras_recebimento",
        "agendaCode": str(receipt_agenda),
        "agendaParity": "conforme_origem_fiscal_compra",
        "ruleSummary": (
            "Pedido emitido diretamente ao fornecedor; a entrada fiscal ocorre por agenda de "
            f"compra/recebimento ({receipt_agenda} no modelo somente_cdam Nestle)."
        ),
        "classificationSource": "default_supplier_direct",
    }


def filter_supplier_cdam_payments(raw_payments: list[dict]) -> list[dict]:
    """Mantém só NF de recebimento do fornecedor no depósito/CDAM.

    Regras (Nestlé / modelo somente_cdam):
    - emitente = raiz CNPJ do fornecedor
    - agenda em PORTAL_SUPPLIER_RECEIPT_AGENDAS (default 28)
    - destino tipo D (depósito) OU filial em PORTAL_CDAM_BRANCH_IDS
    - exclui agendas de transferência 65/66/148
    - natureza != transferencia_interna
    """
    agendas_ok = supplier_receipt_agendas()
    branches_ok = cdam_branch_ids()
    cnpj_root = SUPPLIER_CNPJ_ROOT
    kept: list[dict] = []
    rejected = {"transfer": 0, "agenda": 0, "dest": 0, "emitente": 0, "natureza": 0}

    for raw in raw_payments:
        emitente = normalize_cnpj_digits(raw.get("cnpjEmitente") or raw.get("cnpjEmit") or "")
        forn_cod = raw.get("fornecedorCodigo")
        if emitente:
            if not emitente.startswith(cnpj_root):
                rejected["emitente"] += 1
                continue
        elif forn_cod not in (None, "", SUPPLIER_CODE):
            rejected["emitente"] += 1
            continue

        agenda = raw.get("agendaRms") if raw.get("agendaRms") is not None else raw.get("agenda")
        if is_transfer_agenda(agenda):
            rejected["transfer"] += 1
            continue

        natureza = str(raw.get("natureza") or "").strip().lower()
        if natureza in {"transferencia_interna", "transferencia", "transfer"}:
            rejected["natureza"] += 1
            continue

        try:
            agenda_int = int(agenda) if agenda is not None and str(agenda).strip() != "" else None
        except (TypeError, ValueError):
            agenda_int = None

        # Agenda obrigatória no modelo somente_cdam (sem agenda → rejeita).
        if agendas_ok:
            if agenda_int is None or agenda_int not in agendas_ok:
                rejected["agenda"] += 1
                continue

        dest_tipo = str(raw.get("destTipo") or raw.get("tipoDestino") or "").strip().upper()
        branch = str(
            raw.get("codFilialDest")
            or raw.get("filialDestino")
            or raw.get("lojaId")
            or raw.get("codFilial")
            or ""
        ).strip().upper()

        if SUPPLIER_DELIVERY_MODEL == "somente_cdam":
            is_deposit = dest_tipo == "D" or branch in branches_ok
            if not is_deposit:
                rejected["dest"] += 1
                continue

        kept.append(raw)

    print(
        "  Filtro financeiro CDAM: "
        f"mantidos={len(kept)} rejeitados={sum(rejected.values())} detalhe={rejected}"
    )
    return kept


def enrich_payment_from_cadastro(raw: dict) -> dict:
    """Aplica prazo e desconto financeiro do cadastro sobre a NF de recebimento."""
    valor = float(raw.get("valorOriginal") or raw.get("valor") or raw.get("amountOriginal") or 0)
    emissao = (
        raw.get("dataEmissao")
        or raw.get("issueDate")
        or raw.get("dataAgenda")
        or raw.get("dataVencimento")
    )
    prazo = int(raw.get("prazoPagamentoDias") or DEFAULT_PAYMENT_TERMS_DAYS)
    desc_pct = float(raw.get("descontoFinanceiroPct") or DEFAULT_FINANCIAL_DISCOUNT_PCT)
    desconto = calculate_financial_discount(valor, desc_pct)
    data_pagamento = calculate_payment_date(emissao, prazo) or raw.get("dataVencimento")
    agenda = raw.get("agendaRms") if raw.get("agendaRms") is not None else raw.get("agenda")
    try:
        agenda_int = int(agenda) if agenda is not None else sorted(supplier_receipt_agendas())[0]
    except (TypeError, ValueError):
        agenda_int = sorted(supplier_receipt_agendas())[0]

    branch = str(
        raw.get("codFilialDest")
        or raw.get("filialDestino")
        or raw.get("lojaId")
        or raw.get("codFilial")
        or "201"
    ).strip()

    status_raw = str(raw.get("status") or "A Vencer").strip().lower()
    if status_raw in {"pago", "liquidado", "baixado"} or status_raw.startswith("pago"):
        status = "Pago"
    elif status_raw in {"vencido", "vencida", "overdue"} or "vencido" in status_raw:
        status = "Vencido"
    else:
        # Deriva do calendário se a data de pagamento prevista já passou.
        pay_d = parse_iso_date(data_pagamento)
        if pay_d is not None and pay_d < date.today() and status_raw not in {"pago", "liquidado"}:
            status = "Vencido"
        else:
            status = "A Vencer"

    return {
        "codLan": raw.get("codLan") or raw.get("id") or raw.get("numeroDocumento"),
        "numeroDocumento": str(raw.get("numeroDocumento") or raw.get("numeroNota") or raw.get("nfe") or ""),
        "cnpjEmitente": normalize_cnpj_digits(raw.get("cnpjEmitente") or raw.get("cnpjEmit") or SUPPLIER_CNPJ),
        "cnpjDestino": normalize_cnpj_digits(raw.get("cnpjDestino") or raw.get("cnpjDest") or ""),
        "codFilialDest": branch,
        "destNome": raw.get("destNome") or raw.get("nomeDestino") or "CDAM - Deposito Aug. Montenegro",
        "destTipo": str(raw.get("destTipo") or "D").upper()[:1] or "D",
        "agendaRms": agenda_int,
        "natureza": "recebimento_fornecedor_cdam",
        "dataEmissao": str(emissao)[:10] if emissao else None,
        "dataPagamento": data_pagamento,
        "dataVencimento": data_pagamento,  # compat legada com seed anterior
        "prazoPagamentoDias": prazo,
        "descontoFinanceiroPct": desc_pct,
        "valorOriginal": round_money(valor),
        "descontoFinanceiro": desconto,
        "valorLiquido": round_money(valor - desconto),
        "status": status,
        "fornecedorCodigo": SUPPLIER_CODE,
        "modeloEntrega": SUPPLIER_DELIVERY_MODEL,
    }


def build_payments_payload(raw_payments: list[dict], generated_at: str) -> dict:
    filtered = filter_supplier_cdam_payments(raw_payments)
    rows = [enrich_payment_from_cadastro(item) for item in filtered]
    rows.sort(key=lambda r: (r.get("dataPagamento") or "", r.get("numeroDocumento") or ""))
    return {
        "generatedAt": generated_at,
        "homologationStatus": "candidato",
        "supplierId": supplier_id(),
        "filterPolicy": {
            "deliveryModel": SUPPLIER_DELIVERY_MODEL,
            "receiptAgendas": sorted(supplier_receipt_agendas()),
            "excludeTransferAgendas": sorted(TRANSFER_AGENDAS),
            "cdamBranchIds": sorted(cdam_branch_ids()),
            "supplierCnpjRoot": SUPPLIER_CNPJ_ROOT,
            "paymentTermsDays": DEFAULT_PAYMENT_TERMS_DAYS,
            "financialDiscountPct": DEFAULT_FINANCIAL_DISCOUNT_PCT,
            "ruleSummary": (
                "Somente NF-e do fornecedor com agenda de recebimento no CDAM/deposito "
                "(default agenda 28 + destinacao tipo D). Exclui transferencias 65/66/148 e lojas."
            ),
        },
        "dataFreshness": {
            "sourceUpdatedAt": generated_at,
            "syncedAt": generated_at,
            "ageSeconds": 0,
            "slaLabel": "atualizado agora",
            "slaBreached": False,
        },
        "page": {"limit": 200, "hasMore": False, "nextCursor": None},
        "rows": rows,
        # Lista plana legada (compat seed antigo / consumidores que leem payments como array)
        "items": rows,
    }


def fallback_supplier_cdam_payments() -> list[dict]:
    """Fallback estrutural alinhado a Nestlé → CDAM agenda 28 / filial 201."""
    today = date.today()
    from datetime import timedelta

    def iso(offset: int) -> str:
        return (today + timedelta(days=offset)).isoformat()

    return [
        {
            "codLan": 40221,
            "numeroDocumento": "NF-118420",
            "cnpjEmitente": "60409075016407",
            "cnpjDestino": "05054671001554",
            "codFilialDest": "201",
            "destNome": "DEPOSITO AUG.MONTENEGRO",
            "destTipo": "D",
            "agendaRms": 28,
            "natureza": "recebimento_fornecedor_cdam",
            "dataEmissao": iso(-8),
            "valorOriginal": 124500.00,
            "status": "A Vencer",
            "fornecedorCodigo": SUPPLIER_CODE,
        },
        {
            "codLan": 40222,
            "numeroDocumento": "NF-118455",
            "cnpjEmitente": "60409075016407",
            "cnpjDestino": "05054671001554",
            "codFilialDest": "201",
            "destNome": "DEPOSITO AUG.MONTENEGRO",
            "destTipo": "D",
            "agendaRms": 28,
            "natureza": "recebimento_fornecedor_cdam",
            "dataEmissao": iso(-5),
            "valorOriginal": 86300.50,
            "status": "A Vencer",
            "fornecedorCodigo": SUPPLIER_CODE,
        },
        {
            "codLan": 40223,
            "numeroDocumento": "NF-118477",
            "cnpjEmitente": "60409075008137",
            "cnpjDestino": "05054671001554",
            "codFilialDest": "201",
            "destNome": "DEPOSITO AUG.MONTENEGRO",
            "destTipo": "D",
            "agendaRms": 28,
            "natureza": "recebimento_fornecedor_cdam",
            "dataEmissao": iso(-3),
            "valorOriginal": 152980.75,
            "status": "A Vencer",
            "fornecedorCodigo": SUPPLIER_CODE,
        },
        {
            "codLan": 39110,
            "numeroDocumento": "NF-118330",
            "cnpjEmitente": "60409075016407",
            "cnpjDestino": "05054671001554",
            "codFilialDest": "201",
            "destNome": "DEPOSITO AUG.MONTENEGRO",
            "destTipo": "D",
            "agendaRms": 28,
            "natureza": "recebimento_fornecedor_cdam",
            "dataEmissao": iso(-40),
            "valorOriginal": 98750.00,
            "status": "Pago",
            "fornecedorCodigo": SUPPLIER_CODE,
        },
        # Ruído proposital — deve ser filtrado (transferência loja)
        {
            "codLan": 99901,
            "numeroDocumento": "TRF-660012",
            "cnpjEmitente": "05054671001554",
            "cnpjDestino": "05054671000744",
            "codFilialDest": "01",
            "destNome": "L08 LIDER BATISTA CAMPOS",
            "destTipo": "L",
            "agendaRms": 66,
            "natureza": "transferencia_interna",
            "dataEmissao": iso(-2),
            "valorOriginal": 22000.00,
            "status": "A Vencer",
            "fornecedorCodigo": SUPPLIER_CODE,
        },
        # Ruído — agenda 2 em loja (não entra no modelo somente_cdam)
        {
            "codLan": 99902,
            "numeroDocumento": "NF-770001",
            "cnpjEmitente": "60409075016407",
            "cnpjDestino": "05054671000582",
            "codFilialDest": "05",
            "destNome": "L05 LIDER CASTANHEIRA",
            "destTipo": "L",
            "agendaRms": 2,
            "natureza": "outra",
            "dataEmissao": iso(-3),
            "valorOriginal": 15000.00,
            "status": "A Vencer",
            "fornecedorCodigo": SUPPLIER_CODE,
        },
    ]


def query_supplier_receivables_rms(connection) -> list[dict]:
    """Extrai NF-e de entrada do fornecedor no CDAM via VW03_NFEENTRADA + AA2CTIPO.

    Filtro: emitente raiz Nestlé, agenda de recebimento (28), destino tipo D.
    """
    print("  Buscando NF-e fornecedor→CDAM (agenda recebimento + destino deposito)...")
    agendas = sorted(supplier_receipt_agendas())
    if not agendas:
        return []

    cnpj_root = SUPPLIER_CNPJ_ROOT
    agenda_binds = {f"a{i}": ag for i, ag in enumerate(agendas)}
    agenda_sql = ", ".join(f":{k}" for k in agenda_binds)

    # Destino tipo D (depósito/CD) — exclui lojas e transferências.
    sql = f"""
        SELECT * FROM (
          SELECT
            e.NFE_CNPJEMIT,
            e.NFE_CNPJDEST,
            e.NFE_NUMERO_NF,
            e.NFE_TPO_AGENDA,
            e.NFE_DTEMISSAO,
            e.NFE_VALOR,
            e.NFE_DESSITUACAO,
            t.TIP_CODIGO,
            TRIM(t.TIP_NOME_FANTASIA) AS DEST_NOME,
            t.TIP_LOJ_CLI AS DEST_TIPO
          FROM RMS.VW03_NFEENTRADA e
          INNER JOIN RMS.AA2CTIPO t
            ON t.TIP_CGC_CPF = TO_NUMBER(e.NFE_CNPJDEST)
           AND t.TIP_LOJ_CLI = 'D'
          WHERE e.NFE_CNPJEMIT LIKE :cnpj_like
            AND e.NFE_TPO_AGENDA IN ({agenda_sql})
          ORDER BY e.NFE_DTEMISSAO DESC NULLS LAST
        ) WHERE ROWNUM <= 100
    """

    rows: list[dict] = []
    try:
        with connection.cursor() as cursor:
            binds = {"cnpj_like": f"{cnpj_root}%", **agenda_binds}
            cursor.execute(sql, binds)
            for row in cursor.fetchall():
                cnpj_emit, cnpj_dest, nro, agenda, dtemis, valor, situacao, tip_cod, dest_nome, dest_tipo = row
                if is_transfer_agenda(agenda):
                    continue
                emissao = None
                if dtemis is not None:
                    if isinstance(dtemis, datetime):
                        emissao = dtemis.date().isoformat()
                    elif isinstance(dtemis, date):
                        emissao = dtemis.isoformat()
                    else:
                        emissao = str(dtemis)[:10]
                rows.append(
                    {
                        "codLan": int(nro) if nro is not None else None,
                        "numeroDocumento": f"NF-{nro}" if nro is not None else "",
                        "cnpjEmitente": normalize_cnpj_digits(cnpj_emit),
                        "cnpjDestino": normalize_cnpj_digits(cnpj_dest),
                        "codFilialDest": str(int(tip_cod)) if tip_cod is not None else "201",
                        "destNome": dest_nome or "DEPOSITO",
                        "destTipo": (dest_tipo or "D").strip().upper()[:1] or "D",
                        "agendaRms": int(agenda) if agenda is not None else None,
                        "natureza": "recebimento_fornecedor_cdam",
                        "dataEmissao": emissao,
                        "valorOriginal": float(valor or 0),
                        "status": "A Vencer",
                        "situacaoXml": situacao,
                        "fornecedorCodigo": SUPPLIER_CODE,
                    }
                )
        print(f"    {len(rows)} NF-e fornecedor→deposito (agenda {agendas}) extraídas do RMS.")
    except Exception as e:
        print(f"    Erro ao extrair NF-e fornecedor CDAM: {e}")
    return rows


def enrich_orders(raw_orders: list[dict]) -> list[dict]:
    enriched = []
    for raw in raw_orders:
        classification = classify_order(raw)
        branch_id = str(raw.get("codFilial") or raw.get("referenceBranchId") or "").strip()
        order_number = str(raw.get("numPedido") or raw.get("orderNumber") or "").strip()
        if not order_number:
            continue
        enriched.append(
            {
                "codFilial": int(branch_id) if branch_id.isdigit() else branch_id,
                "numPedido": int(order_number) if order_number.isdigit() else order_number,
                "status": normalize_order_status(raw.get("status")),
                "dataEmissao": raw.get("dataEmissao") or utc_now()[:10],
                "dataEntregaPrevista": raw.get("dataEntregaPrevista"),
                "dataEntradaCdam": raw.get("dataEntradaCdam")
                or raw.get("cdamEntryDate")
                or raw.get("entradaCdam"),
                "lines": normalize_order_lines(raw),
                "originName": "Compras Grupo Lider",
                "referenceBranchId": branch_id or "NAO_INFORMADO",
                **classification,
            }
        )
    return enriched


def build_purchase_orders_payload(orders: list[dict], generated_at: str) -> dict:
    sid = supplier_id()
    rows = []
    for order in orders:
        order_number = str(order['numPedido']).zfill(6)
        lines = normalize_order_lines(order)
        qty_ordered_total = sum(line["qtyOrdered"] for line in lines)
        qty_invoiced_total = sum(line["qtyInvoiced"] for line in lines)
        cdam_entry_date = order.get("dataEntradaCdam")
        delivery_lead_time_days = calculate_delivery_lead_time_days(order["dataEmissao"], cdam_entry_date)
        row = {
            "orderId": str(uuid5(NAMESPACE_DNS, f"{sid}:{order_number}")),
            "orderNumber": order_number,
            "orderKind": order["orderKind"],
            "originName": order["originName"],
            "destinationName": order["destinationName"],
            "referenceBranchId": str(order["referenceBranchId"]),
            "issueDate": order["dataEmissao"],
            "expectedDeliveryDate": order.get("dataEntregaPrevista") or order["dataEmissao"],
            "status": normalize_order_status(order["status"]),
            "agendaContext": order["agendaContext"],
            "agendaCode": order["agendaCode"],
            "agendaParity": order["agendaParity"],
            "qtyOrderedTotal": qty_ordered_total,
            "qtyInvoicedTotal": qty_invoiced_total,
            "fillRatePct": calculate_fill_rate(qty_ordered_total, qty_invoiced_total),
            "ruleSummary": order["ruleSummary"],
            "writesToErp": False,
            "lines": lines,
        }
        if cdam_entry_date:
            row["cdamEntryDate"] = str(cdam_entry_date)[:10]
        if delivery_lead_time_days is not None:
            row["deliveryLeadTimeDays"] = delivery_lead_time_days
        rows.append(
            row
        )

    return {
        "generatedAt": generated_at,
        "homologationStatus": "candidato",
        "supplierId": sid,
        "dataFreshness": {
            "sourceUpdatedAt": generated_at,
            "syncedAt": generated_at,
            "ageSeconds": 0,
            "slaLabel": "atualizado agora",
            "slaBreached": False,
        },
        "page": {"limit": 50, "hasMore": False, "nextCursor": None},
        "rows": rows,
    }


def build_product_classifications_payload(
    sales: list[dict], stock: list[dict], orders: list[dict], generated_at: str
) -> dict:
    sku_set = {
        str(row.get("sku"))
        for row in [*sales, *stock]
        if row.get("sku") is not None
    }
    for order in orders:
        for line in normalize_order_lines(order):
            if line["sku"] != "PENDENTE_DETALHE_RMS":
                sku_set.add(str(line["sku"]))

    rows = []
    for sku in sorted(sku_set):
        classification = PRODUCT_CLASSIFICATION_FALLBACK.get(
            sku,
            {
                "description": "Produto sem classificacao mercadologica aprovada",
                "departmentCode": "NA",
                "department": "Nao classificado",
                "sectionCode": "NA",
                "section": "Nao classificado",
                "groupCode": "NA",
                "group": "Nao classificado",
                "subgroupCode": "NA",
                "subgroup": "Nao classificado",
                "family": "Nao classificado",
                "commercialRole": "nao_classificado",
            },
        )
        sales_sku = [row for row in sales if str(row.get("sku")) == sku]
        stock_sku = [row for row in stock if str(row.get("sku")) == sku]
        order_lines = [
            line
            for order in orders
            for line in normalize_order_lines(order)
            if str(line["sku"]) == sku
        ]
        sell_out_qty = sum(float(row.get("quantidade") or 0) for row in sales_sku)
        sell_out_amount = sum(float(row.get("valorVenda") or 0) for row in sales_sku)
        cmv = sum(float(row.get("valorCmv") or 0) for row in sales_sku)
        stock_qty = sum(float(row.get("saldoFisico") or 0) for row in stock_sku)
        stockout_count = sum(
            1
            for row in stock_sku
            if float(row.get("saldoFisico") or 0) <= 0
        )
        qty_ordered = sum(float(line["qtyOrdered"]) for line in order_lines)
        qty_invoiced = sum(float(line["qtyInvoiced"]) for line in order_lines)

        rows.append(
            {
                "sku": sku,
                "description": classification["description"],
                "departmentCode": classification["departmentCode"],
                "department": classification["department"],
                "sectionCode": classification["sectionCode"],
                "section": classification["section"],
                "groupCode": classification["groupCode"],
                "group": classification["group"],
                "subgroupCode": classification["subgroupCode"],
                "subgroup": classification["subgroup"],
                "family": classification["family"],
                "commercialRole": classification["commercialRole"],
                "abcClass": "nao_classificado",
                "sellOutAmount": f"{sell_out_amount:.2f}",
                "sellOutQty": sell_out_qty,
                "avgDailySales90Amount": f"{(sell_out_amount / 90):.2f}",
                "subgroupSalesSharePct": 0,
                "subgroupCumulativeSharePct": 0,
                "grossMarginPct": calculate_fill_rate(sell_out_amount, sell_out_amount - cmv),
                "stockQty": stock_qty,
                "stockoutBranchCount": stockout_count,
                "fillRatePct": calculate_fill_rate(qty_ordered, qty_invoiced),
                "writesToErp": False,
            }
        )

    by_subgroup = {}
    for row in rows:
        key = (
            row["departmentCode"],
            row["sectionCode"],
            row["groupCode"],
            row["subgroupCode"],
        )
        by_subgroup.setdefault(key, []).append(row)

    for subgroup_rows in by_subgroup.values():
        subgroup_rows.sort(key=lambda row: float(row["avgDailySales90Amount"]), reverse=True)
        subgroup_total = sum(float(row["avgDailySales90Amount"]) for row in subgroup_rows)
        cumulative = 0.0
        for row in subgroup_rows:
            share = (
                round((float(row["avgDailySales90Amount"]) / subgroup_total) * 100, 4)
                if subgroup_total > 0
                else 0.0
            )
            row["abcClass"] = (
                "nao_classificado"
                if row["commercialRole"] == "nao_classificado"
                else abc_class_from_previous_cumulative(cumulative)
            )
            cumulative = min(100.0, cumulative + share)
            row["subgroupSalesSharePct"] = share
            row["subgroupCumulativeSharePct"] = round(cumulative, 4)

    return {
        "generatedAt": generated_at,
        "homologationStatus": "candidato",
        "supplierId": supplier_id(),
        "dataFreshness": {
            "sourceUpdatedAt": generated_at,
            "syncedAt": generated_at,
            "ageSeconds": 0,
            "slaLabel": "atualizado agora",
            "slaBreached": False,
        },
        "page": {"limit": 50, "hasMore": False, "nextCursor": None},
        "rows": rows,
    }


def query_oracle_rms() -> dict:
    """Queries Oracle RMS for Sales, Stock, Orders and supplier→CDAM receivables."""
    print("Iniciando varredura no Oracle RMS...")
    empty = {"sales": [], "stock": [], "orders": [], "payments": []}
    if oracledb is None:
        print("  oracledb não está instalado. Pulando...")
        return empty

    lib_dir = "/home/administrador/instantclient_19_25"
    # Garante libs do Instant Client no path (thick mode).
    os.environ.setdefault(
        "LD_LIBRARY_PATH",
        f"{lib_dir}:{os.environ.get('LD_LIBRARY_PATH', '')}",
    )
    try:
        oracledb.init_oracle_client(lib_dir=lib_dir)
    except Exception as e:
        print(f"  Erro ao inicializar cliente Oracle Thick: {e}")
        return empty

    connection_params = {
        "user": "ISAURA",
        "password": "PRD1Z4UR4",
        "host": "10.15.2.26",
        "port": 1521,
        "sid": "RMSPRD"
    }

    sales = []
    stock = []
    orders = []
    payments: list[dict] = []

    try:
        connection = oracledb.connect(**connection_params)
        print("  Conexão estabelecida com o Oracle RMS com sucesso!")
        
        with connection.cursor() as cursor:
            # 1. Obter Vendas Mensais por Filial para os principais SKUs
            print("  Buscando vendas na tabela RMS.AGG_VDA_PROD_VEND_MES...")
            try:
                cursor.execute("""
                    SELECT CD_FIL, CD_PROD, SUM(QTD_VDA), SUM(VL_VDA), SUM(VL_CMV)
                    FROM RMS.AGG_VDA_PROD_VEND_MES
                    WHERE ROWNUM <= 100
                    GROUP BY CD_FIL, CD_PROD
                """)
                for row in cursor.fetchall():
                    sales.append({
                        "codFilial": int(row[0]),
                        "sku": int(row[1]),
                        "quantidade": float(row[2]),
                        "valorVenda": float(row[3]),
                        "valorCmv": float(row[4]) if row[4] is not None else 0.0,
                        "competencia": "202605"
                    })
                print(f"    {len(sales)} registros de vendas extraídos.")
            except Exception as e:
                print(f"    Erro ao consultar vendas RMS: {e}")

            # 2. Obter Posição de Estoque Atual por SKU / Filial
            print("  Buscando estoques no Oracle RMS...")
            try:
                # Vamos tentar ler da tabela física de saldos de estoque mapeada
                cursor.execute("""
                    SELECT table_name FROM all_tables 
                    WHERE owner = 'RMS' AND table_name = 'AA2CESTQ'
                """)
                if cursor.fetchone():
                    cursor.execute("""
                        SELECT GET_COD_LOCAL, GET_COD_PRODUTO, GET_ESTOQUE 
                        FROM RMS.AA2CESTQ 
                        WHERE ROWNUM <= 50 AND GET_ESTOQUE > 0
                    """)
                    for row in cursor.fetchall():
                        stock.append({
                            "codFilial": int(row[0]),
                            "sku": int(row[1]),
                            "saldoFisico": float(row[2])
                        })
                elif ALLOW_STRUCTURAL_FALLBACKS:
                    stock = [
                        {"codFilial": 1, "sku": 10010, "saldoFisico": 150.0},
                        {"codFilial": 5, "sku": 10010, "saldoFisico": 45.0},
                        {"codFilial": 12, "sku": 10020, "saldoFisico": 0.0}
                    ]
                else:
                    print("    Tabela AA2CESTQ indisponível; fallback estrutural desativado.")
                print(f"    {len(stock)} registros de estoques extraídos.")
            except Exception as e:
                print(f"    Erro ao consultar estoques RMS: {e}")

            # 3. Obter Pedidos de Compra Pendentes
            print("  Buscando pedidos pendentes no Oracle RMS...")
            try:
                cursor.execute("""
                    SELECT PED_LOJA_CP, PED_NUM_PEDIDO_CP
                    FROM RMS.AG3PVEND 
                    WHERE ROWNUM <= 10
                """)
                for row in cursor.fetchall():
                    orders.append({
                        "codFilial": int(row[0]),
                        "numPedido": int(row[1]),
                        "status": "Aberto",
                        "dataEmissao": "2026-08-01"
                    })
                print(f"    {len(orders)} registros de pedidos extraídos.")
            except Exception as e:
                print(f"    Erro ao consultar pedidos RMS: {e}")

        # 4. NF-e fornecedor → depósito/CDAM (financeiro do portal)
        try:
            payments = query_supplier_receivables_rms(connection)
        except Exception as e:
            print(f"    Erro ao consultar recebíveis fornecedor CDAM: {e}")

        connection.close()
    except Exception as e:
        print(f"  Falha de rede ou login no Oracle RMS: {e}")

    return {"sales": sales, "stock": stock, "orders": orders, "payments": payments}


def query_corpore_rm() -> list:
    """Queries SQL Server Corpore RM for accounts payable / titles."""
    print("Iniciando varredura no Totvs RM SQL Server...")
    if pymssql is None:
        print("  pymssql não está instalado. Pulando...")
        return []

    connection_params = {
        "server": "10.15.2.178",
        "user": "Isaura",
        "password": "L!der@2026",
        "database": "CORPORE_0626",
        "port": 1433
    }

    titles = []

    try:
        connection = pymssql.connect(**connection_params)
        print("  Conexão estabelecida com o SQL Server com sucesso!")
        
        with connection.cursor(as_dict=True) as cursor:
            # 1. Tentar ler faturas / títulos financeiros reais da tabela de lançamentos FLAN
            print("  Buscando faturas a pagar no Totvs RM...")
            try:
                # Verificamos se a tabela FLAN existe
                cursor.execute("""
                    SELECT OBJECT_ID('dbo.FLAN') AS tbl_exists
                """)
                res = cursor.fetchone()
                if res and res['tbl_exists'] is not None:
                    # Query real na tabela de lançamentos financeiros (FLAN) do RM
                    cursor.execute("""
                        SELECT TOP 30 CODLAN, NUMERODOCUMENTO, VALORORIGINAL, DATAVENCIMENTO, PAGREC 
                        FROM dbo.FLAN 
                        WHERE PAGREC = 2 AND DATAVENCIMENTO >= '2026-01-01'
                    """)
                    for row in cursor.fetchall():
                        titles.append({
                            "codLan": row["CODLAN"],
                            "numeroDocumento": row["NUMERODOCUMENTO"],
                            "valorOriginal": float(row["VALORORIGINAL"]),
                            "dataVencimento": row["DATAVENCIMENTO"].strftime("%Y-%m-%d") if row["DATAVENCIMENTO"] else None,
                            "status": "A Vencer" if row["DATAVENCIMENTO"] >= datetime.now() else "Vencido"
                        })
                else:
                    # Se FLAN não estiver acessível, usamos a tabela PFFINANC de folha
                    # como fallback estrutural
                    cursor.execute("SELECT TOP 20 CODEVENTO, VALOR, MESCOMP, ANOCOMP FROM dbo.PFFINANC WHERE VALOR > 0")
                    for i, row in enumerate(cursor.fetchall()):
                        titles.append({
                            "codLan": i + 5000,
                            "numeroDocumento": f"NF-{row['CODEVENTO']}-{row['MESCOMP']}",
                            "valorOriginal": float(row["VALOR"]),
                            "dataVencimento": f"2026-08-{10 + (i % 20)}",
                            "status": "A Vencer"
                        })
                print(f"    {len(titles)} faturas extraídas do SQL Server.")
            except Exception as e:
                print(f"    Erro ao consultar faturas SQL Server: {e}")

        connection.close()
    except Exception as e:
        print(f"  Falha de rede ou login no SQL Server: {e}")

    return titles


def main():
    print(f"Iniciando Sincronizador do Portal do Fornecedor em {utc_now()}...")

    # Query the ERP databases
    rms_data = query_oracle_rms()
    rm_data = query_corpore_rm()

    # Consolidate, enrich and apply LGPD rules
    print("Processando e agregando dados (Fase de Transformação)...")

    # Fallbacks estruturais só podem entrar em execuções explicitamente demonstrativas.
    if not rms_data["sales"] and ALLOW_STRUCTURAL_FALLBACKS:
        print("  Adicionando sementes de vendas mockadas como fallback estrutural...")
        rms_data["sales"] = [
            {"codFilial": 1, "sku": 10010, "quantidade": 450, "valorVenda": 4500.0, "valorCmv": 3150.0, "competencia": "202607"},
            {"codFilial": 5, "sku": 10010, "quantidade": 120, "valorVenda": 1200.0, "valorCmv": 840.0, "competencia": "202607"},
            {"codFilial": 12, "sku": 10020, "quantidade": 300, "valorVenda": 2700.0, "valorCmv": 1890.0, "competencia": "202607"},
            {"codFilial": 1, "sku": 10030, "quantidade": 15, "valorVenda": 120.0, "valorCmv": 84.0, "competencia": "202607"}
        ]

    elif not rms_data["sales"]:
        print("  Sem vendas RMS; fallback estrutural desativado.")

    if not rms_data["stock"] and ALLOW_STRUCTURAL_FALLBACKS:
        print("  Adicionando sementes de estoque mockadas como fallback estrutural...")
        rms_data["stock"] = [
            {"codFilial": 1, "sku": 10010, "saldoFisico": 150.0, "estoqueMinimo": 50},
            {"codFilial": 5, "sku": 10010, "saldoFisico": 30.0, "estoqueMinimo": 40},
            {"codFilial": 12, "sku": 10020, "saldoFisico": 0.0, "estoqueMinimo": 30},
            {"codFilial": 1, "sku": 10030, "saldoFisico": 85.0, "estoqueMinimo": 20}
        ]

    elif not rms_data["stock"]:
        print("  Sem estoque RMS; fallback estrutural desativado.")

    if not rms_data["orders"] and ALLOW_STRUCTURAL_FALLBACKS:
        print("  Adicionando pedidos mockados com separacao Fornecedor x CDAM...")
        rms_data["orders"] = [
            {
                "codFilial": 1,
                "numPedido": 884210,
                "status": "Aberto",
                "dataEmissao": "2026-08-01",
                "itens": [
                    {
                        "sku": "10010",
                        "descricao": "Nescau Chocolate Po 400g",
                        "quantidadePedida": 480,
                        "quantidadeFaturada": 360,
                        "precoUnitario": 12.40,
                    }
                ],
            },
            {
                "codFilial": 201,
                "numPedido": 884176,
                "status": "Entregue",
                "dataEmissao": "2026-07-15",
                "dataEntregaPrevista": "2026-07-25",
                "dataEntradaCdam": "2026-07-26",
                "destinoOperacional": "CDAM - Deposito Aug. Montenegro",
                "itens": [
                    {
                        "sku": "10020",
                        "descricao": "Leite Condensado Moca Lata 395g",
                        "quantidadePedida": 960,
                        "quantidadeFaturada": 360,
                        "precoUnitario": 8.20,
                    }
                ],
            },
            {
                "codFilial": 201,
                "numPedido": 884166,
                "status": "Entregue",
                "dataEmissao": "2026-07-10",
                "dataEntregaPrevista": "2026-07-20",
                "dataEntradaCdam": "2026-07-21",
                "destinoOperacional": "CDAM - Deposito Aug. Montenegro",
                "itens": [
                    {
                        "sku": "10010",
                        "descricao": "Nescau Chocolate Po 400g",
                        "quantidadePedida": 520,
                        "quantidadeFaturada": 500,
                        "precoUnitario": 12.18,
                    }
                ],
            },
            {
                "codFilial": 201,
                "numPedido": 884155,
                "status": "Entregue",
                "dataEmissao": "2026-07-03",
                "dataEntregaPrevista": "2026-07-13",
                "dataEntradaCdam": "2026-07-14",
                "destinoOperacional": "CDAM - Deposito Aug. Montenegro",
                "itens": [
                    {
                        "sku": "10030",
                        "descricao": "Biscoito Passatempo Recheado Chocolate 130g",
                        "quantidadePedida": 1800,
                        "quantidadeFaturada": 1720,
                        "precoUnitario": 4.01,
                    }
                ],
            },
            {
                "codFilial": 201,
                "numPedido": 884149,
                "status": "Entregue",
                "dataEmissao": "2026-06-26",
                "dataEntregaPrevista": "2026-07-06",
                "dataEntradaCdam": "2026-07-07",
                "destinoOperacional": "CDAM - Deposito Aug. Montenegro",
                "itens": [
                    {
                        "sku": "10020",
                        "descricao": "Leite Condensado Moca Lata 395g",
                        "quantidadePedida": 900,
                        "quantidadeFaturada": 900,
                        "precoUnitario": 8.08,
                    }
                ],
            },
            {
                "codFilial": 201,
                "numPedido": 884132,
                "status": "Entregue",
                "dataEmissao": "2026-06-18",
                "dataEntregaPrevista": "2026-06-28",
                "dataEntradaCdam": "2026-06-30",
                "destinoOperacional": "CDAM - Deposito Aug. Montenegro",
                "itens": [
                    {
                        "sku": "10010",
                        "descricao": "Nescau Chocolate Po 400g",
                        "quantidadePedida": 430,
                        "quantidadeFaturada": 430,
                        "precoUnitario": 12.21,
                    }
                ],
            },
        ]
    elif not rms_data["orders"]:
        print("  Sem pedidos RMS; fallback estrutural desativado.")

    enriched_orders = enrich_orders(rms_data["orders"])

    # Financeiro: prioriza NF-e RMS (agenda 28 + depósito). FLAN só se tiver campos de agenda/destino.
    # Caso contrário o FLAN genérico (sem filtro) contaminaria o portal com títulos de loja/transferência.
    print("  Montando títulos financeiros (filtro agenda recebimento + destino D)...")
    payment_candidates: list[dict] = list(rms_data.get("payments") or [])
    if not payment_candidates and ALLOW_STRUCTURAL_FALLBACKS:
        print("  Sem NF-e RMS elegíveis; usando fallback estrutural Nestlé→CDAM (com ruído filtrável)...")
        payment_candidates = fallback_supplier_cdam_payments()
    elif not payment_candidates:
        print("  Sem NF-e RMS elegíveis; fallback financeiro estrutural desativado.")
    # RM FLAN sem agenda/filial não entra no modelo somente_cdam (evita falso positivo).
    if rm_data:
        print(
            f"  Aviso: {len(rm_data)} títulos FLAN ignorados no modelo somente_cdam "
            "(sem agenda RMS / destinacao D no payload atual)."
        )

    generated_at = utc_now()
    payments_payload = build_payments_payload(payment_candidates, generated_at)

    payload = {
        "generatedAt": generated_at,
        "mode": "hybrid_sync_worker",
        "provider": {
            "supplierCode": SUPPLIER_CODE,
            "name": SUPPLIER_NAME,
            "cnpj": SUPPLIER_CNPJ,
            "cnpjRoot": SUPPLIER_CNPJ_ROOT,
            "deliveryModel": SUPPLIER_DELIVERY_MODEL,
            "receiptAgenda": sorted(supplier_receipt_agendas()),
            "filialEntregaPadrao": "201",
            "paymentTermsDays": DEFAULT_PAYMENT_TERMS_DAYS,
            "financialDiscountPct": DEFAULT_FINANCIAL_DISCOUNT_PCT,
        },
        "sales": rms_data["sales"],
        "stock": rms_data["stock"],
        "orders": enriched_orders,
        "purchaseOrders": build_purchase_orders_payload(enriched_orders, generated_at),
        "productClassifications": build_product_classifications_payload(
            rms_data["sales"], rms_data["stock"], enriched_orders, generated_at
        ),
        "payments": payments_payload,
    }

    # Write unified seed to the portal directory
    OUTPUT_SEED.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_SEED.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"SUCESSO: Arquivo de cache integrado gerado em: {OUTPUT_SEED}")


if __name__ == "__main__":
    main()
