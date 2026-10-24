import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { fetchControlePromotoresResumo } from "@/api";

type Supplier = {
  fornecedor_codigo: string;
  descricao_fornecedor: string;
  segmentos_ativos?: string[];
  modelo_atendimento?: string;
  modelo_atendimento_rotulo?: string;
  familias_produto_ativas?: number;
  sessoes_treinamento_loja_mes?: number;
  ciclo_reciclagem_dias?: number | null;
  promotores_observados: number;
  promotores_necessarios_recomendados: number;
  horas_observadas: number;
  lojas_com_presenca: number;
  visitas_observadas?: number;
  visitas_planejadas_mes?: number;
  itens_movimentados_mes?: number;
  necessidade_operacional_horas_mes?: number;
  venda_media_mensal?: number;
  periodos_base_planejados_mes?: number;
  periodos_capacidade_por_promotor_mes?: number;
  periodos_reforco_compartilhado_mes?: number;
  periodos_trabalho_em_equipe_mes?: number;
  reforco_simultaneo_maximo_promotores?: number;
  dias_uteis_planejamento_mes?: number;
  horas_agendaveis_por_promotor_mes?: number;
  jornada_agendavel_horas_semana?: number;
  jornada_legal_horas_semana?: number;
  folgas_legais_semana?: number;
  regra_jornada_legal?: string;
  skus_ativos_media_loja?: number;
  skus_ativos_maximo_loja?: number;
  teto_promotores_fornecedor?: number;
};

export const Route = createFileRoute("/_portal/controle-promotores")({
  component: ControlePromotores,
});

function ControlePromotores() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;
  const totalPaginas = Math.max(1, Math.ceil(rows.length / porPagina));
  const rowsPagina = rows.slice((pagina - 1) * porPagina, pagina * porPagina);

  useEffect(() => {
    void fetchControlePromotoresResumo().then((data) => setRows(data as Supplier[]));
  }, []);

  return (
    <PortalLayout
      titulo="Controle de Promotores"
      descricao="Visão interna por fornecedor: equipe observada e necessidade calculada por agenda."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> Somente Líder · informativo · sem obrigação automática
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Fornecedores</p>
              <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Promotores presentes</p>
              <p className="mt-1 text-2xl font-semibold">
                {rows.reduce((sum, row) => sum + row.promotores_observados, 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Promotores necessários</p>
              <p className="mt-1 text-2xl font-semibold">
                {rows.reduce((sum, row) => sum + row.promotores_necessarios_recomendados, 0)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Como ler:</strong> a necessidade fixa considera os
          modelo de atendimento. No operacional, usa SKUs, reposição, clusters e frequência. Em Home
          Center e FarmaLíder, usa consultoria técnica; no Magazan, consultoria de vendas. Esses
          segmentos são calculados por sessões, famílias de produtos, módulos e reciclagem. O modelo
          híbrido combina treinamento e execução. Cidades diferentes não compartilham o mesmo
          período, e o teto continua em 20 por fornecedor.
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[2350px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Segmento</th>
                <th className="p-3">Modelo</th>
                <th className="p-3">Venda média/mês</th>
                <th className="p-3">Promotores necessários</th>
                <th className="p-3">Promotores presentes</th>
                <th className="p-3">Reforço/períodos</th>
                <th className="p-3">Trabalho em equipe/períodos</th>
                <th className="p-3">Máx. reforço simultâneo</th>
                <th className="p-3">Períodos base</th>
                <th className="p-3">Capacidade/promotor</th>
                <th className="p-3">Dias úteis</th>
                <th className="p-3">Horas agendáveis/promotor</th>
                <th className="p-3">Jornada legal</th>
                <th className="p-3">Folgas legais/semana</th>
                <th className="p-3">SKUs médios/loja</th>
                <th className="p-3">Máx. SKUs/loja</th>
                <th className="p-3">Famílias ativas</th>
                <th className="p-3">Sessões/loja/mês</th>
                <th className="p-3">Reciclagem</th>
                <th className="p-3">Visitas planejadas/mês</th>
                <th className="p-3">Horas necessárias/mês</th>
                <th className="p-3">Itens movimentados/mês</th>
                <th className="p-3">Visitas observadas</th>
                <th className="p-3">Horas observadas</th>
                <th className="p-3">Lojas presentes</th>
              </tr>
            </thead>
            <tbody>
              {rowsPagina.map((row) => (
                <tr key={row.fornecedor_codigo} className="border-t">
                  <td className="p-3 font-mono">{row.fornecedor_codigo}</td>
                  <td className="p-3">{row.descricao_fornecedor}</td>
                  <td className="p-3">{(row.segmentos_ativos ?? []).join(" · ") || "—"}</td>
                  <td className="p-3 font-medium">
                    {row.modelo_atendimento_rotulo ?? "Não classificado"}
                  </td>
                  <td className="p-3">
                    R${" "}
                    {(row.venda_media_mensal ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="p-3 font-semibold">{row.promotores_necessarios_recomendados}</td>
                  <td className="p-3">{row.promotores_observados}</td>
                  <td className="p-3 font-semibold">
                    {row.periodos_reforco_compartilhado_mes ?? 0}
                  </td>
                  <td className="p-3">{row.periodos_trabalho_em_equipe_mes ?? 0}</td>
                  <td className="p-3">{row.reforco_simultaneo_maximo_promotores ?? 0}</td>
                  <td className="p-3">{row.periodos_base_planejados_mes ?? 0}</td>
                  <td className="p-3">{row.periodos_capacidade_por_promotor_mes ?? 0}</td>
                  <td className="p-3">{row.dias_uteis_planejamento_mes ?? "—"}</td>
                  <td className="p-3">
                    {row.horas_agendaveis_por_promotor_mes?.toFixed(2) ?? "—"}h
                  </td>
                  <td className="p-3" title={row.regra_jornada_legal}>
                    {row.jornada_legal_horas_semana ?? "—"}h/semana
                  </td>
                  <td className="p-3">{row.folgas_legais_semana ?? "—"}</td>
                  <td className="p-3">{(row.skus_ativos_media_loja ?? 0).toFixed(1)}</td>
                  <td className="p-3">{row.skus_ativos_maximo_loja ?? 0}</td>
                  <td className="p-3">{row.familias_produto_ativas ?? "—"}</td>
                  <td className="p-3">
                    {row.modelo_atendimento === "OPERACIONAL_REPOSICAO"
                      ? "—"
                      : (row.sessoes_treinamento_loja_mes ?? "—")}
                  </td>
                  <td className="p-3">
                    {row.ciclo_reciclagem_dias ? `${row.ciclo_reciclagem_dias} dias` : "—"}
                  </td>
                  <td className="p-3">{row.visitas_planejadas_mes ?? "—"}</td>
                  <td className="p-3">{(row.necessidade_operacional_horas_mes ?? 0).toFixed(2)}</td>
                  <td className="p-3">
                    {(row.itens_movimentados_mes ?? 0).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="p-3">{row.visitas_observadas ?? "—"}</td>
                  <td className="p-3">{row.horas_observadas.toFixed(2)}</td>
                  <td className="p-3">{row.lojas_com_presenca}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Exibindo {rows.length ? (pagina - 1) * porPagina + 1 : 0}–
            {Math.min(pagina * porPagina, rows.length)} de {rows.length}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-1.5 disabled:opacity-50"
              disabled={pagina === 1}
              onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
            >
              Anterior
            </button>
            <button
              className="rounded-md border px-3 py-1.5 disabled:opacity-50"
              disabled={pagina === totalPaginas}
              onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
