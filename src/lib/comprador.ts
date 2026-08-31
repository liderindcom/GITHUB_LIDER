import type { Produto } from "@/lib/mock-data";

const nomeGenerico = (codigo: string) => `Comprador ${codigo}`;

export function mapaNomesComprador(lista: Produto[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const produto of lista) {
    const codigo = produto.compradorCodigo?.trim();
    const nome = produto.compradorNome?.trim();
    if (!codigo || !nome || nome === nomeGenerico(codigo)) continue;
    if (!mapa.has(codigo)) mapa.set(codigo, nome);
  }
  return mapa;
}

export function nomeComprador(produto: Produto, mapa?: Map<string, string>): string {
  const codigo = produto.compradorCodigo?.trim();
  const nome = produto.compradorNome?.trim();
  if (nome && (!codigo || nome !== nomeGenerico(codigo))) return nome;
  if (codigo && mapa?.get(codigo)) return mapa.get(codigo)!;
  if (nome) return nome;
  return "Comprador não informado";
}

export const compradorProduto = (produto: Produto, mapa?: Map<string, string>) => {
  const codigo = produto.compradorCodigo?.trim();
  const nome = nomeComprador(produto, mapa);
  if (nome !== "Comprador não informado") {
    if (codigo && nome !== nomeGenerico(codigo)) return `${codigo} - ${nome}`;
    return nome;
  }
  if (codigo) return nomeGenerico(codigo);
  return "Comprador não informado";
};

export const compradoresProdutos = (produtos: Produto[]) => {
  const mapa = mapaNomesComprador(produtos);
  const compradores = Array.from(new Set(produtos.map((p) => compradorProduto(p, mapa)))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  if (compradores.length === 0) return "Comprador não informado";
  return compradores.join("; ");
};

/** Comprador(es) do pedido a partir dos SKUs. Vários códigos viram lista. */
export function compradorPedido(
  itens: Array<{ sku: string }>,
  resolver: (sku: string) => Produto,
  catalogo?: Produto[],
): string {
  if (!itens.length) return "Comprador não informado";
  const mapa = catalogo ? mapaNomesComprador(catalogo) : undefined;
  const vistos = new Set<string>();
  for (const item of itens) {
    vistos.add(compradorProduto(resolver(item.sku), mapa));
  }
  const conhecidos = [...vistos].filter((nome) => nome !== "Comprador não informado");
  if (conhecidos.length > 0) {
    return conhecidos.sort((a, b) => a.localeCompare(b, "pt-BR")).join("; ");
  }
  return "Comprador não informado";
}
