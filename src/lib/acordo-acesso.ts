/** Desconto financeiro exigido para liberar o portal: 1% das compras do mês anterior. */
export const DESCONTO_ACESSO_PORTAL_PCT = 1;

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
  "106": "NUTRILIDER",
  "201": "MAGAZAN",
  "203": "MAGAZAN",
  "204": "MAGAZAN",
  "208": "MAGAZAN",
  "209": "MAGAZAN",
  "212": "MAGAZAN",
  "213": "MAGAZAN",
  "214": "MAGAZAN",
  "215": "MAGAZAN",
  "216": "MAGAZAN",
  "217": "MAGAZAN",
  "219": "MAGAZAN",
  "222": "MAGAZAN",
  "226": "MAGAZAN",
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
