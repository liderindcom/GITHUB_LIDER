/** Contrato de grãos do portal.db — o que cada tela pode ler. */

export const JANELA_VENDAS_LOJA_DIAS = 30;
export const JANELA_SKU_DIA_DIAS = 90;
export const JANELA_MENSAL_MESES = 24;

export type ShareJanelaGrao = "30" | "60" | "90" | "180" | "365" | "tudo";

/** Share curto permanece na diária; longo vai para vendas_mensal. */
export const shareUsaMensal = (janela: ShareJanelaGrao): boolean =>
  janela === "180" || janela === "365" || janela === "tudo";

export const GRAOS = {
  vendas: { tabela: "vendas", dimensoes: "loja×dia×sku", janelaDias: JANELA_VENDAS_LOJA_DIAS },
  vendasMensal: { tabela: "vendas_mensal", dimensoes: "sku×mês", janelaMeses: JANELA_MENSAL_MESES },
  vendasSubgrupo: { tabela: "vendas_subgrupo", dimensoes: "subgrupo×dia", janelaDias: 180 },
  estoque: { tabela: "estoque", dimensoes: "sku×loja", janela: "snapshot" },
} as const;
