import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  BadgeDollarSign,
  BadgePercent,
  FileSpreadsheet,
  KeyRound,
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
  ClipboardCheck,
  Scale,
  TrendingUp,
  Coins,
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
  { title: "Acordo Fill Rate", url: "/acordo-fillrate", icon: ClipboardCheck },
  { title: "Vendas Sell-out", url: "/vendas", icon: LineChart },
  { title: "Vendas Anual", url: "/vendas-anual", icon: TrendingUp },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Meus Itens", url: "/itens", icon: PackageCheck },
  { title: "Ruptura e Perda Venda", url: "/ruptura-venda", icon: AlertTriangle },
  { title: "Perdas Físicas", url: "/perdas", icon: TrendingDown },
  { title: "Relatório MIX", url: "/relatorio-mix", icon: FileSpreadsheet },
  { title: "Preço Concorrência", url: "/precos", icon: BadgeDollarSign },
  { title: "Tabela de Preço (Sistema)", url: "/preco-sistema", icon: Coins },
  { title: "Share de Vendas", url: "/representatividade", icon: Percent },
  { title: "Sugestão Compra", url: "/sugestao-compra", icon: PackagePlus },
  { title: "Ofertas e Rebaixas", url: "/ofertas-rebaixas", icon: Tags },
  { title: "Classificação", url: "/classificacao", icon: Tags },
  { title: "Logística", url: "/logistica", icon: CalendarClock },
  { title: "Conciliação NF-e", url: "/conciliacao", icon: Scale },
  { title: "Contas a Receber", url: "/contas-receber", icon: ReceiptText },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Corrigir senha", url: "/corrigir-senha", icon: KeyRound },
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Taxa de acesso 1%", url: "/acordo-acesso", icon: BadgePercent },
  { title: "Aprovação de Preços", url: "/admin-precos", icon: ShieldCheck },
  { title: "Acesso Fornecedores (Admin)", url: "/admin-fornecedores", icon: Tags },
  { title: "Acordo de acesso", url: "/admin-acordo-acesso", icon: BadgePercent },
  { title: "Usuários Administrativos", url: "/admin-usuarios", icon: Users },
] as const;

import { useState, useEffect, useMemo } from "react";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { fornecedor, sair, usuarioInterno, usuarioFornecedor } = usePortal();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const displayNome = mounted ? fornecedor.nome : "Nestlé Brasil S/A";
  const displayCodigo = mounted ? fornecedor.codigo : "704894";

  const itensVisiveis = useMemo(() => {
    const precisaTrocar = Boolean(usuarioFornecedor?.precisaTrocarSenha) && !usuarioInterno;
    return itens.filter((item) => {
      if (precisaTrocar) {
        return item.url === "/corrigir-senha";
      }
      if (
        item.url === "/admin-fornecedores" ||
        item.url === "/admin-precos" ||
        item.url === "/admin-acordo-acesso"
      ) {
        return usuarioInterno !== null;
      }
      if (item.url === "/admin-usuarios") {
        return usuarioInterno !== null && usuarioInterno.role === "admin";
      }
      if (item.url === "/usuarios" || item.url === "/acordo-acesso" || item.url === "/corrigir-senha") {
        return usuarioInterno === null;
      }
      return true;
    });
  }, [usuarioInterno, usuarioFornecedor?.precisaTrocarSenha]);

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
                <p className="truncate text-[10px] text-sidebar-foreground/60 uppercase">
                  {usuarioInterno.role === "admin" ? "Administrador" : "Colaborador"}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-xs font-medium">{displayNome}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">{displayCodigo}</p>
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
