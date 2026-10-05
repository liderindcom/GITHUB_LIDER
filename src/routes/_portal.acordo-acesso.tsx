import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { PortalLayout } from "@/components/portal-layout";
import { Card, CardContent } from "@/components/ui/card";
import { usePortal } from "@/context/portal-context";
import { DESCONTO_ACESSO_PORTAL_PCT, fetchCompraMesAnterior, type CompraMesAnteriorDB } from "@/api";
import { brl, numero } from "@/lib/format";
import { rotuloMesAno } from "@/lib/pedidos-janela";

export const Route = createFileRoute("/_portal/acordo-acesso")({
  head: () => ({
    meta: [
      { title: "Taxa de acesso 1% | Portal do Fornecedor" },
      {
        name: "description",
        content: "Valor de 1% sobre as compras do mês anterior para manter o acesso ao portal.",
      },
    ],
  }),
  component: AcordoAcessoFornecedorPage,
});

function AcordoAcessoFornecedorPage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [compra, setCompra] = useState<CompraMesAnteriorDB | null>(null);

  useEffect(() => {
    let ativo = true;
    fetchCompraMesAnterior({ data: fornecedor.codigo })
      .then((dados) => {
        if (ativo) setCompra(dados);
      })
      .catch(() => {
        if (ativo) setCompra(null);
      });
    return () => {
      ativo = false;
    };
  }, [fornecedor.codigo, dadosFornecedorVersao]);

  const isento = fornecedor.isentoCobranca === 1;

  return (
    <PortalLayout
      titulo="Taxa de acesso ao portal"
      descricao={
        isento
          ? "Sua empresa possui acesso cortesia/isento de cobrança comercial."
          : `O acesso custa ${DESCONTO_ACESSO_PORTAL_PCT}% sobre as compras faturadas do mês anterior.`
      }
    >
      {isento ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-panel">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-emerald-600">Acesso Gratuito Ativo</h3>
            <p className="mt-2 max-w-md text-xs text-muted-foreground">
              Sua conta foi classificada pelo Grupo Líder como isenta de cobrança para a taxa comercial de {DESCONTO_ACESSO_PORTAL_PCT}%. Você tem acesso irrestrito a todos os recursos do portal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-panel">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mês de referência
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {compra ? rotuloMesAno(compra.mes) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {compra ? `${numero(compra.documentos)} pedido(s) faturado(s)` : "Carregando…"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Compra do Grupo Líder
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {compra ? brl(compra.compra) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Valor faturado no pedido</p>
          </CardContent>
        </Card>
        <Card className="shadow-panel border-primary/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Seu acesso · {DESCONTO_ACESSO_PORTAL_PCT}%
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">
              {compra ? brl(compra.umPct) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Valor do acordo comercial do mês</p>
          </CardContent>
        </Card>
        </div>
      )}
    </PortalLayout>
  );
}
