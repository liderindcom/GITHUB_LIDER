import { fetchVendasAnual, type VendasAnualDB } from "@/api";

const cache = new Map<string, Promise<VendasAnualDB>>();

function chaveCache(codigoFornecedor: string, versao: number | string) {
  return `${codigoFornecedor}:${versao}`;
}

export function prefetchVendasAnual(
  codigoFornecedor: string,
  versao: number | string,
): Promise<VendasAnualDB> {
  const chave = chaveCache(codigoFornecedor, versao);
  const existente = cache.get(chave);
  if (existente) return existente;

  const carregamento = fetchVendasAnual({ data: codigoFornecedor }).catch((erro) => {
    cache.delete(chave);
    throw erro;
  });
  cache.set(chave, carregamento);
  return carregamento;
}

