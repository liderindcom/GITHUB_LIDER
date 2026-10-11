import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";

import type { CatalogoComercialDB, CatalogoComercialInput } from "@/catalogo-api";
import { readStagedUpload, stagePortalUpload } from "@/server/cerberus-upload-staging";
import { persistirCatalogoComercial } from "@/server/catalogo-comercial-persist";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

function normalizar(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function lerTexto(linha: Record<string, unknown>, nomes: string[]) {
  const valor = Object.entries(linha).find(([chave]) => nomes.includes(normalizar(chave)))?.[1];
  return String(valor ?? "").trim();
}

function lerNumero(linha: Record<string, unknown>, nomes: string[]) {
  const bruto = lerTexto(linha, nomes).replace(/[^0-9,.-]/g, "");
  if (!bruto) return null;
  const valor = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
  return Number.isFinite(valor) ? valor : null;
}

function converterPlanilha(bytes: Buffer): { linhas: CatalogoComercialInput[]; erros: string[] } {
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
  if (!primeiraAba) return { linhas: [], erros: ["A planilha não possui uma aba para importar."] };

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeiraAba, { defval: "" });
  const importadas: CatalogoComercialInput[] = [];
  const erros: string[] = [];

  linhas.forEach((linha, indice) => {
    const descricao = lerTexto(linha, ["descricao", "descricaocomercial", "produto", "nome"]);
    if (!descricao) {
      if (Object.values(linha).some((valor) => String(valor).trim())) {
        erros.push(`Linha ${indice + 2}: descrição comercial não informada.`);
      }
      return;
    }
    importadas.push({
      codigoFornecedor: lerTexto(linha, ["codigo", "codigofornecedor", "referenciafornecedor"]),
      descricao,
      marca: lerTexto(linha, ["marca"]),
      categoria: lerTexto(linha, ["categoria"]),
      subcategoria: lerTexto(linha, ["subcategoria"]),
      skuReferencia: lerTexto(linha, ["sku", "skurms", "skureferencia"]),
      imagemUrl: lerTexto(linha, ["imagem", "imagemurl", "urlimagem"]),
      fichaTecnica: lerTexto(linha, ["fichatecnica", "informacoescomerciais"]),
      variacoesJson: lerTexto(linha, ["variacoes", "variacoesjson"]),
      precoSugerido: lerNumero(linha, ["preco", "precosugerido", "valorsugerido"]),
      precoValidadeInicio: lerTexto(linha, ["iniciovalidade", "iniciovalidadepreco"]),
      precoValidadeFim: lerTexto(linha, ["fimvalidade", "fimvalidadepreco"]),
      estoqueDisponivel: lerNumero(linha, ["estoque", "estoquedisponivel"]),
      prazoEntregaDias: lerNumero(linha, ["prazo", "prazoentrega", "prazoentregadias"]),
      pedidoMinimo: lerNumero(linha, ["pedidominimo", "quantidademinima"]),
      colecao: lerTexto(linha, ["colecao", "linha"]),
      estacao: lerTexto(linha, ["estacao"]),
      evento: lerTexto(linha, ["evento", "oportunidade"]),
      origem: "FORNECEDOR",
      status: "RASCUNHO",
    });
  });

  if (!importadas.length && !erros.length) {
    erros.push(
      "Nenhuma linha válida foi encontrada. Use o modelo e preencha a coluna Descrição comercial.",
    );
  }
  return { linhas: importadas, erros };
}

export const Route = createFileRoute("/api/cerberus/catalogo-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.CERBERUS_PORTAL_UPLOADS_ENABLED !== "true") {
          return error("Endpoint indisponível.", 404);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("JSON inválido.", 400);
        }
        if (!body || typeof body !== "object") return error("Corpo inválido.", 400);
        const candidate = body as Record<string, unknown>;
        const originalName =
          typeof candidate.originalName === "string" ? candidate.originalName : "";
        const mimeType = typeof candidate.mimeType === "string" ? candidate.mimeType : "";
        const bytesBase64 = typeof candidate.bytesBase64 === "string" ? candidate.bytesBase64 : "";
        const fornecedorCodigo =
          typeof candidate.fornecedorCodigo === "string" ? candidate.fornecedorCodigo : undefined;
        if (!originalName || !mimeType || !bytesBase64)
          return error("Campos obrigatórios ausentes.", 422);

        try {
          const receipt = await stagePortalUpload({
            originalName,
            mimeType,
            bytesBase64,
            route: "catalogo-comercial",
            fornecedorCodigo,
          });
          const bytes = await readStagedUpload(receipt.uploadId, receipt.internalName);
          const convertido = converterPlanilha(bytes);
          if (convertido.erros.length) {
            return error(convertido.erros.join(" "), 422);
          }

          const itens: CatalogoComercialDB[] = [];
          for (const linha of convertido.linhas) {
            itens.push(
              await persistirCatalogoComercial(linha, {
                fornecedorCodigo: receipt.fornecedorCodigo,
              }),
            );
          }
          return Response.json({ receipt, itens }, { headers: { "cache-control": "no-store" } });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Importação recusada.";
          const status = message.includes("Sessão") ? 401 : 422;
          return error(message, status);
        }
      },
    },
  },
});
