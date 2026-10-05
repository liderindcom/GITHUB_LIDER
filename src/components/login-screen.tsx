import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Truck, User } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { LiderLogo } from "@/components/lider-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortal } from "@/context/portal-context";
import { soDigitos } from "@/lib/fornecedor-codigo";
import {
  loginUsuarioFornecedor,
  loginUsuarioInterno,
  primeiroAcessoFornecedor,
} from "@/api";

const destaques = [
  { icone: Truck, titulo: "Agendamento de NF-e", texto: "Janelas de descarga em tempo real" },
  { icone: ShieldCheck, titulo: "Acesso com MFA", texto: "Senha forte + segundo fator" },
  { icone: KeyRound, titulo: "Antecipação", texto: "Simulador de taxas pro-rata dia" },
];

export function LoginScreen() {
  const navigate = useNavigate();
  const { entrar } = usePortal();

  const [mounted, setMounted] = useState(false);
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function acessar() {
    setErro(null);

    try {
      const email = emailUsuario.trim().toLowerCase();

      if (!email) {
        const userInterno = await loginUsuarioInterno({
          data: { username: codigo.trim(), senha },
        }).catch((err) => {
          console.error("login interno", err);
          return undefined;
        });
        if (userInterno) {
          entrar(undefined, userInterno);
          toast.success("Acesso administrativo liberado", {
            description: `Bem-vindo, ${userInterno.nome}.`,
          });
          navigate({ to: "/admin-fornecedores" });
          return;
        }
        setErro("Informe o e-mail do usuário. É o login da sua conta — não deixe em branco.");
        return;
      }

      const ident = soDigitos(codigo) || codigo.trim();
      const usuario = await loginUsuarioFornecedor({
        data: { codigo: ident, email, senha },
      });
      if (usuario) {
        const precisa = Boolean(usuario.precisaTrocarSenha);
        entrar(usuario.codigo, undefined, {
          nome: usuario.nome,
          email: usuario.email,
          precisaTrocarSenha: precisa,
        });
        toast.success("Acesso liberado", { description: `Bem-vindo, ${usuario.nome}.` });
        navigate({ to: precisa ? "/corrigir-senha" : "/dashboard" });
        return;
      }

      try {
        const criado = await primeiroAcessoFornecedor({
          data: { codigo: ident, email, senha },
        });
        entrar(criado.codigo, undefined, {
          nome: criado.nome,
          email: criado.email,
          precisaTrocarSenha: true,
        });
        toast.success("Primeiro acesso liberado", {
          description: `Conta criada para ${criado.email}. Corrija a senha no menu do portal.`,
        });
        navigate({ to: "/corrigir-senha" });
      } catch (primeiroErr) {
        const msg = primeiroErr instanceof Error ? primeiroErr.message : "";
        if (msg.includes("EMAIL_JA_CADASTRADO")) {
          setErro(
            "E-mail ou senha inválidos. Peça a outro usuário da empresa (menu Usuários) ou ao comercial do Grupo Líder para corrigir a senha.",
          );
          return;
        }
        throw primeiroErr;
      }
    } catch (err) {
      console.error("Erro no login:", err);
      const msg = err instanceof Error ? err.message : "";
      setErro(
        msg && !/server action|serverFn|conexão/i.test(msg)
          ? msg
          : "Não foi possível entrar. Confira código/CNPJ, e-mail e senha, ou recarregue a página.",
      );
    }
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
            Código RMS ou CNPJ, e-mail e senha. No primeiro acesso a senha é o CNPJ; o portal
            pede em seguida para corrigir a senha no menu.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="codigo"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Código RMS ou CNPJ
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="20922-8 ou CNPJ"
                  className="h-11 bg-card/60 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email-usuario"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                E-mail do usuário
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email-usuario"
                  type="email"
                  value={emailUsuario}
                  onChange={(e) => setEmailUsuario(e.target.value)}
                  placeholder="nome@empresa.com"
                  autoComplete="username"
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
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && acessar()}
                  placeholder="Senha ou CNPJ no primeiro acesso"
                  autoComplete="current-password"
                  className="h-11 bg-card/60 pl-9 pr-11"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {senha ? (
                <p className="text-[11px] text-muted-foreground">
                  {soDigitos(senha).length} número(s) · {mostrarSenha ? "visível" : "oculta"}
                </p>
              ) : null}
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

            {mounted ? (
              <p className="text-center text-xs text-muted-foreground">
                Primeiro acesso: e-mail + senha = CNPJ, depois o menu Corrigir senha. Equipe
                Líder: usuário interno no primeiro campo, e-mail em branco.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
