import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { useMemo, useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { globalDbCache } from "@/lib/mock-data";
import { formatarNumeroPedido } from "@/lib/pedido-numero";

const JANELA_DIAS = 90;

type AbaConciliacao = "divergencia" | "ok";

export const Route = createFileRoute("/_portal/conciliacao")({
  validateSearch: (search: Record<string, unknown>): { aba?: AbaConciliacao } => {
    const aba = search["aba"];
    if (aba === "ok" || aba === "divergencia") return { aba };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Conciliação NF-e × Pedido | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Conciliação dos últimos 90 dias: divergências de preço, quantidade, pedido e eventos SEFAZ.",
      },
    ],
  }),
  component: ConciliacaoPage,
});

type TipoProblema = "preco" | "quantidade" | "pedido" | "prazo" | "sefaz";

type Problema = {
  tipo: TipoProblema;
  label: string;
  detalhe?: string;
};

type LinhaConciliacao = {
  id: string;
  dataIso: string;
  dataLabel: string;
  numeroNota: string;
  chaveNfe: string;
  pedido: string;
  sku: string;
  descricaoXml: string;
  quantidadeXml: number;
  quantidadePedida: number;
  precoXml: number;
  precoPedido: number;
  problemas: Problema[];
};

const isoDate = (raw?: string | null) => {
  const m = String(raw ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
};

function emissaoDaChaveNfe(chave?: string | null) {
  const d = String(chave ?? "").replace(/\D/g, "");
  if (d.length < 6) return "";
  const yy = Number(d.slice(2, 4));
  const mm = Number(d.slice(4, 6));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return "";
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-01`;
}

function dataDaNota(chave?: string | null, agenda?: string | null) {
  return isoDate(agenda) || emissaoDaChaveNfe(chave);
}

function rotuloDataNota(iso: string) {
  if (/^\d{4}-\d{2}-01$/.test(iso)) {
    const [ano, mes] = iso.split("-");
    return ano && mes ? `${mes}/${ano}` : iso;
  }
  return iso ? dataBR(iso) : "—";
}

function corteJanelaIso(ref: Date) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - (JANELA_DIAS - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dentroDosUltimosDias(iso: string, corte: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  if (/^\d{4}-\d{2}-01$/.test(iso)) {
    const [ano, mes] = iso.split("-").map(Number);
    if (!ano || !mes) return false;
    const fimMes = new Date(ano, mes, 0);
    const y = fimMes.getFullYear();
    const m = String(fimMes.getMonth() + 1).padStart(2, "0");
    const d = String(fimMes.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}` >= corte;
  }
  return iso >= corte;
}

function eventoSefaz(raw?: string | null) {
  const texto = String(raw ?? "").trim();
  const m = texto.match(/^(\d{3})\b(?:\s*[-–:]\s*(.*))?$/);
  if (!m?.[1]) return null;
  return { codigo: m[1], texto: (m[2] ?? texto).trim() || texto, bruto: texto };
}

function problemasDoItem(
  item: {
    pedido: string;
    quantidadeXml: number;
    quantidadePedida: number;
    precoXml: number;
    precoPedido: number;
    divergenciaPreco: number;
    divergenciaQuantidade: number;
    itemDesacordo: number;
  },
  sefaz: ReturnType<typeof eventoSefaz>,
): Problema[] {
  const lista: Problema[] = [];
  const pedido = String(item.pedido ?? "").trim();
  const qtdXml = Number(item.quantidadeXml) || 0;
  const qtdPed = Number(item.quantidadePedida) || 0;
  const precoXml = Number(item.precoXml) || 0;
  const precoPed = Number(item.precoPedido) || 0;
  const foraDoPedido = item.itemDesacordo === 1 || !pedido || (qtdPed <= 0 && qtdXml > 0);

  if (foraDoPedido) {
    lista.push({ tipo: "pedido", label: pedido ? "Fora do pedido" : "Sem pedido" });
  }
  if (item.divergenciaQuantidade === 1 || (qtdPed > 0 && qtdXml !== qtdPed)) {
    lista.push({ tipo: "quantidade", label: "Quantidade" });
  }
  if (item.divergenciaPreco === 1 || (precoPed > 0 && precoXml > precoPed + 0.005)) {
    lista.push({ tipo: "preco", label: "Preço" });
  }
  if (sefaz) {
    lista.push({
      tipo: "sefaz",
      label: `SEFAZ ${sefaz.codigo}`,
      detalhe: sefaz.bruto,
    });
  }
  return lista;
}

