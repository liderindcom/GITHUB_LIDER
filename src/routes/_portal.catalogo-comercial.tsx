import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImagePlus, PackagePlus, Save, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  fetchCatalogoComercial,
  salvarCatalogoComercial,
  type CatalogoComercialDB,
} from "@/catalogo-api";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/context/portal-context";

export const Route = createFileRoute("/_portal/catalogo-comercial")({
  head: () => ({
    meta: [
      { title: "Catálogo Comercial | Portal do Fornecedor" },
      {
        name: "description",
        content: "Apresente lançamentos, coleções e produtos ao Grupo Líder.",
      },
    ],
  }),
  component: CatalogoComercialPage,
});

type Formulario = Omit<
  CatalogoComercialDB,
  "id" | "fornecedorCodigo" | "status" | "criadoEm" | "atualizadoEm" | "publicadoEm"
> &
  Pick<CatalogoComercialDB, "status">;

const vazio: Formulario = {
  codigoFornecedor: "",
  descricao: "",
  marca: "",
  categoria: "",
  subcategoria: "",
  skuReferencia: "",
  imagemUrl: "",
  fichaTecnica: "",
  variacoesJson: "",
  precoSugerido: null,
  precoValidadeInicio: "",
  precoValidadeFim: "",
  estoqueDisponivel: null,
  prazoEntregaDias: null,
  pedidoMinimo: null,
  colecao: "",
  estacao: "",
  evento: "",
  origem: "FORNECEDOR",
  status: "RASCUNHO",
};

