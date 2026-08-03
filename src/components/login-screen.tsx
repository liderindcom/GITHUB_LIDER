import { useNavigate } from "@tanstack/react-router";
import { KeyRound, Lock, QrCode, ShieldCheck, Truck, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortal } from "@/context/portal-context";
import { fornecedor } from "@/lib/mock-data";

const senhaForte = (senha: string) => senha.length >= 8 && /[^A-Za-z0-9]/.test(senha) && /[A-Za-z]/.test(senha);

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

  function acessar() {
    setErro(null);
    if (codigo.trim().toUpperCase() !== fornecedor.codigo) {
      setErro("Código do fornecedor não encontrado.");
      return;
    }
    if (!primeiroAcessoConcluido && senha === fornecedor.cnpjSenhaInicial) {
      setOnboardingAberto(true);
      return;
    }
    if (senha.length < 8) {
      setErro("Senha inválida. Use a senha cadastrada no primeiro acesso.");
      return;
    }
    entrar();
    toast.success("Acesso liberado", { description: `Bem-vindo, ${fornecedor.nome}.` });
    navigate({ to: "/dashboard" });
  }

  function concluirOnboarding() {
    setErroOnboarding(null);
    if (!senhaForte(novaSenha)) {
      setErroOnboarding("A nova senha precisa de no mínimo 8 caracteres, com letras e 1 caractere especial.");
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
    concluirPrimeiroAcesso();
    entrar();
    setOnboardingAberto(false);
    toast.success("Primeiro acesso concluído", { description: "MFA ativado com sucesso." });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-brand-deep p-12 text-brand-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            GL
          </span>
          <div>
            <p className="text-sm font-semibold">Portal do Fornecedor</p>
            <p className="text-xs text-brand-foreground/70">Grupo Líder · Varejo Alimentício</p>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">
            Pedidos, sell-out, estoque e financeiro do Grupo Líder em um só lugar.
          </h2>
          <ul className="space-y-4 text-sm text-brand-foreground/80">
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 size-4 shrink-0" />
              Agende a entrega das suas notas fiscais nas centrais de distribuição.
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Acesso protegido por senha forte e autenticação de dois fatores.
            </li>
            <li className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4 shrink-0" />
              Antecipe recebíveis simulando taxas em tempo real.
            </li>
          </ul>
        </div>

        <p className="text-xs text-brand-foreground/50">© Grupo Líder — Ambiente de demonstração</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md shadow-panel">
          <CardHeader>
            <CardTitle className="text-xl">Acesse sua conta</CardTitle>
            <CardDescription>
              Primeiro acesso? Use o CNPJ da empresa (somente números) como senha inicial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código do Fornecedor</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="FORN-0000"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && acessar()}
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
            </div>

            {erro && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
            )}

            <Button className="w-full" onClick={acessar}>
              Entrar no portal
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Demonstração: código <span className="font-medium">{fornecedor.codigo}</span> e senha{" "}
              <span className="font-medium">{fornecedor.cnpjSenhaInicial}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={onboardingAberto} onOpenChange={() => undefined}>
        <DialogContent className="max-w-lg [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Primeiro acesso obrigatório</DialogTitle>
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

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-4">
                <div className="flex size-24 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <QrCode className="size-16 text-brand-deep" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Onboarding de MFA</p>
                  <p className="text-muted-foreground">
                    Escaneie o QR Code no seu app autenticador e informe o código de 6 dígitos enviado
                    para o e-mail cadastrado do fornecedor.
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
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erroOnboarding}</p>
            )}

            <Button className="w-full" onClick={concluirOnboarding}>
              Concluir cadastro e ativar MFA
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
