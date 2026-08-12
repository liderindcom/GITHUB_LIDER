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
  agendamentos as agendamentosMock,
  fornecedor,
  type Agendamento,
  setActiveSupplierCode,
  getActiveSupplierCode,
  globalDbCache,
} from "@/lib/mock-data";
import { fetchFornecedor, fetchProdutos, fetchPerdas, fetchVendas, type UsuarioInternoDB } from "@/api";
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
      const codeClean = code.replace("FORN-", "");
      if (codeClean === "4050") {
        globalDbCache.fornecedor = null;
        globalDbCache.produtos = null;
        globalDbCache.perdas = null;
        globalDbCache.vendas = null;
        globalDbCache.estoque = null;
        globalDbCache.vendasMensais = null;
        setDadosFornecedorVersao((versao) => versao + 1);
        return;
      }

      const [forn, prods, pds, vds] = await Promise.all([
        fetchFornecedor({ data: code }),
        fetchProdutos({ data: code }),
        fetchPerdas({ data: code }),
        fetchVendas({ data: code }),
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
          cadastroFinanceiro: {
            prazoPagamentoDias: forn.prazoPagamentoDias,
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

        // Gerar estoque fictício correspondente aos produtos reais da base
        globalDbCache.estoque = prods.map((p) => ({
          sku: p.sku,
          lojaId: "01",
          estoqueMinimo: 100,
          estoqueAtual: Math.round(120 + (Number(p.sku) % 250)),
        }));

        // Agrupar vendas reais por mês para alimentar o gráfico de sell-out temporal de 12 meses
        const mensalMap = new Map<string, { faturamento: number; volume: number }>();
        vds.forEach((v) => {
          const anoMes = v.data.slice(0, 7); // YYYY-MM
          const atual = mensalMap.get(anoMes) || { faturamento: 0, volume: 0 };
          atual.faturamento += v.quantidade * v.valorUnitario;
          atual.volume += v.quantidade;
          mensalMap.set(anoMes, atual);
        });

        // Gerar a série histórica dos últimos 12 meses ordenados
        const hoje = new Date();
        globalDbCache.vendasMensais = Array.from({ length: 12 }, (_, i) => {
          const dataMes = subMonths(hoje, 11 - i);
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
      if (dados.autenticado && !dados.usuarioInterno) {
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
