import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Input } from "@/components/ui/input";

export function TableColumnHeader({
  title,
  value,
  onChange,
  onSort,
  direction,
  placeholder,
}: {
  title: string;
  value?: string;
  onChange?: (value: string) => void;
  onSort?: () => void;
  direction?: "asc" | "desc" | null;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1">
      {onChange ? (
        <Input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? title}
          aria-label={`Buscar por ${title}`}
          className="h-7 min-w-0 px-1 text-center text-xs"
        />
      ) : (
        <span className="truncate">{title}</span>
      )}
      {onSort ? (
        <button type="button" onClick={onSort} aria-label={`Ordenar ${title}`} className="shrink-0 text-muted-foreground hover:text-foreground">
          {direction === "asc" ? <ArrowUp className="size-3.5" /> : direction === "desc" ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
        </button>
      ) : null}
    </div>
  );
}
