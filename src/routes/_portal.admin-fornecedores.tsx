import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Search, Check, X, ShieldAlert, ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { searchFornecedores, updateSupplierAccess } from "@/api";

export const Route = createFileRoute("/_portal/admin-fornecedores")({
  head: () => ({
    meta: [
      { title: "Controle de Acesso - Admin | Portal do Fornecedor" },
      {
        name: "description",
        content: "Painel de administração para liberação e controle de acesso dos fornecedores do Grupo Líder.",
      },
    ],
  }),
  component: AdminFornecedoresPage,
});

function AdminFornecedoresPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [isPending, startTransition] = useTransition();

  const limit = 15;

  const carregarFornecedores = async (searchTerm: string, pageNum: number) => {
    setCarregando(true);
    try {
      const data = await searchFornecedores({
        data: {
          search: searchTerm,
          limit,
          offset: pageNum * limit,
        }
      });
      setFornecedores(data.rows);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar lista de fornecedores.");
    } finally {
      setCarregando(false);
    }
  };

  // Carregar dados iniciais e quando muda busca ou página
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarFornecedores(search, page);
    }, 300); // Debounce de busca de 300ms
    return () => clearTimeout(timer);
  }, [search, page]);

  // Resetar página ao buscar
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const handleToggleAccess = async (codigo: string, statusAtual: number) => {
    const novoStatus = statusAtual === 1 ? 0 : 1;
    
    // Otimista: atualiza o estado local primeiro
    setFornecedores((prev) =>
      prev.map((f) => (f.codigo === codigo ? { ...f, acessoLiberado: novoStatus } : f))
    );

    try {
      await updateSupplierAccess({
        data: { codigo, acessoLiberado: novoStatus }
      });
      toast.success(
        novoStatus === 1
          ? `Acesso LIBERADO para o fornecedor ${codigo}.`
          : `Acesso BLOQUEADO para o fornecedor ${codigo}.`
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status de acesso. Revertendo...");
      // Reverter estado local em caso de falha
      setFornecedores((prev) =>
        prev.map((f) => (f.codigo === codigo ? { ...f, acessoLiberado: statusAtual } : f))
      );
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PortalLayout
      titulo="Controle de Acesso"
      descricao="Gerencie quais fornecedores importados do RMS têm acesso ativo ao portal de sell-out."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Controle de Acesso</h1>
            <p className="text-xs text-muted-foreground">
              Gerencie quais fornecedores importados do RMS têm acesso ativo ao portal de sell-out.
            </p>
          </div>
        </div>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="size-5 text-primary" />
              <span>Fornecedores Cadastrados ({total})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barra de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Pesquise por código (Ex: 13003), Razão Social ou CNPJ..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tabela de Fornecedores */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código RMS</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="w-[180px]">CNPJ</TableHead>
                    <TableHead className="w-[150px] text-center">Acesso</TableHead>
                    <TableHead className="w-[150px] text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando && fornecedores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                        Carregando fornecedores...
                      </TableCell>
                    </TableRow>
                  ) : fornecedores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                        Nenhum fornecedor encontrado para a busca "{search}".
                      </TableCell>
                    </TableRow>
                  ) : (
                    fornecedores.map((f) => {
                      const ativo = f.acessoLiberado === 1;
                      return (
                        <TableRow key={f.codigo}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {f.codigo.replace("FORN-", "")}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-xs font-medium">
                            {f.nome}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {f.cnpj}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                                ativo
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-red-500/10 text-red-500"
                              }`}
                            >
                              {ativo ? (
                                <>
                                  <Check className="size-3" /> Ativo
                                </>
                              ) : (
                                <>
                                  <X className="size-3" /> Inativo
                                </>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={ativo ? "destructive" : "default"}
                              size="sm"
                              className="text-[0.7rem] font-bold"
                              onClick={() => handleToggleAccess(f.codigo, f.acessoLiberado || 0)}
                            >
                              {ativo ? "Bloquear" : "Liberar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong> (Exibindo {fornecedores.length} de {total} itens)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0 || carregando}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 text-xs"
                  >
                    <ArrowLeft className="mr-1 size-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1 || carregando}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 text-xs"
                  >
                    Próxima <ArrowRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
