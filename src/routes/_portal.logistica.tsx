import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, Clock, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePortal } from "@/context/portal-context";
import { dataBR } from "@/lib/format";
import { horariosDisponiveis, lojas, notasAguardandoAgendamento } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/logistica")({
  head: () => ({
    meta: [
      { title: "Logística e Agendamento | Portal do Fornecedor" },
      { name: "description", content: "Agende a entrega das suas NF-e nas centrais de distribuição do Grupo Líder." },
      { property: "og:title", content: "Logística e Agendamento | Portal do Fornecedor" },
      { property: "og:description", content: "Calendário de janelas de descarga e confirmação de agendamentos." },
    ],
  }),
  component: LogisticaPage,
});

function LogisticaPage() {
  const { agendamentos, adicionarAgendamento } = usePortal();

  const [nota, setNota] = useState(notasAguardandoAgendamento[0]?.chaveNfe ?? "");
  const [data, setData] = useState<Date | undefined>(new Date());
  const [horario, setHorario] = useState("");

  const pendentes = notasAguardandoAgendamento.filter(
    (n) => !agendamentos.some((a) => a.chaveNfe === n.chaveNfe),
  );
  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome ?? id;
  const diasAgendados = agendamentos.map((a) => new Date(`${a.data}T12:00:00`));

  function confirmar() {
    const selecionada = notasAguardandoAgendamento.find((n) => n.chaveNfe === nota);
    if (!selecionada || !data || !horario) {
      toast.error("Preencha nota fiscal, data e janela de horário.");
      return;
    }
    adicionarAgendamento({
      chaveNfe: selecionada.chaveNfe,
      lojaId: selecionada.lojaId,
      data: format(data, "yyyy-MM-dd"),
      horario,
    });
    toast.success("Agendamento confirmado", {
      description: `${selecionada.numeroNota} · ${format(data, "dd/MM/yyyy")} às ${horario}`,
    });
    setHorario("");
    const proxima = pendentes.find((n) => n.chaveNfe !== selecionada.chaveNfe);
    setNota(proxima?.chaveNfe ?? "");
  }

  return (
    <PortalLayout titulo="Logística" descricao="Agendamento de entrega de Notas Fiscais nas centrais de distribuição">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4 text-primary" /> Novo agendamento
            </CardTitle>
            <CardDescription>
              {pendentes.length > 0
                ? `${pendentes.length} nota(s) fiscal(is) aguardando agendamento.`
                : "Todas as notas fiscais estão agendadas."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nota fiscal</Label>
              <Select value={nota} onValueChange={setNota} disabled={pendentes.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a NF-e" />
                </SelectTrigger>
                <SelectContent>
                  {pendentes.map((n) => (
                    <SelectItem key={n.chaveNfe} value={n.chaveNfe}>
                      {n.numeroNota} · {nomeLoja(n.lojaId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da entrega</Label>
              <div className="rounded-lg border border-border p-2">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={setData}
                  locale={ptBR}
                  disabled={{ before: new Date() }}
                  modifiers={{ agendado: diasAgendados }}
                  modifiersClassNames={{ agendado: "bg-success-soft text-success font-semibold rounded-md" }}
                  className={cn("pointer-events-auto")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Janela de descarga</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {horariosDisponiveis.map((h) => (
                  <Button
                    key={h}
                    variant={horario === h ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHorario(h)}
                  >
                    <Clock className="size-3.5" /> {h}
                  </Button>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={confirmar} disabled={pendentes.length === 0}>
              Confirmar agendamento
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4 text-primary" /> Agendamentos confirmados
            </CardTitle>
            <CardDescription>Janelas de descarga reservadas para a sua indústria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agendamentos
              .slice()
              .sort((a, b) => a.data.localeCompare(b.data))
              .map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{nomeLoja(a.lojaId)}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{a.chaveNfe}</p>
                    </div>
                    <Badge className="border-0 bg-success-soft text-success">{a.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <CalendarCheck className="size-4 text-muted-foreground" /> {dataBR(a.data)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4 text-muted-foreground" /> {a.horario}
                    </span>
                  </div>
                </div>
              ))}
            {agendamentos.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum agendamento confirmado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
