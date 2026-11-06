import { createServerFn } from "@tanstack/react-start";
import { soDigitos } from "@/lib/fornecedor-codigo";
import { segmentoIntelider } from "@/lib/acordo-acesso";
import { db } from "../server/db";
import { codigoFornecedorEfetivo } from "../server/sessao-portal";
import { joinVendasMensalProduto, sqlSkuVisivel, tabelaExiste } from "./db-support";
import type {
  VendasAnualDB,
  VendasAnualItemDB,
  VendasAnualMesDB,
  VendasAnualSecaoDB,
} from "./contracts";

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function diasNoMes(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

function crescimentoPct(atual: number, base: number): number | null {
  if (base === 0) return atual > 0 ? null : 0;
  return (atual / base - 1) * 100;
}

function escopoSegmentoVendas(codigoFornecedor: string): {
  segmento: string;
  departamentos: string[];
} {
  let produtosFornecedor = db
    .prepare(
      `SELECT DISTINCT p.departamentoCodigo, p.departamento
       FROM produtos p
       WHERE ${sqlSkuVisivel("p")}`,
    )
    .all(codigoFornecedor) as Array<{
    departamentoCodigo?: string | null;
    departamento?: string | null;
  }>;
  if (!produtosFornecedor.length) {
    produtosFornecedor = db
      .prepare(
        `SELECT DISTINCT p.departamentoCodigo, p.departamento
         FROM produtos p
         WHERE p.fornecedorCodigo = ? OR p.fornecedorCodigo LIKE ? || '_'`,
      )
      .all(codigoFornecedor, codigoFornecedor) as Array<{
      departamentoCodigo?: string | null;
      departamento?: string | null;
    }>;
  }

  const segmentos = new Set(
    produtosFornecedor.map((p) => segmentoIntelider(p.departamentoCodigo, p.departamento)),
  );
  const segmento =
    segmentos.size === 1
      ? (Array.from(segmentos)[0] ?? "OUTROS")
      : segmentos.size > 1
        ? "MIX DE SEGMENTOS"
        : "OUTROS";
  const departamentos = (
    db.prepare("SELECT DISTINCT departamentoCodigo, departamento FROM produtos").all() as Array<{
      departamentoCodigo?: string | null;
      departamento?: string | null;
    }>
  )
    .filter(
      (p) =>
        segmentos.size === 0 ||
        segmentos.has(segmentoIntelider(p.departamentoCodigo, p.departamento)),
    )
    .map((p) => String(p.departamentoCodigo ?? "").trim())
    .filter(Boolean);

  return { segmento, departamentos: Array.from(new Set(departamentos)) };
}

export const fetchVendasAnual = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const escopo = escopoSegmentoVendas(fornecedorCodigo);
    const hoje = new Date();
    const anoAtual = hoje.getUTCFullYear();
    const mesCorte = hoje.getUTCMonth() + 1;
    const diaCorte = hoje.getUTCDate();
    const anoBase = anoAtual - 1;
    const corteIso = `${anoAtual}-${String(mesCorte).padStart(2, "0")}-${String(diaCorte).padStart(2, "0")}`;

    const vazio = (cacheAte: string | null, temAnoAtual: boolean): VendasAnualDB => ({
      corte: {
        data: corteIso,
        dia: diaCorte,
        mes: mesCorte,
        anoAtual,
        anoBase,
      },
      segmento: escopo.segmento,
      farolPct: 0,
      cacheAte,
      temAnoAtual,
      rede: { anualBase: 0, ytdAtual: 0, realizadoPct: null, pontos: null },
      fornecedor: {
        anualBase: 0,
        ytdAtual: 0,
        realizadoPct: null,
        pontos: null,
      },
      meses: [],
      secoes: [],
      itens: [],
    });

    if (!tabelaExiste("vendas_mensal")) {
      return vazio(null, false);
    }

    const cacheAteRow = db.prepare("SELECT MAX(anoMes) AS ate FROM vendas_mensal").get() as {
      ate: string | null;
    };
    const cacheAte = cacheAteRow?.ate ?? null;
    const temAnoAtual = Boolean(cacheAte && cacheAte.startsWith(String(anoAtual)));

    type MesAgg = { valor: number; volume: number };
    const zeroMes = (): MesAgg => ({ valor: 0, volume: 0 });
    const redeBase: MesAgg[] = Array.from({ length: 12 }, zeroMes);
    const redeAtual: MesAgg[] = Array.from({ length: 12 }, zeroMes);
    const fornBase: MesAgg[] = Array.from({ length: 12 }, zeroMes);
    const fornAtual: MesAgg[] = Array.from({ length: 12 }, zeroMes);

    const placeholdersSegmento = escopo.departamentos.map(() => "?").join(",");
    const filtroSegmentoRede = escopo.departamentos.length
      ? `AND p.departamentoCodigo IN (${placeholdersSegmento})`
      : "AND 1 = 0";
    const redeRows = db
      .prepare(
        `SELECT vm.anoMes, SUM(vm.valor) AS valor, SUM(vm.quantidade) AS volume
         FROM vendas_mensal vm
         INNER JOIN produtos p
           ON p.sku = vm.sku
           OR (
             length(vm.sku) > 1
             AND p.codigoProdutoRms = substr(vm.sku, 1, length(vm.sku) - 1)
             AND p.digitoProdutoRms = substr(vm.sku, -1)
           )
         WHERE (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
           ${filtroSegmentoRede}
         GROUP BY vm.anoMes`,
      )
      .all(`${anoBase}-%`, `${anoAtual}-%`, ...escopo.departamentos) as {
      anoMes: string;
      valor: number;
      volume: number;
    }[];

    for (const row of redeRows) {
      const ano = Number(row.anoMes.slice(0, 4));
      const mes = Number(row.anoMes.slice(5, 7));
      const alvo = ano === anoBase ? redeBase : ano === anoAtual ? redeAtual : null;
      if (!alvo || mes < 1 || mes > 12) continue;
      alvo[mes - 1].valor += row.valor || 0;
      alvo[mes - 1].volume += row.volume || 0;
    }

    const temFornCol = Boolean(
      (
        db.prepare("PRAGMA table_info(vendas_mensal)").all() as {
          name: string;
        }[]
      ).some((c) => c.name === "fornecedorCodigo"),
    );
    // Planilha: SKU = codigo RMS + dígito. Refresh RMS grava o SKU do portal (sem dígito).
    const joinProdutoRms = joinVendasMensalProduto;
    const nomeSecaoSql = `COALESCE(
      NULLIF(TRIM(
        CASE
          WHEN instr(COALESCE(p.secao, ''), ' - ') > 1
           AND substr(p.secao, 1, instr(p.secao, ' - ') - 1) GLOB '[0-9]*'
          THEN substr(p.secao, instr(p.secao, ' - ') + 3)
          ELSE p.secao
        END
      ), ''),
      'Sem seção'
    )`;
    const filtroForn = temFornCol
      ? `(vm.fornecedorCodigo = ? OR vm.fornecedorCodigo LIKE ? || '_')`
      : sqlSkuVisivel("p");
    const bindsForn = temFornCol ? [fornecedorCodigo, fornecedorCodigo] : [fornecedorCodigo];
    const joinProdObrigatorio = joinProdutoRms;

    const fornRows = db
      .prepare(
        `SELECT vm.anoMes, SUM(vm.valor) AS valor, SUM(vm.quantidade) AS volume
         FROM vendas_mensal vm
         ${joinProdutoRms}
         WHERE ${filtroForn}
           AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
         GROUP BY vm.anoMes`,
      )
      .all(...bindsForn, `${anoBase}-%`, `${anoAtual}-%`) as {
      anoMes: string;
      valor: number;
      volume: number;
    }[];

    for (const row of fornRows) {
      const ano = Number(row.anoMes.slice(0, 4));
      const mes = Number(row.anoMes.slice(5, 7));
      const alvo = ano === anoBase ? fornBase : ano === anoAtual ? fornAtual : null;
      if (!alvo || mes < 1 || mes > 12) continue;
      alvo[mes - 1].valor += row.valor || 0;
      alvo[mes - 1].volume += row.volume || 0;
    }

    const anualRedeBase = redeBase.reduce((acc, m) => acc + m.valor, 0);
    const anualFornBase = fornBase.reduce((acc, m) => acc + m.valor, 0);
    const pesos = redeBase.map((m) => (anualRedeBase > 0 ? m.valor / anualRedeBase : 0));

    let farolPct = 0;
    const meses: VendasAnualMesDB[] = [];
    for (let i = 0; i < 12; i++) {
      const mes = i + 1;
      const dias = diasNoMes(anoAtual, mes);
      const aberto = mes === mesCorte;
      const fechado = mes < mesCorte;
      let farolAcum = pesos.slice(0, i).reduce((acc, p) => acc + p, 0);
      if (aberto) farolAcum += (pesos[i] / dias) * diaCorte;
      else if (fechado || mes < mesCorte) farolAcum += pesos[i];
      if (aberto) farolPct = farolAcum * 100;
      if (mes === 12 && mesCorte === 12 && diaCorte >= dias) farolPct = 100;

      meses.push({
        mes,
        nome: NOMES_MES[i],
        dias,
        pesoAnoPct: pesos[i] * 100,
        farolAcumPct: farolAcum * 100,
        redeValorBase: redeBase[i].valor,
        redeValorAtual: redeAtual[i].valor,
        redeVolumeBase: redeBase[i].volume,
        redeVolumeAtual: redeAtual[i].volume,
        fornValorBase: fornBase[i].valor,
        fornValorAtual: fornAtual[i].valor,
        fornVolumeBase: fornBase[i].volume,
        fornVolumeAtual: fornAtual[i].volume,
        aberto,
      });
    }
    if (mesCorte === 12 && diaCorte >= diasNoMes(anoAtual, 12)) farolPct = 100;

    const ytdMeses = (arr: MesAgg[]) =>
      arr.reduce((acc, m, i) => {
        const mes = i + 1;
        if (mes < mesCorte) return acc + m.valor;
        if (mes === mesCorte) return acc + m.valor;
        return acc;
      }, 0);

    const ytdRede = ytdMeses(redeAtual);
    const ytdForn = ytdMeses(fornAtual);
    const realizadoRede = anualRedeBase > 0 && temAnoAtual ? (ytdRede / anualRedeBase) * 100 : null;
    const realizadoForn = anualFornBase > 0 && temAnoAtual ? (ytdForn / anualFornBase) * 100 : null;

    const ytdBaseFim = `${anoBase}-${String(mesCorte).padStart(2, "0")}`;
    const ytdAtualFim = `${anoAtual}-${String(mesCorte).padStart(2, "0")}`;

    const secaoRows = db
      .prepare(
        `SELECT
            ${nomeSecaoSql} AS secao,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.valor ELSE 0 END) AS valorBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorBaseYtd,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorAtual,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.quantidade ELSE 0 END) AS volumeBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.quantidade ELSE 0 END) AS volumeBaseYtd,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.quantidade ELSE 0 END) AS volumeAtual
         FROM vendas_mensal vm
         ${joinProdObrigatorio}
         WHERE ${filtroForn}
           AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
         GROUP BY 1
         HAVING SUM(vm.valor) > 0
         ORDER BY valorBase DESC
         LIMIT 40`,
      )
      .all(
        `${anoBase}-%`,
        `${anoBase}-01`,
        ytdBaseFim,
        `${anoAtual}-01`,
        ytdAtualFim,
        `${anoBase}-%`,
        `${anoBase}-01`,
        ytdBaseFim,
        `${anoAtual}-01`,
        ytdAtualFim,
        ...bindsForn,
        `${anoBase}-%`,
        `${anoAtual}-%`,
      ) as VendasAnualSecaoDB[];

    const secoes: VendasAnualSecaoDB[] = secaoRows.map((s) => ({
      ...s,
      crescimentoValorPct: crescimentoPct(s.valorAtual, s.valorBaseYtd),
      crescimentoVolumePct: crescimentoPct(s.volumeAtual, s.volumeBaseYtd),
    }));

    const itemRows = db
      .prepare(
        `SELECT
            COALESCE(p.sku, vm.sku) AS sku,
            COALESCE(p.descricao, vm.sku) AS descricao,
            p.codigoProdutoRms AS codigoProdutoRms,
            p.digitoProdutoRms AS digitoProdutoRms,
            ${nomeSecaoSql} AS secao,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.valor ELSE 0 END) AS valorBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorBaseYtd,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorAtual,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.quantidade ELSE 0 END) AS volumeBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.quantidade ELSE 0 END) AS volumeAtual
         FROM vendas_mensal vm
         ${joinProdObrigatorio}
         WHERE ${filtroForn}
           AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
         GROUP BY 1, 2, 3, 4, 5
         HAVING SUM(vm.valor) > 0
         ORDER BY valorBase DESC
         LIMIT 80`,
      )
      .all(
        `${anoBase}-%`,
        `${anoBase}-01`,
        ytdBaseFim,
        `${anoAtual}-01`,
        ytdAtualFim,
        `${anoBase}-%`,
        `${anoAtual}-01`,
        ytdAtualFim,
        ...bindsForn,
        `${anoBase}-%`,
        `${anoAtual}-%`,
      ) as Omit<VendasAnualItemDB, "crescimentoValorPct" | "contribuicaoFuro">[];

    const esperadoItem = (base: number) => base * (farolPct / 100);
    const itens: VendasAnualItemDB[] = itemRows
      .map((item) => ({
        ...item,
        crescimentoValorPct: crescimentoPct(item.valorAtual, item.valorBaseYtd),
        contribuicaoFuro: esperadoItem(item.valorBase) - item.valorAtual,
      }))
      .sort((a, b) => {
        const valA = a.crescimentoValorPct === null ? 0 : a.crescimentoValorPct;
        const valB = b.crescimentoValorPct === null ? 0 : b.crescimentoValorPct;
        return valA - valB;
      })
      .slice(0, 40);

    return {
      corte: {
        data: corteIso,
        dia: diaCorte,
        mes: mesCorte,
        anoAtual,
        anoBase,
      },
      segmento: escopo.segmento,
      farolPct,
      cacheAte,
      temAnoAtual,
      rede: {
        anualBase: anualRedeBase,
        ytdAtual: ytdRede,
        realizadoPct: realizadoRede,
        pontos: realizadoRede === null ? null : realizadoRede - farolPct,
      },
      fornecedor: {
        anualBase: anualFornBase,
        ytdAtual: ytdForn,
        realizadoPct: realizadoForn,
        pontos: realizadoForn === null ? null : realizadoForn - farolPct,
      },
      meses,
      secoes,
      itens,
    } satisfies VendasAnualDB;
  });
