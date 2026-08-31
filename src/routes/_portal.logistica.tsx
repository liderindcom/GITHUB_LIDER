import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, CalendarDays, ExternalLink, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { fetchItensNfe } from "@/api";

import { AgendaEntradaCalendario } from "@/components/agenda-entrada";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/context/portal-context";
import { brl, dataBR, numero } from "@/lib/format";
import {
  globalDbCache,
  lojaPorCodigo,
  nomeLoja,
  pedidos,
  produtoPorSku,
  quantidadesPedido,
  totalPedido,
  type Pedido,
} from "@/lib/mock-data";
import { formatarNumeroPedido } from "@/lib/pedido-numero";
import {
  DIAS_PREVISAO_CHEGADA,
  fluxoEntregaDeSistematica,
  fluxoPredominante,
  previsaoChegadaIso,
  rotuloFluxoEntrega,
  type FluxoEntrega,
} from "@/lib/previsao-chegada";

const JANELA_DIAS = 60;

/** Consulta completa no Portal Nacional da NF-e (SEFA/SEFAZ). A chave não vai na URL; o site exige captcha. */
const URL_CONSULTA_NFE_SEFA =
  "https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8pl8=";

function chaveNfeSoDigitos(chave?: string | null) {
  return String(chave ?? "").replace(/\D/g, "");
}

function abrirConsultaSefa(chave?: string | null) {
  const digits = chaveNfeSoDigitos(chave);
  if (digits.length !== 44) return false;
  void navigator.clipboard?.writeText(digits).catch(() => undefined);
  window.open(URL_CONSULTA_NFE_SEFA, "_blank", "noopener,noreferrer");
  toast.success("Chave copiada", {
    description: "Cole no site da SEFA e confirme o captcha para ver os itens da nota.",
  });
  return true;
}

const isoDate = (raw?: string | null) => {
  const m = String(raw ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
};

const corteJanelaIso = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (JANELA_DIAS - 1));
  return d.toISOString().slice(0, 10);
};

const dentroDaJanela = (raw?: string | null) => {
  const iso = isoDate(raw);
  if (!iso) return true;
  return iso >= corteJanelaIso();
};

type AbaLogistica = "fila" | "agenda";

export const Route = createFileRoute("/_portal/logistica")({
  validateSearch: (search: Record<string, unknown>): { aba?: AbaLogistica } => {
    const aba = search["aba"];
    if (aba === "agenda" || aba === "fila") return { aba };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Logística | Portal do Fornecedor" },
      {
        name: "description",
        content: "Fila de entrada física e calendário de agendamentos do Grupo Líder.",
      },
    ],
  }),
  component: LogisticaPage,
});

type TipoFila = "todos" | "nfe" | "pedido";

type LinhaLogistica = {
  id: string;
  tipo: "nfe" | "pedido";
  documento: string;
  detalhe: string;
  destino: string;
  fluxo: FluxoEntrega;
  dataIso: string;
  dataLabel: string;
  situacao: string;
  nfeId?: string;
  chaveNfe?: string;
  pedidoNumero?: string;
  pedidoLojaId?: string;
};

type ItemNfeDetalhe = {
  id: string;
  sku: string;
  descricao: string;
  quantidade: number;
  preco: number;
  pedido: string;
};

type NfePendenteFila = NonNullable<(typeof globalDbCache)["nfePendentes"]>[number];

type SelecionadoFila =
  | { tipo: "nfe"; nfe: NfePendenteFila }
  | { tipo: "pedido"; pedido: Pedido };

function skuExibicao(sku: string) {
  const produto = produtoPorSku(sku);
  if (produto.codigoProdutoRms && produto.digitoProdutoRms) {
    return `${produto.codigoProdutoRms}-${produto.digitoProdutoRms}`;
  }
  return sku || "—";
}

function itensDaNfe(chaveNfe: string, numeroNota: string): ItemNfeDetalhe[] {
  const chave = String(chaveNfe ?? "").trim();
  const nota = String(numeroNota ?? "").trim();
  return (globalDbCache.conciliacao ?? [])
    .filter((item) => {
      const itemChave = String(item.chaveNfe ?? "").trim();
      if (chave && itemChave) return itemChave === chave;
      return nota && String(item.numeroNota ?? "").trim() === nota;
    })
    .map((item) => {
      const sku = String(item.sku ?? "").trim();
      const descricaoXml = String(item.descricaoXml ?? "").trim();
      return {
        id: item.id,
        sku,
        descricao: descricaoXml || (sku ? produtoPorSku(sku).descricao : "—"),
        quantidade: Number(item.quantidadeXml ?? 0),
        preco: Number(item.precoXml ?? 0),
        pedido: String(item.pedido ?? "").trim(),
      };
    });
}

