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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  updateSupplierCarencia,
  refreshSupplierDataImmediately,
  FILLRATE_TAXA_PADRAO,
  FILLRATE_TAXA_MIN,
  FILLRATE_TAXA_MAX,
  FILLRATE_META_PADRAO,
  FILLRATE_META_MIN,
  FILLRATE_META_MAX,
  type FornecedorDB,
} from "@/api";
import { usePortal } from "@/context/portal-context";
import { TAXAS_ACESSO_PORTAL_PCT } from "@/lib/acordo-acesso";
import { formatarCodigoFornecedorComDigito } from "@/lib/fornecedor-codigo";
import { RebaixaDestinatariosTab } from "@/components/rebaixa-destinatarios-tab";
import { RenderErrorBoundary } from "@/components/render-error-boundary";

const formatarDataBr = (valor: string | null | undefined) => {
  const data = String(valor ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return valor || "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
};

const formatarCompetenciaBr = (valor: string | null | undefined) => {
  const competencia = String(valor ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(competencia)) return valor || "—";
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
};

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
  const montadoRef = useRef(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [fornecedores, setFornecedores] = useState<FornecedorDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [taxaMulta, setTaxaMulta] = useState<number>(FILLRATE_TAXA_PADRAO);
  const [salvandoTaxa, setSalvandoTaxa] = useState(false);
  const [codigoNovo, setCodigoNovo] = useState("");
  const [carenciaDiasNovo, setCarenciaDiasNovo] = useState(30);
  const [incluindo, setIncluindo] = useState(false);
  const [salvandoMeta, setSalvandoMeta] = useState<string | null>(null);
  const [atualizandoCodigo, setAtualizandoCodigo] = useState<string | null>(null);
  const [colunaOrdenacao, setColunaOrdenacao] = useState<string | null>(null);
  const [ordemOrdenacao, setOrdemOrdenacao] = useState<"asc" | "desc">("asc");

  const limit = 500;

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const fornecedoresOrdenados = [...fornecedores].sort((a, b) => {
    const alvo = (search.trim() || codigoNovo.trim()).replace(/\D/g, "");
    const codigoA = String(a.codigo ?? "").replace(/\D/g, "");
    const codigoB = String(b.codigo ?? "").replace(/\D/g, "");
    const prioridade = (codigo: string) => (codigo === alvo ? 0 : codigo.startsWith(alvo) ? 1 : 2);
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
    colunaOrdenacao !== coluna ? (
      <ArrowUpDown className="size-3 opacity-50" />
    ) : ordemOrdenacao === "asc" ? (
      <ArrowUp className="size-3" />
    ) : (
      <ArrowDown className="size-3" />
    );

  const cabecalhoOrdenavel = (titulo: string, coluna: string) => (
    <div className="flex items-center justify-between gap-1">
      <span>{titulo}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-5"
        onClick={() => ordenarPor(coluna)}
        aria-label={`Ordenar por ${titulo}`}
      >
        {indicadorOrdenacao(coluna)}
      </Button>
    </div>
  );

  const handleUpdateConfig = async (codigo: string, isento: number, taxaAcessoPct?: number) => {
    try {
      const taxa = taxaAcessoPct !== undefined ? taxaAcessoPct : 1.0;
      await updateSupplierAccessConfig({
        data: {
          codigo,
          isentoCobranca: isento,
          taxaAcessoPct: taxa,
        },
      });
      setFornecedores((prev) =>
        prev.map((f) =>
          f.codigo === codigo
            ? {
                ...f,
                isentoCobranca: isento,
                taxaAcessoPct: taxa,
              }
            : f,
        ),
      );
      toast.success("Configuração de acesso atualizada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configuração.");
    }
  };

  const handleUpdateCarencia = async (codigo: string, carenciaDias: number) => {
    try {
      const resultado = await updateSupplierCarencia({
        data: { codigo, carenciaDias },
      });
      setFornecedores((prev) =>
        prev.map((f) =>
          f.codigo === codigo
            ? {
                ...f,
                carenciaDias: resultado.carenciaDias,
                carenciaAte: resultado.carenciaAte,
                primeiraCompetenciaCobravel: resultado.primeiraCompetenciaCobravel,
                primeiraCobrancaEm: resultado.primeiraCobrancaEm,
                acessoStatus: resultado.acessoStatus as FornecedorDB["acessoStatus"],
              }
            : f,
        ),
      );
      toast.success("Carência e data de cobrança atualizadas.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar carência.");
    }
  };

  const handleRefreshSupplier = async (codigo: string) => {
    setAtualizandoCodigo(codigo);
    try {
      const res = await refreshSupplierDataImmediately({ data: { codigo } });
      toast.success(res.message);
      await carregarFornecedores(search, page);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar dados do fornecedor.");
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
          onlyActive: true,
        },
      });
      if (!montadoRef.current) return;
      setFornecedores(data.rows);
      setTotal(data.total);
    } catch (err) {
      if (!montadoRef.current) return;
      console.error(err);
      toast.error("Erro ao carregar lista de fornecedores.");
    } finally {
      if (montadoRef.current) setCarregando(false);
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
    const possuiCargaEmAndamento = fornecedores.some(
      (fornecedor) => fornecedor.cargaStatus === "PROCESSANDO",
    );
    if (!possuiCargaEmAndamento) return;
    const timer = window.setInterval(() => {
      void carregarFornecedores(search, page);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fornecedores, search, page]);

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
      const politica = await updateFillrateTaxa({
        data: { taxaMultaPct: limitada },
      });
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

  const imprimirAcordo = (
    codigo: string,
    nome: string,
    cnpj: string,
    acessoStatus: string | null | undefined,
    inicio: string | null | undefined,
    carenciaAte: string | null | undefined,
    carenciaDias: number | null | undefined,
    primeiraCompetencia: string | null | undefined,
    primeiraCobranca: string | null | undefined,
    taxaAcessoPct: number,
    acordoNumero?: string | null,
  ) => {
    const janela = window.open("", "_blank", "width=800,height=1100");
    if (!janela) {
      toast.error("Permita pop-ups para imprimir o contrato.");
      return;
    }
    const escaparHtml = (valor: string) =>
      valor.replace(
        /[&<>"']/g,
        (caractere) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          })[caractere]!,
      );
    const degustacao = acessoStatus === "DEGUSTACAO";
    const detalhesAcesso = degustacao
      ? `<p>O acesso de degustação inicia em <b>${escaparHtml(formatarDataBr(inicio) || "não informado")}</b> e termina em <b>${escaparHtml(formatarDataBr(carenciaAte) || "sem carência")}</b>, totalizando <b>${Number(carenciaDias || 0)} dias</b>. A primeira competência cobravel será <b>${escaparHtml(formatarCompetenciaBr(primeiraCompetencia) || "não informada")}</b>, com cobrança a partir de <b>${escaparHtml(formatarDataBr(primeiraCobranca) || "não informada")}</b>. Este prazo é único e não prorrogável.</p>`
      : `<p>O acesso está ativo no Portal do Fornecedor${acordoNumero ? ` sob o acordo nº <b>${escaparHtml(acordoNumero)}</b>` : ""}.</p>`;
    const loginImagemUrl = new URL("/assets/login-portal-fornecedor.png", window.location.origin)
      .href;
    const primeiroAcesso = `<section class="primeiro-acesso"><h2>Primeiro acesso ao Portal do Fornecedor</h2><ol><li>Acesse <b>https://portaldofornecedor.intelider.com.br</b>.</li><li>Informe o seu <b>código RMS</b>, o e-mail corporativo e a senha inicial.</li><li>No primeiro acesso, use o <b>CNPJ do fornecedor</b> como senha, com ou sem pontuação.</li><li>Após entrar, cadastre uma nova senha no menu <b>Corrigir senha</b>.</li></ol><figure class="login-print"><figcaption>Exemplo de preenchimento da tela de login</figcaption><img src="${escaparHtml(loginImagemUrl)}" alt="Tela de login do Portal do Fornecedor" /></figure></section>`;
    janela.document.write(
      `<html><head><title>Acordo de acesso - ${escaparHtml(codigo)}</title><style>@page{size:A4 portrait;margin:15mm}body{font-family:Arial;padding:0;line-height:1.4}h1{font-size:21px}h2{font-size:15px;margin:0 0 6px}hr{margin:18px 0}.primeiro-acesso{background:#f3f7ff;border-left:4px solid #1d4ed8;padding:10px 12px;margin:14px 0}.primeiro-acesso ol{margin:0;padding-left:20px}.login-print{width:72%;margin:10px auto 2px;padding:6px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;break-inside:avoid}.login-print figcaption{font-size:10px;font-weight:bold;margin-bottom:5px;color:#334155}.login-print img{display:block;width:100%;max-height:220px;object-fit:contain;border:1px solid #e2e8f0}.assinatura{margin-top:42px;display:flex;justify-content:space-between}.linha{border-top:1px solid #222;width:42%;padding-top:6px}</style></head><body><h1>ACORDO DE ACESSO AO PORTAL DO FORNECEDOR</h1><p><b>Líder Indústria &amp; Comércio Ltda.</b>, CNPJ <b>05.054.671/0005-63</b>, e o fornecedor <b>${escaparHtml(nome)}</b>, CNPJ <b>${escaparHtml(cnpj || "não informado")}</b>, código RMS <b>${escaparHtml(codigo)}</b>, registram este termo de acesso.</p>${detalhesAcesso}${primeiroAcesso}<p>Após a validação do acordo, será aplicada a taxa comercial escolhida de <b>${taxaAcessoPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</b> sobre as compras faturadas do mês anterior.</p><p>Após a assinatura e validação no sistema do Grupo Líder, o fornecedor será mantido ativo e incluído na lista de cobrança do menu <b>Acordo de acesso</b>. Sem validação, o acesso será encerrado ao final do prazo.</p><p>Este documento deve ser assinado pelo fornecedor e devolvido ao comprador responsável.</p><hr/><div class="assinatura"><div class="linha">Fornecedor / representante legal</div><div class="linha">Grupo Líder / comprador</div></div><script>window.onload=()=>window.print()</script></body></html>`,
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
      const resultado = await includeSupplier({
        data: { codigo, carenciaDias: carenciaDiasNovo },
      });
      const codigoExibicao = formatarCodigoFornecedorComDigito(resultado.codigo);
      toast.success(resultado.message || `Carga RMS iniciada para o fornecedor ${codigoExibicao}.`);
      setCodigoNovo("");
      setPage(0);
      await carregarFornecedores(codigoExibicao, 0);
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
      if (novoStatus === 0) {
        setFornecedores((prev) => prev.filter((f) => f.codigo !== codigo));
        setTotal((prev) => Math.max(0, prev - 1));
      }
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
      descricao="Gerenciamento de acessos de fornecedores, política de fill rate e logs de auditoria do Grupo Líder."
    >
      <Tabs defaultValue="acesso" className="space-y-6">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="acesso">Controle de Acesso</TabsTrigger>
          <TabsTrigger value="rebaixa-destinatarios">Destinatários de rebaixa e preços</TabsTrigger>
          <TabsTrigger value="politica-log">Fill Rate & Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="acesso" className="space-y-6">
          {/* Card: Incluir fornecedor */}
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
                  Informe apenas o código RMS. Nome e CNPJ serão preenchidos pelo cadastro RMS
                  quando o cache for sincronizado. A data inicial é registrada automaticamente e não
                  poderá ser alterada. A cobrança começa após a primeira competência mensal
                  completa.
                </p>
                <p className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-primary/90">
                  O botão <b>Imprimir acordo</b>, na lista abaixo, gera o termo com as instruções e
                  um print da tela de login para orientar o fornecedor no primeiro acesso.
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
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground">
                    Carência (0–60 dias)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={carenciaDiasNovo}
                    onChange={(e) =>
                      setCarenciaDiasNovo(Math.max(0, Math.min(60, Number(e.target.value))))
                    }
                    className="h-9 w-[110px] font-mono"
                  />
                </div>
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

          {/* Card: Fornecedores Cadastrados */}
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

              {/* Tabela de Fornecedores com Scroll */}
              <div className="rounded-md border max-h-[550px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">
                        {cabecalhoOrdenavel("Código RMS", "codigo")}
                      </TableHead>
                      <TableHead className="w-[180px]">
                        <div className="space-y-1">
                          {cabecalhoOrdenavel("Fornecedor", "nome")}
                          <Input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Buscar..."
                            className="h-6 px-1.5 text-[10px]"
                          />
                        </div>
                      </TableHead>
                      <TableHead className="w-[150px] text-center">
                        {cabecalhoOrdenavel("Acordo / status", "acessoStatus")}
                      </TableHead>
                      <TableHead className="w-[125px] text-center">Carga RMS</TableHead>
                      <TableHead className="w-[130px] text-center">
                        {cabecalhoOrdenavel("Cobrança", "isentoCobranca")}
                      </TableHead>
                      <TableHead className="w-[115px] text-center">
                        {cabecalhoOrdenavel("Início", "acessoDataInicio")}
                      </TableHead>
                      <TableHead className="w-[125px] text-center">
                        {cabecalhoOrdenavel("Carência", "carenciaAte")}
                      </TableHead>
                      <TableHead className="w-[145px] text-center">
                        {cabecalhoOrdenavel("Cobrança", "primeiraCobrancaEm")}
                      </TableHead>
                      <TableHead className="w-[110px] text-center">
                        {cabecalhoOrdenavel(
                          `Meta Fill (${FILLRATE_META_MIN}–${FILLRATE_META_MAX}%)`,
                          "metaFillRatePct",
                        )}
                      </TableHead>
                      <TableHead className="w-[100px] text-center">
                        {cabecalhoOrdenavel("Acesso", "acessoLiberado")}
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carregando && fornecedores.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={11}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          Carregando fornecedores...
                        </TableCell>
                      </TableRow>
                    ) : fornecedores.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={11}
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
                        const cargaCompleta = f.cargaStatus === "COMPLETA";
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
                                      ? `DEGUSTAÇÃO ${f.carenciaDias ?? ""} DIAS`
                                      : f.acessoStatus === "AGUARDANDO_ACORDO_MENSAL"
                                        ? "AGUARDANDO ACORDO MENSAL"
                                        : f.acessoStatus === "ACORDO_MENSAL_PENDENTE"
                                          ? "ACORDO MENSAL PENDENTE"
                                          : f.acessoStatus === "AGUARDANDO_CONTRATO"
                                            ? "AGUARDANDO CONTRATO"
                                            : f.acessoStatus === "AGUARDANDO_COMPETENCIA"
                                              ? "AGUARDANDO COMPETÊNCIA"
                                              : f.acessoStatus === "EXPIRADO"
                                                ? "EXPIRADO"
                                                : "SEM ACORDO"}
                                </span>
                                {f.acordoNumero ? (
                                  <div className="font-mono text-muted-foreground">
                                    {f.acordoNumero}
                                  </div>
                                ) : null}
                                {f.acessoStatus === "DEGUSTACAO" && f.carenciaAte ? (
                                  <div>até {formatarDataBr(f.carenciaAte)}</div>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1 text-[10px]"
                                  onClick={() =>
                                    imprimirAcordo(
                                      formatarCodigoFornecedorComDigito(f.codigo),
                                      f.nome || `Fornecedor ${f.codigo}`,
                                      f.cnpj || "",
                                      f.acessoStatus,
                                      f.acessoDataInicio,
                                      f.carenciaAte,
                                      f.carenciaDias,
                                      f.primeiraCompetenciaCobravel,
                                      f.primeiraCobrancaEm,
                                      f.taxaAcessoPct ?? 1.0,
                                      f.acordoNumero,
                                    )
                                  }
                                >
                                  <Printer className="mr-1 size-3" /> Imprimir acordo
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                  cargaCompleta
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : f.cargaStatus === "FALHA"
                                      ? "bg-amber-500/10 text-amber-700"
                                      : f.cargaStatus === "PROCESSANDO"
                                        ? "bg-blue-500/10 text-blue-700"
                                        : "bg-muted text-muted-foreground"
                                }`}
                                title={
                                  f.cargaErro ||
                                  f.cargaVerificadaEm ||
                                  "Fornecedor anterior ao portão de carga"
                                }
                              >
                                {cargaCompleta
                                  ? "COMPLETA"
                                  : f.cargaStatus === "FALHA"
                                    ? "PENDENTE"
                                    : f.cargaStatus === "PROCESSANDO"
                                      ? "PROCESSANDO"
                                      : "LEGADO"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <select
                                  value={isento ? "isento" : String(f.taxaAcessoPct ?? 1.0)}
                                  onChange={(e) => {
                                    const isentoSelecionado = e.target.value === "isento";
                                    void handleUpdateConfig(
                                      f.codigo,
                                      isentoSelecionado ? 1 : 0,
                                      isentoSelecionado
                                        ? (f.taxaAcessoPct ?? 1.0)
                                        : parseFloat(e.target.value),
                                    );
                                  }}
                                  className="h-7 rounded border border-border bg-background px-2 text-[10px] font-mono font-bold"
                                  aria-label="Cobrança"
                                >
                                  <option value="isento">Isento (0%)</option>
                                  {TAXAS_ACESSO_PORTAL_PCT.map((taxa) => (
                                    <option key={taxa} value={taxa}>
                                      {taxa.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                      %
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs font-semibold whitespace-nowrap">
                              <span title="Data inicial imutável">
                                🔒 {formatarDataBr(f.acessoDataInicio)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs whitespace-nowrap">
                              <Input
                                key={`${f.codigo}-${f.carenciaDias ?? "nova"}`}
                                type="number"
                                min={0}
                                max={60}
                                defaultValue={f.carenciaDias ?? ""}
                                placeholder="0–60"
                                aria-label={`Carência em dias para ${f.nome}`}
                                className="mx-auto h-7 w-[64px] px-1 text-center font-mono text-xs"
                                onBlur={(e) => {
                                  const dias = Math.trunc(Number(e.target.value));
                                  if (
                                    Number.isInteger(dias) &&
                                    dias >= 0 &&
                                    dias <= 60 &&
                                    dias !== f.carenciaDias
                                  ) {
                                    void handleUpdateCarencia(f.codigo, dias);
                                  }
                                }}
                              />
                              <div className="mt-1 font-semibold">
                                {f.carenciaAte ? formatarDataBr(f.carenciaAte) : "Definir carência"}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs whitespace-nowrap">
                              <div className="text-[10px] text-muted-foreground">
                                Competência {formatarCompetenciaBr(f.primeiraCompetenciaCobravel)}
                              </div>
                              <div className="font-bold">
                                {formatarDataBr(f.primeiraCobrancaEm)}
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
                                  disabled={
                                    atualizandoCodigo === f.codigo ||
                                    f.cargaStatus === "PROCESSANDO"
                                  }
                                  onClick={() => void handleRefreshSupplier(f.codigo)}
                                >
                                  <RefreshCw
                                    className={`size-3 ${
                                      atualizandoCodigo === f.codigo ? "animate-spin" : ""
                                    }`}
                                  />
                                  {f.cargaStatus === "PROCESSANDO"
                                    ? "Carga em andamento"
                                    : "Validar carga RMS"}
                                </Button>
                                <Button
                                  variant={ativo ? "destructive" : "default"}
                                  size="sm"
                                  className="h-7 text-[10px] font-bold"
                                  onClick={() =>
                                    handleToggleAccess(f.codigo, f.acessoLiberado || 0)
                                  }
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rebaixa-destinatarios" className="space-y-6">
          <RenderErrorBoundary boundary="admin-fornecedores:rebaixa-destinatarios">
            <RebaixaDestinatariosTab />
          </RenderErrorBoundary>
        </TabsContent>

        <TabsContent value="politica-log" className="space-y-6">
          {/* Card: Política de Fill Rate */}
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
                  Valor único da rede. A meta é pacto individual e fica na coluna de cada
                  fornecedor. Os dois valores só aparecem no Fill Rate como espelho do cálculo.
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

          {/* Card: Logs de Auditoria */}
          <Card className="border-none shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="size-5 text-primary" />
                <span>Logs de Auditoria</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground max-h-[350px] overflow-y-auto space-y-2">
                <div className="border-b border-border/40 pb-1">
                  <span className="text-emerald-500 font-bold">[2026-09-15 14:32:00]</span>{" "}
                  Fornecedor <strong className="text-foreground">708558 (GDC)</strong> atualizado do
                  RMS com sucesso por <span className="text-primary font-semibold">admin</span>.
                </div>
                <div className="border-b border-border/40 pb-1">
                  <span className="text-emerald-500 font-bold">[2026-09-15 11:22:15]</span>{" "}
                  Fornecedor <strong className="text-foreground">104913 (GDC Matriz)</strong>{" "}
                  vinculado ao comercial <strong className="text-foreground">708558</strong> por{" "}
                  <span className="text-primary font-semibold">admin</span>.
                </div>
                <div className="border-b border-border/40 pb-1">
                  <span className="text-emerald-500 font-bold">[2026-09-14 17:31:05]</span> Taxa de
                  multa global de Fill Rate ajustada para{" "}
                  <strong className="text-foreground">{taxaMulta}%</strong> por{" "}
                  <span className="text-primary font-semibold">admin</span>.
                </div>
                <div className="border-b border-border/40 pb-1">
                  <span className="text-emerald-500 font-bold">[2026-09-14 10:05:42]</span>{" "}
                  Fornecedor <strong className="text-foreground">Constrular (FOR-001)</strong>{" "}
                  ativado para degustação por{" "}
                  <span className="text-primary font-semibold">Marina Costa</span>.
                </div>
                <div className="border-b border-border/40 pb-1">
                  <span className="text-emerald-500 font-bold">[2026-09-12 09:15:30]</span>{" "}
                  Fornecedor <strong className="text-foreground">Casa Forte (FOR-002)</strong> teve
                  acesso bloqueado por <span className="text-primary font-semibold">admin</span>.
                </div>
                <div className="pb-1">
                  <span className="text-emerald-500 font-bold">[2026-09-10 16:04:23]</span> Daemon{" "}
                  <strong className="text-foreground">maoadc-bico-watcher</strong> inicializado com
                  sucesso e operando.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}
