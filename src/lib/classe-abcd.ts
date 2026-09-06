/** Curva ABCD do portal: valor (1ª letra) + volume (2ª letra minúscula). */

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
  /** Grupo de consolidação da quantidade; por padrão usa `grupo`. */
  grupoQuantidade?: string;
  valor: number;
  volume: number;
};

export type ResultadoCurvaAbcd = {
  classeValor: ClasseAbcd;
  classeVolume: ClasseAbcd;
  classeComposta: string;
};

function classificarDimensao(
  itens: ItemCurvaAbcd[],
  chaveGrupo: (item: ItemCurvaAbcd) => string,
  valorItem: (item: ItemCurvaAbcd) => number,
): Map<string, ClasseAbcd> {
  const classes = new Map<string, ClasseAbcd>();
  const porGrupo = new Map<string, ItemCurvaAbcd[]>();
  for (const item of itens) {
    const grupo = chaveGrupo(item);
    const lista = porGrupo.get(grupo) ?? [];
    lista.push(item);
    porGrupo.set(grupo, lista);
  }

  for (const grupoItens of porGrupo.values()) {
    const ordenados = [...grupoItens].sort(
      (a, b) => valorItem(b) - valorItem(a) || a.sku.localeCompare(b.sku),
    );
    const total = ordenados.reduce((acc, item) => acc + valorItem(item), 0);
    let acumulado = 0;
    for (const item of ordenados) {
      const pct = total > 0 ? (acumulado / total) * 100 : 100;
      classes.set(item.sku, classeAbcdAcumulado(pct));
      acumulado += valorItem(item);
    }
  }

  return classes;
}

function combinarClasses(
  classeValor: Map<string, ClasseAbcd>,
  classeVolume: Map<string, ClasseAbcd>,
): Map<string, ResultadoCurvaAbcd> {
  const saida = new Map<string, ResultadoCurvaAbcd>();
  for (const [sku, valor] of classeValor) {
    const volume = classeVolume.get(sku) ?? "D";
    saida.set(sku, {
      classeValor: valor,
      classeVolume: volume,
      classeComposta: formatarClasseComposta(`${valor}${volume}`),
    });
  }
  return saida;
}

export function classificarCurvaAbcd(itens: ItemCurvaAbcd[]): Map<string, ResultadoCurvaAbcd> {
  const classeValor = classificarDimensao(itens, (item) => item.grupo, (item) => item.valor);
  const classeVolume = classificarDimensao(itens, (item) => item.grupo, (item) => item.volume);
  return combinarClasses(classeValor, classeVolume);
}

/** Top Star: valor por subgrupo e quantidade consolidada no grupo. */
export function classificarCurvaTopStar(itens: ItemCurvaAbcd[]): Map<string, ResultadoCurvaAbcd> {
  const classeValor = classificarDimensao(itens, (item) => item.grupo, (item) => item.valor);
  const classeVolume = classificarDimensao(
    itens,
    (item) => item.grupoQuantidade ?? item.grupo,
    (item) => item.volume,
  );
  return combinarClasses(classeValor, classeVolume);
}
