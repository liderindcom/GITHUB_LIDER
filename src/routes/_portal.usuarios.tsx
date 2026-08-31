import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortal } from "@/context/portal-context";
import {
  excluirUsuarioFornecedor,
  fetchUsuariosFornecedor,
  salvarUsuarioFornecedor,
  type UsuarioFornecedorDB,
} from "@/api";
import { USUARIOS_FORNECEDOR_MAX } from "@/lib/usuarios-fornecedor";

export const Route = createFileRoute("/_portal/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários | Portal do Fornecedor" },
      {
        name: "description",
        content: "Cadastre até 5 usuários da sua empresa para acessar o portal.",
      },
    ],
  }),
  component: UsuariosFornecedorPage,
});

type Vaga = {
  id?: string;
  nome: string;
  email: string;
  senha: string;
};

const vagaVazia = (): Vaga => ({ nome: "", email: "", senha: "" });

function UsuariosFornecedorPage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [usuarios, setUsuarios] = useState<UsuarioFornecedorDB[]>([]);
  const [vagas, setVagas] = useState<Vaga[]>(
    Array.from({ length: USUARIOS_FORNECEDOR_MAX }, vagaVazia),
  );
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<number | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const lista = await fetchUsuariosFornecedor({ data: fornecedor.codigo });
      setUsuarios(lista);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [fornecedor.codigo, dadosFornecedorVersao]);

  useEffect(() => {
    setVagas(
      Array.from({ length: USUARIOS_FORNECEDOR_MAX }, (_, i) => {
        const u = usuarios[i];
        if (!u) return vagaVazia();
        return { id: u.id, nome: u.nome, email: u.email, senha: "" };
      }),
    );
  }, [usuarios]);

  const ocupadas = usuarios.length;

  const atualizarVaga = (indice: number, campo: keyof Vaga, valor: string) => {
    setVagas((prev) =>
      prev.map((vaga, i) => (i === indice ? { ...vaga, [campo]: valor } : vaga)),
    );
  };

  const handleSalvar = async (indice: number) => {
    const vaga = vagas[indice];
    if (!vaga) return;
    if (!vaga.nome.trim() || !vaga.email.trim() || (!vaga.id && !vaga.senha.trim())) {
      toast.error("Preencha nome, e-mail e senha inicial.");
      return;
    }
    setSalvando(indice);
    try {
      await salvarUsuarioFornecedor({
        data: {
          fornecedorCodigo: fornecedor.codigo,
          ...(vaga.id ? { id: vaga.id } : {}),
          nome: vaga.nome,
          email: vaga.email,
          ...(vaga.senha.trim() ? { senha: vaga.senha.trim() } : {}),
        },
      });
      toast.success(vaga.id ? "Usuário atualizado." : "Usuário cadastrado.");
      await carregar();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o usuário.");
    } finally {
      setSalvando(null);
    }
  };

  const handleExcluir = async (indice: number) => {
    const vaga = vagas[indice];
    if (!vaga?.id) return;
    if (!confirm(`Remover o acesso de ${vaga.nome || vaga.email}?`)) return;
    setSalvando(indice);
    try {
      await excluirUsuarioFornecedor({
        data: { fornecedorCodigo: fornecedor.codigo, id: vaga.id },
      });
      toast.success("Usuário removido.");
      await carregar();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível remover o usuário.");
    } finally {
      setSalvando(null);
    }
  };

  const resumo = useMemo(
    () => `${ocupadas} de ${USUARIOS_FORNECEDOR_MAX} vagas preenchidas`,
    [ocupadas],
  );

  return (
    <PortalLayout
      titulo="Usuários da empresa"
      descricao={`Até ${USUARIOS_FORNECEDOR_MAX} pessoas da sua empresa. Elas consultam o portal; a única alteração permitida é preencher a tabela de preço.`}
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          O fornecedor não altera pedido, estoque, logística nem financeiro. A tabela de preço
          vira proposta e só entra no sistema depois que o Grupo Líder aprovar. Se alguém
          esqueceu a senha, grave uma nova senha na vaga dessa pessoa — não há recuperação na
          tela de login.
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{resumo}</p>
          <Badge variant="outline" className="font-mono text-[11px]">
            {ocupadas}/{USUARIOS_FORNECEDOR_MAX}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {vagas.map((vaga, indice) => {
            const preenchida = Boolean(vaga.id);
            return (
              <Card key={vaga.id ?? `vaga-${indice}`} className="shadow-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      {preenchida ? (
                        <Users className="size-4 text-primary" />
                      ) : (
                        <UserPlus className="size-4 text-muted-foreground" />
                      )}
                      Vaga {indice + 1}
                    </span>
                    <Badge variant={preenchida ? "default" : "outline"} className="text-[10px]">
                      {preenchida ? "Ativo" : "Livre"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {preenchida
                      ? "Altere o cadastro ou defina uma nova senha."
                      : "Preencha nome, e-mail e senha inicial."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={vaga.nome}
                      onChange={(e) => atualizarVaga(indice, "nome", e.target.value)}
                      placeholder="Nome completo"
                      disabled={carregando}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail (login)</Label>
                    <Input
                      type="email"
                      value={vaga.email}
                      onChange={(e) => atualizarVaga(indice, "email", e.target.value)}
                      placeholder="nome@empresa.com"
                      disabled={carregando}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{preenchida ? "Nova senha (opcional)" : "Senha inicial"}</Label>
                    <Input
                      type="password"
                      value={vaga.senha}
                      onChange={(e) => atualizarVaga(indice, "senha", e.target.value)}
                      placeholder={preenchida ? "Deixe em branco para manter" : "Mínimo 8 caracteres"}
                      disabled={carregando}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={carregando || salvando === indice}
                      onClick={() => void handleSalvar(indice)}
                    >
                      {preenchida ? "Salvar" : "Cadastrar"}
                    </Button>
                    {preenchida ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={carregando || salvando === indice}
                        onClick={() => void handleExcluir(indice)}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
