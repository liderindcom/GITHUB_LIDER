import { cn } from "@/lib/utils";

type LiderLogoVariant = "full" | "mark" | "hero";

const sources: Record<LiderLogoVariant, { src: string; width: number; height: number }> = {
  /** Wordmark GRUPOLÍDER — header, sidebar expandida, login compacto */
  full: { src: "/brand/logo-header.png", width: 160, height: 28 },
  /** Monograma L — sidebar colapsada e favicon visual */
  mark: { src: "/brand/logo-mark.png", width: 32, height: 32 },
  /** Wordmark grande — tela de login / splash */
  hero: { src: "/brand/logo-grupolider.png", width: 280, height: 72 },
};

export function LiderLogo({
  variant = "full",
  className,
  imgClassName,
  priority = false,
}: {
  variant?: LiderLogoVariant;
  className?: string;
  imgClassName?: string;
  /** Preferência de carregamento (login / above-the-fold) */
  priority?: boolean;
}) {
  const asset = sources[variant];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        variant === "mark" &&
          "size-8 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-border/60",
        variant === "full" && "h-7 max-w-[10.5rem]",
        variant === "hero" && "h-16 max-w-[18rem] sm:h-20 sm:max-w-[22rem]",
        className,
      )}
    >
      <img
        src={asset.src}
        alt="Grupo Líder"
        width={asset.width}
        height={asset.height}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        className={cn(
          "h-full w-auto max-w-full object-contain object-left",
          variant === "mark" && "size-full object-cover p-1",
          imgClassName,
        )}
      />
    </span>
  );
}
