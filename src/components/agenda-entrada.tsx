import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/context/portal-context";
import { dataBR } from "@/lib/format";
import { globalDbCache, nomeLoja, pedidos, produtoPorSku } from "@/lib/mock-data";
import { formatarNumeroPedido } from "@/lib/pedido-numero";
import {
  DIAS_PREVISAO_CHEGADA,
  fluxoEntregaDeSistematica,
  fluxoPredominante,
  previsaoChegadaIso,
} from "@/lib/previsao-chegada";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const isoDate = (raw?: string | null) => {
  const m = String(raw ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
};

const hojeIso = () => new Date().toISOString().slice(0, 10);

type EventoAgenda = {
  id: string;
  tipo: "nfe" | "pedido";
  titulo: string;
  destino: string;
  hora: string;
};

export function AgendaEntradaCalendario() {
  const { dadosFornecedorVersao } = usePortal();
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [diaSelecionado, setDiaSelecionado] = useState(hojeIso());

  const eventosPorDia = useMemo(() => {
    void dadosFornecedorVersao;
    const mapa = new Map<string, EventoAgenda[]>();
    const push = (iso: string, evento: EventoAgenda) => {
      if (!iso) return;
      const lista = mapa.get(iso) ?? [];
      lista.push(evento);
      mapa.set(iso, lista);
    };

    for (const n of globalDbCache.nfePendentes ?? []) {
      const iso = isoDate(n.agendaPrevisao);
      const hora = String(n.agendaPrevisao ?? "").split(" ")[1] ?? "";
      push(iso, {
        id: `nfe-${n.id}`,
        tipo: "nfe",
        titulo: `NF-e ${n.numeroNota}`,
        destino: n.lojaId ? nomeLoja(n.lojaId) : "CDAM",
        hora: hora.slice(0, 5),
      });
    }

    for (const p of pedidos) {
      if (!["Aberto", "Pendente", "Faturado"].includes(p.status) || p.entradaCdam) continue;
      const fluxo = fluxoPredominante(
        p.itens.map((item) => fluxoEntregaDeSistematica(produtoPorSku(item.sku).sistematica)),
      );
      const iso =
        isoDate(p.entregaPrevista) || previsaoChegadaIso(isoDate(p.emissao), fluxo);
      push(iso, {
        id: `ped-${p.numero}-${p.lojaId}`,
        tipo: "pedido",
        titulo: `Pedido ${formatarNumeroPedido(p.numero)}`,
        destino: nomeLoja(p.lojaId),
        hora: isoDate(p.entregaPrevista) ? "" : `até ${DIAS_PREVISAO_CHEGADA[fluxo]}d`,
      });
    }

    return mapa;
  }, [dadosFornecedorVersao]);

  const grade = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const deslocamento = (primeiro.getDay() + 6) % 7;
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const celulas: Array<{ iso: string; dia: number; noMes: boolean }> = [];
    for (let i = 0; i < deslocamento; i++) {
      celulas.push({ iso: "", dia: 0, noMes: false });
    }
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      celulas.push({ iso, dia, noMes: true });
    }
    while (celulas.length % 7 !== 0) {
      celulas.push({ iso: "", dia: 0, noMes: false });
    }
    return celulas;
  }, [ano, mes]);

  const eventosDoDia = eventosPorDia.get(diaSelecionado) ?? [];
  const diasComAgenda = [...eventosPorDia.keys()].filter((iso) =>
    iso.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`),
  ).length;

  const irMes = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
      <Card className="shadow-panel">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" /> {MESES[mes]} {ano}
            </CardTitle>
            <CardDescription>
              {diasComAgenda} dia{diasComAgenda === 1 ? "" : "s"} com agendamento neste mês
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="size-8" onClick={() => irMes(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                const n = new Date();
                setAno(n.getFullYear());
                setMes(n.getMonth());
                setDiaSelecionado(hojeIso());
              }}
            >
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => irMes(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grade.map((celula, idx) => {
              if (!celula.noMes) {
                return <div key={`vazio-${idx}`} className="min-h-16 rounded-lg bg-muted/20" />;
              }
              const eventos = eventosPorDia.get(celula.iso) ?? [];
              const selecionado = celula.iso === diaSelecionado;
              const hoje = celula.iso === hojeIso();
              return (
                <button
                  key={celula.iso}
                  type="button"
                  onClick={() => setDiaSelecionado(celula.iso)}
                  className={`min-h-16 rounded-lg border p-1.5 text-left transition-colors ${
                    selecionado
                      ? "border-primary bg-primary/10"
                      : eventos.length
                        ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                        : "border-transparent bg-muted/20 hover:bg-muted/40"
                  } ${hoje && !selecionado ? "ring-1 ring-primary/40" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-sm font-semibold ${hoje ? "text-primary" : ""}`}>
                      {celula.dia}
                    </span>
                    {eventos.length > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {eventos.length}
                      </span>
                    ) : null}
                  </div>
                  {eventos.length > 0 ? (
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {eventos[0]?.titulo}
                      {eventos.length > 1 ? ` +${eventos.length - 1}` : ""}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle className="text-base">{dataBR(diaSelecionado)}</CardTitle>
          <CardDescription>
            {eventosDoDia.length === 0
              ? "Sem agendamento neste dia"
              : `${eventosDoDia.length} documento${eventosDoDia.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[28rem] space-y-2 overflow-y-auto">
          {eventosDoDia.map((evento) => (
            <div
              key={evento.id}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge
                  className={
                    evento.tipo === "nfe"
                      ? "border-0 bg-primary/10 text-primary"
                      : "border-0 bg-muted text-foreground"
                  }
                >
                  {evento.tipo === "nfe" ? "NF-e" : "Pedido"}
                </Badge>
                {evento.hora ? (
                  <span className="font-mono text-[11px] text-muted-foreground">{evento.hora}</span>
                ) : null}
              </div>
              <p className="mt-1 font-medium">{evento.titulo}</p>
              <p className="text-xs text-muted-foreground">{evento.destino}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
