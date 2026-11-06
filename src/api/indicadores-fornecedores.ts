import { createServerFn } from "@tanstack/react-start";
import { exigirInterno } from "../server/sessao-portal";
import { db } from "../server/db";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";

type PeriodoFechado = { valor: string; inicio: string; fim: string; rotulo: string };

function mesAtualIso() {
  return new Date().toISOString().slice(0, 7);
}

function periodosFechados(): PeriodoFechado[] {
  const atual = mesAtualIso();
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(emissao, 1, 7) AS mes
         FROM pedidos
        WHERE destino = 'Fornecedor'
          AND substr(emissao, 1, 7) < ?
          AND substr(emissao, 1, 7) IS NOT NULL
        ORDER BY mes DESC`,
    )
    .all(atual) as Array<{ mes: string }>;
  return rows
    .filter((row) => /^\d{4}-\d{2}$/.test(row.mes))
    .map((row) => {
      const [ano, mes] = row.mes.split("-").map(Number);
      const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
      const nomes = [
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
      ];
      return { valor: row.mes, inicio: `${row.mes}-01`, fim, rotulo: `${nomes[mes - 1]}/${ano}` };
    });
}

export const fetchIndicadoresFornecedores = createServerFn({ method: "GET" })
  .validator((periodo: string) => (/^\d{4}-\d{2}$/.test(periodo) ? periodo : ""))
  .handler(async ({ data: periodo }) => {
    exigirInterno();
    const periodoDisponiveis = periodosFechados();
    const corte =
      periodoDisponiveis.find((item) => item.valor === periodo) ?? periodoDisponiveis[0];
    if (!corte) return { periodos: [], periodo: null, rows: [] };
    const rows = db
      .prepare(
        `WITH pedidos_periodo AS (
          SELECT p.fornecedorCodigo AS codigo,
                 COUNT(DISTINCT p.numero || ':' || p.lojaId) AS pedidos,
                 SUM(CASE WHEN p.status <> 'Cancelado' THEN COALESCE(i.quantidadePedida, 0) ELSE 0 END) AS pedidas,
                 SUM(CASE WHEN p.status <> 'Cancelado' THEN COALESCE(i.quantidadeFaturada, 0) ELSE 0 END) AS atendidas
            FROM pedidos p
            LEFT JOIN pedido_itens i
              ON i.numero = p.numero
             AND i.lojaId = p.lojaId
             AND i.fornecedorCodigo = p.fornecedorCodigo
           WHERE p.destino = 'Fornecedor'
             AND p.lojaId NOT IN (${sqlLojasForaPortal})
             AND substr(p.emissao, 1, 10) BETWEEN ? AND ?
           GROUP BY p.fornecedorCodigo
        ), leadtime AS (
          SELECT p.fornecedorCodigo AS codigo,
                 AVG(CAST(substr(p.entradaCdam, 1, 10) AS date) - CAST(substr(p.emissao, 1, 10) AS date)) AS leadtime_medio_dias,
                 COUNT(*) AS entregas_com_data
            FROM pedidos p
           WHERE p.destino = 'Fornecedor'
             AND p.status <> 'Cancelado'
             AND p.lojaId NOT IN (${sqlLojasForaPortal})
             AND p.entradaCdam IS NOT NULL
             AND substr(p.emissao, 1, 10) BETWEEN ? AND ?
           GROUP BY p.fornecedorCodigo
        )
        SELECT f.codigo, f.nome,
               COALESCE(pp.pedidos, 0) AS pedidos,
               COALESCE(pp.pedidas, 0) AS unidades_pedidas,
               COALESCE(pp.atendidas, 0) AS unidades_atendidas,
               CASE WHEN COALESCE(pp.pedidas, 0) > 0
                    THEN ROUND(CAST((pp.atendidas * 100.0) / pp.pedidas AS numeric), 2) END AS fill_rate_pct,
               CASE WHEN lt.leadtime_medio_dias IS NOT NULL
                    THEN ROUND(CAST(lt.leadtime_medio_dias AS numeric), 2) END AS leadtime_medio_dias,
               COALESCE(lt.entregas_com_data, 0) AS entregas_com_data
          FROM fornecedores f
          LEFT JOIN pedidos_periodo pp ON pp.codigo = f.codigo
          LEFT JOIN leadtime lt ON lt.codigo = f.codigo
         ORDER BY LOWER(f.nome), f.codigo`,
      )
      .all(corte.inicio, corte.fim, corte.inicio, corte.fim);
    return { periodos: periodoDisponiveis, periodo: corte, rows };
  });
