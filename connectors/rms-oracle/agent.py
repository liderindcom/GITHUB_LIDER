#!/usr/bin/env python3
"""Agente RMS local: leitura Oracle, fila idempotente e envio HTTPS ao Portal."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or not value.strip():
        raise SystemExit(f"Variável obrigatória ausente: {name}")
    return value.strip()


def json_value(value: object) -> object:
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()  # type: ignore[union-attr]
    return value


def carregar_sql() -> str:
    caminho = Path(env("ORACLE_SQL_FILE", str(ROOT / "agenda_520.sql")))
    if not caminho.is_absolute():
        caminho = ROOT / caminho
    sql = caminho.read_text(encoding="utf-8").strip().rstrip(";")
    if not sql:
        raise SystemExit(f"SQL vazio: {caminho}")
    return sql


def consultar() -> list[dict[str, object]]:
    try:
        import oracledb
    except ImportError as exc:  # pragma: no cover - dependência da instalação local
        raise SystemExit("Instale python-oracledb no servidor do RMS") from exc
    params = {
        "user": env("ORACLE_USER"),
        "password": env("ORACLE_PASSWORD"),
        "host": env("ORACLE_HOST", "127.0.0.1"),
        "port": int(env("ORACLE_PORT", "1521")),
    }
    if os.environ.get("ORACLE_SID", "").strip():
        params["sid"] = os.environ["ORACLE_SID"].strip()
    else:
        params["service_name"] = env("ORACLE_SERVICE_NAME")
    connection = oracledb.connect(**params)
    try:
        cursor = connection.cursor()
        cursor.arraysize = 1000
        cursor.execute(carregar_sql())
        nomes = [str(item[0]).lower() for item in cursor.description]
        obrigatorias = {
            "data", "fornecedor_codigo", "loja_codigo", "numero_nota", "serie",
            "sku", "quantidade", "valor_unitario", "valor_total",
        }
        faltantes = obrigatorias - set(nomes)
        if faltantes:
            raise RuntimeError(f"SQL não possui aliases obrigatórios: {sorted(faltantes)}")
        linhas: list[dict[str, object]] = []
        for row in cursor:
            registro = {nome: json_value(valor) for nome, valor in zip(nomes, row)}
            registro["schema"] = "agenda_520_perdas_v1"
            registro["idempotency_key"] = hashlib.sha256(
                "|".join(str(registro.get(chave, "")) for chave in (
                    "data", "fornecedor_codigo", "loja_codigo", "numero_nota", "serie", "sku"
                )).encode("utf-8")
            ).hexdigest()
            linhas.append(registro)
        return linhas
    finally:
        connection.close()


def gravar_fila(linhas: list[dict[str, object]]) -> Path:
    caminho = Path(env("QUEUE_FILE", str(ROOT / "connector-queue.jsonl")))
    if not caminho.is_absolute():
        caminho = ROOT / caminho
    with caminho.open("a", encoding="utf-8") as arquivo:
        for linha in linhas:
            arquivo.write(json.dumps(linha, ensure_ascii=False) + "\n")
    return caminho


def enviar(linhas: list[dict[str, object]]) -> None:
    payload = {
        "schema": "agenda_520_perdas_v1",
        "connector_id": env("PORTAL_CONNECTOR_ID"),
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "records": linhas,
    }
    request = urllib.request.Request(
        env("PORTAL_INGEST_URL"),
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {env('PORTAL_CONNECTOR_TOKEN')}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=int(env("REQUEST_TIMEOUT_SECONDS", "45"))) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Portal respondeu HTTP {response.status}")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Portal indisponível: {exc}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="consulta e mostra totais, sem fila/envio")
    parser.add_argument("--send", action="store_true", help="consulta e envia ao Portal")
    args = parser.parse_args()
    if args.dry_run and args.send:
        parser.error("use somente --dry-run ou --send")
    linhas = consultar()
    total = sum(float(linha.get("valor_total") or 0) for linha in linhas)
    print(json.dumps({"registros": len(linhas), "valor_total": round(total, 2)}, ensure_ascii=False))
    if args.dry_run or not args.send:
        return 0
    try:
        enviar(linhas)
        print(json.dumps({"enviados": len(linhas)}, ensure_ascii=False))
    except RuntimeError as exc:
        fila = gravar_fila(linhas)
        print(json.dumps({"enviados": 0, "enfileirados": len(linhas), "fila": str(fila), "erro": str(exc)}, ensure_ascii=False))
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
