import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { usePortal } from "@/context/portal-context";
import { ShieldCheck } from "lucide-react";

export function PortalLayout({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  const { fornecedor, mfaAtivo } = usePortal();

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full bg-background">
        <div className="grid-noise pointer-events-none fixed inset-0 opacity-60" />
        <div className="pointer-events-none fixed -left-32 top-[-12rem] size-[30rem] rounded-full bg-primary/15 blur-[150px]" />
        <AppSidebar />
        <SidebarInset className="relative min-w-0 bg-transparent">
          <header className="sticky top-0 z-10 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6">
              <SidebarTrigger className="shrink-0" />
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
                  Portal do Fornecedor
                </p>
                <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{titulo}</h1>
                <p className="truncate text-xs text-muted-foreground">{descricao}</p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs md:flex">
                {mfaAtivo && <ShieldCheck className="size-3.5 text-success" />}
                <span className="font-semibold">{fornecedor.nome}</span>
                <span className="text-muted-foreground">· {fornecedor.codigo}</span>
              </div>
            </div>
          </header>
          <main className="rise-in flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