function ConciliacaoPage() {
  const { dadosFornecedorVersao } = usePortal();
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const abaAtual: AbaConciliacao = aba === "ok" ? "ok" : "divergencia";

  const linhas = useMemo<LinhaConciliacao[]>(() => {
    void dadosFornecedorVersao;
    const nfes = globalDbCache.nfePendentes ?? [];
    const itens = globalDbCache.conciliacao ?? [];
    const nfePorChave = new Map(nfes.map((n) => [n.chaveNfe, n]));

    const montadas: LinhaConciliacao[] = [];
    const chavesComItem = new Set<string>();

    for (const item of itens) {
      const nfe = nfePorChave.get(item.chaveNfe);
      const dataIso = dataDaNota(item.chaveNfe, nfe?.agendaPrevisao);
      const sefaz = eventoSefaz(nfe?.situacaoDescricao);
      chavesComItem.add(item.chaveNfe);
      montadas.push({
        id: item.id,
        dataIso,
        dataLabel: rotuloDataNota(dataIso),
        numeroNota: item.numeroNota || nfe?.numeroNota || "—",
        chaveNfe: item.chaveNfe,
        pedido: item.pedido || "",
        sku: item.sku,
        descricaoXml: item.descricaoXml,
        quantidadeXml: item.quantidadeXml,
        quantidadePedida: item.quantidadePedida,
        precoXml: item.precoXml,
        precoPedido: item.precoPedido,
        problemas: problemasDoItem(item, sefaz),
      });
    }

    for (const nfe of nfes) {
      if (!nfe.chaveNfe || chavesComItem.has(nfe.chaveNfe)) continue;
      const sefaz = eventoSefaz(nfe.situacaoDescricao);
      if (!sefaz) continue;
      const dataIso = dataDaNota(nfe.chaveNfe, nfe.agendaPrevisao);
      montadas.push({
        id: `sefaz-${nfe.id}`,
        dataIso,
        dataLabel: rotuloDataNota(dataIso),
        numeroNota: nfe.numeroNota || "—",
        chaveNfe: nfe.chaveNfe,
        pedido: "",
        sku: "",
        descricaoXml: sefaz.bruto,
        quantidadeXml: 0,
        quantidadePedida: 0,
        precoXml: 0,
        precoPedido: 0,
        problemas: [
          {
            tipo: "sefaz",
            label: `SEFAZ ${sefaz.codigo}`,
            detalhe: sefaz.bruto,
          },
        ],
      });
    }

    const corte = corteJanelaIso(new Date());

    return montadas
      .filter((l) => dentroDosUltimosDias(l.dataIso, corte))
      .sort((a, b) => {
        const data = b.dataIso.localeCompare(a.dataIso);
        if (data) return data;
        const nota = b.numeroNota.localeCompare(a.numeroNota);
        if (nota) return nota;
        return b.problemas.length - a.problemas.length;
      });
  }, [dadosFornecedorVersao]);

  const comDivergencia = useMemo(
    () => linhas.filter((l) => l.problemas.length > 0),
    [linhas],
  );
  const ok = useMemo(() => linhas.filter((l) => l.problemas.length === 0), [linhas]);
  const divPreco = comDivergencia.filter((l) => l.problemas.some((p) => p.tipo === "preco")).length;
  const divQtd = comDivergencia.filter((l) => l.problemas.some((p) => p.tipo === "quantidade")).length;
  const divPedido = comDivergencia.filter((l) => l.problemas.some((p) => p.tipo === "pedido")).length;
  const divSefaz = comDivergencia.filter((l) => l.problemas.some((p) => p.tipo === "sefaz")).length;

  return (
    <PortalLayout
      titulo="Conciliação NF-e × Pedido"
      descricao={`Últimos ${JANELA_DIAS} dias. Divergência: preço (XML acima do pedido), quantidade, item fora do pedido e eventos SEFAZ. Preço XML menor que o pedido não é divergência.`}
    >
      <Tabs
        value={abaAtual}
        onValueChange={(value) => {
          navigate({
            search: value === "ok" ? { aba: "ok" } : {},
            replace: true,
          });
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-[420px] grid-cols-2">
          <TabsTrigger value="divergencia" className="gap-1.5">
            <AlertTriangle className="size-3.5" /> Com divergência
          </TabsTrigger>
          <TabsTrigger value="ok" className="gap-1.5">
            <CheckCircle2 className="size-3.5" /> OK
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Resumo
            titulo="Na janela"
            valor={numero(linhas.length)}
            detalhe={`${JANELA_DIAS} dias · XML × pedido`}
          />
          <Resumo
            titulo="Com divergência"
            valor={numero(comDivergencia.length)}
            detalhe={`${numero(divPreco)} preço · ${numero(divQtd)} qtd · ${numero(divPedido)} pedido`}
          />
          <Resumo titulo="OK" valor={numero(ok.length)} detalhe="Sem divergência na janela" />
          <Resumo
            titulo="Eventos SEFAZ"
            valor={numero(divSefaz)}
            detalhe="Rejeição ou evento na NF-e"
          />
        </div>

        <TabsContent value="divergencia">
          <TabelaConciliacao
            titulo="Divergências e eventos SEFAZ"
            descricao="Itens com preço, quantidade, pedido ou evento SEFAZ fora do esperado."
            linhas={comDivergencia}
            vazia={`Nenhuma divergência nos últimos ${JANELA_DIAS} dias.`}
          />
        </TabsContent>
        <TabsContent value="ok">
          <TabelaConciliacao
            titulo="Conciliações OK"
            descricao="Itens do XML alinhados ao pedido, sem evento SEFAZ."
            linhas={ok}
            vazia={`Nenhuma conciliação OK nos últimos ${JANELA_DIAS} dias.`}
          />
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}

function TabelaConciliacao({
  titulo,
  descricao,
  linhas,
  vazia,
}: {
  titulo: string;
  descricao: string;
  linhas: LinhaConciliacao[];
  vazia: string;
}) {
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [ordenacao, setOrdenacao] = useState<{ campo: string; asc: boolean }>({ campo: "data", asc: false });
  const linhasVisiveis = useMemo(() => {
    const valor = (linha: LinhaConciliacao, campo: string) => ({
      data: linha.dataLabel,
      nota: linha.numeroNota,
      pedido: linha.pedido,
      sku: linha.sku,
      descricao: linha.descricaoXml,
      quantidadeXml: linha.quantidadeXml,
      quantidadePedida: linha.quantidadePedida,
      precoXml: linha.precoXml,
      precoPedido: linha.precoPedido,
      divergencia: linha.problemas.map((p) => p.label).join(" "),
    }[campo] ?? "");
    const filtradas = linhas.filter((linha) => Object.entries(filtros).every(([campo, filtro]) => String(valor(linha, campo)).toLowerCase().includes(filtro.toLowerCase())));
    return [...filtradas].sort((a, b) => {
      const av = valor(a, ordenacao.campo);
      const bv = valor(b, ordenacao.campo);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" });
      return ordenacao.asc ? cmp : -cmp;
    });
  }, [linhas, filtros, ordenacao]);
  const ordenar = (campo: string) => setOrdenacao((atual) => ({ campo, asc: atual.campo === campo ? !atual.asc : true }));

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="size-4 text-primary" /> {titulo}
        </CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table
          containerClassName="max-h-[560px] rounded-lg border border-border"
          className="border-separate border-spacing-0"
        >
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
            <TableRow className="bg-stone-100">
              {([["data", "Data"], ["nota", "Nota"], ["pedido", "Pedido"], ["sku", "SKU"], ["descricao", "Descrição no XML"], ["quantidadeXml", "Qtd XML"], ["quantidadePedida", "Qtd Pedido"], ["precoXml", "Preço XML"], ["precoPedido", "Preço Pedido"], ["divergencia", "Divergência"]] as const).map(([campo, titulo]) => (
                <TableHead key={campo} className={campo.startsWith("quantidade") || campo.startsWith("preco") ? "text-right" : undefined}>
                  <div className="flex min-w-[90px] items-center gap-1">
                    <Input value={filtros[campo] ?? ""} onChange={(e) => setFiltros((atual) => ({ ...atual, [campo]: e.target.value }))} placeholder={titulo} className="h-7 w-full text-xs" />
                    <button type="button" className="text-muted-foreground" onClick={() => ordenar(campo)} aria-label={`Ordenar ${titulo}`}>↕</button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhasVisiveis.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{i.dataLabel}</TableCell>
                <TableCell className="font-mono text-xs">{i.numeroNota}</TableCell>
                <TableCell className="font-mono text-xs">{i.pedido ? formatarNumeroPedido(i.pedido) : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{i.sku || "—"}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs" title={i.descricaoXml}>
                  {i.descricaoXml || "—"}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {i.sku ? numero(i.quantidadeXml) : "—"}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {i.sku ? numero(i.quantidadePedida) : "—"}
                </TableCell>
                <TableCell className="text-right text-xs">{i.sku ? brl(i.precoXml) : "—"}</TableCell>
                <TableCell className="text-right text-xs">
                  {i.sku ? brl(i.precoPedido) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {i.problemas.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">
                        OK
                      </Badge>
                    ) : (
                      i.problemas.map((p) => (
                        <Badge
                          key={`${i.id}-${p.tipo}-${p.label}`}
                          variant={p.tipo === "sefaz" ? "secondary" : "destructive"}
                          className="text-[10px]"
                          title={p.detalhe}
                        >
                          {p.label}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  {vazia}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
        <Scale className="size-5 text-primary" />
      </CardContent>
    </Card>
  );
}
