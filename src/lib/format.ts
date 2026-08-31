export const brl = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const numero = (valor: number) => valor.toLocaleString("pt-BR");

export const percentual = (valor: number) =>
  `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const dataBR = (iso: string) => {
  if (!iso || iso === "sem-data") return "Sem data";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
};
