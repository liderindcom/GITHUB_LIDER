/** Código fiscal RMS, sem prefixo. Aceita FORN- legado e hífen do dígito (100561-8). */
export const DEMO_FORNECEDOR_CODIGO = "704894";

export function soDigitos(code: string | null | undefined): string {
  return String(code ?? "")
    .trim()
    .replace(/^FORN-/i, "")
    .replace(/\D/g, "");
}

/** Dígito verificador RMS (módulo 11, pesos 2..9 da direita para a esquerda). Nestlé 100561 → 8. */
export function digitoVerificadorFornecedor(codigo: string | null | undefined): string {
  const d = soDigitos(codigo);
  if (!d) return "";
  let peso = 2;
  let soma = 0;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

export function normalizarCodigoFornecedor(code: string | null | undefined): string {
  const raw = String(code ?? "")
    .trim()
    .replace(/^FORN-/i, "")
    .trim();
  if (!raw) return "";
  if (raw.includes("-")) {
    const partes = raw.split("-");
    const base = soDigitos(partes[0] ?? "");
    const dv = soDigitos(partes.slice(1).join(""));
    if (base && dv && digitoVerificadorFornecedor(base) === dv) return base;
    return `${base}${dv}`;
  }
  const n = soDigitos(raw);
  if (n.length >= 5) {
    const base = n.slice(0, -1);
    const dv = n.slice(-1);
    if (digitoVerificadorFornecedor(base) === dv) return base;
  }
  return n;
}

/** Exibe o código RMS com o dígito verdadeiro: 100561 → 100561-8. */
export function formatarCodigoFornecedorComDigito(codigo: string | null | undefined): string {
  const num = normalizarCodigoFornecedor(codigo);
  if (!/^\d+$/.test(num) || num.length < 2) return num;
  return `${num}-${digitoVerificadorFornecedor(num)}`;
}