function CatalogoComercialPage() {
  const { fornecedor } = usePortal();
  const [itens, setItens] = useState<CatalogoComercialDB[]>([]);
  const [form, setForm] = useState<Formulario>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void fetchCatalogoComercial()
      .then((dados) => {
        setItens(dados);
        setCarregando(false);
      })
      .catch(() => {
        toast.error("Não foi possível carregar o catálogo.");
        setCarregando(false);
      });
  }, []);

  const alterar = (campo: keyof Formulario, valor: string) => {
    const camposNumericos: Array<keyof Formulario> = [
      "precoSugerido",
      "estoqueDisponivel",
      "prazoEntregaDias",
      "pedidoMinimo",
    ];
    const valorFinal = camposNumericos.includes(campo)
      ? valor === ""
        ? null
        : Number(valor)
      : valor;
    setForm((atual) => ({ ...atual, [campo]: valorFinal }));
  };

  const salvar = async (status: "RASCUNHO" | "PUBLICADO") => {
    if (!form.descricao.trim()) {
      toast.error("Informe a descrição do produto ou coleção.");
      return;
    }
    setSalvando(true);
    try {
      const salvo = await salvarCatalogoComercial({ data: { ...form, status } });
      setItens((atual) => [salvo, ...atual]);
      setForm(vazio);
      toast.success(status === "PUBLICADO" ? "Produto enviado ao Grupo Líder." : "Rascunho salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <PortalLayout
      titulo="Catálogo Comercial"
      descricao="Apresente produtos, coleções e oportunidades ao Grupo Líder."
    >
      <div className="space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Nova frente comercial
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Catálogo Comercial</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Apresente lançamentos, coleções e oportunidades para os compradores do Grupo Líder. O
              catálogo não altera o cadastro oficial nem gera pedido automaticamente.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5">
            <Sparkles className="size-3.5" /> Atlas conectado
          </Badge>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="size-5 text-primary" /> Novo produto ou coleção
              </CardTitle>
              <CardDescription>
                Quanto mais completo o catálogo, melhor o comprador poderá avaliar a oportunidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Descrição comercial *"
                  value={form.descricao}
                  onChange={(v) => alterar("descricao", v)}
                  placeholder="Ex.: Coleção primavera — vestido midi"
                />
                <Campo
                  label="Marca"
                  value={form.marca ?? ""}
                  onChange={(v) => alterar("marca", v)}
                  placeholder="Marca ou linha"
                />
                <Campo
                  label="Categoria"
                  value={form.categoria ?? ""}
                  onChange={(v) => alterar("categoria", v)}
                  placeholder="Moda, pet, farma..."
                />
                <Campo
                  label="Subcategoria"
                  value={form.subcategoria ?? ""}
                  onChange={(v) => alterar("subcategoria", v)}
                  placeholder="Ex.: vestidos"
                />
                <Campo
                  label="Código / referência do fornecedor"
                  value={form.codigoFornecedor ?? ""}
                  onChange={(v) => alterar("codigoFornecedor", v)}
                />
                <Campo
                  label="SKU RMS relacionado (se houver)"
                  value={form.skuReferencia ?? ""}
                  onChange={(v) => alterar("skuReferencia", v)}
                />
                <Campo
                  label="Coleção"
                  value={form.colecao ?? ""}
                  onChange={(v) => alterar("colecao", v)}
                  placeholder="Ex.: Primavera 2027"
                />
                <Campo
                  label="Estação ou evento"
                  value={form.estacao ?? ""}
                  onChange={(v) => alterar("estacao", v)}
                  placeholder="Ex.: Verão, Natal, Círio"
                />
                <Campo
                  label="Preço sugerido"
                  value={form.precoSugerido?.toString() ?? ""}
                  onChange={(v) => alterar("precoSugerido", v)}
                  inputMode="decimal"
                />
                <Campo
                  label="Pedido mínimo"
                  value={form.pedidoMinimo?.toString() ?? ""}
                  onChange={(v) => alterar("pedidoMinimo", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Estoque disponível"
                  value={form.estoqueDisponivel?.toString() ?? ""}
                  onChange={(v) => alterar("estoqueDisponivel", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Prazo de entrega (dias)"
                  value={form.prazoEntregaDias?.toString() ?? ""}
                  onChange={(v) => alterar("prazoEntregaDias", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Imagem principal (URL)"
                  value={form.imagemUrl ?? ""}
                  onChange={(v) => alterar("imagemUrl", v)}
                  placeholder="https://..."
                />
                <Campo
                  label="Evento ou oportunidade"
                  value={form.evento ?? ""}
                  onChange={(v) => alterar("evento", v)}
                  placeholder="Ex.: Dia das Mães"
                />
              </div>
              <div className="space-y-2">
                <Label>Ficha técnica, variações e informações comerciais</Label>
                <Textarea
                  value={form.fichaTecnica ?? ""}
                  onChange={(e) => alterar("fichaTecnica", e.target.value)}
                  placeholder="Materiais, cores, tamanhos, voltagem, composição, diferenciais e condições."
                  rows={5}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => void salvar("RASCUNHO")}
                  disabled={salvando}
                >
                  <Save className="mr-2 size-4" />
                  Salvar rascunho
                </Button>
                <Button onClick={() => void salvar("PUBLICADO")} disabled={salvando}>
                  <Send className="mr-2 size-4" />
                  Enviar ao Grupo Líder
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit bg-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="size-5 text-primary" /> Como o catálogo será usado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">1. Apresentação:</strong> o fornecedor cadastra
                o produto, a coleção e as condições comerciais.
              </p>
              <p>
                <strong className="text-foreground">2. Avaliação:</strong> o comprador compara a
                oportunidade com lojas, categorias, preço, margem e tendências.
              </p>
              <p>
                <strong className="text-foreground">3. Decisão:</strong> o Atlas pode sugerir teste,
                negociação ou inclusão no mix, sempre com confirmação humana.
              </p>
              <p>
                <strong className="text-foreground">4. Aprendizado:</strong> o resultado da compra
                ou teste retorna para melhorar as próximas recomendações.
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                As imagens são armazenadas inicialmente como URL. O upload gerenciado será uma etapa
                posterior, após validarmos o fluxo comercial.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Produtos e coleções enviados</CardTitle>
            <CardDescription>
              {fornecedor.nome} · {carregando ? "carregando..." : `${itens.length} registro(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {itens.length === 0 && !carregando ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Seu catálogo ainda está vazio. Apresente a próxima oportunidade ao Grupo Líder.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {itens.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.marca, item.categoria, item.colecao].filter(Boolean).join(" · ") ||
                            "Sem classificação informada"}
                        </p>
                      </div>
                      <Badge variant={item.status === "PUBLICADO" ? "default" : "secondary"}>
                        {item.status === "PUBLICADO" ? "Enviado" : "Rascunho"}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                      {item.fichaTecnica || "Sem ficha técnica informada."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}
