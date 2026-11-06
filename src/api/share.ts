import { createServerFn } from "@tanstack/react-start";
import { soDigitos } from "@/lib/fornecedor-codigo";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import { shareJanelaCurta, shareUsaMensal } from "@/lib/vendas-graos";
import { db } from "../server/db";
import { codigoFornecedorEfetivo } from "../server/sessao-portal";
import { joinVendasMensalProduto, sqlSkuVisivel, tabelaExiste } from "./db-support";
import type {
  ShareCategoriaDB,
  ShareFornecedorDB,
  ShareJanela,
  ShareMarcaDB,
  ShareResumoDB,
} from "./contracts";

type ShareCategoriaRow = Omit<ShareCategoriaDB, "shareValor" | "shareQuantidade">;

function ensureMarcasFornecedor() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fornecedor_produto_marcas (
      fornecedorCodigo TEXT NOT NULL,
      sku TEXT NOT NULL,
      marca TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      PRIMARY KEY (fornecedorCodigo, sku)
    )
  `);
}

const shareCache = new Map<string, { expiresAt: number; data: ShareFornecedorDB }>();

const marcaReal = (marca: string | null | undefined) => {
  const limpa = (marca ?? "").trim();
  return limpa || "Marca não informada";
};

const inicioShare = (janela: ShareJanela, fim: string | null) => {
  if (janela === "tudo" || !fim) return null;
  const data = new Date(`${fim}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - (Number(janela) - 1));
  return data.toISOString().slice(0, 10);
};

const anoMesDe = (iso: string | null) => (iso && iso.length >= 7 ? iso.slice(0, 7) : null);

