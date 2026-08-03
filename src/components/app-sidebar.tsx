import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  Flame,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  ShoppingCart,
  Wallet,
} from "lucide-react";


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
  { title: "Logística", url: "/logistica", icon: CalendarClock },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { fornecedor, sair } = usePortal();

  return (
    <Sidebar variant="floating" collapsible="icon" className="border-none">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-ember">
            <Flame className="size-4" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold leading-tight">Grupo Líder</p>
              <p className="truncate text-[0.7rem] text-sidebar-foreground/60">Portal do Fornecedor</p>
            </div>
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
              {itens.map((item) => (
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
            <p className="truncate text-xs font-medium">{fornecedor.nome}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{fornecedor.codigo}</p>
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
