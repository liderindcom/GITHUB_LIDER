import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PortalLayout } from "@/components/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchRebaixaSegmentosEmail, saveRebaixaSegmentoEmail, type RebaixaSegmentoEmailDB } from "@/api";

export const Route = createFileRoute("/_portal/admin-rebaixa")({ component: AdminRebaixaPage });

function AdminRebaixaPage() {
  const [linhas, setLinhas] = useState<RebaixaSegmentoEmailDB[]>([]);
  const [segmento, setSegmento] = useState("");
  const [email, setEmail] = useState("");
  const carregar = async () => { try { setLinhas(await fetchRebaixaSegmentosEmail({})); } catch { toast.error("Acesso administrativo exigido."); } };
  useEffect(() => { void carregar(); }, []);
  const salvar = async () => { try { await saveRebaixaSegmentoEmail({ data: { segmento, email } }); setSegmento(""); setEmail(""); await carregar(); toast.success("Destinatário salvo."); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); } };
  return <PortalLayout titulo="Configuração de e-mails de rebaixa" descricao="Defina o destinatário de cada segmento. O diretor decide a aprovação da proposta.">
    <Card><CardHeader><CardTitle>Destinatários por segmento</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3"><Input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Segmento (ex.: FARMALIDER)" /><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do diretor/área" type="email" /><Button onClick={salvar}>Salvar configuração</Button></div>
      <div className="divide-y rounded border">{linhas.length ? linhas.map((l) => <div key={l.segmento} className="flex justify-between p-3 text-sm"><span>{l.segmento}</span><span className="text-muted-foreground">{l.email}</span></div>) : <p className="p-4 text-sm text-muted-foreground">Nenhum segmento configurado.</p>}</div>
    </CardContent></Card>
  </PortalLayout>;
}
