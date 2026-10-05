import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortal } from "@/context/portal-context";
import { alterarMinhaSenhaFornecedor } from "@/api";

export const Route = createFileRoute("/_portal/corrigir-senha")({
  head: () => ({
    meta: [
      { title: "Corrigir senha | Portal do Fornecedor" },
      {
        name: "description",
        content: "Defina uma senha sua. A senha inicial (CNPJ) deixa de valer.",
      },
    ],
  }),
  component: CorrigirSenhaPage,
});

function CorrigirSenhaPage() {
  const navigate = useNavigate();
  const { usuarioFornecedor, marcarSenhaCorrigida } = usePortal();
  const obrigatorio = Boolean(usuarioFornecedor?.precisaTrocarSenha);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (novaSenha.length < 8) {
      setErro("A nova senha precisa ter no mínimo 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro("A confirmação da nova senha não confere.");
      return;
    }
    if (!obrigatorio && !senhaAtual) {
      setErro("Informe a senha atual.");
      return;
    }
    setSalvando(true);
    try {
      await alterarMinhaSenhaFornecedor({
        data: {
          novaSenha,
          ...(obrigatorio ? {} : { senhaAtual }),
        },
      });
      marcarSenhaCorrigida();
      toast.success("Senha corrigida", {
        description: "Use esta senha no próximo acesso, com o mesmo e-mail.",
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      setErro(
        msg && !/server action|serverFn|conexão/i.test(msg)
          ? msg
          : "Não foi possível gravar a senha. Tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PortalLayout
      titulo="Corrigir senha"
      descricao={
        obrigatorio
          ? "A senha inicial é o CNPJ. Defina uma senha sua para continuar no portal."
          : "Altere a senha desta conta. O e-mail de login permanece o mesmo."
      }
    >
      <Card className="max-w-lg shadow-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" />
            {obrigatorio ? "Troca obrigatória" : "Nova senha"}
          </CardTitle>
          <CardDescription>
            {usuarioFornecedor?.email
              ? `Conta ${usuarioFornecedor.email}.`
              : "A senha vale só para o e-mail com o qual você entrou."}{" "}
            Não use o CNPJ como senha definitiva.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!obrigatorio ? (
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type={mostrar ? "text" : "password"}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={mostrar ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="pr-11"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirma-senha">Confirmar nova senha</Label>
            <Input
              id="confirma-senha"
              type={mostrar ? "text" : "password"}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {erro ? (
            <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
              {erro}
            </p>
          ) : null}
          <Button
            className="h-11 w-full rounded-xl font-semibold shadow-ember"
            onClick={() => void salvar()}
            disabled={salvando}
          >
            {salvando ? "Gravando…" : "Gravar nova senha"}
          </Button>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
