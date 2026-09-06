import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import {
  agendamentos as agendamentosMock,
  fornecedor,
  type Agendamento,
  setActiveSupplierCode,
  getActiveSupplierCode,
  globalDbCache,
} from "@/lib/mock-data";
import {
  FILTRO_VAZIO,
  setFiltroMercadologicoStore,
  type FiltroMercadologico,
} from "@/lib/filtro-mercadologico";
import {
  fetchConciliacaoNfePedido,
  fetchContasReceber,
  fetchDocas,
  fetchEstoque,
  fetchFaturas,
  fetchNfePendentes,
  encerrarSessaoPortal,
  restaurarSessaoPortal,
  fetchMinhaContaFornecedor,
  fetchFornecedor,
  fetchPedidos,
  fetchPerdas,
  fetchProdutos,
  fetchProdutosBloqueios,
  fetchVendas,
  fetchTransferenciasCdam,
  solicitarAntecipacao,
  fetchAntecipacoes,
  type UsuarioInternoDB,
} from "@/api";
import { subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type Antecipacao = {
  codigoAuditoria: string;
  criadoEm: string;
  faturaIds: string[];
  valorBruto: number;
  desconto: number;
  valorLiquido: number;
  emailEnviado?: boolean | undefined;
  erroEmail?: string | undefined;
};

export type ContaFornecedorSessao = {
  nome: string;
  email: string;
  precisaTrocarSenha: boolean;
};

type PortalState = {
  carregandoSessao: boolean;
  autenticado: boolean;
  usuarioInterno: UsuarioInternoDB | null;
  usuarioFornecedor: ContaFornecedorSessao | null;
  primeiroAcessoConcluido: boolean;
  mfaAtivo: boolean;
  codigoFornecedorAtivo: string;
  dadosFornecedorVersao: number;
  agendamentos: Agendamento[];
  antecipacoes: Antecipacao[];
  entrar: (
    codigoFornecedor?: string,
    userInterno?: UsuarioInternoDB,
    contaFornecedor?: ContaFornecedorSessao,
  ) => void;
  sair: () => void;
  mudarFornecedorAtivo: (codigo: string) => void;
  concluirPrimeiroAcesso: () => void;
  marcarSenhaCorrigida: () => void;
  adicionarAgendamento: (agendamento: Omit<Agendamento, "id" | "status">) => void;
  registrarAntecipacao: (dados: Omit<Antecipacao, "codigoAuditoria" | "criadoEm">) => Promise<Antecipacao>;
  fornecedor: typeof fornecedor;
  classificacaoDados: string;
  setClassificacaoDados: (val: string) => void;
  filtroMercadologico: FiltroMercadologico;
  setFiltroMercadologico: (val: FiltroMercadologico) => void;
};

const PortalContext = createContext<PortalState | null>(null);

const CHAVE_SESSAO = "portal-lider-sessao";

export function PortalProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(false);
  const [primeiroAcessoConcluido, setPrimeiroAcessoConcluido] = useState(false);
  const [mfaAtivo, setMfaAtivo] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(agendamentosMock);
  const [antecipacoes, setAntecipacoes] = useState<Antecipacao[]>([]);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [codigoFornecedorAtivo, setCodigoFornecedorAtivo] = useState(getActiveSupplierCode());
  const [dadosFornecedorVersao, setDadosFornecedorVersao] = useState(0);
  const [usuarioInterno, setUsuarioInterno] = useState<UsuarioInternoDB | null>(null);
  const [usuarioFornecedor, setUsuarioFornecedor] = useState<ContaFornecedorSessao | null>(null);
  const [classificacaoDados, setClassificacaoDados] = useState<string>("departamento");
  const [filtroMercadologico, setFiltroMercadologicoState] =
    useState<FiltroMercadologico>(FILTRO_VAZIO);

  useEffect(() => {
    setFiltroMercadologicoStore(filtroMercadologico);
  }, [filtroMercadologico]);

  const setFiltroMercadologico = useCallback((val: FiltroMercadologico) => {
    setFiltroMercadologicoStore(val);
    setFiltroMercadologicoState(val);
    setDadosFornecedorVersao((versao) => versao + 1);
  }, []);

  const carregarDadosReaisFornecedor = useCallback(async (code: string) => {
    try {
      setCodigoFornecedorAtivo(code);
      const [forn, prods, pds, vds, bloqs, estq, peds, fats, crs, nfes, docas, concil, transfs] =
        await Promise.all([
          fetchFornecedor({ data: code }),
          fetchProdutos({ data: code }),
          fetchPerdas({ data: code }),
          fetchVendas({ data: code }).catch((err) => {
            console.error("Erro ao carregar vendas do fornecedor:", err);
            return [] as Awaited<ReturnType<typeof fetchVendas>>;
          }),
          fetchProdutosBloqueios({ data: code }),
          fetchEstoque({ data: code }),
          fetchPedidos({ data: code }),
          fetchFaturas({ data: code }),
          fetchContasReceber({ data: code }),
          fetchNfePendentes({ data: code }),
          fetchDocas(),
          fetchConciliacaoNfePedido({ data: code }),
          fetchTransferenciasCdam({ data: code }).catch((err) => {
            console.error("Erro ao carregar transferencias CDAM:", err);
            return [] as Awaited<ReturnType<typeof fetchTransferenciasCdam>>;
          }),
        ]);

      if (forn) {
        globalDbCache.fornecedor = {
          codigo: forn.codigo,
          nome: forn.nome,
          cnpj: forn.cnpj,
          cnpjSenhaInicial: forn.cnpjSenhaInicial,
          destinatario: forn.destinatario,
          modeloEntrega: forn.modeloEntrega as any,
          agendaRecebimentoCdam: forn.agendaRecebimentoCdam as any,
          filialEntregaPadrao: forn.filialEntregaPadrao,
          isentoCobranca: forn.isentoCobranca as any,
          acessoDataInicio: forn.acessoDataInicio,
          acessoDataFim: forn.acessoDataFim,
          ...(forn.fornecedorComercialCodigo
            ? { fornecedorComercialCodigo: forn.fornecedorComercialCodigo }
            : {}),
          ...(forn.fornecedorComercialNome
            ? { fornecedorComercialNome: forn.fornecedorComercialNome }
            : {}),
          cadastroFinanceiro: {
            prazoPagamentoDias: forn.prazoPagamentoDias,
            prazoTipo: forn.prazoTipo ?? null,
            descontoFinanceiroPct: forn.descontoFinanceiroPct,
            descontoFinanceiroAteDias: null,
            condicaoPagamentoLabel: forn.condicaoPagamentoLabel,
            anticipationEnabled: true,
          }
        };
        globalDbCache.produtos = prods.map((p) => ({
          ...p,
          papelMercadologico: p.papelMercadologico as any,
        }));
        globalDbCache.perdas = pds;
        globalDbCache.vendas = vds;
        globalDbCache.bloqueios = bloqs;
        globalDbCache.estoque = (estq ?? []).map((e) => ({
          sku: e.sku,
          lojaId: e.lojaId,
          estoqueAtual: e.estoqueAtual,
          estoqueMinimo: 0,
        }));
        globalDbCache.pedidos = (peds ?? []).map((p) => {
          const { entradaCdam, ...rest } = p;
          return entradaCdam
            ? { ...rest, destino: "Fornecedor" as const, entradaCdam }
            : { ...rest, destino: "Fornecedor" as const };
        });
        globalDbCache.faturas = (fats ?? []).map((f) => {
          const { recebimento, prazoTipo, serie, chaveNfe, destTipo, ...rest } = f;
          return {
            ...rest,
            ...(recebimento ? { recebimento } : {}),
            ...(prazoTipo ? { prazoTipo } : {}),
          };
        });
        globalDbCache.contasReceber = crs ?? [];
        globalDbCache.nfePendentes = (nfes ?? []) as any;
        globalDbCache.docas = docas ?? [];
        globalDbCache.conciliacao = concil ?? [];
        globalDbCache.transferenciasCdam = transfs ?? [];

        // Agrupar vendas reais por mês para alimentar o gráfico de sell-out temporal de 12 meses
        const mensalMap = new Map<string, { faturamento: number; volume: number }>();
        vds.forEach((v) => {
          const anoMes = v.data.slice(0, 7); // YYYY-MM
          const atual = mensalMap.get(anoMes) || { faturamento: 0, volume: 0 };
          atual.faturamento += v.quantidade * v.valorUnitario;
          atual.volume += v.quantidade;
          mensalMap.set(anoMes, atual);
        });

        // Gerar a série histórica dos últimos 12 meses a partir da última venda real disponível.
        const dataFinalVendas = vds.reduce(
          (maior, venda) => (venda.data > maior ? venda.data : maior),
          "",
        );
        const fimSerie = dataFinalVendas ? new Date(`${dataFinalVendas}T00:00:00Z`) : new Date();
        globalDbCache.vendasMensais = Array.from({ length: 12 }, (_, i) => {
          const dataMes = subMonths(fimSerie, 11 - i);
          const chave = format(dataMes, "yyyy-MM");
          const real = mensalMap.get(chave) || { faturamento: 0, volume: 0 };

          return {
            mes: format(dataMes, "MMM/yy", { locale: ptBR }),
            faturamento: Number(real.faturamento.toFixed(2)),
            volume: Math.round(real.volume),
          };
        });
      }
      setDadosFornecedorVersao((versao) => versao + 1);
    } catch (error) {
      console.error("Erro ao carregar dados do SQLite no Contexto:", error);
      setDadosFornecedorVersao((versao) => versao + 1);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bruto = window.sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) {
      setCarregandoSessao(false);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const dados = JSON.parse(bruto) as {
          autenticado: boolean;
          primeiroAcessoConcluido: boolean;
          usuarioInterno?: UsuarioInternoDB | null;
          usuarioFornecedor?: ContaFornecedorSessao | null;
        };
        if (dados.autenticado) {
          if (dados.usuarioInterno?.username) {
            await restaurarSessaoPortal({
              data: { tipo: "interno", codigo: dados.usuarioInterno.username },
            });
          } else {
            await restaurarSessaoPortal({
              data: { tipo: "fornecedor", codigo: getActiveSupplierCode() },
            });
          }
        }
        if (cancelado) return;
        setAutenticado(dados.autenticado);
        setPrimeiroAcessoConcluido(dados.primeiroAcessoConcluido);
        setMfaAtivo(dados.primeiroAcessoConcluido);
        if (dados.usuarioInterno) {
          setUsuarioInterno(dados.usuarioInterno);
        }
        if (dados.usuarioFornecedor) {
          setUsuarioFornecedor(dados.usuarioFornecedor);
        }
        if (dados.autenticado && !dados.usuarioInterno) {
          const conta = await fetchMinhaContaFornecedor();
          if (conta) {
            setUsuarioFornecedor({
              nome: conta.nome,
              email: conta.email,
              precisaTrocarSenha: Boolean(conta.precisaTrocarSenha),
            });
            setPrimeiroAcessoConcluido(!conta.precisaTrocarSenha);
          }
        }
        if (dados.autenticado) {
          const code = getActiveSupplierCode();
          setCodigoFornecedorAtivo(code);
          await carregarDadosReaisFornecedor(code);
        }
      } catch {
        window.sessionStorage.removeItem(CHAVE_SESSAO);
      } finally {
        if (!cancelado) setCarregandoSessao(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [carregarDadosReaisFornecedor]);

  useEffect(() => {
    if (typeof window === "undefined" || carregandoSessao) return;
    window.sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({ autenticado, primeiroAcessoConcluido, usuarioInterno, usuarioFornecedor }),
    );
  }, [autenticado, primeiroAcessoConcluido, usuarioInterno, usuarioFornecedor, carregandoSessao]);

  useEffect(() => {
    if (codigoFornecedorAtivo) {
      fetchAntecipacoes({ data: codigoFornecedorAtivo }).then((data) => {
        setAntecipacoes(data || []);
      });
    } else {
      setAntecipacoes([]);
    }
  }, [codigoFornecedorAtivo]);

  const entrar = useCallback(
    (
      codigoFornecedor?: string,
      userInterno?: UsuarioInternoDB,
      contaFornecedor?: ContaFornecedorSessao,
    ) => {
      if (userInterno) {
        setUsuarioInterno(userInterno);
        setUsuarioFornecedor(null);
        const jaAtivo = getActiveSupplierCode();
        setActiveSupplierCode(jaAtivo);
        setCodigoFornecedorAtivo(jaAtivo);
        void carregarDadosReaisFornecedor(jaAtivo);
        setPrimeiroAcessoConcluido(true);
      } else if (codigoFornecedor) {
        setUsuarioInterno(null);
        setUsuarioFornecedor(contaFornecedor ?? null);
        setActiveSupplierCode(codigoFornecedor);
        setCodigoFornecedorAtivo(codigoFornecedor);
        carregarDadosReaisFornecedor(codigoFornecedor);
        setPrimeiroAcessoConcluido(!contaFornecedor?.precisaTrocarSenha);
      }
      setAutenticado(true);
    },
    [carregarDadosReaisFornecedor],
  );
  const sair = useCallback(() => {
    setAutenticado(false);
    setUsuarioInterno(null);
    setUsuarioFornecedor(null);
    void encerrarSessaoPortal();
  }, []);

  const mudarFornecedorAtivo = useCallback(
    (code: string) => {
      setActiveSupplierCode(code);
      setCodigoFornecedorAtivo(code);
      setFiltroMercadologicoStore(FILTRO_VAZIO);
      setFiltroMercadologicoState(FILTRO_VAZIO);
      carregarDadosReaisFornecedor(code);
    },
    [carregarDadosReaisFornecedor],
  );

  const concluirPrimeiroAcesso = useCallback(() => {
    setPrimeiroAcessoConcluido(true);
    setMfaAtivo(true);
  }, []);

  const marcarSenhaCorrigida = useCallback(() => {
    setUsuarioFornecedor((atual) =>
      atual ? { ...atual, precisaTrocarSenha: false } : atual,
    );
    setPrimeiroAcessoConcluido(true);
  }, []);

  const adicionarAgendamento = useCallback((dados: Omit<Agendamento, "id" | "status">) => {
    setAgendamentos((atual) => [
      ...atual,
      { ...dados, id: `AG-${2300 + atual.length}`, status: "Confirmado" },
    ]);
  }, []);

  const registrarAntecipacao = useCallback(
    async (dados: Omit<Antecipacao, "codigoAuditoria" | "criadoEm">) => {
      const res = await solicitarAntecipacao({
        data: {
          fornecedorCodigo: codigoFornecedorAtivo,
          faturaIds: dados.faturaIds,
          valorBruto: dados.valorBruto,
          desconto: dados.desconto,
          valorLiquido: dados.valorLiquido,
        },
      });
      setAntecipacoes((atual) => [res, ...atual]);
      return res;
    },
    [codigoFornecedorAtivo],
  );

  const value = useMemo<PortalState>(
    () => ({
      carregandoSessao,
      autenticado,
      usuarioInterno,
      usuarioFornecedor,
      primeiroAcessoConcluido,
      mfaAtivo,
      codigoFornecedorAtivo,
      dadosFornecedorVersao,
      agendamentos,
      antecipacoes,
      entrar,
      sair,
      mudarFornecedorAtivo,
  solicitarAntecipacao,
  fetchAntecipacoes,
      concluirPrimeiroAcesso,
      marcarSenhaCorrigida,
      adicionarAgendamento,
      registrarAntecipacao,
      fornecedor,
      classificacaoDados,
      setClassificacaoDados,
      filtroMercadologico,
      setFiltroMercadologico,
    }),
    [
      carregandoSessao,
      autenticado,
      usuarioInterno,
      usuarioFornecedor,
      primeiroAcessoConcluido,
      mfaAtivo,
      codigoFornecedorAtivo,
      dadosFornecedorVersao,
      agendamentos,
      antecipacoes,
      entrar,
      sair,
      mudarFornecedorAtivo,
  solicitarAntecipacao,
  fetchAntecipacoes,
      concluirPrimeiroAcesso,
      marcarSenhaCorrigida,
      adicionarAgendamento,
      registrarAntecipacao,
      classificacaoDados,
      setClassificacaoDados,
      filtroMercadologico,
      setFiltroMercadologico,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal deve ser usado dentro de PortalProvider");
  return ctx;
}
