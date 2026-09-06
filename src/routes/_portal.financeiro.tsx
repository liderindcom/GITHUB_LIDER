import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";
import { BadgeCheck, Calculator, FileText, Landmark } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import { brl, dataBR, percentual } from "@/lib/format";
import {
  TAXA_ANTECIPACAO_MENSAL,
  calcularDescontoAntecipacao,
  faturasDoFornecedor,
  nomeLoja,
  rotuloModeloEntrega,
} from "@/lib/mock-data";
import { fetchContasReceber, type ContaReceberDB } from "@/api";

export const Route = createFileRoute("/_portal/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro e Antecipação | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Notas do fornecedor para o Grupo Líder, com data de pagamento e desconto financeiro do cadastro, e simulador de antecipação.",
      },
      { property: "og:title", content: "Financeiro e Antecipação | Portal do Fornecedor" },
      {
        property: "og:description",
        content:
          "Previsão de pagamento a partir do cadastro e simulação de antecipação pró-rata die.",
      },
    ],
  }),
  component: FinanceiroPage,
});

const hoje = new Date();

function FinanceiroPage() {
  const { registrarAntecipacao, antecipacoes, fornecedor, dadosFornecedorVersao } = usePortal();
  const [contasReceber, setContasReceber] = useState<ContaReceberDB[]>([]);

  useEffect(() => {
    fetchContasReceber({ data: fornecedor.codigo }).then(setContasReceber).catch(() => setContasReceber([]));
  }, [fornecedor.codigo, dadosFornecedorVersao]);
  const cadastro = fornecedor.cadastroFinanceiro;

  const titulos = useMemo(
    () => faturasDoFornecedor(fornecedor.codigo),
    [fornecedor.codigo, dadosFornecedorVersao],
  );
  const aVencer = useMemo(() => titulos.filter((f) => f.status === "A vencer"), [titulos]);
  const debitoVencido = useMemo(() => {
    const hojeIso = hoje.toISOString().slice(0, 10);
    return contasReceber.filter((conta) => conta.status !== "Descontado" && conta.vencimento && conta.vencimento < hojeIso).reduce((total, conta) => total + Number(conta.valor || 0), 0);
  }, [contasReceber]);

  const [selecionadas, setSelecionadas] = useState<string[]>([aVencer[0]?.id ?? ""]);


  // Configurações do cálculo da Líder Fomento (salvas no localStorage)
  const [fomentoConfig, setFomentoConfig] = useState(() => {
    const defaultVal = {
      ate5k: 5.0,
      ate10k: 4.5,
      ate100k: 4.0,
      acima100k: 3.5,
      floatDias: 1,
      adValoremPct: 1.0,
      tarifaPorNota: 10.0,
      regimeIof: "simples", // simples ou geral
    };
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("fomento_config_taxas");
      if (saved) {
        try {
          return { ...defaultVal, ...JSON.parse(saved) };
        } catch (e) {
          return defaultVal;
        }
      }
    }
    return defaultVal;
  });

  const [exibirConfig, setExibirConfig] = useState(false);

  // Função para salvar configurações e disparar atualização
  const salvarConfig = (novaConfig: typeof fomentoConfig) => {
    setFomentoConfig(novaConfig);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("fomento_config_taxas", JSON.stringify(novaConfig));
    }
  };

  const simulacaoFomento = useMemo(() => {
    const itens = aVencer
      .filter((f) => selecionadas.includes(f.id))
      .map((f) => {
        const pz = Math.max(
          0,
          differenceInCalendarDays(new Date(`${f.emissao}T12:00:00`), hoje) + 30,
        );
        const diasTotais = pz + Number(fomentoConfig.floatDias);

        // Determinar taxa com base no valor total das notas selecionadas (coerente com os PDFs do borderô)
        const totalFaturamento = aVencer
          .filter((aux) => selecionadas.includes(aux.id))
          .reduce((acc, aux) => acc + aux.valor, 0);

        let taxaMensalPct = fomentoConfig.acima100k;
        if (totalFaturamento < 5000) {
          taxaMensalPct = fomentoConfig.ate5k;
        } else if (totalFaturamento < 10000) {
          taxaMensalPct = fomentoConfig.ate10k;
        } else if (totalFaturamento < 100000) {
          taxaMensalPct = fomentoConfig.ate100k;
        }

        const taxaMensal = taxaMensalPct / 100;

        // Deságio (Dif. de Compra): calculada sobre o valor líquido
        const desagio = Math.max(
          0,
          Number((f.valorLiquido * (taxaMensal / 30) * diasTotais).toFixed(2)),
        );

        // Ad Valorem: % sobre o Valor Bruto (Face)
        const adValorem = Math.max(
          0,
          Number((f.valor * (fomentoConfig.adValoremPct / 100)).toFixed(2)),
        );

        // Tarifa por nota
        const tarifa = Number(fomentoConfig.tarifaPorNota);

        // ISS: 5% sobre o Ad Valorem
        const iss = Math.max(0, Number((adValorem * 0.05).toFixed(2)));

        // IOF:
        // - Adicional: 0.38% sobre (Valor Bruto - Deságio)
        // - Diário: 0.00137% (simples) ou 0.0041% (geral) por dia sobre (Valor Bruto - Deságio)
        const iofDiarioTaxa = fomentoConfig.regimeIof === "simples" ? 0.0000137 : 0.000041;
        const iofBase = Math.max(0, f.valorLiquido - desagio);
        const iofAdicional = Number((iofBase * 0.0038).toFixed(2));
        const iofDiario = Number((iofBase * iofDiarioTaxa * diasTotais).toFixed(2));
        const iof = Math.max(0, Number((iofAdicional + iofDiario).toFixed(2)));

        // Líquido do item: Valor Líquido - Deságio - Ad Valorem - Tarifa - ISS - IOF
        const liquido = Math.max(
          0,
          Number((f.valorLiquido - desagio - adValorem - tarifa - iss - iof).toFixed(2)),
        );

        return {
          fatura: f,
          pz,
          diasTotais,
          taxaMensalPct,
          desagio,
          adValorem,
          tarifa,
          iss,
          iof,
          liquido,
        };
      });

    const bruto = itens.reduce((acc, i) => acc + i.fatura.valor, 0);
    const descontoFinanceiro = itens.reduce((acc, i) => acc + i.fatura.descontoFinanceiro, 0);
    const desagioTotal = itens.reduce((acc, i) => acc + i.desagio, 0);
    const adValoremTotal = itens.reduce((acc, i) => acc + i.adValorem, 0);
    const tarifasTotal = itens.reduce((acc, i) => acc + i.tarifa, 0);
    const issTotal = itens.reduce((acc, i) => acc + i.iss, 0);
    const iofTotal = itens.reduce((acc, i) => acc + i.iof, 0);
    const impostosDiversosTotal = Number((issTotal + iofTotal).toFixed(2));
    const liquidoAntesDebito = itens.reduce((acc, i) => acc + i.liquido, 0);
    const liquidoTotal = Math.max(0, Number((liquidoAntesDebito - debitoVencido).toFixed(2)));
    const descontoTotal = Number(
      (
        descontoFinanceiro +
        desagioTotal +
        adValoremTotal +
        tarifasTotal +
        impostosDiversosTotal +
        debitoVencido
      ).toFixed(2),
    );

    return {
      itens,
      bruto,
      descontoFinanceiro,
      desagioTotal,
      adValoremTotal,
      tarifasTotal,
      issTotal,
      iofTotal,
      impostosDiversosTotal,
      debitoVencido,
      liquidoAntesDebito,
      descontoTotal,
      liquido: liquidoTotal,
    };
  }, [aVencer, selecionadas, fomentoConfig, debitoVencido]);

  async function solicitarFomento() {
    if (!cadastro.anticipationEnabled) {
      toast.error("Antecipação não habilitada no cadastro deste fornecedor.");
      return;
    }
    if (simulacaoFomento.itens.length === 0) {
      toast.error("Selecione ao menos um título para antecipar.");
      return;
    }
    try {
      const registro = await registrarAntecipacao({
        faturaIds: simulacaoFomento.itens.map((i) => i.fatura.id),
        valorBruto: simulacaoFomento.bruto,
        desconto: simulacaoFomento.descontoTotal,
        valorLiquido: simulacaoFomento.liquido,
      });
      
      if (registro.emailEnviado === false) {
        toast.warning("Solicitação de antecipação registrada (Líder Fomento), mas houve falha ao enviar o e-mail de notificação.", {
          description: `Protocolo ${registro.codigoAuditoria} · líquido ${brl(registro.valorLiquido)}. Erro: ${registro.erroEmail || 'Falha SMTP'}`,
          duration: 8000,
        });
      } else {
        toast.success("Solicitação de antecipação registrada e e-mails enviados com sucesso! (Líder Fomento)", {
          description: `Protocolo ${registro.codigoAuditoria} · líquido ${brl(registro.valorLiquido)}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao solicitar antecipação.");
    }
  }

  const resumoTitulos = useMemo(() => {
    const brutoAberto = aVencer.reduce((acc, f) => acc + f.valor, 0);
    const descFinAberto = aVencer.reduce((acc, f) => acc + f.descontoFinanceiro, 0);
    const liquidoAberto = aVencer.reduce((acc, f) => acc + f.valorLiquido, 0);
    return { brutoAberto, descFinAberto, liquidoAberto, qtdAberto: aVencer.length };
  }, [aVencer]);



  function alternar(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }



  return (
    <PortalLayout
      titulo="Financeiro"
      descricao="Notas em aberto do fornecedor para o Grupo Líder. Pagas ficam no RMS para depois."
    >
      <div className="space-y-4">
        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" /> Cadastro financeiro
            </CardTitle>
            <CardDescription>
              Condição comercial do fornecedor junto ao Grupo Líder — base para data de pagamento e
              desconto financeiro das notas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCadastro
                rotulo="Fornecedor fiscal"
                valor={`${fornecedor.codigo} · ${fornecedor.nome}`}
              />
              <InfoCadastro
                rotulo="Fornecedor comercial"
                valor={
                  fornecedor.fornecedorComercialCodigo &&
                  fornecedor.fornecedorComercialCodigo !== fornecedor.codigo
                    ? `${fornecedor.fornecedorComercialCodigo} · ${fornecedor.fornecedorComercialNome || "—"}`
                    : fornecedor.fornecedorComercialNome &&
                        fornecedor.fornecedorComercialNome !== fornecedor.nome
                      ? fornecedor.fornecedorComercialNome
                      : `${fornecedor.codigo} · ${fornecedor.nome}`
                }
              />
              <InfoCadastro rotulo="Destinatário das notas" valor={fornecedor.destinatario} />
              <InfoCadastro
                rotulo="Modelo de entrega"
                valor={rotuloModeloEntrega(fornecedor.modeloEntrega)}
              />
              <InfoCadastro
                rotulo="Agenda RMS (recebimento)"
                valor={
                  fornecedor.agendaRecebimentoCdam
                    ? `Agenda ${fornecedor.agendaRecebimentoCdam} · filial ${fornecedor.filialEntregaPadrao}`
                    : `Filial ${fornecedor.filialEntregaPadrao}`
                }
              />
              <InfoCadastro
                rotulo="Condição de pagamento"
                valor={cadastro.condicaoPagamentoLabel || "—"}
              />
              <InfoCadastro
                rotulo="Tipo de prazo"
                valor={
                  cadastro.prazoTipo === "DDR"
                    ? "DDR — dias do recebimento"
                    : cadastro.prazoTipo === "DDE"
                      ? "DDE — dias da emissão"
                      : "—"
                }
              />
              <InfoCadastro
                rotulo="Prazo (cadastro)"
                valor={
                  cadastro.prazoPagamentoDias != null
                    ? `${cadastro.prazoPagamentoDias} ${cadastro.prazoTipo ?? "dias"}`
                    : "—"
                }
              />
              <InfoCadastro
                rotulo="Desconto financeiro (cadastro)"
                valor={
                  cadastro.descontoFinanceiroPct > 0
                    ? percentual(cadastro.descontoFinanceiroPct)
                    : "Não há desconto financeiro no cadastro"
                }
              />
              <InfoCadastro
                rotulo="Em aberto (líquido)"
                valor={`${resumoTitulos.qtdAberto} notas · ${brl(resumoTitulos.liquidoAberto)}`}
              />
              <InfoCadastro
                rotulo="Desc. financeiro em aberto"
                valor={resumoTitulos.descFinAberto > 0 ? brl(resumoTitulos.descFinAberto) : "—"}
              />
              <InfoCadastro
                rotulo="Antecipação"
                valor={cadastro.anticipationEnabled ? "Habilitada" : "Não habilitada"}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="shadow-panel xl:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="size-4 text-primary" /> Notas do fornecedor → Grupo Líder
              </CardTitle>
              <CardDescription>
                Somente títulos em aberto. Pagas foram removidas desta visualização. Entrega no CDAM
                ou na loja. Transferência interna (65/66/148) fica de fora.
                {cadastro.prazoPagamentoDias != null
                  ? ` Pagamento = ${cadastro.prazoTipo === "DDR" ? "recebimento" : "emissão"} + ${cadastro.prazoPagamentoDias} dias${cadastro.prazoTipo ? ` (${cadastro.prazoTipo})` : ""}.`
                  : ""}
                {cadastro.descontoFinanceiroPct > 0
                  ? ` Desc. financeiro ${percentual(cadastro.descontoFinanceiroPct)}.`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="w-10" />
                      <TableHead>Nota</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Agenda</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Recebimento</TableHead>
                      <TableHead>
                        Pagamento previsto
                        {cadastro.prazoTipo ? ` (${cadastro.prazoTipo})` : ""}
                      </TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Desc. financeiro</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {titulos
                      .filter((f) => f.status !== "Pago")
                      .map((f) => {
                        const antecipavel = f.status === "A vencer" && cadastro.anticipationEnabled;
                        return (
                          <TableRow
                            key={f.id}
                            className={selecionadas.includes(f.id) ? "bg-accent/60" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selecionadas.includes(f.id)}
                                onCheckedChange={() => alternar(f.id)}
                                disabled={!antecipavel}
                                aria-label={`Selecionar ${f.numeroNota}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{f.numeroNota}</TableCell>
                            <TableCell className="max-w-[180px] truncate">
                              {nomeLoja(f.lojaId)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {f.agendaRms}
                            </TableCell>
                            <TableCell>{dataBR(f.emissao)}</TableCell>
                            <TableCell>{f.recebimento ? dataBR(f.recebimento) : "—"}</TableCell>
                            <TableCell className="font-medium">
                              {f.dataPagamento
                                ? dataBR(f.dataPagamento)
                                : cadastro.prazoTipo === "DDR"
                                  ? "Aguardando recebimento"
                                  : "—"}
                            </TableCell>
                            <TableCell className="text-right">{brl(f.valor)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {f.descontoFinanceiro > 0 ? `-${brl(f.descontoFinanceiro)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {brl(f.valorLiquido)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`border-0 ${
                                  f.status === "A vencer"
                                    ? "bg-warning-soft text-warning"
                                    : "bg-success-soft text-success"
                                }`}
                              >
                                {f.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {titulos.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={11}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhuma nota em aberto deste fornecedor.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-panel xl:col-span-2">
            <div className="w-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="size-4 text-primary" /> Simulador de antecipação (Líder Fomento)
                </CardTitle>
                <CardDescription>
                  Selecione notas na tabela ao lado para calcular o recebimento adiantado.
                </CardDescription>
              </CardHeader>


                <CardContent className="space-y-5 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Fator Líder Fomento</span>
                      <span className="font-bold text-primary">
                        {simulacaoFomento.itens[0]
                          ? percentual(simulacaoFomento.itens[0].taxaMensalPct)
                          : "—"}
                      </span>
                    </div>
                    {simulacaoFomento.bruto > 0 && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Faixa:{" "}
                        {simulacaoFomento.bruto < 5000
                          ? `< R$ 5.000 (${fomentoConfig.ate5k}%)`
                          : simulacaoFomento.bruto < 10000
                            ? `< R$ 10.000 (${fomentoConfig.ate10k}%)`
                            : simulacaoFomento.bruto < 100000
                              ? `< R$ 100.000 (${fomentoConfig.ate100k}%)`
                              : `>= R$ 100.000 (${fomentoConfig.acima100k}%)`}{" "}
                        com base no total de {brl(simulacaoFomento.bruto)}.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-xs max-h-[200px] overflow-y-auto">
                    {simulacaoFomento.itens.map((item) => (
                      <div
                        key={item.fatura.id}
                        className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-2 font-medium">
                          <span className="truncate">Nota {item.fatura.numeroNota}</span>
                          <span className="text-muted-foreground font-mono">
                            DDE 30d · cálculo: {item.pz}d · total: {item.diasTotais}d
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground font-mono">
                          <div>deságio: -{brl(item.desagio)}</div>
                          <div className="text-right">ad valorem: -{brl(item.adValorem)}</div>
                          <div>tarifa: -{brl(item.tarifa)}</div>
                          <div className="text-right">impostos: -{brl(item.iss + item.iof)}</div>
                        </div>
                        <div className="flex items-center justify-between font-medium pt-0.5 border-t border-border/20">
                          <span>Líquido:</span>
                          <span>{brl(item.liquido)}</span>
                        </div>
                      </div>
                    ))}
                    {simulacaoFomento.itens.length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        Nenhum título selecionado.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <Linha rotulo="Total bruto" valor={brl(simulacaoFomento.bruto)} />
                    {simulacaoFomento.descontoFinanceiro > 0 && (
                      <Linha
                        rotulo="(-) Desconto financeiro (cadastro)"
                        valor={`-${brl(simulacaoFomento.descontoFinanceiro)}`}
                        tom="danger"
                      />
                    )}
                    <Linha
                      rotulo="(-) Deságio (Dif. de Compra)"
                      valor={`-${brl(simulacaoFomento.desagioTotal)}`}
                      tom="danger"
                    />
                    <Linha
                      rotulo="(-) Ad Valorem"
                      valor={`-${brl(simulacaoFomento.adValoremTotal)}`}
                      tom="danger"
                    />
                    <Linha
                      rotulo="(-) Tarifas (Duplicatas)"
                      valor={`-${brl(simulacaoFomento.tarifasTotal)}`}
                      tom="danger"
                    />
                    <Linha
                      rotulo="(-) Impostos Diversos (ISS + IOF)"
                      valor={`-${brl(simulacaoFomento.impostosDiversosTotal)}`}
                      tom="danger"
                    />
                    <Linha
                      rotulo="(-) Débito vencido com o Líder"
                      valor={`-${brl(simulacaoFomento.debitoVencido)}`}
                      tom="danger"
                    />
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="font-semibold">Líquido a creditar (fomento)</span>
                      <span className="text-xl font-bold text-success">
                        {brl(simulacaoFomento.liquido)}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full font-medium"
                    onClick={solicitarFomento}
                    disabled={!cadastro.anticipationEnabled || simulacaoFomento.itens.length === 0}
                  >
                    Solicitar antecipação (Fomento)
                  </Button>

                  {antecipacoes.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Solicitações registradas
                      </p>
                      {antecipacoes.map((a) => (
                        <div key={a.codigoAuditoria} className="flex items-center gap-2 text-xs">
                          <BadgeCheck className="size-4 shrink-0 text-success" />
                          <span className="font-mono">{a.codigoAuditoria}</span>
                          <span className="ml-auto font-medium">{brl(a.valorLiquido)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-border/60 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-[11px] h-8"
                      onClick={() => setExibirConfig(!exibirConfig)}
                    >
                      {exibirConfig
                        ? "Ocultar Parâmetros da Taxa"
                        : "Configurar Parâmetros da Taxa"}
                    </Button>

                    {exibirConfig && (
                      <div className="mt-4 p-4 rounded-xl border border-border bg-muted/20 space-y-3 text-[11px]">
                        <p className="font-semibold text-xs text-foreground">
                          Parâmetros de Cálculo — Líder Fomento
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label
                              htmlFor="ate5k"
                              className="text-[10px] font-semibold text-muted-foreground"
                            >
                              Taxa &lt; R$ 5k (%)
                            </Label>
                            <Input
                              id="ate5k"
                              type="number"
                              step="0.1"
                              value={fomentoConfig.ate5k}
                              onChange={(e) =>
                                salvarConfig({ ...fomentoConfig, ate5k: Number(e.target.value) })
                              }
                              className="h-8 py-1 px-2 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="ate10k"
                              className="text-[10px] font-semibold text-muted-foreground"
                            >
                              Taxa &lt; R$ 10k (%)
                            </Label>
                            <Input
                              id="ate10k"
                              type="number"
                              step="0.1"
                              value={fomentoConfig.ate10k}
                              onChange={(e) =>
                                salvarConfig({ ...fomentoConfig, ate10k: Number(e.target.value) })
                              }
                              className="h-8 py-1 px-2 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="ate100k"
                              className="text-[10px] font-semibold text-muted-foreground"
                            >
                              Taxa &lt; R$ 100k (%)
                            </Label>
                            <Input
                              id="ate100k"
                              type="number"
                              step="0.1"
                              value={fomentoConfig.ate100k}
                              onChange={(e) =>
                                salvarConfig({ ...fomentoConfig, ate100k: Number(e.target.value) })
                              }
                              className="h-8 py-1 px-2 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="acima100k"
                              className="text-[10px] font-semibold text-muted-foreground"
                            >
                              Taxa &gt;= R$ 100k (%)
                            </Label>
                            <Input
                              id="acima100k"
                              type="number"
                              step="0.1"
                              value={fomentoConfig.acima100k}
                              onChange={(e) =>
                                salvarConfig({
                                  ...fomentoConfig,
                                  acima100k: Number(e.target.value),
                                })
                              }
                              className="h-8 py-1 px-2 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="floatDias"
                              className="text-[10px] font-semibold text-muted-foreground"
                            >
                              Float / D+ (dias)
                            </Label>
                            <Input
                              id="floatDias"
                              type="number"
                              step="1"
                              value={fomentoConfig.floatDias}
                              onChange={(e) =>
                                salvarConfig({
                                  ...fomentoConfig,
                                  floatDias: Number(e.target.value),
                                })
                              }
                              className="h-8 py-1 px-2 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="adValoremPct"
                              className="text-[10px] font-semibold text-muted-foreground"
                            >
                              Ad Valorem (%)
                            </Label>
                            <Input
                              id="adValoremPct"
                              type="number"
                              step="0.05"
                              value={fomentoConfig.adValoremPct}
                              onChange={(e) =>
                                salvarConfig({
                                  ...fomentoConfig,
                                  adValoremPct: Number(e.target.value),
                                })
                              }
                              className="h-8 py-1 px-2 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label
                                  htmlFor="tarifaPorNota"
                                  className="text-[10px] font-semibold text-muted-foreground"
                                >
                                  Tarifa / Nota (R$)
                                </Label>
                                <Input
                                  id="tarifaPorNota"
                                  type="number"
                                  step="1"
                                  value={fomentoConfig.tarifaPorNota}
                                  onChange={(e) =>
                                    salvarConfig({
                                      ...fomentoConfig,
                                      tarifaPorNota: Number(e.target.value),
                                    })
                                  }
                                  className="h-8 py-1 px-2 font-mono text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label
                                  htmlFor="regimeIof"
                                  className="text-[10px] font-semibold text-muted-foreground"
                                >
                                  Regime (IOF)
                                </Label>
                                <select
                                  id="regimeIof"
                                  value={fomentoConfig.regimeIof}
                                  onChange={(e) =>
                                    salvarConfig({ ...fomentoConfig, regimeIof: e.target.value })
                                  }
                                  className="w-full rounded-md border border-input bg-background px-2 h-8 text-[11px] font-mono"
                                >
                                  <option value="simples">Simples (0,00137%)</option>
                                  <option value="geral">Geral (0,0041%)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
        </div>
      </div>
    </PortalLayout>
  );
}

function InfoCadastro({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{valor}</p>
    </div>
  );
}

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={tom === "danger" ? "font-medium text-danger" : "font-medium"}>{valor}</span>
    </div>
  );
}
