import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertCircle, BanknoteArrowDown, Download, ReceiptText, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import { brl, dataBR } from "@/lib/format";
import {
  type ContaReceberFornecedor,
  contasReceberDoFornecedor,
  faturasDoFornecedor,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/contas-receber")({
  head: () => ({
    meta: [
      { title: "Contas a Receber | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Débitos do fornecedor com o Grupo Líder e abatimentos previstos no próximo pagamento.",
      },
      { property: "og:title", content: "Contas a Receber | Portal do Fornecedor" },
      {
        property: "og:description",
        content:
          "Valores que o fornecedor deve ao Grupo Líder, com previsão de desconto em pagamento.",
      },
    ],
  }),
  component: ContasReceberPage,
});

const statusClasses: Record<ContaReceberFornecedor["status"], string> = {
  Aberto: "bg-warning-soft text-warning",
  Programado: "bg-success-soft text-success",
  "Em análise": "bg-muted text-muted-foreground",
  Descontado: "bg-primary/10 text-primary",
};

const tipoClasses: Record<ContaReceberFornecedor["tipo"], string> = {
  "Acordo comercial": "bg-primary/10 text-primary",
  Bonificação: "bg-success-soft text-success",
  Devolução: "bg-danger-soft text-danger",
  Avaria: "bg-warning-soft text-warning",
  "Verba comercial": "bg-muted text-muted-foreground",
};

