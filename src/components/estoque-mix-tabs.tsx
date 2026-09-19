import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Store } from "lucide-react";

const abas = [
  { titulo: "Visão de Estoque", rota: "/estoque", icone: BarChart3 },
  { titulo: "Mix por Loja", rota: "/relatorio-mix", icone: Store },
] as const;

export function EstoqueMixTabs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav aria-label="Estoque e Mix" className="mb-5 overflow-x-auto">
      <div
        role="tablist"
        className="inline-flex min-w-full rounded-xl border border-border/70 bg-card/60 p-1 shadow-sm sm:min-w-0"
      >
        {abas.map((aba) => {
          const ativa = pathname === aba.rota;
          const Icone = aba.icone;
          return (
            <Link
              key={aba.rota}
              to={aba.rota}
              role="tab"
              aria-selected={ativa}
              className={
                ativa
                  ? "flex min-w-[10.5rem] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm"
                  : "flex min-w-[10.5rem] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              }
            >
              <Icone className="size-4" />
              {aba.titulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
