import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Lock, QrCode, ShieldCheck, Truck, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LiderLogo } from "@/components/lider-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortal } from "@/context/portal-context";
import { fornecedor, normalizarCodigoFornecedor } from "@/lib/mock-data";
import { fetchFornecedor } from "@/api";

const senhaForte = (senha: string) =>
  senha.length >= 8 && /[^A-Za-z0-9]/.test(senha) && /[A-Za-z]/.test(senha);

const destaques = [
  { icone: Truck, titulo: "Agendamento de NF-e", texto: "Janelas de descarga em tempo real" },
  { icone: ShieldCheck, titulo: "Acesso com MFA", texto: "Senha forte + segundo fator" },
  { icone: KeyRound, titulo: "Antecipação", texto: "Simulador de taxas pro-rata dia" },
];

export function LoginScreen() {
  const navigate = useNavigate();
  const { entrar, concluirPrimeiroAcesso, primeiroAcessoConcluido } = usePortal();

  const [codigo, setCodigo] = useState(fornecedor.codigo);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [onboardingAberto, setOnboardingAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [codigoMfa, setCodigoMfa] = useState("");
  const [erroOnboarding, setErroOnboarding] = useState<string | null>(null);

  async function acessar() {
    setErro(null);
    const codForn = normalizarCodigoFornecedor(codigo);
    
    try {
      const fornEncontrado = await fetchFornecedor({ data: codForn });

      if (!fornEncontrado) {
        setErro("Código do fornecedor não encontrado.");
        return;
      }

      // Verificar se o acesso está liberado para este fornecedor
      if (fornEncontrado.acessoLiberado !== 1) {
        setErro("Acesso não liberado. Entre em contato com a equipe comercial do Grupo Líder.");
        return;
      }

      const senhaPadrao = fornEncontrado.cnpjSenhaInicial;

      if (!primeiroAcessoConcluido && senha === senhaPadrao) {
        setOnboardingAberto(true);
        return;
      }
      if (senha.length < 8) {
        setErro("Senha inválida. Use a senha cadastrada no primeiro acesso.");
        return;
      }
      entrar(codForn);
      toast.success("Acesso liberado", { description: `Bem-vindo, ${fornEncontrado.nome}.` });
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error("Erro no login:", err);
      setErro("Erro de conexão ao servidor. Tente novamente.");
    }
  }

  function concluirOnboarding() {
    setErroOnboarding(null);
    if (!senhaForte(novaSenha)) {
      setErroOnboarding(
        "A nova senha precisa de no mínimo 8 caracteres, com letras e 1 caractere especial.",
      );
      return;
    }
    if (novaSenha !== confirmacao) {
      setErroOnboarding("A confirmação de senha não confere.");
      return;
    }
    if (!/^\d{6}$/.test(codigoMfa)) {
      setErroOnboarding("Informe o código de verificação de 6 dígitos enviado por e-mail.");
      return;
    }
    const codForn = normalizarCodigoFornecedor(codigo);
    concluirPrimeiroAcesso();
    entrar(codForn);
    setOnboardingAberto(false);
    toast.success("Primeiro acesso concluído", { description: "MFA ativado com sucesso." });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-80" />
      <div className="speed-lines pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70" />
      <div className="pointer-events-none absolute -left-40 top-[-10rem] size-[34rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-52 right-[-8rem] size-[30rem] rounded-full bg-warning/20 blur-[150px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
        <div className="rise-in space-y-10">
          <div className="space-y-3">
            <LiderLogo
              variant="hero"
              priority
              className="h-14 max-w-[16rem] sm:h-16 sm:max-w-[20rem]"
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-tight">Portal do Fornecedor</p>
              <p className="text-xs text-muted-foreground">Grupo Líder · Varejo Alimentício</p>
            </div>
          </div>

          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ambiente do parceiro
            </span>
            <h1 className="ember-text max-w-xl text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Sua operação com o Grupo Líder, viva em um só painel.
            </h1>
            <p className="max-w-lg text-base text-muted-foreground">
              Pedidos, sell-out item a item, rupturas de estoque, agendamento logístico e
              antecipação de recebíveis — tudo em tempo real.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {destaques.map((d) => (
              <div
                key={d.titulo}
                className="glow-ember rounded-2xl border border-border bg-card/70 p-4 backdrop-blur transition-transform hover:-translate-y-1"
              >
                <d.icone className="size-5 text-primary" />
                <p className="mt-3 font-display text-sm font-semibold">{d.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">{d.texto}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rise-in glow-ember w-full rounded-3xl border border-border bg-elevated/80 p-6 shadow-panel backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <LiderLogo variant="full" priority className="h-7" />
          </div>
          <h2 className="font-display text-2xl font-bold">Acesse sua conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Primeiro acesso? Use o CNPJ da empresa (somente números) como senha inicial.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="codigo"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Código do Fornecedor
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="FORN-0000"
                  className="h-11 bg-card/60 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="senha"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Senha
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && acessar()}
                  placeholder="••••••••"
                  className="h-11 bg-card/60 pl-9"
                />
              </div>
            </div>

            {erro && (
              <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                {erro}
              </p>
            )}

            <Button
              className="group h-11 w-full rounded-xl font-semibold shadow-ember"
              onClick={acessar}
            >
              Entrar no portal
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Demonstração: código{" "}
              <span className="font-semibold text-foreground">{fornecedor.codigo}</span> e senha{" "}
              <span className="font-semibold text-foreground">{fornecedor.cnpjSenhaInicial}</span>
            </p>
          </div>
        </div>
      </div>

      <Dialog open={onboardingAberto} onOpenChange={() => undefined}>
        <DialogContent className="max-w-lg border-border bg-elevated [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="font-display">Primeiro acesso obrigatório</DialogTitle>
            <DialogDescription>
              Cadastre uma nova senha e ative a autenticação de dois fatores para continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres e 1 especial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirma-senha">Confirmar nova senha</Label>
              <Input
                id="confirma-senha"
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-start gap-4">
                <div className="grid size-24 shrink-0 place-items-center rounded-xl border border-border bg-background">
                  <QrCode className="size-16 text-primary" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-display font-semibold">Onboarding de MFA</p>
                  <p className="text-muted-foreground">
                    Escaneie o QR Code no seu app autenticador e informe o código de 6 dígitos
                    enviado para o e-mail cadastrado do fornecedor.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="mfa">Código de verificação</Label>
                <Input
                  id="mfa"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigoMfa}
                  onChange={(e) => setCodigoMfa(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="tracking-[0.4em]"
                />
              </div>
            </div>

            {erroOnboarding && (
              <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                {erroOnboarding}
              </p>
            )}

            <Button
              className="h-11 w-full rounded-xl font-semibold shadow-ember"
              onClick={concluirOnboarding}
            >
              Concluir cadastro e ativar MFA
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
