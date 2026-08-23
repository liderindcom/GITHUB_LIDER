import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEMO_FORNECEDOR_CODIGO,
  normalizarCodigoFornecedor,
} from "@/lib/fornecedor-codigo";
import {
  agendamentos as agendamentosMock,
  fornecedor,
  type Agendamento,
  setActiveSupplierCode,
  getActiveSupplierCode,
  globalDbCache,
} from "@/lib/mock-data";
import {
  fetchConciliacaoNfePedido,
  fetchContasReceber,
  fetchDocas,
  fetchEstoque,
  fetchFaturas,
  fetchNfePendentes,
  encerrarSessaoPortal,
  fetchFornecedor,
  fetchPedidos,
  fetchPerdas,
  fetchProdutos,
  fetchProdutosBloqueios,
  fetchVendas,
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
};

type PortalState = {
  carregandoSessao: boolean;
  autenticado: boolean;
  usuarioInterno: UsuarioInternoDB | null;
  primeiroAcessoConcluido: boolean;
  mfaAtivo: boolean;
  codigoFornecedorAtivo: string;
  dadosFornecedorVersao: number;
  agendamentos: Agendamento[];
  antecipacoes: Antecipacao[];
  entrar: (codigoFornecedor?: string, userInterno?: UsuarioInternoDB) => void;
  sair: () => void;
  mudarFornecedorAtivo: (codigo: string) => void;
  concluirPrimeiroAcesso: () => void;
  adicionarAgendamento: (agendamento: Omit<Agendamento, "id" | "status">) => void;
  registrarAntecipacao: (dados: Omit<Antecipacao, "codigoAuditoria" | "criadoEm">) => Antecipacao;
  fornecedor: typeof fornecedor;
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

  const carregarDadosReaisFornecedor = useCallback(async (code: string) => {
    try {
      setCodigoFornecedorAtivo(code);
      const codeClean = normalizarCodigoFornecedor(code);

      if (codeClean === DEMO_FORNECEDOR_CODIGO) {
        globalDbCache.fornecedor = null;
        globalDbCache.produtos = null;
        globalDbCache.perdas = null;
        globalDbCache.vendas = null;
        globalDbCache.estoque = null;
        globalDbCache.vendasMensais = null;
        globalDbCache.bloqueios = null;
        globalDbCache.pedidos = null;
        globalDbCache.faturas = null;
        globalDbCache.contasReceber = null;
        globalDbCache.nfePendentes = null;
        globalDbCache.docas = null;
        globalDbCache.conciliacao = null;
        setDadosFornecedorVersao((versao) => versao + 1);
        return;
      }

      const [forn, prods, pds, vds, bloqs, estq, peds, fats, crs, nfes, docas, concil] =
        await Promise.all([
          fetchFornecedor({ data: code }),
          fetchProdutos({ data: code }),
          fetchPerdas({ data: code }),
          fetchVendas({ data: code }),
          fetchProdutosBloqueios({ data: code }),
          fetchEstoque({ data: code }),
          fetchPedidos({ data: code }),
          fetchFaturas({ data: code }),
          fetchContasReceber({ data: code }),
          fetchNfePendentes({ data: code }),
          fetchDocas(),
          fetchConciliacaoNfePedido({ data: code }),
        ]);

      if (forn) {
        globalDbCache.fornecedor = {
          codigo: forn.codigo,
          nome: forn.nome,
          cnpj: forn.cnpj,
          cnpjSenhaInicial: forn.cnpjSenhaInicial,
          destinatario: forn.destinatario,
          modeloEntrega: forn.modeloEntrega as any,
          agendaRecebimentoCdam: forn.agendaRecebimentoCdam,
          filialEntregaPadrao: forn.filialEntregaPadrao,
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
        globalDbCache.nfePendentes = nfes ?? [];
        globalDbCache.docas = docas ?? [];
        globalDbCache.conciliacao = concil ?? [];

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
    try {
      const dados = JSON.parse(bruto) as { 
        autenticado: boolean; 
        primeiroAcessoConcluido: boolean;
        usuarioInterno?: UsuarioInternoDB | null;
      };
      setAutenticado(dados.autenticado);
      setPrimeiroAcessoConcluido(dados.primeiroAcessoConcluido);
      setMfaAtivo(dados.primeiroAcessoConcluido);
      if (dados.usuarioInterno) {
        setUsuarioInterno(dados.usuarioInterno);
      }
      if (dados.autenticado) {
        const code = getActiveSupplierCode();
        setCodigoFornecedorAtivo(code);
        carregarDadosReaisFornecedor(code);
      }
    } catch {
      window.sessionStorage.removeItem(CHAVE_SESSAO);
    }
    setCarregandoSessao(false);
  }, [carregarDadosReaisFornecedor]);

  useEffect(() => {
    if (typeof window === "undefined" || carregandoSessao) return;
    window.sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({ autenticado, primeiroAcessoConcluido, usuarioInterno }),
    );
  }, [autenticado, primeiroAcessoConcluido, usuarioInterno, carregandoSessao]);

  const entrar = useCallback(
    (codigoFornecedor?: string, userInterno?: UsuarioInternoDB) => {
      if (userInterno) {
        setUsuarioInterno(userInterno);
      } else if (codigoFornecedor) {
        setUsuarioInterno(null);
        setActiveSupplierCode(codigoFornecedor);
        setCodigoFornecedorAtivo(codigoFornecedor);
        carregarDadosReaisFornecedor(codigoFornecedor);
      }
      setAutenticado(true);
    },
    [carregarDadosReaisFornecedor],
  );
  const sair = useCallback(() => {
    setAutenticado(false);
    setUsuarioInterno(null);
    void encerrarSessaoPortal();
  }, []);

  const mudarFornecedorAtivo = useCallback(
    (code: string) => {
      setActiveSupplierCode(code);
      setCodigoFornecedorAtivo(code);
      carregarDadosReaisFornecedor(code);
    },
    [carregarDadosReaisFornecedor],
  );

  const concluirPrimeiroAcesso = useCallback(() => {
    setPrimeiroAcessoConcluido(true);
    setMfaAtivo(true);
  }, []);

  const adicionarAgendamento = useCallback((dados: Omit<Agendamento, "id" | "status">) => {
    setAgendamentos((atual) => [
      ...atual,
      { ...dados, id: `AG-${2300 + atual.length}`, status: "Confirmado" },
    ]);
  }, []);

  const registrarAntecipacao = useCallback(
    (dados: Omit<Antecipacao, "codigoAuditoria" | "criadoEm">) => {
      const registro: Antecipacao = {
        ...dados,
        codigoAuditoria: `ANT-${Date.now().toString(36).toUpperCase()}`,
        criadoEm: new Date().toISOString(),
      };
      setAntecipacoes((atual) => [registro, ...atual]);
      return registro;
    },
    [],
  );

  const value = useMemo<PortalState>(
    () => ({
      carregandoSessao,
      autenticado,
      usuarioInterno,
      primeiroAcessoConcluido,
      mfaAtivo,
      codigoFornecedorAtivo,
      dadosFornecedorVersao,
      agendamentos,
      antecipacoes,
      entrar,
      sair,
      mudarFornecedorAtivo,
      concluirPrimeiroAcesso,
      adicionarAgendamento,
      registrarAntecipacao,
      fornecedor,
    }),
    [
      carregandoSessao,
      autenticado,
      usuarioInterno,
      primeiroAcessoConcluido,
      mfaAtivo,
      codigoFornecedorAtivo,
      dadosFornecedorVersao,
      agendamentos,
      antecipacoes,
      entrar,
      sair,
      mudarFornecedorAtivo,
      concluirPrimeiroAcesso,
      adicionarAgendamento,
      registrarAntecipacao,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal deve ser usado dentro de PortalProvider");
  return ctx;
}