const ultimoDiaMes = (anoMes: string) => {
  const y = Number(anoMes.slice(0, 4));
  const m = Number(anoMes.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export const fetchShareFornecedor = createServerFn({ method: "GET" })
  .validator((data: { fornecedorCodigo: string; janela: ShareJanela }) => ({
    ...data,
    fornecedorCodigo: soDigitos(data.fornecedorCodigo),
  }))
  .handler(async ({ data }) => {
    const janela = data.janela;
    const fornecedorCodigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const chaveCache = `${fornecedorCodigo}:${janela}`;
    const cacheAtual = shareCache.get(chaveCache);
    if (cacheAtual && cacheAtual.expiresAt > Date.now()) return cacheAtual.data;
    ensureMarcasFornecedor();
    const marcasFornecedor = new Map(
      (
        db
          .prepare("SELECT sku, marca FROM fornecedor_produto_marcas WHERE fornecedorCodigo = ?")
          .all(fornecedorCodigo) as Array<{ sku: string; marca: string }>
      ).map((item) => [String(item.sku), item.marca] as const),
    );
    const temSubgrupo = tabelaExiste("vendas_subgrupo");
    const temMensal = tabelaExiste("vendas_mensal");
    let fim: string | null = null;
    if (shareUsaMensal(janela) && temMensal) {
      const ate = db.prepare("SELECT MAX(anoMes) AS ate FROM vendas_mensal").get() as {
        ate: string | null;
      };
      fim = ate?.ate ? ultimoDiaMes(ate.ate) : null;
    }
    if (!fim) {
      const fimRow = db.prepare("SELECT MAX(data) AS fim FROM vendas").get() as {
        fim: string | null;
      };
      fim = fimRow?.fim ?? null;
    }
    const inicio = inicioShare(janela, fim);
    const coberturaSubgrupo = temSubgrupo
      ? (db.prepare("SELECT MIN(data) AS dmin, MAX(data) AS dmax FROM vendas_subgrupo").get() as {
          dmin: string | null;
          dmax: string | null;
        })
      : { dmin: null, dmax: null };
    const subgrupoCobre =
      Boolean(temSubgrupo && coberturaSubgrupo.dmin && coberturaSubgrupo.dmax) &&
      (inicio == null || inicio >= String(coberturaSubgrupo.dmin)) &&
      (fim == null || fim <= String(coberturaSubgrupo.dmax));
    const usarMensal =
      temMensal && (shareUsaMensal(janela) || (shareJanelaCurta(janela) && !subgrupoCobre));
    const inicioMes = anoMesDe(inicio);
    const fimMes = anoMesDe(fim);

    const joinMensalProd = joinVendasMensalProduto;
    const filtroFornMensal = `(vm.fornecedorCodigo = ? OR ${sqlSkuVisivel("p")})`;

    const temTotalCategoria = tabelaExiste("vendas_subgrupo");
    const categoriaRows = usarMensal
      ? (db
          .prepare(
            `
        WITH forn AS (
          SELECT
            CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            COALESCE(NULLIF(MAX(p.categoria), ''), NULLIF(MAX(p.subgrupo), ''), 'Sem categoria') AS categoria,
            COALESCE(NULLIF(MAX(p.departamento), ''), 'Sem departamento') AS departamento,
            COALESCE(NULLIF(MAX(p.secao), ''), 'Sem secao') AS secao,
            COALESCE(NULLIF(MAX(p.grupo), ''), 'Sem grupo') AS grupo,
            COALESCE(NULLIF(MAX(p.subgrupo), ''), 'Sem subgrupo') AS subgrupo,
            SUM(vm.valor) AS fornecedorValor,
            SUM(vm.quantidade) AS fornecedorQuantidade,
            COUNT(DISTINCT COALESCE(p.sku, vm.sku)) AS fornecedorSkus
          FROM vendas_mensal vm
          ${joinMensalProd}
          WHERE ${filtroFornMensal}
            AND (? IS NULL OR vm.anoMes >= ?)
            AND (? IS NULL OR vm.anoMes <= ?)
          GROUP BY 1, 2, 3, 4
        ),
        lider AS (
          SELECT
            CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            SUM(vm.valor) AS liderValor,
            SUM(vm.quantidade) AS liderQuantidade
          FROM vendas_mensal vm
          ${joinMensalProd}
          WHERE (? IS NULL OR vm.anoMes >= ?)
            AND (? IS NULL OR vm.anoMes <= ?)
          GROUP BY 1, 2, 3, 4
        )
        SELECT
          f.categoria,
          f.departamento,
          f.secao,
          f.grupo,
          f.subgrupo,
          f.fornecedorValor,
          COALESCE(l.liderValor, f.fornecedorValor) AS liderValor,
          f.fornecedorQuantidade,
          COALESCE(l.liderQuantidade, f.fornecedorQuantidade) AS liderQuantidade,
          f.fornecedorSkus,
          f.fornecedorSkus AS liderSkus
        FROM forn f
        LEFT JOIN lider l
          ON l.depto = f.depto
         AND l.secaoCod = f.secaoCod
         AND l.grupoCod = f.grupoCod
         AND l.subCod = f.subCod
        ORDER BY f.fornecedorValor DESC
      `,
          )
          .all(
            fornecedorCodigo,
            fornecedorCodigo,
            inicioMes,
            inicioMes,
            fimMes,
            fimMes,
            inicioMes,
            inicioMes,
            fimMes,
            fimMes,
          ) as ShareCategoriaRow[])
      : temTotalCategoria
        ? (db
            .prepare(
              `
        WITH forn AS (
          SELECT
            CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            COALESCE(NULLIF(MAX(p.categoria), ''), NULLIF(MAX(p.subgrupo), ''), 'Sem categoria') AS categoria,
            COALESCE(NULLIF(MAX(p.departamento), ''), 'Sem departamento') AS departamento,
            COALESCE(NULLIF(MAX(p.secao), ''), 'Sem secao') AS secao,
            COALESCE(NULLIF(MAX(p.grupo), ''), 'Sem grupo') AS grupo,
            COALESCE(NULLIF(MAX(p.subgrupo), ''), 'Sem subgrupo') AS subgrupo,
            SUM(v.quantidade * v.valorUnitario) AS fornecedorValor,
            SUM(v.quantidade) AS fornecedorQuantidade,
            COUNT(DISTINCT p.sku) AS fornecedorSkus
          FROM vendas v
          JOIN produtos p ON p.sku = v.sku
          WHERE ${sqlSkuVisivel("p")}
            AND (? IS NULL OR v.data >= ?)
            AND v.lojaId NOT IN (${sqlLojasForaPortal})
          GROUP BY 1, 2, 3, 4
        ),
        lider AS (
          SELECT
            CAST(CAST(departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            SUM(valor) AS liderValor,
            SUM(quantidade) AS liderQuantidade
          FROM vendas_subgrupo
          WHERE (? IS NULL OR data >= ?)
            AND (? IS NULL OR data <= ?)
          GROUP BY 1, 2, 3, 4
        )
        SELECT
          f.categoria,
          f.departamento,
          f.secao,
          f.grupo,
          f.subgrupo,
          f.fornecedorValor,
          COALESCE(l.liderValor, f.fornecedorValor) AS liderValor,
          f.fornecedorQuantidade,
          COALESCE(l.liderQuantidade, f.fornecedorQuantidade) AS liderQuantidade,
          f.fornecedorSkus,
          f.fornecedorSkus AS liderSkus
        FROM forn f
        LEFT JOIN lider l
          ON l.depto = f.depto
         AND l.secaoCod = f.secaoCod
         AND l.grupoCod = f.grupoCod
         AND l.subCod = f.subCod
        ORDER BY f.fornecedorValor DESC
      `,
            )
            .all(fornecedorCodigo, inicio, inicio, inicio, inicio, fim, fim) as ShareCategoriaRow[])
        : (db
            .prepare(
              `
        WITH vendas_periodo AS (
          SELECT sku, quantidade, valorUnitario
          FROM vendas
          WHERE (? IS NULL OR data >= ?)
            AND lojaId NOT IN (${sqlLojasForaPortal})
        )
        SELECT
          COALESCE(NULLIF(MAX(p.categoria), ''), NULLIF(MAX(p.subgrupo), ''), 'Sem categoria') AS categoria,
          COALESCE(NULLIF(MAX(p.departamento), ''), 'Sem departamento') AS departamento,
          COALESCE(NULLIF(MAX(p.secao), ''), 'Sem secao') AS secao,
          COALESCE(NULLIF(MAX(p.grupo), ''), 'Sem grupo') AS grupo,
          COALESCE(NULLIF(MAX(p.subgrupo), ''), 'Sem subgrupo') AS subgrupo,
          SUM(CASE WHEN ${sqlSkuVisivel("p")} THEN vp.quantidade * vp.valorUnitario ELSE 0 END) AS fornecedorValor,
          SUM(vp.quantidade * vp.valorUnitario) AS liderValor,
          SUM(CASE WHEN ${sqlSkuVisivel("p")} THEN vp.quantidade ELSE 0 END) AS fornecedorQuantidade,
          SUM(vp.quantidade) AS liderQuantidade,
          COUNT(DISTINCT CASE WHEN ${sqlSkuVisivel("p")} THEN p.sku END) AS fornecedorSkus,
          COUNT(DISTINCT p.sku) AS liderSkus
        FROM vendas_periodo vp
        JOIN produtos p ON p.sku = vp.sku
        GROUP BY p.departamentoCodigo, p.secaoCodigo, p.grupoCodigo, p.subgrupoCodigo
        HAVING SUM(CASE WHEN ${sqlSkuVisivel("p")} THEN vp.quantidade * vp.valorUnitario ELSE 0 END) > 0
        ORDER BY fornecedorValor DESC
      `,
            )
            .all(
              inicio,
              inicio,
              fornecedorCodigo,
              fornecedorCodigo,
              fornecedorCodigo,
              fornecedorCodigo,
            ) as ShareCategoriaRow[]);

    const categorias: ShareCategoriaDB[] = categoriaRows.map((item) => {
      const fornecedorValor = Number(item.fornecedorValor ?? 0);
      const liderValor = Number(item.liderValor ?? 0);
      const fornecedorQuantidade = Number(item.fornecedorQuantidade ?? 0);
      const liderQuantidade = Number(item.liderQuantidade ?? 0);
      return {
        ...item,
        fornecedorValor,
        liderValor,
        fornecedorQuantidade,
        liderQuantidade,
        fornecedorSkus: Number(item.fornecedorSkus ?? 0),
        liderSkus: Number(item.liderSkus ?? 0),
        shareValor: liderValor > 0 ? (fornecedorValor / liderValor) * 100 : 0,
        shareQuantidade: liderQuantidade > 0 ? (fornecedorQuantidade / liderQuantidade) * 100 : 0,
      } satisfies ShareCategoriaDB;
    });

    const produtosFornecedor = (
      usarMensal
        ? db
            .prepare(
              `
        SELECT
          COALESCE(p.sku, vm.sku) AS sku,
          COALESCE(p.descricao, vm.sku) AS descricao,
          p.marca,
          COALESCE(NULLIF(p.categoria, ''), NULLIF(p.subgrupo, ''), 'Sem categoria') AS categoria,
          SUM(vm.valor) AS fornecedorValor,
          SUM(vm.quantidade) AS fornecedorQuantidade
        FROM vendas_mensal vm
        ${joinMensalProd}
        WHERE ${filtroFornMensal}
          AND (? IS NULL OR vm.anoMes >= ?)
          AND (? IS NULL OR vm.anoMes <= ?)
        GROUP BY COALESCE(p.sku, vm.sku), COALESCE(p.descricao, vm.sku), p.marca, p.subgrupo, categoria
      `,
            )
            .all(fornecedorCodigo, fornecedorCodigo, inicioMes, inicioMes, fimMes, fimMes)
        : db
            .prepare(
              `
        SELECT
          p.sku,
          p.descricao,
          p.marca,
          COALESCE(NULLIF(p.categoria, ''), NULLIF(p.subgrupo, ''), 'Sem categoria') AS categoria,
          SUM(v.quantidade * v.valorUnitario) AS fornecedorValor,
          SUM(v.quantidade) AS fornecedorQuantidade
        FROM vendas v
        JOIN produtos p ON p.sku = v.sku
        WHERE ${sqlSkuVisivel("p")}
          AND (? IS NULL OR v.data >= ?)
          AND v.lojaId NOT IN (${sqlLojasForaPortal})
        GROUP BY p.sku, p.descricao, p.marca, p.subgrupo, categoria
      `,
            )
            .all(fornecedorCodigo, inicio, inicio)
    ) as Array<{
      sku: string;
      descricao: string;
      marca: string | null;
      categoria: string;
      fornecedorValor: number;
      fornecedorQuantidade: number;
    }>;

    const totalFornecedor = produtosFornecedor.reduce(
      (acc, item) => acc + Number(item.fornecedorValor ?? 0),
      0,
    );
    const marcasMap = new Map<
      string,
      {
        fornecedorValor: number;
        fornecedorQuantidade: number;
        produtos: Set<string>;
        categorias: Set<string>;
      }
    >();

    for (const item of produtosFornecedor) {
      const marca = marcaReal(marcasFornecedor.get(String(item.sku)) ?? item.marca);
      const atual = marcasMap.get(marca) ?? {
        fornecedorValor: 0,
        fornecedorQuantidade: 0,
        produtos: new Set<string>(),
        categorias: new Set<string>(),
      };
      atual.fornecedorValor += Number(item.fornecedorValor ?? 0);
      atual.fornecedorQuantidade += Number(item.fornecedorQuantidade ?? 0);
      atual.produtos.add(item.sku);
      atual.categorias.add(item.categoria);
      marcasMap.set(marca, atual);
    }

    const marcas = Array.from(marcasMap.entries())
      .map(([marca, item]) => ({
        marca,
        fornecedorValor: item.fornecedorValor,
        fornecedorQuantidade: item.fornecedorQuantidade,
        produtos: item.produtos.size,
        categorias: item.categorias.size,
        sharePortfolio: totalFornecedor > 0 ? (item.fornecedorValor / totalFornecedor) * 100 : 0,
      }))
      .sort((a, b) => b.fornecedorValor - a.fornecedorValor)
      .slice(0, 24) satisfies ShareMarcaDB[];

    const resumo: ShareResumoDB = {
      fornecedorValor: categorias.reduce((acc, item) => acc + item.fornecedorValor, 0),
      liderValorCategorias: categorias.reduce((acc, item) => acc + item.liderValor, 0),
      fornecedorQuantidade: categorias.reduce((acc, item) => acc + item.fornecedorQuantidade, 0),
      liderQuantidadeCategorias: categorias.reduce((acc, item) => acc + item.liderQuantidade, 0),
      categorias: categorias.length,
      marcas: marcas.length,
      produtos: produtosFornecedor.length,
      shareValorMedio: 0,
      shareQuantidadeMedio: 0,
    };
    resumo.shareValorMedio =
      resumo.liderValorCategorias > 0
        ? (resumo.fornecedorValor / resumo.liderValorCategorias) * 100
        : 0;
    resumo.shareQuantidadeMedio =
      resumo.liderQuantidadeCategorias > 0
        ? (resumo.fornecedorQuantidade / resumo.liderQuantidadeCategorias) * 100
        : 0;

    const resultado = {
      periodo: { janela, inicio, fim },
      categorias,
      marcas,
      resumo,
    } satisfies ShareFornecedorDB;
    shareCache.set(chaveCache, {
      expiresAt: Date.now() + 5 * 60_000,
      data: resultado,
    });
    return resultado;
  });
