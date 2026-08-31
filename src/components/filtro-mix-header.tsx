import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/context/portal-context";
import {
  FILTRO_TODOS,
  FILTRO_VAZIO,
  ajustarFiltroCascata,
  filtroMercadologicoAtivo,
  opcoesFiltroMercadologico,
  produtoPassaFiltro,
  type FiltroMercadologico,
} from "@/lib/filtro-mercadologico";
import { produtosTodosDoFornecedor } from "@/lib/mock-data";

const CAMPOS: { key: keyof FiltroMercadologico; label: string; opcao: keyof ReturnType<typeof opcoesFiltroMercadologico> }[] = [
  { key: "segmento", label: "Segmento", opcao: "segmentos" },
  { key: "departamento", label: "Departamento", opcao: "departamentos" },
  { key: "secao", label: "Seção", opcao: "secoes" },
  { key: "grupo", label: "Grupo", opcao: "grupos" },
  { key: "subgrupo", label: "Subgrupo", opcao: "subgrupos" },
  { key: "comprador", label: "Comprador", opcao: "compradores" },
];

export function FiltroMixHeader() {
  const { filtroMercadologico, setFiltroMercadologico, dadosFornecedorVersao } = usePortal();
  const [aberto, setAberto] = useState(false);
  const ativos = filtroMercadologicoAtivo(filtroMercadologico);

  const produtosBase = useMemo(() => {
    void dadosFornecedorVersao;
    return produtosTodosDoFornecedor();
  }, [dadosFornecedorVersao]);

  const opcoes = useMemo(
    () => opcoesFiltroMercadologico(produtosBase, filtroMercadologico),
    [produtosBase, filtroMercadologico],
  );

  const escolher = (campo: keyof FiltroMercadologico, valor: string) => {
    setFiltroMercadologico(ajustarFiltroCascata(filtroMercadologico, campo, valor, produtosBase));
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 max-w-[280px] items-center gap-1.5 rounded-lg border border-border/70 bg-card/50 px-2 text-[10px] font-semibold hover:bg-muted/40"
        >
          <Filter className="size-3 text-primary" />
          <span>{ativos ? `${ativos} filtro${ativos === 1 ? "" : "s"} do mix` : "Filtrar mix"}</span>
          <span className="text-[10px] text-primary/70">▼</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-50 w-[280px] space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ver produtos por
          </p>
          {ativos > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => setFiltroMercadologico(FILTRO_VAZIO)}
            >
              <X className="mr-1 size-3" />
              Limpar
            </Button>
          ) : null}
        </div>
        {CAMPOS.map((campo) => {
          const lista = opcoes[campo.opcao];
          const valor = filtroMercadologico[campo.key] || FILTRO_TODOS;
          return (
            <div key={campo.key} className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">{campo.label}</Label>
              <Select value={valor} onValueChange={(v) => escolher(campo.key, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={`Todos os ${campo.label.toLowerCase()}s`} />
                </SelectTrigger>
                <SelectContent className="z-[60] max-h-56 text-xs">
                  <SelectItem value={FILTRO_TODOS}>Todos</SelectItem>
                  {lista.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
        <p className="pt-1 text-[10px] text-muted-foreground">
          {produtosBase.filter((p) => produtoPassaFiltro(p, filtroMercadologico)).length} de{" "}
          {produtosBase.length} produtos neste fornecedor
        </p>
      </PopoverContent>
    </Popover>
  );
}
