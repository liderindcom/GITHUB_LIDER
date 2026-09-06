import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  Search,
  Check,
  X,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  Percent,
  UserPlus,
  RefreshCw,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  searchFornecedores,
  updateSupplierAccess,
  includeSupplier,
  fetchFillratePolitica,
  updateFillrateTaxa,
  updateFillrateMeta,
  updateSupplierAccessConfig,
  refreshSupplierDataImmediately,
  FILLRATE_TAXA_PADRAO,
  FILLRATE_TAXA_MIN,
  FILLRATE_TAXA_MAX,
  FILLRATE_META_PADRAO,
  FILLRATE_META_MIN,
  FILLRATE_META_MAX,
} from "@/api";
import { usePortal } from "@/context/portal-context";
import { formatarCodigoFornecedorComDigito } from "@/lib/fornecedor-codigo";

const dataIsoCompleta = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor);

function CampoDataVigencia({
  valor,
  disabled,
  onConfirmar,
}: {
  valor: string;
  disabled?: boolean;
  onConfirmar: (iso: string | null) => void;
}) {
  return (
    <Input
      type="date"
      defaultValue={valor || ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (dataIsoCompleta(v)) onConfirmar(v);
      }}
      onBlur={(e) => {
        const v = e.target.value;
        if (!v && valor) onConfirmar(null);
      }}
      className="h-7 w-[132px] px-1 text-center font-mono text-[10px]"
    />
  );
}

export const Route = createFileRoute("/_portal/admin-fornecedores")({
  head: () => ({
    meta: [
      { title: "Controle de Acesso - Admin | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Painel de administração para liberação e controle de acesso dos fornecedores do Grupo Líder.",
      },
    ],
  }),
  component: AdminFornecedoresPage,
});

