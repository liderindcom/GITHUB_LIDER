import { useState, useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { LiderLogo } from "@/components/lider-logo";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { usePortal } from "@/context/portal-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { fetchFornecedoresList } from "@/api";

const formatarCodigoFornecedorComDigito = (codigo: string): string => {
  const num = codigo.replace("FORN-", "");
  if (!/^\d+$/.test(num) || num.length < 2) return num;
  const base = num.slice(0, -1);
  const digito = num.slice(-1);
  return `${base}-${digito}`;
};

export function PortalLayout({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  const { fornecedor, mfaAtivo, usuarioInterno, mudarFornecedorAtivo, dadosFornecedorVersao } = usePortal();
  const [fornecedoresList, setFornecedoresList] = useState<any[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (usuarioInterno) {
      fetchFornecedoresList().then((data) => {
        setFornecedoresList(data || []);
      });
    }
  }, [usuarioInterno]);

  const listFiltrada = useMemo(() => {
    return fornecedoresList.filter((f) => {
      const q = busca.toLowerCase();
      return (
        f.codigo.toLowerCase().includes(q) ||
        f.nome.toLowerCase().includes(q) ||
        (f.cnpj && f.cnpj.includes(q))
      );
    });
  }, [fornecedoresList, busca]);

  return (
    <SidebarProvider style={{ "--sidebar-width": "13.5rem" } as CSSProperties}>
      <div className="relative flex min-h-screen w-full bg-background">
        <div className="grid-noise pointer-events-none fixed inset-0 opacity-60" />
        <div className="pointer-events-none fixed -left-32 top-[-12rem] size-[30rem] rounded-full bg-primary/15 blur-[150px]" />
        <AppSidebar />
        <SidebarInset className="relative min-w-0 bg-transparent">
          <header className="sticky top-0 z-10 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6">
              <div className="flex shrink-0 items-center gap-2">
                <SidebarTrigger className="shrink-0" />
                <LiderLogo
                  variant="full"
                  className="hidden h-6 max-w-[8.5rem] sm:inline-flex lg:hidden"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
                  Portal do Fornecedor
                </p>
                <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{titulo}</h1>
                <p className="truncate text-xs text-muted-foreground">{descricao}</p>
              </div>
              <div className="flex items-center gap-2">
                <LiderLogo variant="mark" className="size-7 sm:hidden" />
                
                {usuarioInterno ? (
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 rounded-full border border-border bg-card/90 hover:bg-muted/70 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer max-w-[280px]">
                        <ShieldCheck className="size-3.5 text-primary" />
                        <span className="font-semibold text-primary font-mono">{formatarCodigoFornecedorComDigito(fornecedor.codigo)}</span>
                        <span className="truncate text-muted-foreground">· {fornecedor.nome}</span>
                        <span className="text-[10px] text-primary/70 font-bold ml-1">▼</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-2 bg-card border border-border rounded-xl shadow-panel z-50">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Selecionar Fornecedor</p>
                        <Input
                          placeholder="Buscar por código ou nome..."
                          className="h-8 text-xs pl-2 bg-background"
                          value={busca}
                          onChange={(e) => setBusca(e.target.value)}
                        />
                        <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-1">
                          {listFiltrada.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum fornecedor encontrado.</p>
                          ) : (
                            listFiltrada.map((f) => (
                              <button
                                key={f.codigo}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                  f.codigo === fornecedor.codigo
                                    ? "bg-primary text-primary-foreground font-semibold"
                                    : "hover:bg-muted text-foreground"
                                }`}
                                onClick={() => {
                                  mudarFornecedorAtivo(f.codigo);
                                  setPopoverOpen(false);
                                  setBusca("");
                                  toast.success(`Navegando como ${f.nome}`);
                                }}
                              >
                                <span className="font-mono text-[11px] font-semibold">{formatarCodigoFornecedorComDigito(f.codigo)}</span>
                                <span className="truncate max-w-[180px] text-muted-foreground">{f.nome}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="hidden items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs md:flex">
                    {mfaAtivo && <ShieldCheck className="size-3.5 text-success" />}
                    <span className="font-semibold font-mono">{formatarCodigoFornecedorComDigito(fornecedor.codigo)}</span>
                    <span className="text-muted-foreground">· {fornecedor.nome}</span>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="rise-in flex-1 p-4 sm:p-6" key={dadosFornecedorVersao}>{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