function fluxoDoPedido(itens: { sku: string }[]): FluxoEntrega {
  return fluxoPredominante(
    itens.map((item) => fluxoEntregaDeSistematica(produtoPorSku(item.sku).sistematica)),
  );
}

function fluxoDaNfe(destTipo?: string | null): FluxoEntrega {
  return String(destTipo ?? "").toUpperCase().startsWith("L") ? "direto_loja" : "estocado";
}

function formatarAgendamento(raw?: string | null) {
  const texto = String(raw ?? "").trim();
  if (!texto) return "";
  const [data, hora] = texto.split(" ");
  const iso = isoDate(data);
  if (!iso) return texto;
  return hora ? `${dataBR(iso)} ${hora.slice(0, 5)}` : dataBR(iso);
}

function destinoFila(lojaId?: string | null, destTipo?: string | null) {
  const tipo = String(destTipo ?? "").toUpperCase().trim();
  const loja =
    lojaId ? lojaPorCodigo(lojaId) ?? lojaPorCodigo(lojaId, "local") : undefined;
  const cdam = loja?.tipo === "D" || tipo.startsWith("D") || (!lojaId && !tipo.startsWith("L"));
  if (cdam) {
    return { label: lojaId ? nomeLoja(lojaId) : "CDAM", cdam: true };
  }
  if (lojaId) return { label: nomeLoja(lojaId), cdam: false };
  if (tipo.startsWith("L")) return { label: "Loja", cdam: false };
  return { label: "—", cdam: false };
}

function descricaoEventoSefaz(raw?: string | null) {
  return /^\d{3}\b/.test(String(raw ?? "").trim());
}

function rotuloSituacaoNfe(n: {
  situacaoDescricao?: string | null;
  status?: string | null;
  agendaPrevisao?: string | null;
}, cdam: boolean) {
  if (cdam) return formatarAgendamento(n.agendaPrevisao) || "Sem agendamento";
  const desc = String(n.situacaoDescricao ?? "").trim();
  if (desc && !descricaoEventoSefaz(desc)) return desc;
  return n.status || "Pendente";
}

