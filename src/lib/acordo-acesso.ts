import { mesFechadoIso } from "./pedidos-janela";

/** Desconto financeiro exigido para liberar o portal: 1% das compras do mês anterior. */
export const DESCONTO_ACESSO_PORTAL_PCT = 1;

export function fornecedorAcessoRestrito(fornecedor: {
  isentoCobranca?: number | null;
  acessoStatus?: string | null;
  acessoDataInicio?: string | null;
  acessoDataFim?: string | null;
  carenciaAte?: string | null;
  primeiraCompetenciaCobravel?: string | null;
  ultimoAcordoMes?: string | null;
}) {
  if (Number(fornecedor.isentoCobranca) === 1) return false;
  const inicio = String(fornecedor.acessoDataInicio ?? "").slice(0, 10);
  const carenciaAte = String(fornecedor.carenciaAte ?? "").slice(0, 10);
  if (!inicio) return true;
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  if (hojeIso < inicio) return true;

  if (carenciaAte && hojeIso <= carenciaAte) return false;

  // O acordo do mês fechado pode ser lançado até o dia 10 do mês seguinte.
  const competenciaObrigatoria = mesFechadoIso(hoje);
  const primeiraCompetencia = String(fornecedor.primeiraCompetenciaCobravel ?? "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(primeiraCompetencia) && competenciaObrigatoria < primeiraCompetencia) {
    return false;
  }
  if (hoje.getDate() <= 10) return false;
  const ultimoAcordoMes = String(fornecedor.ultimoAcordoMes ?? "").slice(0, 7);
  if (ultimoAcordoMes >= competenciaObrigatoria) return false;

  // Sem acordo do mês fechado após o prazo, bloqueia até a regularização.
  return true;
}

export const TAXAS_ACESSO_PORTAL_PCT = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5] as const;
export type TaxaAcessoPortalPct = (typeof TAXAS_ACESSO_PORTAL_PCT)[number];

export function normalizarTaxaAcessoPortalPct(valor: unknown): TaxaAcessoPortalPct {
  const numero = Number(valor);
  return (TAXAS_ACESSO_PORTAL_PCT as readonly number[]).includes(numero)
    ? (numero as TaxaAcessoPortalPct)
    : DESCONTO_ACESSO_PORTAL_PCT;
}

/** Segmentos oficiais do InteLider/CometNet — não existem como campo no RMS. */
export const SEGMENTOS_INTELIDER = [
  "SUPERMERCADO",
  "MAGAZAN",
  "FARMALIDER",
  "HOME CENTER",
  "OTICA",
  "PETSLIDER",
  "NUTRILIDER",
  "OUTROS",
] as const;

const DEPT_PARA_SEGMENTO: Record<string, string> = {
  "100": "SUPERMERCADO",
  "102": "SUPERMERCADO",
  "103": "SUPERMERCADO",
  "105": "SUPERMERCADO",
  "600": "SUPERMERCADO",
  "300": "FARMALIDER",
  "110": "HOME CENTER",
  "115": "HOME CENTER",
  "221": "OTICA",
  "104": "PETSLIDER",
  "999": "PETSLIDER",
  "206": "MAGAZAN",
  "99": "OUTROS",
  "400": "OUTROS",
  "650": "OUTROS",
  "700": "OUTROS",
  "106": "NUTRILIDER",
  "201": "MAGAZAN",
  "202": "MAGAZAN",
  "203": "MAGAZAN",
  "204": "MAGAZAN",
  "205": "MAGAZAN",
  "207": "MAGAZAN",
  "208": "MAGAZAN",
  "209": "MAGAZAN",
  "210": "MAGAZAN",
  "211": "MAGAZAN",
  "212": "MAGAZAN",
  "213": "MAGAZAN",
  "214": "MAGAZAN",
  "215": "MAGAZAN",
  "216": "MAGAZAN",
  "217": "MAGAZAN",
  "219": "MAGAZAN",
  "220": "MAGAZAN",
  "222": "MAGAZAN",
  "223": "MAGAZAN",
  "224": "MAGAZAN",
  "225": "MAGAZAN",
  "226": "MAGAZAN",
  "227": "MAGAZAN",
  "228": "MAGAZAN",
  "500": "MAGAZAN",
};

export function valorUmPctCompra(compra: number, pct = DESCONTO_ACESSO_PORTAL_PCT) {
  return Math.round(compra * (pct / 100) * 100) / 100;
}

function codigoDepartamento(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  const doCodigo = t.match(/^(\d+)/);
  if (doCodigo?.[1]) return String(Number(doCodigo[1]));
  return t.replace(/^0+/, "") || "";
}

/** Departamento RMS → segmento InteLider (SUPERMERCADO, MAGAZAN, FARMALIDER…). */
export function segmentoIntelider(
  departamentoCodigo?: string | null,
  departamentoNome?: string | null,
): string {
  const cod = codigoDepartamento(departamentoCodigo);
  if (cod && DEPT_PARA_SEGMENTO[cod]) return DEPT_PARA_SEGMENTO[cod];
  const t = String(departamentoNome ?? "").toUpperCase();
  if (/PETSLIDER|PETS[\s-]?LIDER/.test(t)) return "PETSLIDER";
  if (/NUTRILIDER/.test(t)) return "NUTRILIDER";
  if (/FARMAC/.test(t)) return "FARMALIDER";
  if (/HOME CENTER|HOMECENTER/.test(t)) return "HOME CENTER";
  if (/OTIC/.test(t)) return "OTICA";
  if (/SUPERMERCADO/.test(t)) return "SUPERMERCADO";
  if (
    /MODA|CALCAD|LINGERIE|MAGAZAN|BEBES|INFANTIL|CAMA MESA|BAZAR|BRINQUEDO|PERFUMARIA|PAPELARIA|CELULAR|INFORMATICA/.test(
      t,
    )
  ) {
    return "MAGAZAN";
  }
  return "OUTROS";
}
