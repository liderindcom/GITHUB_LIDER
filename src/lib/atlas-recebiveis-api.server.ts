import { db } from "@/server/db";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function optionalInteger(params: URLSearchParams, name: string) {
  const value = params.get(name)?.trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) throw new Error(`${name} inválido`);
  return Number(value);
}

export function atlasRecebiveis(params: URLSearchParams) {
  try {
    const vencimento = optionalInteger(params, "vencimento");
    const filial = optionalInteger(params, "filial");
    const filters = ["r.status = 'success'", "d.source_run_id = (SELECT run_id FROM atlas_rms_recebiveis_runs WHERE status = 'success' ORDER BY finished_at DESC NULLS LAST, observed_at DESC LIMIT 1)"];
    const values: unknown[] = [];
    if (vencimento !== null) {
      filters.push("d.data_vencimento_rms = ?");
      values.push(vencimento);
    }
    if (filial !== null) {
      filters.push("d.codigo_filial = ?");
      values.push(filial);
    }
    const rows = db
      .prepare(
        `SELECT d.data_vencimento_rms, d.codigo_filial, d.status_recebimento_rms,
                d.status_credito_rms, d.quantidade_titulos,
                d.valor_nominal, d.valor_desconto, d.valor_abatimento,
                d.valor_juros, d.valor_correcao, d.valor_pago_registrado,
                d.valor_liquido_calculado, d.quantidade_com_credito_rms,
                d.observed_at
           FROM atlas_rms_recebiveis_daily d
           JOIN atlas_rms_recebiveis_runs r ON r.run_id = d.source_run_id
          WHERE ${filters.join(" AND ")}
          ORDER BY d.data_vencimento_rms DESC, d.codigo_filial,
                   d.status_recebimento_rms, d.status_credito_rms`,
      )
      .all(...values) as Array<Record<string, unknown>>;
    const summary = rows.reduce(
      (total, row) => {
        const amount = Number(row.valor_liquido_calculado || 0);
        total.quantidadeTitulos += Number(row.quantidade_titulos || 0);
        total.valorNominal += Number(row.valor_nominal || 0);
        total.valorLiquido += amount;
        if (row.status_recebimento_rms === "aberto_rms") {
          total.titulosAbertos += Number(row.quantidade_titulos || 0);
          total.valorLiquidoAberto += amount;
        }
        if (row.status_recebimento_rms === "baixado_registrado") {
          total.titulosBaixados += Number(row.quantidade_titulos || 0);
          total.valorLiquidoBaixado += amount;
        }
        return total;
      },
      {
        quantidadeTitulos: 0,
        valorNominal: 0,
        valorLiquido: 0,
        titulosAbertos: 0,
        valorLiquidoAberto: 0,
        titulosBaixados: 0,
        valorLiquidoBaixado: 0,
      },
    );
    return json({
      source: "postgresql_integrador",
      originHotPath: false,
      reconciliationStatus: rows.length ? "registro_rms_sem_conciliacao_bancaria" : "sem_dados",
      dataQualityStatus: rows.length ? "amostra_tecnica_validada" : "sem_dados",
      warnings: [
        "Baixado no RMS não prova crédito conciliado no banco.",
        "Esta visão contém apenas recebíveis; não representa fluxo de caixa consolidado.",
      ],
      filters: { vencimento, filial },
      summary,
      rows,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "consulta indisponível";
    return json({ error: /inválido/.test(detail) ? "invalid_filter" : "recebiveis_database_unavailable", detail }, /inválido/.test(detail) ? 400 : 503);
  }
}
