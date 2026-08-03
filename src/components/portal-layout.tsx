import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { usePortal } from "@/context/portal-context";
import { Separator } from "@/components/ui/separator";
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
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-brand-deep text-brand-foreground">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger className="text-brand-foreground hover:bg-white/10" />
              <Separator orientation="vertical" className="h-6 bg-white/20" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold sm:text-lg">{titulo}</h1>
                <p className="truncate text-xs text-brand-foreground/70">{descricao}</p>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs sm:flex">
                {mfaAtivo && <ShieldCheck className="size-3.5 text-success-soft" />}
                <span className="font-medium">{fornecedor.nome}</span>
                <span className="text-brand-foreground/60">· {fornecedor.codigo}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
