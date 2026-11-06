import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, CheckCircle2, Download, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { TableColumnHeader } from "@/components/table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import {
  fetchRelatorioAcordoAcesso,
  fetchFornecedoresAcordoCadastro,
  registrarAcordoAcessoPortal,
  verificarAcordoCobranca,
  type AcordoCobrancaDB,
  type RelatorioAcordoAcessoLinhaDB,
  type FornecedorAcordoCadastroDB,
} from "@/api";
import { formatarCodigoFornecedorComDigito } from "@/lib/fornecedor-codigo";
import { brl, numero } from "@/lib/format";
import { rotuloMesAno } from "@/lib/pedidos-janela";

export const Route = createFileRoute("/_portal/admin-acordo-acesso")({
  head: () => ({
    meta: [
      { title: "Relatório acordo de acesso | Portal do Fornecedor" },
      {
        name: "description",
        content: "Vendas do período e valor do acordo por fornecedor e segmento InteLider.",
      },
    ],
  }),
  component: RelatorioAcordoAcessoPage,
});

function RelatorioAcordoAcessoPage() {
  const { usuarioInterno } = usePortal();
  const [mes, setMes] = useState("");
  const [linhas, setLinhas] = useState<RelatorioAcordoAcessoLinhaDB[]>([]);
  const [fornecedoresCadastro, setFornecedoresCadastro] = useState<FornecedorAcordoCadastroDB[]>(
    [],
  );
  const [fornecedorCadastroBusca, setFornecedorCadastroBusca] = useState("");
  const [segmento, setSegmento] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, string>>({});
  const [ordenacao, setOrdenacao] = useState<{
    chave: string;
    direcao: "asc" | "desc";
  }>({
    chave: "fornecedor",
    direcao: "asc",
  });
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState<RelatorioAcordoAcessoLinhaDB | null>(null);
  const [numeroAcordo, setNumeroAcordo] = useState("");
  const [contratoAssinadoEm, setContratoAssinadoEm] = useState("");
  const [contratoDocumentoRef, setContratoDocumentoRef] = useState("");
  const [confirmouContratoAssinado, setConfirmouContratoAssinado] = useState(false);
  const [checagem, setChecagem] = useState<AcordoCobrancaDB | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!usuarioInterno) return;
    setCarregando(true);
    Promise.all([fetchRelatorioAcordoAcesso(), fetchFornecedoresAcordoCadastro()])
      .then(([dados, fornecedores]) => {
        setMes(dados.mes);
        setLinhas(dados.linhas);
        setFornecedoresCadastro(fornecedores);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Não foi possível montar o relatório.");
      })
      .finally(() => setCarregando(false));
  }, [usuarioInterno]);

  const fornecedoresCadastroFiltrados = useMemo(() => {
    const q = fornecedorCadastroBusca.trim().toLocaleLowerCase("pt-BR");
    return fornecedoresCadastro.filter((f) => {
      if (!q) return true;
      return (
        f.nome.toLocaleLowerCase("pt-BR").includes(q) ||
        formatarCodigoFornecedorComDigito(f.codigo).toLowerCase().includes(q)
      );
    });
  }, [fornecedorCadastroBusca, fornecedoresCadastro]);

  const selecionarFornecedorCadastro = (codigo: string) => {
    const fornecedor = fornecedoresCadastro.find((f) => f.codigo === codigo);
    if (!fornecedor) return;
    setSelecionado({
      codigo: fornecedor.codigo,
      nome: fornecedor.nome,
      segmento: "Cadastro existente",
      compra: 0,
      taxaAcessoPct: fornecedor.taxaAcessoPct ?? 1,
      cobrancaAcesso: 0,
      fillRatePct: 0,
      metaFillRatePct: 85,
      multaTresPct: 0,
      totalCobranca: 0,
      documentos: 0,
    });
    setChecagem(null);
    setNumeroAcordo(fornecedor.acordoNumero ?? "");
    setContratoAssinadoEm(fornecedor.contratoAssinadoEm ?? "");
    setContratoDocumentoRef(fornecedor.contratoDocumentoRef ?? "");
    setConfirmouContratoAssinado(false);
  };

  const segmentos = useMemo(() => {
    return [...new Set(linhas.map((l) => l.segmento))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [linhas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (segmento !== "todos" && l.segmento !== segmento) return false;
      if (!q) return true;
      return (
        l.nome.toLowerCase().includes(q) ||
        l.codigo.includes(q) ||
        formatarCodigoFornecedorComDigito(l.codigo).toLowerCase().includes(q)
      );
    });
  }, [busca, linhas, segmento]);

  const filtradasOrdenadas = useMemo(() => {
    const filtradas = visiveis.filter((linha) => {
      const valores: Record<string, string> = {
        segmento: linha.segmento,
        codigo: formatarCodigoFornecedorComDigito(linha.codigo),
        fornecedor: linha.nome,
        pedidos: String(linha.documentos),
        compra: String(linha.compra),
        taxaAcesso: String(linha.taxaAcessoPct),
        cobrancaAcesso: String(linha.cobrancaAcesso),
        fillRate: String(linha.fillRatePct),
        multa: String(linha.multaTresPct),
        totalCobranca: String(linha.totalCobranca),
      };
      return Object.entries(filtrosColuna).every(
        ([chave, valor]) =>
          !valor || (valores[chave] ?? "").toLocaleLowerCase().includes(valor.toLocaleLowerCase()),
      );
    });
    const valor = (linha: RelatorioAcordoAcessoLinhaDB): string | number =>
      ({
        segmento: linha.segmento,
        codigo: formatarCodigoFornecedorComDigito(linha.codigo),
        fornecedor: linha.nome,
        pedidos: linha.documentos,
        compra: linha.compra,
        taxaAcesso: linha.taxaAcessoPct,
        cobrancaAcesso: linha.cobrancaAcesso,
        fillRate: linha.fillRatePct,
        multa: linha.multaTresPct,
        totalCobranca: linha.totalCobranca,
      })[ordenacao.chave] ?? "";
    return [...filtradas].sort((a, b) => {
      const av = valor(a);
      const bv = valor(b);
      const resultado =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR", {
              numeric: true,
              sensitivity: "base",
            });
      return ordenacao.direcao === "asc" ? resultado : -resultado;
    });
  }, [visiveis, filtrosColuna, ordenacao]);

  const alternarOrdenacao = (chave: string) =>
    setOrdenacao((atual) => ({
      chave,
      direcao: atual.chave === chave && atual.direcao === "asc" ? "desc" : "asc",
    }));
  const cabecalho = (titulo: string, chave: string) => (
    <TableColumnHeader
      title={titulo}
      value={filtrosColuna[chave] ?? ""}
      onChange={(value) => setFiltrosColuna((atual) => ({ ...atual, [chave]: value }))}
      onSort={() => alternarOrdenacao(chave)}
      direction={ordenacao.chave === chave ? ordenacao.direcao : null}
      placeholder={titulo}
    />
  );

  const totais = useMemo(() => {
    return filtradasOrdenadas.reduce(
      (acc, l) => {
        acc.compra += l.compra;
        acc.cobrancaAcesso += l.cobrancaAcesso;
        acc.multaTresPct += l.multaTresPct;
        acc.totalCobranca += l.totalCobranca;
        return acc;
      },
      { compra: 0, cobrancaAcesso: 0, multaTresPct: 0, totalCobranca: 0 },
    );
  }, [filtradasOrdenadas]);

  function exportar() {
    const cabecalho = [
      "Segmento",
      "Codigo",
      "Codigo com digito",
      "Fornecedor",
      "Pedidos",
      "Compra",
      "Taxa de acesso (%)",
      "Cobranca de acesso",
      "Fill Rate (%)",
      "Meta Fill Rate (%)",
      "Multa (3%)",
      "Total da cobranca",
    ];
    const csvLinhas = filtradasOrdenadas.map((l) => [
      l.segmento,
      l.codigo,
      formatarCodigoFornecedorComDigito(l.codigo),
      l.nome,
      String(l.documentos),
      l.compra.toFixed(2).replace(".", ","),
      l.taxaAcessoPct.toFixed(2).replace(".", ","),
      l.cobrancaAcesso.toFixed(2).replace(".", ","),
      l.fillRatePct.toFixed(2).replace(".", ","),
      l.metaFillRatePct.toFixed(2).replace(".", ","),
      l.multaTresPct.toFixed(2).replace(".", ","),
      l.totalCobranca.toFixed(2).replace(".", ","),
    ]);
    const csv = [cabecalho, ...csvLinhas]
      .map((row) => row.map((c) => `"${c}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `acordo-acesso-${mes || "mes"}-${segmento}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado", {
      description: `${csvLinhas.length} fornecedores.`,
    });
  }

  const handleVerificar = async () => {
    if (!selecionado) return;
    if (!numeroAcordo.trim()) {
      toast.error("Informe o número do acordo.");
      return;
    }
    setVerificando(true);
    try {
      const resultado = await verificarAcordoCobranca({
        data: { fornecedorCodigo: selecionado.codigo, numeroAcordo },
      });
      setChecagem(resultado);
      if (resultado.encontrado) toast.success(`Acordo ${resultado.numeroAcordo} encontrado.`);
      else toast.error("Acordo não encontrado na cobrança deste fornecedor.");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao consultar a cobrança.");
    } finally {
      setVerificando(false);
    }
  };

  const handleRegistrar = async () => {
    if (!selecionado || !checagem?.encontrado) {
      toast.error("Verifique o acordo na cobrança antes de registrar.");
      return;
    }
    setSalvando(true);
    try {
      await registrarAcordoAcessoPortal({
        data: {
          fornecedorCodigo: selecionado.codigo,
          numeroAcordo,
          contratoAssinadoEm,
          contratoDocumentoRef,
          confirmouContratoAssinado,
        },
      });
      toast.success("Contrato validado e fornecedor incluído na cobrança.");
      setNumeroAcordo("");
      setContratoAssinadoEm("");
      setContratoDocumentoRef("");
      setConfirmouContratoAssinado(false);
      setChecagem(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setSalvando(false);
    }
  };

  if (!usuarioInterno) {
    return (
      <PortalLayout
        titulo="Acesso restrito"
        descricao="Relatório mensal de acordo de acesso para a equipe comercial do Grupo Líder."
      >
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 shadow-panel">
          <ShieldAlert className="mb-3 size-12 text-destructive" />
          <h2 className="text-lg font-bold">Acesso negado</h2>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      titulo="Relatório acordo de acesso"
      descricao="Somente fornecedores com acesso liberado no portal, no segmento InteLider. Cada responsável filtra o seu e exporta."
    >
      <div className="flex flex-col gap-4">
        <Card className="order-1 border-primary/30 shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Validar contrato assinado</CardTitle>
            <CardDescription>
              Apenas administradores validam o contrato: conferem a assinatura, registram a
              referência do documento e vinculam o acordo à cobrança. Só depois disso o fornecedor
              entra no relatório mensal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {usuarioInterno?.role !== "admin" ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                A validação de contrato é exclusiva do perfil Administrador.
              </p>
            ) : null}
            <div className="max-w-xl space-y-1">
              <Label htmlFor="busca-fornecedor-acordo">Fornecedor</Label>
              <Input
                id="busca-fornecedor-acordo"
                placeholder="Digite o código ou nome do fornecedor…"
                value={fornecedorCadastroBusca}
                onChange={(e) => setFornecedorCadastroBusca(e.target.value)}
                disabled={usuarioInterno?.role !== "admin"}
              />
            </div>
            <div className="max-h-56 max-w-3xl overflow-y-auto rounded-lg border">
              {fornecedoresCadastroFiltrados.slice(0, 50).map((f) => (
                <button
                  key={f.codigo}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary/5 ${selecionado?.codigo === f.codigo ? "bg-primary/10" : ""}`}
                  onClick={() => selecionarFornecedorCadastro(f.codigo)}
                  disabled={usuarioInterno?.role !== "admin"}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs font-semibold">
                      {formatarCodigoFornecedorComDigito(f.codigo)}
                    </span>
                    <span className="ml-2">{f.nome}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.acordoNumero ? `Acordo ${f.acordoNumero}` : f.acessoStatus || "Sem acordo"}
                  </span>
                </button>
              ))}
              {fornecedoresCadastroFiltrados.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="order-3 grid gap-4 md:grid-cols-3">
          <Card className="shadow-panel">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mês de referência
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {mes ? rotuloMesAno(mes) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {carregando ? "Carregando…" : `${numero(visiveis.length)} fornecedor(es) no filtro`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-panel">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vendas no período
              </p>
              <p className="mt-1 font-display text-2xl font-bold">{brl(totais.compra)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-panel border-primary/30">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Valor do período
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-primary">
                {brl(totais.totalCobranca)}
              </p>
              <p className="text-xs text-muted-foreground">
                Acesso: {brl(totais.cobrancaAcesso)} · Multa: {brl(totais.multaTresPct)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="order-4 shadow-panel">
          <CardHeader className="gap-3">
            <CardTitle className="text-base">Fornecedores do mês</CardTitle>
            <CardDescription>
              Filtre pelo segmento InteLider do responsável e exporte. Clique numa linha para lançar
              o acordo na cobrança.
            </CardDescription>
            <div className="flex flex-col gap-2 lg:flex-row">
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger className="lg:w-64">
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os segmentos InteLider</SelectItem>
                  {segmentos.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar código ou nome…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <Button variant="outline" onClick={exportar} disabled={visiveis.length === 0}>
                <Download className="mr-1.5 size-4" /> Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table
              containerClassName="max-h-[480px] rounded-lg border border-border"
              className="border-separate border-spacing-0"
            >
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100">
                <TableRow className="bg-stone-100">
                  <TableHead>{cabecalho("Segmento", "segmento")}</TableHead>
                  <TableHead>{cabecalho("Código", "codigo")}</TableHead>
                  <TableHead>{cabecalho("Fornecedor", "fornecedor")}</TableHead>
                  <TableHead className="text-right">{cabecalho("Pedidos", "pedidos")}</TableHead>
                  <TableHead className="text-right">{cabecalho("Compra", "compra")}</TableHead>
                  <TableHead className="text-right">
                    {cabecalho("Taxa acesso", "taxaAcesso")}
                  </TableHead>
                  <TableHead className="text-right">
                    {cabecalho("Cobrança acesso", "cobrancaAcesso")}
                  </TableHead>
                  <TableHead className="text-right">{cabecalho("Fill Rate", "fillRate")}</TableHead>
                  <TableHead className="text-right">{cabecalho("Multa (3%)", "multa")}</TableHead>
                  <TableHead className="text-right">
                    {cabecalho("Total cobrança", "totalCobranca")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradasOrdenadas.map((l) => (
                  <TableRow
                    key={`${l.codigo}-${l.segmento}`}
                    className={`cursor-pointer ${selecionado?.codigo === l.codigo && selecionado.segmento === l.segmento ? "bg-primary/10" : ""}`}
                    onClick={() => {
                      setSelecionado(l);
                      setChecagem(null);
                      setNumeroAcordo("");
                    }}
                  >
                    <TableCell className="text-xs">{l.segmento}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatarCodigoFornecedorComDigito(l.codigo)}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs">{l.nome}</TableCell>
                    <TableCell className="text-right text-xs">{numero(l.documentos)}</TableCell>
                    <TableCell className="text-right text-xs">{brl(l.compra)}</TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {l.taxaAcessoPct.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      %
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {brl(l.cobrancaAcesso)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-semibold ${l.fillRatePct < l.metaFillRatePct ? "text-destructive" : "text-emerald-700"}`}
                      title={`Meta acordada: ${l.metaFillRatePct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                    >
                      {l.fillRatePct.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      %
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        meta{" "}
                        {l.metaFillRatePct.toLocaleString("pt-BR", {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {brl(l.multaTresPct)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary">
                      {brl(l.totalCobranca)}
                    </TableCell>
                  </TableRow>
                ))}
                {filtradasOrdenadas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {carregando ? "Carregando relatório…" : "Nenhum fornecedor neste filtro."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selecionado && usuarioInterno?.role === "admin" ? (
          <Card className="order-2 shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgePercent className="size-4 text-primary" /> Validar contrato
              </CardTitle>
              <CardDescription>
                {formatarCodigoFornecedorComDigito(selecionado.codigo)} · {selecionado.nome} ·{" "}
                {selecionado.segmento} · acesso{" "}
                {selecionado.taxaAcessoPct.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                % · Fill Rate{" "}
                {selecionado.fillRatePct.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}
                % · total {brl(selecionado.totalCobranca)} · validade mensal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="numero-acordo">Número do acordo</Label>
                  <Input
                    id="numero-acordo"
                    className="font-mono"
                    placeholder="Ex.: 63967"
                    value={numeroAcordo}
                    onChange={(e) => {
                      setNumeroAcordo(e.target.value);
                      setChecagem(null);
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={verificando}
                  onClick={() => void handleVerificar()}
                >
                  <Search className="mr-1.5 size-4" /> Verificar na cobrança
                </Button>
                <Button
                  disabled={
                    salvando ||
                    !checagem?.encontrado ||
                    !contratoAssinadoEm ||
                    !contratoDocumentoRef.trim() ||
                    !confirmouContratoAssinado
                  }
                  onClick={() => void handleRegistrar()}
                >
                  Validar e incluir na cobrança
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="contrato-assinado-em">Data de assinatura</Label>
                  <Input
                    id="contrato-assinado-em"
                    type="date"
                    value={contratoAssinadoEm}
                    onChange={(e) => setContratoAssinadoEm(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contrato-documento-ref">Referência do documento assinado</Label>
                  <Input
                    id="contrato-documento-ref"
                    placeholder="Ex.: GED 12345 ou contrato-assinado-empresa.pdf"
                    value={contratoDocumentoRef}
                    onChange={(e) => setContratoDocumentoRef(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmouContratoAssinado}
                  onChange={(e) => setConfirmouContratoAssinado(e.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span>
                  Confirmo que conferi o contrato assinado e que o número informado corresponde ao
                  acordo localizado na cobrança.
                </span>
              </label>
              {checagem ? (
                checagem.encontrado ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="size-4" /> Acordo {checagem.numeroAcordo} encontrado
                    {checagem.descricao ? ` · ${checagem.descricao}` : ""}
                    {checagem.vencimento ? ` · vencimento ${checagem.vencimento}` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-destructive">
                    Nenhum acordo comercial com esse número para este fornecedor.
                  </p>
                )
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PortalLayout>
  );
}