function AdminFornecedoresPage() {
  const { usuarioInterno } = usePortal();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [taxaMulta, setTaxaMulta] = useState<number>(FILLRATE_TAXA_PADRAO);
  const [salvandoTaxa, setSalvandoTaxa] = useState(false);
  const [codigoNovo, setCodigoNovo] = useState("");
  const [incluindo, setIncluindo] = useState(false);
  const [salvandoMeta, setSalvandoMeta] = useState<string | null>(null);
  const [atualizandoCodigo, setAtualizandoCodigo] = useState<string | null>(null);
  const [colunaOrdenacao, setColunaOrdenacao] = useState<string | null>(null);
  const [ordemOrdenacao, setOrdemOrdenacao] = useState<"asc" | "desc">("asc");

  const limit = 15;

  const fornecedoresOrdenados = [...fornecedores].sort((a, b) => {
    const alvo = (search.trim() || codigoNovo.trim()).replace(/\D/g, "");
    const codigoA = String(a.codigo ?? "").replace(/\D/g, "");
    const codigoB = String(b.codigo ?? "").replace(/\D/g, "");
    const prioridade = (codigo: string) => codigo === alvo ? 0 : codigo.startsWith(alvo) ? 1 : 2;
    if (!colunaOrdenacao) return prioridade(codigoA) - prioridade(codigoB);
    const valorA = String(a[colunaOrdenacao] ?? "").toLocaleLowerCase();
    const valorB = String(b[colunaOrdenacao] ?? "").toLocaleLowerCase();
    const resultado = valorA.localeCompare(valorB, "pt-BR", { numeric: true });
    return ordemOrdenacao === "asc" ? resultado : -resultado;
  });

  const ordenarPor = (coluna: string) => {
    if (colunaOrdenacao === coluna) {
      setOrdemOrdenacao((atual) => (atual === "asc" ? "desc" : "asc"));
    } else {
      setColunaOrdenacao(coluna);
      setOrdemOrdenacao("asc");
    }
  };

  const indicadorOrdenacao = (coluna: string) =>
    colunaOrdenacao !== coluna ? <ArrowUpDown className="size-3 opacity-50" /> :
      ordemOrdenacao === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;

  const cabecalhoOrdenavel = (titulo: string, coluna: string) => (
    <div className="flex items-center justify-between gap-1">
      <span>{titulo}</span>
      <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => ordenarPor(coluna)} aria-label={`Ordenar por ${titulo}`}>
        {indicadorOrdenacao(coluna)}
      </Button>
    </div>
  );

  const handleUpdateConfig = async (
    codigo: string,
    isento: number,
    inicio: string | null,
    fim: string | null,
  ) => {
    try {
      await updateSupplierAccessConfig({
        data: { codigo, isentoCobranca: isento, acessoDataInicio: inicio, acessoDataFim: fim },
      });
      setFornecedores((prev) =>
        prev.map((f) =>
          f.codigo === codigo
            ? { ...f, isentoCobranca: isento, acessoDataInicio: inicio, acessoDataFim: fim }
            : f,
        ),
      );
      toast.success("Configuração de acesso atualizada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configuração.");
    }
  };

  const handleRefreshSupplier = async (codigo: string) => {
    setAtualizandoCodigo(codigo);
    try {
      const res = await refreshSupplierDataImmediately({ data: { codigo } });
      toast.success(res.message);
      await carregarFornecedores(search, page);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao atualizar dados do fornecedor.");
    } finally {
      setAtualizandoCodigo(null);
    }
  };

  const carregarFornecedores = async (searchTerm: string, pageNum: number) => {
    setCarregando(true);
    try {
      const data = await searchFornecedores({
        data: {
          search: searchTerm,
          limit,
          offset: pageNum * limit,
        },
      });
      setFornecedores(data.rows);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar lista de fornecedores.");
    } finally {
      setCarregando(false);
    }
  };

  // Carregar dados iniciais e quando muda busca ou página
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarFornecedores(search, page);
    }, 300); // Debounce de busca de 300ms
    return () => clearTimeout(timer);
  }, [search, page]);

  useEffect(() => {
    let ativo = true;
    fetchFillratePolitica()
      .then((politica) => {
        if (ativo) setTaxaMulta(politica.taxaMultaPct);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar a taxa da multa de fill rate.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  const handleAlterarTaxa = async (proxima: number) => {
    const anterior = taxaMulta;
    const limitada = Math.min(FILLRATE_TAXA_MAX, Math.max(FILLRATE_TAXA_MIN, proxima));
    setTaxaMulta(limitada);
    setSalvandoTaxa(true);
    try {
      const politica = await updateFillrateTaxa({ data: { taxaMultaPct: limitada } });
      setTaxaMulta(politica.taxaMultaPct);
      toast.success(`Taxa da multa atualizada para ${politica.taxaMultaPct}%.`);
    } catch (err) {
      console.error(err);
      setTaxaMulta(anterior);
      toast.error("Erro ao gravar a taxa da multa.");
    } finally {
      setSalvandoTaxa(false);
    }
  };

  // Resetar página ao buscar
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const imprimirContratoDegustacao = (
    codigo: string,
    nome: string,
    cnpj: string,
    inicio: string,
    fim: string,
  ) => {
    const janela = window.open("", "_blank", "width=800,height=1100");
    if (!janela) {
      toast.error("Permita pop-ups para imprimir o contrato.");
      return;
    }
    janela.document.write(
      `<html><head><title>Acordo de acesso - ${codigo}</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial;padding:0;line-height:1.5}h1{font-size:22px}hr{margin:28px 0}.assinatura{margin-top:90px;display:flex;justify-content:space-between}.linha{border-top:1px solid #222;width:42%;padding-top:8px}</style></head><body><h1>ACORDO DE ACESSO AO PORTAL DO FORNECEDOR</h1><p><b>Líder Indústria &amp; Comércio Ltda.</b>, CNPJ <b>05.054.671/0005-63</b>, e o fornecedor <b>${nome}</b>, CNPJ <b>${cnpj || "não informado"}</b>, código RMS <b>${codigo}</b>, registram este termo de acesso experimental.</p><p>O acesso de degustação inicia em <b>${inicio}</b> e termina em <b>${fim}</b>, totalizando 30 dias corridos. Este prazo é único, não prorrogável e não gera cobrança durante a degustação.</p><p>Após a assinatura e validação no sistema do Grupo Líder, o fornecedor será mantido ativo e incluído na lista de cobrança do menu <b>Acordo de acesso</b>. Sem validação, o acesso será encerrado ao final do prazo.</p><p>Este documento deve ser assinado pelo fornecedor e devolvido ao comprador responsável.</p><hr/><div class="assinatura"><div class="linha">Fornecedor / representante legal</div><div class="linha">Grupo Líder / comprador</div></div><script>window.onload=()=>window.print()</script></body></html>`,
    );
    janela.document.close();
  };

  const handleIncluirFornecedor = async () => {
    const codigo = codigoNovo.trim();
    if (!codigo) {
      toast.error("Informe o código RMS do fornecedor.");
      return;
    }
    setIncluindo(true);
    try {
      const resultado = await includeSupplier({ data: { codigo } });
      const codigoExibicao = formatarCodigoFornecedorComDigito(resultado.codigo);
      toast.success(`Fornecedor ${codigoExibicao} ativado para degustação de 30 dias.`);
      imprimirContratoDegustacao(
        codigoExibicao,
        resultado.fornecedorNome || `Fornecedor ${codigoExibicao}`,
        resultado.fornecedorCnpj || "não informado",
        resultado.acessoDataInicio,
        resultado.acessoDataFim,
      );
      setCodigoNovo("");
      setPage(0);
      await carregarFornecedores(search, 0);
    } catch (err) {
      console.error(err);
      const mensagem =
        err instanceof Error ? err.message : "Não foi possível incluir o fornecedor.";
      toast.error(mensagem);
    } finally {
      setIncluindo(false);
    }
  };

  const handleAlterarMeta = async (codigo: string, atual: number, proxima: number) => {
    const limitada = Math.min(FILLRATE_META_MAX, Math.max(FILLRATE_META_MIN, proxima));
    if (limitada === atual) return;
    setFornecedores((prev) =>
      prev.map((f) => (f.codigo === codigo ? { ...f, metaFillRatePct: limitada } : f)),
    );
    setSalvandoMeta(codigo);
    try {
      const gravada = await updateFillrateMeta({
        data: { codigo, metaFillRatePct: limitada },
      });
      setFornecedores((prev) =>
        prev.map((f) =>
          f.codigo === codigo ? { ...f, metaFillRatePct: gravada.metaFillRatePct } : f,
        ),
      );
      toast.success(
        `Meta de ${formatarCodigoFornecedorComDigito(codigo)} atualizada para ${gravada.metaFillRatePct}%.`,
      );
    } catch (err) {
      console.error(err);
      setFornecedores((prev) =>
        prev.map((f) => (f.codigo === codigo ? { ...f, metaFillRatePct: atual } : f)),
      );
      toast.error("Erro ao gravar a meta pactuada.");
    } finally {
      setSalvandoMeta(null);
    }
  };

  const handleToggleAccess = async (codigo: string, statusAtual: number) => {
    const novoStatus = statusAtual === 1 ? 0 : 1;

    // Otimista: atualiza o estado local primeiro
    setFornecedores((prev) =>
      prev.map((f) => (f.codigo === codigo ? { ...f, acessoLiberado: novoStatus } : f)),
    );

    try {
      await updateSupplierAccess({
        data: { codigo, acessoLiberado: novoStatus },
      });
      toast.success(
        novoStatus === 1
          ? `Acesso LIBERADO para o fornecedor ${formatarCodigoFornecedorComDigito(codigo)}.`
          : `Acesso BLOQUEADO para o fornecedor ${formatarCodigoFornecedorComDigito(codigo)}.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status de acesso. Revertendo...");
      // Reverter estado local em caso de falha
      setFornecedores((prev) =>
        prev.map((f) => (f.codigo === codigo ? { ...f, acessoLiberado: statusAtual } : f)),
      );
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (!usuarioInterno) {
    return (
      <PortalLayout
        titulo="Acesso Restrito"
        descricao="Esta área é de uso exclusivo de funcionários do Grupo Líder."
      >
        <div className="flex flex-col items-center justify-center p-8 bg-card rounded-lg border border-border shadow-panel">
          <ShieldAlert className="size-12 text-destructive mb-3" />
          <h2 className="text-lg font-bold">Acesso Negado</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-[340px] text-center">
            Você não possui as permissões necessárias para acessar este painel. Caso seja um
            colaborador, faça o login administrativo.
          </p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      titulo="Controle de Acesso"
      descricao="Somente fornecedores com acesso ativo ficam no portal."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Controle de Acesso</h1>
            <p className="text-xs text-muted-foreground">
              Só entram no portal fornecedores com acesso ativo. Para incluir, use o código RMS com
              dígito (ex.: 100561-8).
            </p>
          </div>
        </div>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Percent className="size-5 text-primary" />
              <span>Política de Fill Rate</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Taxa da multa
              </p>
              <p className="max-w-xl text-xs text-muted-foreground">
                Valor único da rede. A meta é pacto individual e fica na coluna de cada fornecedor
                abaixo. Os dois valores só aparecem no Fill Rate como espelho do cálculo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="size-8"
                disabled={salvandoTaxa || taxaMulta <= FILLRATE_TAXA_MIN}
                onClick={() => handleAlterarTaxa(taxaMulta - 0.5)}
              >
                -
              </Button>
              <span className="w-14 text-center font-mono text-sm font-bold">{taxaMulta}%</span>
              <Button
                variant="outline"
                size="sm"
                className="size-8"
                disabled={salvandoTaxa || taxaMulta >= FILLRATE_TAXA_MAX}
                onClick={() => handleAlterarTaxa(taxaMulta + 0.5)}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserPlus className="size-5 text-primary" />
              <span>Incluir fornecedor</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Código RMS com dígito
              </p>
              <p className="text-xs text-muted-foreground">
                Informe apenas o código RMS. Nome e CNPJ serão preenchidos pelo cadastro RMS quando
                o cache for sincronizado.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ex.: 100561-8"
                value={codigoNovo}
                onChange={(e) => setCodigoNovo(e.target.value)}
                className="w-[180px] font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleIncluirFornecedor();
                  }
                }}
              />
              <Button
                size="sm"
                className="h-9 text-xs font-bold"
                disabled={incluindo}
                onClick={() => void handleIncluirFornecedor()}
              >
                Incluir no portal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="size-5 text-primary" />
              <span>Fornecedores Cadastrados ({total})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Pesquise por código (100561-8), razão social ou CNPJ..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tabela de Fornecedores */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">{cabecalhoOrdenavel("Código RMS", "codigo")}</TableHead>
                    <TableHead className="w-[180px]">
                      <div className="space-y-1">
                        {cabecalhoOrdenavel("Fornecedor", "nome")}
                        <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Buscar..." className="h-6 px-1.5 text-[10px]" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px] text-center">{cabecalhoOrdenavel("Acordo / status", "acessoStatus")}</TableHead>
                    <TableHead className="w-[130px] text-center">{cabecalhoOrdenavel("Cobrança 1%", "isentoCobranca")}</TableHead>
                    <TableHead className="w-[240px] text-center">{cabecalhoOrdenavel("Vigência Acesso", "acessoDataFim")}</TableHead>
                    <TableHead className="w-[110px] text-center">{cabecalhoOrdenavel("Meta Fill", "metaFillRatePct")}</TableHead>
                    <TableHead className="w-[100px] text-center">{cabecalhoOrdenavel("Acesso", "acessoLiberado")}</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando && fornecedores.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-sm text-muted-foreground"
                      >
                        Carregando fornecedores...
                      </TableCell>
                    </TableRow>
                  ) : fornecedores.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-sm text-muted-foreground"
                      >
                        Nenhum fornecedor encontrado para a busca "{search}".
                      </TableCell>
                    </TableRow>
                  ) : (
                    fornecedoresOrdenados.map((f) => {
                      const ativo = f.acessoLiberado === 1;
                      const isento = f.isentoCobranca === 1;
                      const meta = Number(f.metaFillRatePct ?? FILLRATE_META_PADRAO);
                      return (
                        <TableRow key={f.codigo}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {formatarCodigoFornecedorComDigito(f.codigo)}
                          </TableCell>
                          <TableCell
                            className="max-w-[180px] truncate text-xs font-medium"
                            title={f.nome}
                          >
                            {f.nome}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1 text-[10px]">
                              <span className="font-bold">
                                {f.acessoStatus === "ATIVO_COM_ACORDO"
                                  ? "ACORDO VALIDADO"
                                  : f.acessoStatus === "DEGUSTACAO"
                                    ? "DEGUSTAÇÃO 30 DIAS"
                                    : f.acessoStatus === "EXPIRADO"
                                      ? "EXPIRADO"
                                      : "SEM ACORDO"}
                              </span>
                              {f.acordoNumero ? (
                                <div className="font-mono text-muted-foreground">
                                  {f.acordoNumero}
                                </div>
                              ) : null}
                              {f.acessoStatus === "DEGUSTACAO" && f.acessoDataFim ? (
                                <div>até {f.acessoDataFim}</div>
                              ) : null}
                              {f.acessoStatus !== "ATIVO_COM_ACORDO" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1 text-[10px]"
                                  onClick={() =>
                                    imprimirContratoDegustacao(
                                      formatarCodigoFornecedorComDigito(f.codigo),
                                      f.nome || `Fornecedor ${f.codigo}`,
                                      f.cnpj || "",
                                      f.acessoDataInicio || "",
                                      f.acessoDataFim || "",
                                    )
                                  }
                                >
                                  <Printer className="mr-1 size-3" /> Imprimir acordo
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Button
                                variant={isento ? "default" : "outline"}
                                size="sm"
                                className="h-7 text-[10px] font-bold"
                                onClick={() =>
                                  void handleUpdateConfig(
                                    f.codigo,
                                    isento ? 0 : 1,
                                    f.acessoDataInicio || null,
                                    f.acessoDataFim || null,
                                  )
                                }
                              >
                                {isento ? "Isento (Grátis)" : "Cobrar 1%"}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <CampoDataVigencia
                                key={`${f.codigo}-inicio`}
                                valor={f.acessoDataInicio || ""}
                                disabled={isento}
                                onConfirmar={(inicio) =>
                                  void handleUpdateConfig(
                                    f.codigo,
                                    f.isentoCobranca || 0,
                                    inicio,
                                    f.acessoDataFim || null,
                                  )
                                }
                              />
                              <span className="text-[10px] text-muted-foreground">a</span>
                              <CampoDataVigencia
                                key={`${f.codigo}-fim`}
                                valor={f.acessoDataFim || ""}
                                disabled={isento}
                                onConfirmar={(fim) =>
                                  void handleUpdateConfig(
                                    f.codigo,
                                    f.isentoCobranca || 0,
                                    f.acessoDataInicio || null,
                                    fim,
                                  )
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="size-6 text-xs p-0"
                                disabled={salvandoMeta === f.codigo || meta <= FILLRATE_META_MIN}
                                onClick={() => handleAlterarMeta(f.codigo, meta, meta - 1)}
                              >
                                -
                              </Button>
                              <span className="w-8 text-center font-mono text-[11px] font-bold">
                                {meta}%
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="size-6 text-xs p-0"
                                disabled={salvandoMeta === f.codigo || meta >= FILLRATE_META_MAX}
                                onClick={() => handleAlterarMeta(f.codigo, meta, meta + 1)}
                              >
                                +
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                ativo
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-red-500/10 text-red-500"
                              }`}
                            >
                              {ativo ? "Ativo" : "Inativo"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-1.5 text-[10px] font-bold"
                                disabled={atualizandoCodigo === f.codigo}
                                onClick={() => void handleRefreshSupplier(f.codigo)}
                              >
                                <RefreshCw
                                  className={`size-3 ${
                                    atualizandoCodigo === f.codigo ? "animate-spin" : ""
                                  }`}
                                />
                                Atualizar RMS
                              </Button>
                              <Button
                                variant={ativo ? "destructive" : "default"}
                                size="sm"
                                className="h-7 text-[10px] font-bold"
                                onClick={() => handleToggleAccess(f.codigo, f.acessoLiberado || 0)}
                              >
                                {ativo ? "Bloquear" : "Liberar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong> (Exibindo{" "}
                  {fornecedores.length} de {total} itens)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0 || carregando}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 text-xs"
                  >
                    <ArrowLeft className="mr-1 size-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1 || carregando}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 text-xs"
                  >
                    Próxima <ArrowRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