function ContasReceberPage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [buscaTabela, setBuscaTabela] = useState("");
  const [ordenacao, setOrdenacao] = useState<{ campo: string; asc: boolean }>({ campo: "vencimento", asc: true });

  const contas = useMemo(
    () => contasReceberDoFornecedor(fornecedor.codigo),
    [fornecedor.codigo, dadosFornecedorVersao],
  );
  const titulosAbertos = useMemo(
    () =>
      faturasDoFornecedor(fornecedor.codigo)
        .filter((fatura) => fatura.status === "A vencer")
        .sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento)),
    [fornecedor.codigo, dadosFornecedorVersao],
  );
  const proximoPagamento = titulosAbertos[0];
  const contasProgramadas = useMemo(
    () =>
      contas.filter((conta) => conta.abatimentoProximoPagamento && conta.status !== "Descontado"),
    [contas],
  );

  const contasTabela = useMemo(() => {
    const termo = buscaTabela.trim().toLowerCase();
    const filtradas = contas.filter((conta) => `${conta.documento} ${conta.tipo} ${conta.descricao} ${conta.competencia} ${conta.vencimento} ${conta.origem} ${conta.status}`.toLowerCase().includes(termo));
    return [...filtradas].sort((a, b) => {
      const av = ordenacao.campo === "valor" ? a.valor : String((a as any)[ordenacao.campo] ?? "");
      const bv = ordenacao.campo === "valor" ? b.valor : String((b as any)[ordenacao.campo] ?? "");
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : av.localeCompare(bv, "pt-BR", { numeric: true });
      return ordenacao.asc ? cmp : -cmp;
    });
  }, [contas, buscaTabela, ordenacao]);
  const ordenar = (campo: string) => setOrdenacao((atual) => ({ campo, asc: atual.campo === campo ? !atual.asc : true }));

  const totalProgramado = contasProgramadas.reduce((acc, conta) => acc + conta.valor, 0);
  const totalAberto = contas
    .filter((conta) => conta.status !== "Descontado")
    .reduce((acc, conta) => acc + conta.valor, 0);
  const totalEmAnalise = contas
    .filter((conta) => conta.status === "Em análise")
    .reduce((acc, conta) => acc + conta.valor, 0);
  const valorBasePagamento = proximoPagamento?.valorLiquido ?? 0;
  const liquidoPrevisto = Math.max(0, valorBasePagamento - totalProgramado);

  function exportar() {
    const cabecalho = [
      "Documento",
      "Tipo",
      "Descrição",
      "Emissão",
      "Competência",
      "Vencimento",
      "Origem",
      "Valor",
      "Status",
      "Abate próximo pagamento",
      "Observação",
    ];
    const linhas = contas.map((conta) => [
      conta.documento,
      conta.tipo,
      conta.descricao,
      dataBR(conta.emissao),
      conta.competencia,
      dataBR(conta.vencimento),
      conta.origem,
      conta.valor.toFixed(2).replace(".", ","),
      conta.status,
      conta.abatimentoProximoPagamento ? "Sim" : "Não",
      conta.observacao,
    ]);
    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((c) => `"${c}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contas-a-receber-fornecedor.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado", {
      description: `${contas.length} lançamentos em formato Excel (CSV).`,
    });
  }

  return (
    <PortalLayout
      titulo="Contas a Receber"
      descricao="Títulos a receber em que o fornecedor é o cliente — o que o Grupo Líder vai abater no pagamento."
    >
      <div className="space-y-4">
        <Card className="border-warning/40 bg-warning-soft/40 shadow-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="size-4 text-warning" /> O que entra nesta tela
            </CardTitle>
            <CardDescription>
              Débito financeiro é o título a receber do RMS em que o fornecedor é o cliente (
              <code>AA1RTITU</code>), aberto e — quando já programado — ligado a um título a pagar
              ainda em aberto (<code>AG1AUABT</code>). Lançamento de acordo comercial não entra.
              Quebra e agenda 520 continuam em{" "}
              <Link to="/perdas" className="font-semibold text-primary underline-offset-2 hover:underline">
                Perdas físicas
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Resumo
            titulo="Próximo pagamento"
            valor={proximoPagamento ? brl(valorBasePagamento) : "Sem título"}
            detalhe={
              proximoPagamento
                ? `${proximoPagamento.numeroNota} · ${dataBR(proximoPagamento.dataPagamento)}`
                : "Nenhum título a vencer localizado"
            }
            tom="primary"
          />
          <Resumo
            titulo="A descontar"
            valor={brl(totalProgramado)}
            detalhe={`${contasProgramadas.length} lançamentos programados`}
            tom="danger"
          />
          <Resumo
            titulo="Líquido previsto"
            valor={proximoPagamento ? brl(liquidoPrevisto) : "—"}
            detalhe="Pagamento líquido após abatimentos"
            tom="success"
          />
          <Resumo
            titulo="Em análise"
            valor={brl(totalEmAnalise)}
            detalhe="Ainda sem desconto programado"
            tom="warning"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="shadow-panel xl:col-span-3">
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ReceiptText className="size-4 text-primary" /> Débitos do fornecedor
                </CardTitle>
                <CardDescription>
                  Somente títulos ainda não recebidos e sem baixa. Programado = já amarrado no próximo pagamento.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportar}>
                <Download className="size-4" /> Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead><button type="button" onClick={() => ordenar("documento")}>Documento ↕</button></TableHead>
                      <TableHead><button type="button" onClick={() => ordenar("tipo")}>Tipo ↕</button></TableHead>
                      <TableHead><div className="flex items-center gap-1"><input value={buscaTabela} onChange={(e) => setBuscaTabela(e.target.value)} placeholder="Descrição / busca" className="h-7 w-full min-w-[150px] rounded-md border bg-background px-2 text-xs" /><button type="button" onClick={() => ordenar("descricao")}>↕</button></div></TableHead>
                      <TableHead><button type="button" onClick={() => ordenar("competencia")}>Competência ↕</button></TableHead>
                      <TableHead><button type="button" onClick={() => ordenar("vencimento")}>Vencimento ↕</button></TableHead>
                      <TableHead><button type="button" onClick={() => ordenar("origem")}>Origem ↕</button></TableHead>
                      <TableHead className="text-right"><button type="button" onClick={() => ordenar("valor")}>Valor ↕</button></TableHead>
                      <TableHead>Abatimento</TableHead>
                      <TableHead><button type="button" onClick={() => ordenar("status")}>Status ↕</button></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contasTabela.map((conta) => (
                      <TableRow key={conta.id}>
                        <TableCell className="font-medium">{conta.documento}</TableCell>
                        <TableCell>
                          <Badge className={`border-0 ${tipoClasses[conta.tipo]}`}>
                            {conta.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-1">
                            <p className="font-medium">{conta.descricao}</p>
                            <p className="text-xs text-muted-foreground">{conta.observacao}</p>
                          </div>
                        </TableCell>
                        <TableCell>{conta.competencia}</TableCell>
                        <TableCell>{dataBR(conta.vencimento)}</TableCell>
                        <TableCell>{conta.origem}</TableCell>
                        <TableCell className="text-right font-medium text-danger">
                          {brl(conta.valor)}
                        </TableCell>
                        <TableCell>
                          {conta.abatimentoProximoPagamento ? (
                            <Badge className="border-0 bg-danger-soft text-danger">
                              Próximo pagamento
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Não programado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 ${statusClasses[conta.status]}`}>
                            {conta.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {contas.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhum débito do fornecedor encontrado para abatimento.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-panel xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WalletCards className="size-4 text-primary" /> Composição do pagamento
              </CardTitle>
              <CardDescription>
                Simulação do próximo pagamento considerando somente débitos programados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Título base
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {proximoPagamento ? proximoPagamento.numeroNota : "Sem título aberto"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {proximoPagamento
                    ? `Pagamento previsto em ${dataBR(proximoPagamento.dataPagamento)}`
                    : "Não há previsão para aplicar abatimentos."}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <Linha rotulo="Valor líquido do título" valor={brl(valorBasePagamento)} />
                <Linha rotulo="Débitos totais em aberto" valor={brl(totalAberto)} tom="danger" />
                <Linha
                  rotulo="Abatimentos programados"
                  valor={`-${brl(totalProgramado)}`}
                  tom="danger"
                />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="font-semibold">Líquido após desconto</span>
                  <span className="text-xl font-semibold text-success">
                    {proximoPagamento ? brl(liquidoPrevisto) : "—"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Itens que entram no próximo pagamento
                </p>
                {contasProgramadas.map((conta) => (
                  <div
                    key={conta.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{conta.documento}</p>
                      <p className="truncate text-xs text-muted-foreground">{conta.tipo}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-danger">
                      -{brl(conta.valor)}
                    </span>
                  </div>
                ))}
                {contasProgramadas.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Não há lançamento programado para desconto no próximo pagamento.
                  </p>
                )}
              </div>

              {totalProgramado > valorBasePagamento && proximoPagamento && (
                <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-sm text-warning">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Os abatimentos programados superam o título base. O excedente deve seguir para o
                    próximo pagamento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}

function Resumo({
  titulo,
  valor,
  detalhe,
  tom,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  tom: "primary" | "danger" | "success" | "warning";
}) {
  const tons = {
    primary: "border-primary/20 bg-primary/5 text-primary",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
    warning: "border-warning/30 bg-warning-soft text-warning",
  };
  const icons = {
    primary: WalletCards,
    danger: BanknoteArrowDown,
    success: ReceiptText,
    warning: AlertCircle,
  };
  const Icon = icons[tom];

  return (
    <div className={`rounded-lg border p-4 shadow-panel ${tons[tom]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{titulo}</p>
        <Icon className="size-4 shrink-0" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{valor}</p>
      <p className="mt-1 text-sm opacity-85">{detalhe}</p>
    </div>
  );
}

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "danger" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={tom === "danger" ? "font-medium text-danger" : "font-medium"}>{valor}</span>
    </div>
  );
}
