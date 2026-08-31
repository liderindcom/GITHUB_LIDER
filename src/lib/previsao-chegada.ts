/** Previsão de chegada por fluxo de entrega. */

export type FluxoEntrega = "diretissimo" | "direto_loja" | "estocado";

export const DIAS_PREVISAO_CHEGADA: Record<FluxoEntrega, number> = {
  diretissimo: 2,
  direto_loja: 5,
  estocado: 15,
};

export const rotuloFluxoEntrega: Record<FluxoEntrega, string> = {
  diretissimo: "Diretíssimo",
  direto_loja: "Direto loja",
  estocado: "Estocado",
};

export function fluxoEntregaDeSistematica(raw?: string | null): FluxoEntrega | null {
  const s = String(raw ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!s) return null;
  if (s.includes("DIRETISSIM") || s === "DIRET" || s === "20") return "diretissimo";
  // RMS: 10 e 11 = direto loja (texto "10" ou "D. LOJA")
  if (
    s === "10" ||
    s === "11" ||
    s.includes("LOJA") ||
    s.includes("DIRETO")
  ) {
    return "direto_loja";
  }
  // RMS: 1 / ESTOCADO
  if (s === "1" || s.includes("ESTOC")) return "estocado";
  return "estocado";
}

export function fluxoPredominante(fluxos: Array<FluxoEntrega | null | undefined>): FluxoEntrega {
  const counts: Record<FluxoEntrega, number> = {
    diretissimo: 0,
    direto_loja: 0,
    estocado: 0,
  };
  for (const fluxo of fluxos) {
    if (fluxo) counts[fluxo] += 1;
  }
  const ordenado = (Object.entries(counts) as [FluxoEntrega, number][]).sort((a, b) => b[1] - a[1]);
  if (ordenado[0][1] === 0) return "estocado";
  return ordenado[0][0];
}

export function somarDiasIso(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function previsaoChegadaIso(baseIso: string | null | undefined, fluxo: FluxoEntrega): string {
  const dias = DIAS_PREVISAO_CHEGADA[fluxo];
  const base = String(baseIso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
  return somarDiasIso(base, dias);
}
