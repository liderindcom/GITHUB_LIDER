/** Número técnico do pedido RMS (NROPED), sem prefixo PC- e sem dígito. */
export function numeroPedidoBase(numero: string | null | undefined): string {
  const raw = String(numero ?? "").trim();
  if (!raw) return "";
  const semPrefixo = raw.replace(/^PC-/i, "");
  if (semPrefixo.includes("-")) {
    return (semPrefixo.split("-")[0] ?? "").replace(/\D/g, "") || semPrefixo;
  }
  return semPrefixo.replace(/\D/g, "") || semPrefixo;
}

/**
 * Dígito verificador do pedido RMS (DIGPED): módulo 11, pesos 2..9 da direita
 * para a esquerda. Conferido em AG1LPEDI.DIGPED_CAR / AG1FLPED.DIGPED_CARF.
 */
export function digitoVerificadorPedido(numero: string | null | undefined): string {
  const d = numeroPedidoBase(numero);
  if (!d || !/^\d+$/.test(d)) return "";
  let peso = 2;
  let soma = 0;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

/** Exibe o pedido como no RMS: 59937 → 59937-9. */
export function formatarNumeroPedido(numero: string | null | undefined): string {
  const raw = String(numero ?? "").trim();
  if (!raw) return "";
  const semPrefixo = raw.replace(/^PC-/i, "");
  if (semPrefixo.includes("-")) {
    const [base, ...resto] = semPrefixo.split("-");
    const baseD = (base ?? "").replace(/\D/g, "");
    const dv = resto.join("").replace(/\D/g, "");
    if (baseD && dv) return `${baseD}-${dv}`;
    return semPrefixo;
  }
  const digits = semPrefixo.replace(/\D/g, "");
  if (!digits) return semPrefixo;
  const dv = digitoVerificadorPedido(digits);
  return dv ? `${digits}-${dv}` : digits;
}
