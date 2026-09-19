import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  iniciarImportacaoScanntech,
  enviarLoteScanntech,
  promoverImportacaoScanntech,
} from "@/api";
const obrigatorios = [
  "Código Barras SKU",
  "Nome SKU",
  "Marca SKU",
  "Fabricante SKU",
  ".Cesta",
  ".Categoria",
  ".Sub-Categoria",
];
export const Route = createFileRoute("/_portal/admin-scanntech")({ component: ImportarScanntech });
function ImportarScanntech() {
  const [competencia, setCompetencia] = useState("2026-09"),
    [arquivo, setArquivo] = useState<File | null>(null),
    [dados, setDados] = useState<any[]>([]),
    [cab, setCab] = useState<string[]>([]),
    [erros, setErros] = useState<string[]>([]),
    [enviando, setEnviando] = useState(false),
    [pronto, setPronto] = useState(false);
  const ler = async (f: File) => {
    setArquivo(f);
    setPronto(false);
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
    const h = (linhas[0] || []).map((x: any) => String(x || "").trim());
    setCab(h);
    const faltam = obrigatorios.filter((x) => !h.includes(x));
    if (faltam.length) {
      setErros(["Cabeçalhos ausentes: " + faltam.join(", ")]);
      setDados([]);
      return;
    }
    const ix = (n: string) => h.indexOf(n),
      vistos = new Set<string>(),
      rejeitadas: string[] = [];
    const validas = linhas
      .slice(1)
      .map((r: any[], i: number) => {
        const ean = String(r[ix("Código Barras SKU")] || "").replace(/\D/g, "");
        if (!/^\d{8,14}$/.test(ean) || vistos.has(ean)) {
          if (rejeitadas.length < 20) rejeitadas.push(`Linha ${i + 2}: EAN inválido ou duplicado`);
          return null;
        }
        vistos.add(ean);
        const metricas: any = {};
        h.forEach((nome, j) => {
          if (nome && !obrigatorios.includes(nome)) metricas[nome] = r[j];
        });
        return {
          linha: i + 2,
          ean,
          nome: r[ix("Nome SKU")],
          marca: r[ix("Marca SKU")],
          fabricante: r[ix("Fabricante SKU")],
          cesta: r[ix(".Cesta")],
          categoria: r[ix(".Categoria")],
          subcategoria: r[ix(".Sub-Categoria")],
          metricas,
        };
      })
      .filter(Boolean);
    setDados(validas);
    setErros(rejeitadas);
  };
  const importar = async () => {
    if (!arquivo || !dados.length || erros.length || !/^\d{4}-\d{2}$/.test(competencia)) {
      toast.error("Corrija competência e rejeições antes de importar.");
      return;
    }
    setEnviando(true);
    try {
      const hash = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
      const checksum = Array.from(new Uint8Array(hash))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      const ini = await iniciarImportacaoScanntech({
        data: { competencia, arquivo: arquivo.name, checksum, cabecalhos: cab },
      });
      for (let i = 0; i < dados.length; i += 1000)
        await enviarLoteScanntech({ data: { runId: ini.runId, itens: dados.slice(i, i + 1000) } });
      const fim = await promoverImportacaoScanntech({
        data: { runId: ini.runId, linhasLidas: dados.length, linhasRejeitadas: 0 },
      });
      setPronto(true);
      toast.success(`${fim.promovidas.toLocaleString("pt-BR")} linhas promovidas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <PortalLayout
      titulo="Importar Scanntech"
      descricao="A planilha é validada antes do staging e substitui somente a competência escolhida."
    >
      <div className="max-w-3xl space-y-5">
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Importação mensal controlada
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Competência</Label>
              <Input
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                placeholder="AAAA-MM"
              />
            </div>
            <div>
              <Label>Arquivo Scanntech</Label>
              <Input
                type="file"
                accept=".xlsx,.xlsm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void ler(f);
                }}
              />
            </div>
          </div>
          {arquivo && (
            <p className="text-sm text-muted-foreground">
              {arquivo.name} · {dados.length.toLocaleString("pt-BR")} linhas válidas
            </p>
          )}
          {erros.length > 0 && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {erros.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </div>
          )}
          <Button
            onClick={() => void importar()}
            disabled={enviando || !dados.length || !!erros.length}
          >
            <Upload className="mr-2 size-4" />
            {enviando ? "Enviando lotes..." : "Validar, carregar staging e promover"}
          </Button>
          {pronto && (
            <p className="text-sm font-medium text-green-700">
              Competência atualizada com sucesso.
            </p>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
