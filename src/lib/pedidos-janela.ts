/** Janela do menu Pedidos e do SELECT local: emissão neste intervalo. */
export const JANELA_PEDIDOS_DIAS = 60;

export function cortePedidosIso(agora = new Date()): string {
  const corte = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  corte.setDate(corte.getDate() - JANELA_PEDIDOS_DIAS);
  const y = corte.getFullYear();
  const m = String(corte.getMonth() + 1).padStart(2, "0");
  const d = String(corte.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mesAtualIso(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM do último mês fechado (não o mês corrente). */
export function mesFechadoIso(agora = new Date()): string {
  const y = agora.getFullYear();
  const m = agora.getMonth(); // 0-11
  const fechado = m === 0 ? new Date(y - 1, 11, 1) : new Date(y, m - 1, 1);
  return `${fechado.getFullYear()}-${String(fechado.getMonth() + 1).padStart(2, "0")}`;
}

export function rotuloMesAno(anoMes: string): string {
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const [ano, mes] = (anoMes || "").split("-");
  const idx = Number(mes) - 1;
  if (!ano || idx < 0 || idx > 11) return anoMes;
  return `${nomes[idx]}/${ano}`;
}

export function emissaoNosUltimosDias(
  emissao: string,
  dias = JANELA_PEDIDOS_DIAS,
  agora = new Date(),
): boolean {
  const raw = (emissao || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [ano, mes, dia] = raw.split("-").map(Number);
  const dt = new Date(ano, mes - 1, dia);
  const corte = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  corte.setDate(corte.getDate() - dias);
  return dt >= corte;
}
