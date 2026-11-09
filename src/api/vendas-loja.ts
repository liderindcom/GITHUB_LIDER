import { createServerFn } from "@tanstack/react-start";

import { soDigitos } from "@/lib/fornecedor-codigo";
import {
  FILTRO_VAZIO,
  filtroMercadologicoAtivo,
  produtoPassaFiltro,
  type FiltroMercadologico,
} from "@/lib/filtro-mercadologico";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import { sqlLojasForaRelatorioVendas } from "@/lib/lojas-excluidas-vendas";
import { JANELA_VENDAS_LOJA_DIAS } from "@/lib/vendas-graos";

import { db } from "../server/db";
import { codigoFornecedorEfetivo } from "../server/sessao-portal";
import { sqlSkuVisivel, tabelaExiste } from "./db-support";

export type VendaPorLojaDiaDB = {
  data: string;
  lojaId: string;
  quantidade: number;
  faturamento: number;
  skus: number;
};

export type VendaPorLojaItemDB = {
  lojaId: string;
  sku: string;
  descricao: string;
  quantidade: number;
  faturamento: number;
  dias: number;
};

export type VendasPorLojaDB = {
  inicio: string | null;
  fim: string | null;
  dias: number;
  linhas: VendaPorLojaDiaDB[];
  itens: VendaPorLojaItemDB[];
};

const CACHE_VENDAS_POR_LOJA_TTL_MS = 2 * 60_000;
const cacheVendasPorLoja = new Map<
  string,
  { expiresAt: number; linhas: VendaPorLojaDiaDB[] }
>();

function proximoDiaIso(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
  const proximo = new Date(Date.UTC(ano, mes - 1, dia));
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return proximo.toISOString().slice(0, 10);
}

function skusDoFiltro(codigo: string, filtro: FiltroMercadologico): string[] | null {
  if (!filtroMercadologicoAtivo(filtro)) return null;
  const produtos = db
    .prepare(`SELECT p.* FROM produtos p WHERE ${sqlSkuVisivel("p")}`)
    .all(codigo) as Array<Record<string, unknown> & { sku: string }>;
  return produtos
    .filter((produto) => produtoPassaFiltro(produto, filtro))
    .map((produto) => produto.sku);
}

/** Sell-out agregado por loja/dia para a Dashboard e o menu de detalhe. */
export const fetchVendasPorLoja = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      filtro?: FiltroMercadologico;
      dias?: number;
      lojaId?: string;
      incluirLinhas?: boolean;
    }) => ({
      fornecedorCodigo: soDigitos(data.fornecedorCodigo),
      filtro: data.filtro ?? FILTRO_VAZIO,
      dias: Math.min(90, Math.max(7, Math.trunc(Number(data.dias) || JANELA_VENDAS_LOJA_DIAS))),
      lojaId:
        typeof data.lojaId === "string" && data.lojaId.trim() ? soDigitos(data.lojaId) : undefined,
      incluirLinhas: data.incluirLinhas !== false,
    }),
  )
  .handler(async ({ data }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const vazio: VendasPorLojaDB = {
      inicio: null,
      fim: null,
      dias: data.dias,
      linhas: [],
      itens: [],
    };
    if (!tabelaExiste("vendas") || !tabelaExiste("produtos")) return vazio;

    const corte = db
      .prepare(
        `SELECT MIN(data) AS inicio, MAX(data) AS fim
         FROM (
           SELECT DISTINCT substr(data, 1, 10) AS data
           FROM vendas
           ORDER BY data DESC
           LIMIT ${data.dias}
         )`,
      )
      .get() as { inicio: string | null; fim: string | null };
    const inicio = corte?.inicio ?? null;
    const fim = corte?.fim ?? null;
    if (!inicio || !fim) return { ...vazio, inicio, fim };
    const fimExclusivo = proximoDiaIso(fim);

    const skusMix = skusDoFiltro(fornecedorCodigo, data.filtro);
    if (skusMix && skusMix.length === 0)
      return { inicio, fim, dias: data.dias, linhas: [], itens: [] };
    const sqlSkuMix = skusMix?.length ? `AND v.sku IN (${skusMix.map(() => "?").join(",")})` : "";
    const sqlLoja = data.lojaId ? "AND v.lojaid = ?" : "";
    const params = [
      fornecedorCodigo,
      inicio,
      fimExclusivo,
      ...(data.lojaId ? [data.lojaId] : []),
      ...(skusMix ?? []),
    ];
    const chaveCache = `${fornecedorCodigo}:${data.dias}:${JSON.stringify(data.filtro)}`;
    const cacheAtual =
      !data.lojaId && data.incluirLinhas ? cacheVendasPorLoja.get(chaveCache) : undefined;
    let linhas: VendaPorLojaDiaDB[] = [];
    if (data.incluirLinhas) {
      if (cacheAtual && cacheAtual.expiresAt > Date.now()) {
        linhas = cacheAtual.linhas;
      } else {
        linhas = db
          .prepare(
            `SELECT substr(v.data, 1, 10) AS data,
                    v.lojaid AS lojaId,
                    SUM(COALESCE(v.quantidade, 0)) AS quantidade,
                    SUM(COALESCE(v.quantidade, 0) * COALESCE(v.valorunitario, 0)) AS faturamento,
                    COUNT(DISTINCT v.sku) AS skus
             FROM vendas v
             JOIN produtos p ON v.sku = p.sku
             WHERE ${sqlSkuVisivel("p")}
               AND v.lojaid NOT IN (${sqlLojasForaPortal}, ${sqlLojasForaRelatorioVendas})
               AND v.data >= ?
               AND v.data < ?
               ${sqlLoja}
               ${sqlSkuMix}
             GROUP BY substr(v.data, 1, 10), v.lojaid
             ORDER BY data DESC, faturamento DESC`,
          )
          .all(...params) as VendaPorLojaDiaDB[];
        if (!data.lojaId) {
          cacheVendasPorLoja.set(chaveCache, {
            expiresAt: Date.now() + CACHE_VENDAS_POR_LOJA_TTL_MS,
            linhas,
          });
        }
      }
    }

    let itens: VendaPorLojaItemDB[] = [];
    if (data.lojaId) {
      itens = db
        .prepare(
          `SELECT v.lojaid AS lojaId,
                  v.sku AS sku,
                  COALESCE(p.descricao, v.sku) AS descricao,
                  SUM(COALESCE(v.quantidade, 0)) AS quantidade,
                  SUM(COALESCE(v.quantidade, 0) * COALESCE(v.valorunitario, 0)) AS faturamento,
                  COUNT(DISTINCT substr(v.data, 1, 10)) AS dias
           FROM vendas v
           JOIN produtos p ON v.sku = p.sku
           WHERE ${sqlSkuVisivel("p")}
             AND v.lojaid NOT IN (${sqlLojasForaPortal}, ${sqlLojasForaRelatorioVendas})
             AND v.data >= ?
             AND v.data < ?
             ${sqlLoja}
             ${sqlSkuMix}
           GROUP BY v.lojaid, v.sku, p.descricao
           ORDER BY faturamento DESC, descricao ASC`,
        )
        .all(...params) as VendaPorLojaItemDB[];
    }

    return { inicio, fim, dias: data.dias, linhas, itens };
  });