function LogisticaPage() {
  const { dadosFornecedorVersao } = usePortal();
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const abaAtual: AbaLogistica = aba === "agenda" ? "agenda" : "fila";
  const [tipo, setTipo] = useState<TipoFila>("todos");
  const [selecionado, setSelecionado] = useState<SelecionadoFila | null>(null);

  const nfes = useMemo(
    () => (globalDbCache.nfePendentes ?? []).filter((n) => dentroDaJanela(n.agendaPrevisao)),
    [dadosFornecedorVersao],
  );
  const pedidosAbertos = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          ["Aberto", "Pendente", "Faturado"].includes(p.status) &&
          !p.entradaCdam &&
          dentroDaJanela(p.entregaPrevista || p.emissao),
      ),
    [dadosFornecedorVersao],
  );

  const fila = useMemo<LinhaLogistica[]>(() => {
    const montar = (
      base: Omit<LinhaLogistica, "dataIso" | "dataLabel"> & { baseIso: string },
    ): LinhaLogistica => {
      const dias = DIAS_PREVISAO_CHEGADA[base.fluxo];
      const iso = previsaoChegadaIso(base.baseIso, base.fluxo);
      const { baseIso: _baseIso, ...rest } = base;
      return {
        ...rest,
        dataIso: iso,
        dataLabel: iso ? `${dataBR(iso)} · até ${dias}d` : `até ${dias}d`,
      };
    };
    const linhasNfe = nfes.map((n) => {
      const agenda = n.agendaPrevisao;
      const dest = destinoFila(n.lojaId, n.destTipo);
      return montar({
        id: `nfe-${n.id}`,
        tipo: "nfe",
        documento: n.numeroNota || "—",
        detalhe: n.chaveNfe || "",
        destino: dest.label,
        fluxo: dest.cdam ? "estocado" : fluxoDaNfe(n.destTipo),
        situacao: rotuloSituacaoNfe(n, dest.cdam),
        nfeId: n.id,
        chaveNfe: n.chaveNfe,
        baseIso: isoDate(agenda) || new Date().toISOString().slice(0, 10),
      });
    });
    const linhasPedido = pedidosAbertos.map((p) => {
      const dest = destinoFila(p.lojaId);
      return montar({
        id: `ped-${p.numero}-${p.lojaId}`,
        tipo: "pedido",
        documento: formatarNumeroPedido(p.numero),
        detalhe: p.emissao ? `Emissão ${dataBR(p.emissao)}` : "",
        destino: dest.label,
        fluxo: dest.cdam ? "estocado" : fluxoDoPedido(p.itens),
        situacao: dest.cdam
          ? formatarAgendamento(p.entregaPrevista || p.emissao) || "Sem agendamento"
          : p.status,
        pedidoNumero: p.numero,
        pedidoLojaId: p.lojaId,
        baseIso: isoDate(p.emissao) || isoDate(p.entregaPrevista),
      });
    });
    return [...linhasNfe, ...linhasPedido].sort((a, b) => b.dataIso.localeCompare(a.dataIso));
  }, [nfes, pedidosAbertos]);

  const visiveis = tipo === "todos" ? fila : fila.filter((l) => l.tipo === tipo);

  function abrirLinha(linha: LinhaLogistica) {
    if (linha.tipo === "nfe") {
      const nfe = nfes.find((n) => n.id === linha.nfeId);
      if (!nfe) return;
      setSelecionado({ tipo: "nfe", nfe });
      return;
    }
    const pedido = pedidosAbertos.find(
      (p) => p.numero === linha.pedidoNumero && p.lojaId === linha.pedidoLojaId,
    );
    if (!pedido) return;
    setSelecionado({ tipo: "pedido", pedido });
  }

  return (
    <PortalLayout
      titulo="Logística"
      descricao={`Fila de entrada física e calendário de agendamentos. Previsão de chegada: diretíssimo até 2 dias, direto loja até 5 dias, estocado até 15 dias.`}
    >
      <Tabs
        value={abaAtual}
        onValueChange={(value) => {
          navigate({
            search: value === "agenda" ? { aba: "agenda" } : {},
            replace: true,
          });
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-[360px] grid-cols-2">
          <TabsTrigger value="fila" className="gap-1.5">
            <Truck className="size-3.5" /> Fila de entrada
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5">
            <CalendarDays className="size-3.5" /> Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Resumo titulo="Na fila" valor={String(fila.length)} detalhe={`NF-e + pedidos · ${JANELA_DIAS} dias`} />
          <Resumo titulo="NF-e sem entrada" valor={String(nfes.length)} detalhe="XML sem recebimento" />
          <Resumo
            titulo="Pedidos sem entrada"
            valor={String(pedidosAbertos.length)}
            detalhe="Aberto, pendente ou faturado"
          />
        </div>

        <Card className="shadow-panel">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="size-4 text-primary" /> Entrada física pendente
                </CardTitle>
                <CardDescription>
                  Clique na linha para ver os itens da nota ou do pedido.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["todos", "Todos"],
                    ["nfe", "NF-e"],
                    ["pedido", "Pedidos"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <Button
                    key={valor}
                    size="sm"
                    variant={tipo === valor ? "default" : "outline"}
                    onClick={() => setTipo(valor)}
                  >
                    {rotulo}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table
              containerClassName="max-h-[500px] rounded-lg border border-border"
              className="border-separate border-spacing-0"
            >
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                <TableRow className="bg-stone-100">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Fluxo</TableHead>
                  <TableHead>Previsão de chegada</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((linha) => (
                  <TableRow
                    key={linha.id}
                    onClick={() => abrirLinha(linha)}
                    className="cursor-pointer transition-colors hover:bg-accent/60"
                  >
                    <TableCell>
                      <Badge
                        className={
                          linha.tipo === "nfe"
                            ? "border-0 bg-primary/10 text-primary"
                            : "border-0 bg-muted text-foreground"
                        }
                      >
                        {linha.tipo === "nfe" ? "NF-e" : "Pedido"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{linha.documento}</div>
                      {linha.detalhe ? (
                        <div className="max-w-[280px] truncate text-[10px] text-muted-foreground" title={linha.detalhe}>
                          {linha.detalhe}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{linha.destino}</TableCell>
                    <TableCell className="text-xs">{rotuloFluxoEntrega[linha.fluxo]}</TableCell>
                    <TableCell className="text-xs font-mono">{linha.dataLabel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {linha.situacao}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {visiveis.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nada pendente de entrada nos últimos {JANELA_DIAS} dias.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <AgendaEntradaCalendario />
        </TabsContent>
      </Tabs>

      <Sheet open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selecionado?.tipo === "nfe" ? (
            <DetalheNfeFila nfe={selecionado.nfe} />
          ) : selecionado?.tipo === "pedido" ? (
            <DetalhePedidoFila pedido={selecionado.pedido} />
          ) : null}
        </SheetContent>
      </Sheet>
    </PortalLayout>
  );
}

function DetalheNfeFila({ nfe }: { nfe: NfePendenteFila }) {
  const dest = destinoFila(nfe.lojaId, nfe.destTipo);
  const [itens, setItens] = useState<ItemNfeDetalhe[] | null>(null);

  useEffect(() => {
    let ativo = true;
    const locais = itensDaNfe(nfe.chaveNfe, nfe.numeroNota);
    if (locais.length) {
      setItens(locais);
      return () => {
        ativo = false;
      };
    }
    setItens(null);
    fetchItensNfe({ data: { chaveNfe: nfe.chaveNfe, numeroNota: nfe.numeroNota } })
      .then((rows) => {
        if (!ativo) return;
        setItens(
          rows.map((row) => ({
            id: row.id,
            sku: row.sku,
            descricao: row.descricao || (row.sku ? produtoPorSku(row.sku).descricao : "—"),
            quantidade: row.quantidade,
            preco: row.preco,
            pedido: row.pedido,
          })),
        );
      })
      .catch(() => {
        if (ativo) setItens([]);
      });
    return () => {
      ativo = false;
    };
  }, [nfe.chaveNfe, nfe.numeroNota]);

  const lista = itens ?? [];
  const total = lista.reduce((acc, item) => acc + item.quantidade * item.preco, 0);

  return (
    <>
      <SheetHeader>
        <SheetTitle>NF-e {nfe.numeroNota || "—"}</SheetTitle>
        <SheetDescription>
          {dest.label} · {nfe.status || "Pendente"}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6">
        {nfe.chaveNfe ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-all font-mono text-[11px] text-muted-foreground">{nfe.chaveNfe}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              onClick={() => abrirConsultaSefa(nfe.chaveNfe)}
            >
              <ExternalLink className="size-3" /> SEFA
            </Button>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Pedido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens === null ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando itens da nota…
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{skuExibicao(item.sku)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs" title={item.descricao}>
                      {item.descricao}
                    </TableCell>
                    <TableCell className="text-right">{numero(item.quantidade)}</TableCell>
                    <TableCell className="text-right">{brl(item.preco)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {brl(item.quantidade * item.preco)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.pedido ? formatarNumeroPedido(item.pedido) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {itens !== null && lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Itens desta nota ainda não estão no cache do portal.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {lista.length > 0 ? (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total da nota</span>
            <span className="text-base font-semibold">{brl(total)}</span>
          </div>
        ) : null}
      </div>
    </>
  );
}

function DetalhePedidoFila({ pedido }: { pedido: Pedido }) {
  const totais = quantidadesPedido(pedido);

  return (
    <>
      <SheetHeader>
        <SheetTitle>Pedido {formatarNumeroPedido(pedido.numero)}</SheetTitle>
        <SheetDescription>
          {nomeLoja(pedido.lojaId)} · emissão {dataBR(pedido.emissao)} · {pedido.status}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 text-center text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Pedida</p>
            <p className="font-display text-lg font-bold">{numero(totais.pedida)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Faturada</p>
            <p className="font-display text-lg font-bold">{numero(totais.faturada)}</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Pedida</TableHead>
                <TableHead className="text-right">Faturada</TableHead>
                <TableHead className="text-right">Preço un.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedido.itens.map((item) => (
                <TableRow key={item.sku}>
                  <TableCell className="font-mono text-xs">{skuExibicao(item.sku)}</TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {produtoPorSku(item.sku).descricao}
                  </TableCell>
                  <TableCell className="text-right">{numero(item.quantidadePedida)}</TableCell>
                  <TableCell className="text-right">{numero(item.quantidadeFaturada)}</TableCell>
                  <TableCell className="text-right">{brl(item.precoUnitario)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {brl(item.quantidadePedida * item.precoUnitario)}
                  </TableCell>
                </TableRow>
              ))}
              {pedido.itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Este pedido não tem itens no cache.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Total do pedido</span>
          <span className="text-base font-semibold">{brl(totalPedido(pedido))}</span>
        </div>
      </div>
    </>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="font-display text-2xl font-bold">{valor}</p>
          <p className="text-[0.65rem] text-muted-foreground">{detalhe}</p>
        </div>
        <CalendarCheck className="size-5 text-primary" />
      </CardContent>
    </Card>
  );
}
