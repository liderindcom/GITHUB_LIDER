import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  BadgeDollarSign,
  FileSpreadsheet,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  PackagePlus,
  Percent,
  ReceiptText,
  Tags,
  ShoppingCart,
  Wallet,
  TrendingDown,
  AlertTriangle,
  PackageCheck,
  Users,
  ShieldCheck,
} from "lucide-react";

import { LiderLogo } from "@/components/lider-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePortal } from "@/context/portal-context";

const itens = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart },
  { title: "Vendas Sell-out", url: "/vendas", icon: LineChart },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Meus Itens", url: "/itens", icon: PackageCheck },
  { title: "Ruptura e Perda Venda", url: "/ruptura-venda", icon: AlertTriangle },
  { title: "Perdas Físicas", url: "/perdas", icon: TrendingDown },
  { title: "Relatório MIX", url: "/relatorio-mix", icon: FileSpreadsheet },
  { title: "Preço Concorrência", url: "/precos", icon: BadgeDollarSign },
  { title: "Representatividade", url: "/representatividade", icon: Percent },
  { title: "Sugestão Compra", url: "/sugestao-compra", icon: PackagePlus },
  { title: "Classificação", url: "/classificacao", icon: Tags },
  { title: "Logística", url: "/logistica", icon: CalendarClock },
  { title: "Contas a Receber", url: "/contas-receber", icon: ReceiptText },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Acesso Fornecedores (Admin)", url: "/admin-fornecedores", icon: Tags },
  { title: "Usuários Administrativos", url: "/admin-usuarios", icon: Users },
] as const;

import { useMemo } from "react";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { fornecedor, sair, usuarioInterno } = usePortal();

  const itensVisiveis = useMemo(() => {
    return itens.filter((item) => {
      if (item.url === "/admin-fornecedores") {
        return usuarioInterno !== null;
      }
      if (item.url === "/admin-usuarios") {
        return usuarioInterno !== null && usuarioInterno.role === "admin";
      }
      return true;
    });
  }, [usuarioInterno]);

  return (
    <Sidebar variant="floating" collapsible="icon" className="border-none">
      <SidebarHeader className="px-3 py-4">
        <div className={collapsed ? "flex justify-center" : "flex min-w-0 flex-col gap-1.5"}>
          {collapsed ? (
            <LiderLogo variant="mark" priority />
          ) : (
            <>
              <LiderLogo variant="full" priority className="h-8 max-w-[11rem]" />
              <p className="truncate pl-0.5 text-[0.7rem] font-medium text-sidebar-foreground/60">
                Portal do Fornecedor
              </p>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-[0.2em]">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {itensVisiveis.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 pb-1">
            {usuarioInterno ? (
              <>
                <p className="truncate text-xs font-bold text-primary flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> {usuarioInterno.nome}
                </p>
                <p className="truncate text-[10px] text-sidebar-foreground/60 uppercase">{usuarioInterno.role === "admin" ? "Administrador" : "Colaborador"}</p>
              </>
            ) : (
              <>
                <p className="truncate text-xs font-medium">{fornecedor.nome}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">{fornecedor.codigo}</p>
              </>
            )}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={sair} tooltip="Sair">
              <LogOut className="size-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
