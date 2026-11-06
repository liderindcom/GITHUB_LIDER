/** Lojas fora do recorte comercial do relatório Vendas por Loja. */
const LOJAS_EXCLUIDAS = [
  ["15", "159"],
  ["21", "213"],
  ["22", "221"],
  ["29", "291"],
  ["30", "308"],
  ["34", "345"],
  ["35", "353"], // Panificadora Líder
  ["39", "399"],
] as const;

const idsExcluidos = new Set(LOJAS_EXCLUIDAS.flat());

export const lojaForaRelatorioVendas = (id: string): boolean => {
  const cru = String(id ?? "").trim();
  if (!cru) return false;
  if (idsExcluidos.has(cru)) return true;
  return idsExcluidos.has(cru.replace(/^0+(?=\d)/, ""));
};

export const sqlLojasForaRelatorioVendas = [...idsExcluidos].map((id) => `'${id}'`).join(",");
