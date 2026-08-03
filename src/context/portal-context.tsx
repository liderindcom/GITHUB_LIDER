import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import {
  agendamentos as agendamentosMock,
  fornecedor,
  type Agendamento,
} from "@/lib/mock-data";

export type Antecipacao = {
  codigoAuditoria: string;
  criadoEm: string;
  faturaIds: string[];
  valorBruto: number;
  desconto: number;
  valorLiquido: number;
};

type PortalState = {
  autenticado: boolean;
  primeiroAcessoConcluido: boolean;
  mfaAtivo: boolean;
  agendamentos: Agendamento[];
  antecipacoes: Antecipacao[];
  entrar: () => void;
  sair: () => void;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bruto = window.sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return;
    try {
      const dados = JSON.parse(bruto) as { autenticado: boolean; primeiroAcessoConcluido: boolean };
      setAutenticado(dados.autenticado);
      setPrimeiroAcessoConcluido(dados.primeiroAcessoConcluido);
      setMfaAtivo(dados.primeiroAcessoConcluido);
    } catch {
      window.sessionStorage.removeItem(CHAVE_SESSAO);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({ autenticado, primeiroAcessoConcluido }),
    );
  }, [autenticado, primeiroAcessoConcluido]);

  const entrar = useCallback(() => setAutenticado(true), []);
  const sair = useCallback(() => setAutenticado(false), []);

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
      autenticado,
      primeiroAcessoConcluido,
      mfaAtivo,
      agendamentos,
      antecipacoes,
      entrar,
      sair,
      concluirPrimeiroAcesso,
      adicionarAgendamento,
      registrarAntecipacao,
      fornecedor,
    }),
    [
      autenticado,
      primeiroAcessoConcluido,
      mfaAtivo,
      agendamentos,
      antecipacoes,
      entrar,
      sair,
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
