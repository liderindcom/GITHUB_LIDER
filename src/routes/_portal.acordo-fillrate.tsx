import { createFileRoute } from "@tanstack/react-router";
import { Download, AlertTriangle, CheckCircle2, DollarSign, Percent } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import { brl, numero, dataBR } from "@/lib/format";
import { fetchFillrateAcordo, FILLRATE_TAXA_PADRAO, FILLRATE_META_PADRAO } from "@/api";
import {
  fillRateGeral,
  fillRatePedido,
  pedidos,
  totalPedido,
  quantidadesPedido,
  nomeLoja,
} from "@/lib/mock-data";
import { formatarNumeroPedido } from "@/lib/pedido-numero";
import { mesAtualIso, mesFechadoIso } from "@/lib/pedidos-janela";

export const Route = createFileRoute("/_portal/acordo-fillrate")({
  head: () => ({
    meta: [
      { title: "Acordo Fill Rate Mínimo | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhamento de acordos de entrega mínima (Fill Rate) e penalidades.",
      },
    ],
  }),
  component: AcordoFillRatePage,
});

function AcordoFillRatePage() {
  const { fornecedor, codigoFornecedorAtivo, dadosFornecedorVersao } = usePortal();
  
  // Obter meses disponíveis dinamicamente dos pedidos
  const mesesDisponiveis = useMemo(() => {
    const mesesSet = new Set<string>();
    for (const p of pedidos) {
      if (p.emissao) {
        mesesSet.add(p.emissao.slice(0, 7)); // 'YYYY-MM'
      }
    }
    return Array.from(mesesSet).sort().reverse();
  }, [pedidos, dadosFornecedorVersao]);

  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [metaFillRate, setMetaFillRate] = useState<number>(FILLRATE_META_PADRAO);
  const [taxaMulta, setTaxaMulta] = useState<number>(FILLRATE_TAXA_PADRAO);

  useEffect(() => {
    if (mesesDisponiveis.length === 0) return;
    const fechado = mesFechadoIso();
    if (mesesDisponiveis.includes(fechado)) {
      setMesSelecionado(fechado);
    } else {
      setMesSelecionado(mesesDisponiveis[0]);
    }
  }, [mesesDisponiveis]);

  useEffect(() => {
    let ativo = true;
    fetchFillrateAcordo({ data: codigoFornecedorAtivo })
      .then((acordo) => {
        if (!ativo) return;
        setMetaFillRate(acordo.metaFillRatePct);
        setTaxaMulta(acordo.taxaMultaPct);
      })
      .catch(() => {
        if (!ativo) return;
        setMetaFillRate(FILLRATE_META_PADRAO);
        setTaxaMulta(FILLRATE_TAXA_PADRAO);
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo]);

  const formatarMes = (anoMes: string) => {
    if (!anoMes) return "";
    const [ano, mes] = anoMes.split("-");
    const nomes = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
      "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
      "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
    };
    return `${nomes[mes as keyof typeof nomes] || mes}/${ano}`;
  };

  // Filtrar os pedidos do mês selecionado e fornecedor
  const mesCorrente = mesAtualIso();
  const pedidosDoMes = useMemo(() => {
    if (!mesSelecionado) return [];
    return pedidos.filter((p) => {
      const mes = p.emissao ? p.emissao.slice(0, 7) : "";
      return mes === mesSelecionado && p.destino === "Fornecedor";
    });
  }, [pedidos, mesSelecionado, dadosFornecedorVersao]);

  const ultimoImportadoMes = useMemo(() => {
    let max = "";
    for (const p of pedidosDoMes) {
      const iso = (p.emissao || "").slice(0, 10);
      if (iso > max) max = iso;
    }
    return max;
  }, [pedidosDoMes]);

  const metricas = useMemo(() => {
    let totalQtdPedida = 0;
    let totalQtdFaturada = 0;
    let totalValorEntregue = 0;
    let totalValorPedido = 0;
    let totalPedidosAbaixo = 0;
    let qtdPedidosAbaixo = 0;

    for (const p of pedidosDoMes) {
      if (p.status === "Cancelado") continue;
      const valPedido = totalPedido(p);
      totalValorPedido += valPedido;
      const fillPedido = fillRatePedido(p);
      if (fillPedido < metaFillRate) {
        totalPedidosAbaixo += valPedido;
        qtdPedidosAbaixo += 1;
      }
      for (const item of p.itens) {
        totalQtdPedida += item.quantidadePedida;
        totalQtdFaturada += item.quantidadeFaturada;
        totalValorEntregue += item.quantidadeFaturada * item.precoUnitario;
      }
    }

    const fillRateReal = fillRateGeral(pedidosDoMes);
    const atingiuMeta = fillRateReal >= metaFillRate;
    const valorMulta = atingiuMeta ? 0 : totalPedidosAbaixo * (taxaMulta / 100);

    return {
      totalQtdPedida,
      totalQtdFaturada,
      totalValorPedido,
      totalValorEntregue,
      totalPedidosAbaixo,
      qtdPedidosAbaixo,
      fillRateReal,
      atingiuMeta,
      valorMulta
    };
  }, [pedidosDoMes, metaFillRate, taxaMulta]);

  // Função para simular exportação
  function exportarRelatorio() {
    toast.success("Relatório de Fill Rate exportado com sucesso!", {
      description: `Período: ${formatarMes(mesSelecionado)} | Fornecedor: ${fornecedor.nome}`,
    });
  }

  return (
    <PortalLayout
      titulo="Acordo de Fill Rate Mínimo"
      descricao="Mês fechado por padrão. O mês atual vai até o último dia importado. Multa de 3% só se a meta do mês não for atingida, e só sobre os pedidos abaixo do fill rate combinado."
    >
      <div className="space-y-6">
        {/* Controles do Relatório */}
        <Card className="border-border bg-card shadow-panel">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-4 sm:grid-cols-3 md:flex md:items-center md:gap-6">
                {/* Seleção do Mês */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mês de Referência</label>
                  <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                    <SelectTrigger className="w-full sm:w-[240px] bg-background">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {mesesDisponiveis.map((m) => {
                        const aberto = m === mesCorrente;
                        const ate = aberto && ultimoImportadoMes ? ` até ${dataBR(ultimoImportadoMes)}` : "";
                        return (
                          <SelectItem key={m} value={m}>
                            {formatarMes(m)} {aberto ? `(em curso${ate})` : "(fechado)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Meta: espelho do pacto individual gravado no acesso */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta Pactuada</label>
                  <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3">
                    <Percent className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-sm font-bold">{metaFillRate}%</span>
                    <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">pacto do fornecedor</span>
                  </div>
                </div>

                {/* Taxa da multa: espelho da política única da rede */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Taxa da Multa</label>
                  <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3">
                    <Percent className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-sm font-bold">{taxaMulta}%</span>
                    <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">política da rede</span>
                  </div>
                </div>
              </div>

              <div className="flex items-end self-end md:self-auto">
                <Button onClick={exportarRelatorio} className="gap-2">
                  <Download className="size-4" />
                  <span>Exportar Planilha</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-bold uppercase tracking-wider text-foreground">Como o cálculo é feito</p>
          <p>
            Fill rate do mês = quantidade faturada ÷ quantidade pedida (exceto cancelados). Escolha o mês no seletor — o atual conta até o último dia importado
            {mesSelecionado === mesCorrente && ultimoImportadoMes ? ` (${dataBR(ultimoImportadoMes)})` : ""}.
            Meta deste fornecedor: <span className="font-semibold text-foreground">{metaFillRate}%</span>.
            Se o mês ficar abaixo da meta, a multa é <span className="font-semibold text-foreground">{taxaMulta}% sobre o total dos pedidos cujo fill rate ficou abaixo de {metaFillRate}%</span>.
            Se atingir a meta, não há multa.
          </p>
        </div>

        {/* Quadro Geral de Métricas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Meta de Serviço */}
          <Card className="border-border bg-card shadow-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Meta Acordada</span>
              <Percent className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-primary">{metaFillRate}.0%</div>
              <p className="mt-1 text-xs text-muted-foreground">Pacto contratado com este fornecedor.</p>
            </CardContent>
          </Card>

          {/* Card 2: Realizado */}
          <Card className={`border-border bg-card shadow-panel border-l-4 ${metricas.atingiuMeta ? "border-l-success" : "border-l-destructive"}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Fill Rate Realizado</span>
              {metricas.atingiuMeta ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <AlertTriangle className="size-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${metricas.atingiuMeta ? "text-success" : "text-destructive"}`}>
                {metricas.fillRateReal.toFixed(1)}%
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {mesSelecionado === mesCorrente && ultimoImportadoMes
                  ? `Parcial até ${dataBR(ultimoImportadoMes)}.`
                  : metricas.atingiuMeta
                    ? "Nível de serviço atingido."
                    : "Abaixo da meta estabelecida."}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Entregas */}
          <Card className="border-border bg-card shadow-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Volume de Entregas</span>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{brl(metricas.totalValorEntregue)}</div>
              <p className="mt-1 text-xs text-muted-foreground">Faturado sobre {pedidosDoMes.length} pedidos.</p>
            </CardContent>
          </Card>

          {/* Card 4: Penalidade */}
          <Card className={`border-border bg-card shadow-panel ${metricas.valorMulta > 0 ? "bg-destructive/5 border-destructive/20" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Multa a Cobrar ({taxaMulta}%)</span>
              <Percent className={`size-4 ${metricas.valorMulta > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${metricas.valorMulta > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {brl(metricas.valorMulta)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metricas.valorMulta > 0
                  ? `${taxaMulta}% sobre ${brl(metricas.totalPedidosAbaixo)} (${metricas.qtdPedidosAbaixo} pedidos abaixo da meta).`
                  : "Isento de penalidades."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Informativo sobre a cobrança */}
        {!metricas.atingiuMeta && metricas.totalPedidosAbaixo > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/10 p-4 text-destructive">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold">Penalidade de Entrega Mínima Ativada</p>
              <p className="text-xs opacity-90 leading-relaxed">
                Fill rate do período: <span className="font-bold">{metricas.fillRateReal.toFixed(1)}%</span>, abaixo da meta de <span className="font-bold">{metaFillRate}%</span>.
                Multa de <span className="font-bold">{taxaMulta}%</span> sobre o total dos <span className="font-bold">{metricas.qtdPedidosAbaixo}</span> pedidos abaixo do fill rate combinado
                ({brl(metricas.totalPedidosAbaixo)}). Penalidade: <span className="font-bold font-mono">{brl(metricas.valorMulta)}</span>.
              </p>
            </div>
          </div>
        )}

        {/* Tabela de Detalhamento dos Pedidos */}
        <Card className="border-border bg-card shadow-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border bg-muted/20">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Pedidos do Período</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">Filtrando {pedidosDoMes.length} pedidos</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table
              containerClassName="max-h-[500px]"
              className="border-separate border-spacing-0"
            >
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                <TableRow className="hover:bg-transparent bg-muted/40 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                    <TableHead className="px-4 py-3">Número</TableHead>
                    <TableHead className="px-4 py-3">Emissão</TableHead>
                    <TableHead className="px-4 py-3">Loja Destino</TableHead>
                    <TableHead className="px-4 py-3 text-right">Qtd Pedida</TableHead>
                    <TableHead className="px-4 py-3 text-right">Qtd Faturada</TableHead>
                    <TableHead className="px-4 py-3 text-center">Fill Rate</TableHead>
                    <TableHead className="px-4 py-3 text-right">Valor Pedido</TableHead>
                    <TableHead className="px-4 py-3 text-right">Valor Entregue</TableHead>
                    <TableHead className="px-4 py-3 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosDoMes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum pedido de fornecedor registrado neste mês.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pedidosDoMes.map((pedido) => {
                      const totaisPed = quantidadesPedido(pedido);
                      const fillRatePed = fillRatePedido(pedido);
                      const valPedido = totalPedido(pedido);
                      const abaixoMeta = pedido.status !== "Cancelado" && fillRatePed < metaFillRate;
                      const valFaturado = pedido.itens.reduce((acc, item) => acc + item.quantidadeFaturada * item.precoUnitario, 0);

                      return (
                        <TableRow
                          key={`${pedido.numero}-${pedido.lojaId}`}
                          className={`font-mono text-xs hover:bg-muted/30 ${abaixoMeta ? "bg-destructive/5" : ""}`}
                        >
                          <TableCell className="px-4 py-2.5 font-bold text-primary">{formatarNumeroPedido(pedido.numero)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-muted-foreground">{pedido.emissao ? dataBR(pedido.emissao) : ""}</TableCell>
                          <TableCell className="px-4 py-2.5 text-muted-foreground">
                            {nomeLoja(pedido.lojaId)}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right">{numero(totaisPed.pedida)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-right">{numero(totaisPed.faturada)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-center">
                            <span className={`font-bold px-1.5 py-0.5 rounded ${fillRatePed >= metaFillRate ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {fillRatePed.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right">{brl(valPedido)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-right font-bold">{brl(valFaturado)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[0.65rem] font-bold ${
                              pedido.status === "Entregue" ? "bg-success/15 text-success border border-success/20" :
                              pedido.status === "Faturado" ? "bg-primary/15 text-primary border border-primary/20" :
                              "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                            }`}>
                              {pedido.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
