import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, MessageCircle, Printer, QrCode, Smartphone } from "lucide-react";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_portal/instalar")({
  head: () => ({
    meta: [
      { title: "Acessos no celular | Portal do Fornecedor" },
      { name: "description", content: "QR Codes oficiais para Portal do Fornecedor e AppCom Líder." },
    ],
  }),
  component: AcessosNoCelularPage,
});

const portalUrl = "https://portaldofornecedor.intelider.com.br:9955";
const appComUrl = "https://appcom.intelider.com.br";
const qr = (url: string) =>
  "https://quickchart.io/qr?size=320&margin=2&ecLevel=H&text=" + encodeURIComponent(url) + "&v=appcom-pwa-v5";

function AcessosNoCelularPage() {
  const imprimir = () => {
    const janela = window.open("", "_blank", "width=850,height=650");
    if (!janela) return;
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Acessos no celular | Grupo Líder</title><style>@page{size:A4 landscape;margin:15mm}body{font-family:Arial,sans-serif;color:#17261b}h1{margin:0 0 6px;font-size:25px}.sub{color:#526257;margin:0 0 24px}.cards{display:flex;gap:24px}.card{flex:1;border:1px solid #cbd8cd;border-radius:12px;padding:20px;text-align:center}.card h2{margin:0 0 8px;font-size:19px}.card p{font-size:13px;line-height:1.45;color:#526257}.card img{width:190px;height:190px;margin:12px auto;display:block}.url{font-size:10px;word-break:break-all;color:#285f3b}</style></head><body><h1>Grupo Líder — Acessos no celular</h1><p class="sub">Use o mesmo e-mail e senha cadastrados no Portal.</p><div class="cards"><section class="card"><h2>Portal do Fornecedor</h2><p>Indicadores, pedidos, preços e informações comerciais.</p><img src="${qr(portalUrl)}" alt="QR Portal"><p class="url">${portalUrl}</p></section><section class="card"><h2>AppCom Líder</h2><p>Avisos do Atlas, negociações e conversas com o Grupo Líder.</p><img src="${qr(appComUrl)}" alt="QR AppCom"><p class="url">${appComUrl}</p></section></div><script>window.onload=()=>window.print();</script></body></html>`);
    janela.document.close();
  };
  return (
    <PortalLayout
      titulo="Acessos no celular"
      descricao="Escolha o acesso desejado. Portal e AppCom são aplicativos diferentes."
    >
      <div className="space-y-6 pb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Acessos oficiais da sua empresa
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Abra no celular</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Escaneie o QR Code correspondente. O mesmo e-mail e senha cadastrados no Portal valem
            para o AppCom; não existe um segundo cadastro.
          </p>
        </div>

        <Button className="w-fit" variant="outline" onClick={imprimir}>
          <Printer className="size-4" />
          Imprimir QR Codes
        </Button>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-5 text-primary" /> Portal do Fornecedor
              </CardTitle>
              <CardDescription>
                Consulte indicadores, itens, preços, pedidos e demais informações comerciais.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <img
                className="size-44 rounded-lg border-8 border-white bg-white shadow-sm ring-1 ring-border"
                alt="QR Code para abrir o Portal do Fornecedor no celular"
                src={qr(portalUrl)}
              />
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Acesso externo do Portal: porta 9955. Se desejar, use “Adicionar à tela de
                  início”.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={portalUrl} target="_blank" rel="noreferrer">
                    Abrir Portal <ExternalLink className="ml-2 size-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="size-5 text-primary" /> AppCom Líder
              </CardTitle>
              <CardDescription>
                Comunicador para avisos do Atlas, negociações e conversas com o Grupo Líder.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <img
                className="size-44 rounded-lg border-8 border-white bg-white shadow-sm ring-1 ring-border"
                alt="QR Code para abrir o AppCom Líder no celular"
                src={qr(appComUrl)}
              />
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Este QR abre somente o AppCom Líder por HTTPS padrão. Depois de entrar, instale-o
                  na tela inicial do celular se desejar.
                </p>
                <Button asChild size="sm">
                  <a href={appComUrl} target="_blank" rel="noreferrer">
                    <QrCode className="size-4" />
                    Abrir AppCom Líder
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
