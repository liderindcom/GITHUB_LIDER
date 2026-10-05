/** Seções e dias de faturamento informados pelo menu Reforço de Faturamento do CometNet. */
export const GRUPOS_REFORCO: Record<number, string[]> = {
  1: ["001", "004", "005", "008", "010", "012", "013", "014", "025", "028", "030", "031", "006", "021", "070"],
  2: ["002", "015", "017", "019", "034", "037", "044", "054", "062", "072", "074", "016", "021", "076", "081", "082", "084", "085", "086", "088"],
  3: ["009", "011", "020", "023", "024", "033", "038", "041", "043", "006", "021", "055", "060", "061"],
  4: ["032", "036"],
  5: ["003", "007", "016", "022", "026", "027", "033", "029", "039", "051", "052", "053", "064", "065", "001", "002", "004", "006", "010", "017", "021", "075", "080", "087", "089", "092", "096"],
  6: ["073", "076", "093", "097", "098", "233", "268", "270", "271"],
  7: ["225"],
  8: ["057"],
};

export const LOJAS_AGENDAMENTO_PERMITIDAS = ["201", "203"] as const;

const DIA_FATURAMENTO_POR_GRUPO: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 1,
  6: 1,
  7: 4,
  8: 4,
};

export function gruposDasSecoes(secoes: string[]): number[] {
  const informadas = new Set(secoes.map((secao) => secao.replace(/\D/g, "").padStart(3, "0")));
  return Object.entries(GRUPOS_REFORCO)
    .filter(([, grupoSecoes]) => grupoSecoes.some((secao) => informadas.has(secao)))
    .map(([grupo]) => Number(grupo));
}

export function faturamentoBloqueiaData(secoes: string[], dataIso: string): number[] {
  if (!dataIso) return [];
  const diaSemana = new Date(`${dataIso}T12:00:00`).getDay() || 7;
  return gruposDasSecoes(secoes).filter((grupo) => DIA_FATURAMENTO_POR_GRUPO[grupo] === diaSemana);
}
