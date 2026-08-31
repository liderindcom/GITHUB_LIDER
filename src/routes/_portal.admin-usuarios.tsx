import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  UserPlus, 
  Users, 
  UserCheck 
} from "lucide-react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import { fetchUsuariosInternos, createUsuarioInterno, deleteUsuarioInterno, type UsuarioInternoDB } from "@/api";

export const Route = createFileRoute("/_portal/admin-usuarios")({
  head: () => ({
    meta: [
      { title: "Gerenciamento de Usuários Internos | Portal do Fornecedor" },
      {
        name: "description",
        content: "Painel para cadastro e controle de usuários internos autorizados a liberar dados de fornecedores.",
      },
    ],
  }),
  component: AdminUsuariosPage,
});

function AdminUsuariosPage() {
  const { usuarioInterno } = usePortal();

  // Route protection
  if (!usuarioInterno || usuarioInterno.role !== "admin") {
    return (
      <PortalLayout titulo="Acesso Restrito" descricao="Esta área é de uso exclusivo dos administradores do Grupo Líder.">
        <div className="flex flex-col items-center justify-center p-8 bg-card rounded-lg border border-border shadow-panel">
          <ShieldAlert className="size-12 text-destructive mb-3" />
          <h2 className="text-lg font-bold">Acesso Negado</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-[340px] text-center">
            Você não possui as permissões necessárias para acessar este painel. Caso seja um administrador, faça o login correspondente.
          </p>
        </div>
      </PortalLayout>
    );
  }

  const [usuarios, setUsuarios] = useState<UsuarioInternoDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // Form states
  const [novoUsername, setNovoUsername] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovoSenha] = useState("");
  const [novoRole, setNovoRole] = useState("admin");

  const carregarUsuarios = async () => {
    setCarregando(true);
    try {
      const data = await fetchUsuariosInternos();
      setUsuarios(data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar lista de usuários internos.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoUsername.trim() || !novoNome.trim() || !novaSenha.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      await createUsuarioInterno({
        data: {
          username: novoUsername.trim().toLowerCase(),
          nome: novoNome.trim(),
          senha: novaSenha.trim(),
          role: novoRole,
        }
      });
      toast.success("Usuário " + novoUsername + " cadastrado com sucesso!");
      // Reset form
      setNovoUsername("");
      setNovoNome("");
      setNovoSenha("");
      setNovoRole("admin");
      // Reload list
      carregarUsuarios();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg && !/server action|serverFn/i.test(msg)
          ? msg
          : "Não foi possível cadastrar. Recarregue a página (Ctrl+Shift+R) e tente de novo.",
      );
    }
  };

  const handleDeleteUser = async (usernameToDelete: string) => {
    if (usernameToDelete === usuarioInterno.username) {
      toast.error("Você não pode excluir o seu próprio usuário enquanto está logado!");
      return;
    }
    if (usernameToDelete === "lider" && usuarios.length === 1) {
      toast.error("O usuário de bootstrap principal não pode ser removido.");
      return;
    }

    if (!confirm("Tem certeza que deseja excluir o usuário administrativo " + usernameToDelete + "?")) {
      return;
    }

    try {
      await deleteUsuarioInterno({
        data: usernameToDelete
      });
      toast.success("Usuário " + usernameToDelete + " removido com sucesso.");
      carregarUsuarios();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir o usuário interno.");
    }
  };

  return (
    <PortalLayout
      titulo="Usuários Administrativos"
      descricao="Gerencie a equipe interna autorizada a liberar e bloquear acessos de fornecedores."
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Cadastro de Novo Usuário */}
          <Card className="shadow-panel md:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserPlus className="size-4 text-primary" /> Cadastrar Usuário
              </CardTitle>
              <CardDescription className="text-xs">
                Adicione um novo colaborador comercial ou administrador ao portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="username" className="text-xs font-semibold">Username (login)</Label>
                  <Input
                    id="username"
                    placeholder="Ex: joao.silva"
                    className="h-9 text-xs"
                    value={novoUsername}
                    onChange={(e) => setNovoUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="nome" className="text-xs font-semibold">Nome Completo</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: João da Silva"
                    className="h-9 text-xs"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="senha" className="text-xs font-semibold">Senha Inicial</Label>
                  <Input
                    id="senha"
                    type="password"
                    placeholder="Senha forte"
                    className="h-9 text-xs"
                    value={novaSenha}
                    onChange={(e) => setNovoSenha(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nível de Permissão (Role)</Label>
                  <Select value={novoRole} onValueChange={setNovoRole}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin" className="text-xs">Administrador (Total)</SelectItem>
                      <SelectItem value="colaborador" className="text-xs">Colaborador (Leitura/Escrita)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" size="sm" className="w-full h-9 text-xs font-semibold flex items-center justify-center gap-1.5 mt-2">
                  <Plus className="size-3.5" /> Cadastrar Colaborador
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de Usuários Internos */}
          <Card className="shadow-panel md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-primary" /> Equipe Cadastrada
              </CardTitle>
              <CardDescription className="text-xs">
                Lista de funcionários autorizados a gerenciar permissões de fornecedores.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead>Username</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-center">Role</TableHead>
                      <TableHead className="w-[100px] text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carregando ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          Carregando equipe...
                        </TableCell>
                      </TableRow>
                    ) : usuarios.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          Nenhum usuário interno cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      usuarios.map((user) => (
                        <TableRow key={user.username} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold">{user.username}</TableCell>
                          <TableCell className="font-medium text-xs">{user.nome}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={"text-[10px] px-1.5 h-5 " + (
                              user.role === "admin" 
                                ? "text-success bg-success-soft border-success/30 font-bold" 
                                : "text-primary bg-primary/10 border-primary/30"
                            )}>
                              {user.role === "admin" ? "Administrador" : "Colaborador"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 p-0"
                              onClick={() => handleDeleteUser(user.username)}
                              disabled={user.username === usuarioInterno.username}
                              title="Remover Colaborador"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </PortalLayout>
  );
}
