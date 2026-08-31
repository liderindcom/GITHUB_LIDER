import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
  extractor?: (item: T) => any;
}

export function useTableSort<T>(
  items: T[],
  initialConfig: SortConfig<T> | null = null
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialConfig);

  const sortedItems = useMemo(() => {
    if (!sortConfig || !sortConfig.direction) {
      return items;
    }

    const sorted = [...items];
    const { key, direction, extractor } = sortConfig;

    sorted.sort((a, b) => {
      let aVal = extractor ? extractor(a) : (a as any)[key];
      let bVal = extractor ? extractor(b) : (b as any)[key];

      // Handle null/undefined values
      if (aVal === undefined || aVal === null) aVal = "";
      if (bVal === undefined || bVal === null) bVal = "";

      // If they are numbers
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      // If they are booleans
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return direction === "asc"
          ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
          : (bVal ? 1 : 0) - (aVal ? 1 : 0);
      }

      // Convert everything else to string for comparison
      const aStr = String(aVal).toLowerCase().trim();
      const bStr = String(bVal).toLowerCase().trim();

      // Handle numeric strings (e.g., "123")
      const aNum = Number(aStr);
      const bNum = Number(bStr);
      if (!isNaN(aNum) && !isNaN(bNum) && aStr !== "" && bStr !== "") {
        return direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Locale-aware string comparison for Portuguese (accents, uppercase, etc.)
      return direction === "asc"
        ? aStr.localeCompare(bStr, "pt-BR")
        : bStr.localeCompare(aStr, "pt-BR");
    });

    return sorted;
  }, [items, sortConfig]);

  const requestSort = (key: keyof T | string, customExtractor?: (item: T) => any) => {
    let direction: SortDirection = "asc";
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc";
      } else if (sortConfig.direction === "desc") {
        direction = null; // reset sorting
      }
    }
    setSortConfig(
      direction
        ? {
            key,
            direction,
            ...(customExtractor ? { extractor: customExtractor } : {}),
          }
        : null
    );
  };

  return { items: sortedItems, sortConfig, requestSort };
}
