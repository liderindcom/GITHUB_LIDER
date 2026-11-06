import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PortalLayout } from "@/components/portal-layout";
import { fetchAceiteCelulasDisponibilidade, registrarAceiteCelulasDisponibilidade } from "@/api";

export const Route = createFileRoute("/_portal/celulas-disponibilidade")({ component: CelulasDisponibilidade });

const resumo = { fornecedores: 36, lojas: 33, celulas: 1034, tratamento: 512, controle: 522, elegiveis: 0 };
const VERSAO_TERMO = "celulas-disponibilidade-v1";

function CelulasDisponibilidade() {
  const [checks, setChecks] = useState([false, false, false, false]);
  const [aceito, setAceito] = useState(false);
  const [carregandoAceite, setCarregandoAceite] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const pronto = checks.every(Boolean);
  const status = useMemo(() => aceito ? "ACEITE_PERSISTIDO" : "AGUARDA_ACEITE_LIDER", [aceito]);

  useEffect(() => {
    void fetchAceiteCelulasDisponibilidade()
      .then((registro) => {
        if (registro?.versao === VERSAO_TERMO) setAceito(true);
      })
      .catch((error) => setErro(error instanceof Error ? error.message : "Não foi possível consultar o aceite."))
      .finally(() => setCarregandoAceite(false));
  }, []);

  function toggle(index: number) {
    setChecks((current) => current.map((value, item) => item === index ? !value : value));
  }

  return (
    <PortalLayout
      titulo="Células de Disponibilidade"
      descricao="Aceite do piloto observacional e acompanhamento trimestral."
    >
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" /> Administração interna</div>
          <h1 className="text-2xl font-semibold tracking-tight">Células de Disponibilidade</h1>
          <p className="text-sm text-muted-foreground">Aceite do piloto observacional e acompanhamento trimestral.</p>
        </div>
        <Badge variant={aceito ? "default" : "secondary"}>{status}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[["Fornecedores", resumo.fornecedores], ["Lojas", resumo.lojas], ["Células", resumo.celulas], ["Tratamento", resumo.tratamento], ["Controle", resumo.controle], ["Elegíveis externos", resumo.elegiveis]].map(([label, value]) => (
          <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>
        ))}
      </div>

      {!aceito ? <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5" /> Termo de aceite interno</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">O aceite autoriza somente a medição observacional. Não cria cobrança, contratação obrigatória, penalidade ou mensagem ao fornecedor.</p>
          {[
            "Conferi que o plano usa dados reais agregados de vendas, estoque e presença.",
            "Concordo que o diagnóstico causal será validado por auditoria amostral.",
            "Confirmo que o piloto não gera obrigação comercial automática.",
            "Confirmo que o controle recebe somente totais mensais, sem dados individuais.",
          ].map((label, index) => <label key={label} className="flex items-start gap-3 text-sm"><Checkbox checked={checks[index]} onCheckedChange={() => toggle(index)} /><span>{label}</span></label>)}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4" /> Registro de aceite deve guardar usuário, data e versão.</div>
            <Button disabled={!pronto || aceito || carregandoAceite} onClick={async () => {
              setErro(null);
              try {
                await registrarAceiteCelulasDisponibilidade({ data: { versao: VERSAO_TERMO, checks: checks.map((value) => String(value)) } });
                setAceito(true);
              } catch (error) {
                setErro(error instanceof Error ? error.message : "Não foi possível registrar o aceite.");
              }
            }}><CheckCircle2 className="mr-2 size-4" />{aceito ? "Aceite registrado" : "Registrar aceite"}</Button>
          </div>
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        </CardContent>
      </Card> : null}
    </div>
    </PortalLayout>
  );
}
