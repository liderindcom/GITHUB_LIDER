/** Curva ABCD única do portal. Valor (1ª letra) + volume (2ª letra minúscula): Aa, Bc, Dd. */

export type ClasseAbcd = "A" | "B" | "C" | "D";

export const classeAbcdAcumulado = (pctAnterior: number): ClasseAbcd => {
  if (pctAnterior < 50) return "A";
  if (pctAnterior < 80) return "B";
  if (pctAnterior < 98) return "C";
  return "D";
};

export function formatarClasseComposta(classe?: string | null): string {
  const raw = String(classe || "Dd").trim();
  const valor = (raw[0] || "D").toUpperCase();
  const volume = (raw[1] || "d").toLowerCase();
  return `${valor}${volume}`;
}

export type ItemCurvaAbcd = {
  sku: string;
  grupo: string;
  valor: number;
  volume: number;
};

export type ResultadoCurvaAbcd = {
  classeValor: ClasseAbcd;
  classeVolume: ClasseAbcd;
  classeComposta: string;
};

export function classificarCurvaAbcd(itens: ItemCurvaAbcd[]): Map<string, ResultadoCurvaAbcd> {
  const saida = new Map<string, ResultadoCurvaAbcd>();
  const porGrupo = new Map<string, ItemCurvaAbcd[]>();
  for (const item of itens) {
    const lista = porGrupo.get(item.grupo) ?? [];
    lista.push(item);
    porGrupo.set(item.grupo, lista);
  }

  for (const grupoItens of porGrupo.values()) {
    const porValor = [...grupoItens].sort((a, b) => b.valor - a.valor);
    const totalValor = porValor.reduce((acc, item) => acc + item.valor, 0);
    let acumuladoValor = 0;
    const classeValor = new Map<string, ClasseAbcd>();
    for (const item of porValor) {
      const pct = totalValor > 0 ? (acumuladoValor / totalValor) * 100 : 100;
      classeValor.set(item.sku, classeAbcdAcumulado(pct));
      acumuladoValor += item.valor;
    }

    const porVolume = [...grupoItens].sort((a, b) => b.volume - a.volume);
    const totalVolume = porVolume.reduce((acc, item) => acc + item.volume, 0);
    let acumuladoVolume = 0;
    for (const item of porVolume) {
      const pct = totalVolume > 0 ? (acumuladoVolume / totalVolume) * 100 : 100;
      const volume = classeAbcdAcumulado(pct);
      const valor = classeValor.get(item.sku) ?? "D";
      saida.set(item.sku, {
        classeValor: valor,
        classeVolume: volume,
        classeComposta: formatarClasseComposta(`${valor}${volume}`),
      });
      acumuladoVolume += item.volume;
    }
  }

  return saida;
}
