import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";

import type { CatalogoComercialDB, CatalogoComercialInput } from "@/catalogo-api";
import {
  CerberusBodyTooLargeError,
  CerberusInvalidJsonError,
  claimStagedUpload,
  readJsonBodyLimited,
  markStagedUploadConsumed,
  releaseStagedUpload,
} from "@/server/cerberus-upload-staging";
import {
  persistirCatalogoComercial,
  validarDuplicidadesCatalogo,
} from "@/server/catalogo-comercial-persist";
import { exigirInternoRole, exigirSessaoFornecedor, lerSessaoPortal } from "@/server/sessao-portal";
import { permitirRequisicao } from "@/server/request-guard";
import { db } from "@/server/db";

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

const ALIASES_FICHA_LIDER: Record<string, string[]> = {
  codigoInterno: ["cod interno", "referencia", "codigo produto", "codigo"],
  descricao: ["descricao do produto", "descricao", "produto", "nome"],
  embalagemQuantidade: ["embl qtde na cx", "quantidade na caixa", "multiplo de compra"],
  custoFornecedor: ["custo do fornecedor", "custo", "preco fornecedor"],
  condicaoFaturamento: ["condicao de entrega", "faturamento"],
  ipiPct: ["ipi", "ipi percentual"],
  prazoEntregaDias: ["prazo de entrega", "prazo de entrega dias", "prazo"],
  freteTipo: ["frete", "tipo frete"],
  ean13: ["ean13", "ean 13", "codigo de barras"],
  dun14: ["dun14", "dun 14"],
  controlaValidade: ["controla validade", "controle validade"],
  validadeDias: ["validade em dias", "validade dias"],
  diasValidadeMinima: ["dias validade minima", "validade minima recebimento"],
  ncm: ["ncm"],
  cest: ["cest"],
  caixaComprimentoCm: ["caixa comp", "caixa comprimento", "comp caixa"],
  caixaLarguraCm: ["caixa larg", "caixa largura", "larg caixa"],
  caixaAlturaCm: ["caixa alt", "caixa altura", "alt caixa"],
  caixaPesoBrutoKg: ["caixa p bruto", "caixa peso bruto", "peso bruto caixa"],
  unidadeComprimentoCm: ["unidade comp", "unidade comprimento", "comp unidade"],
  unidadeLarguraCm: ["unidade larg", "unidade largura", "larg unidade"],
  unidadeAlturaCm: ["unidade alt", "unidade altura", "alt unidade"],
  unidadePesoBrutoKg: ["unidade p bruto", "unidade peso bruto", "peso bruto unidade"],
  palletBaseCaixas: ["pallet base", "base caixas", "pallet base caixas"],
  palletAlturaCaixas: ["pallet altura", "altura caixas", "pallet altura caixas"],
  palletTotalCaixas: ["pallet em caixas", "total pallet", "pallet caixas"],
};

const CAMPOS_NUMERICOS_FICHA = new Set([
  "embalagemQuantidade",
  "custoFornecedor",
  "ipiPct",
  "prazoEntregaDias",
  "validadeDias",
  "diasValidadeMinima",
  "caixaComprimentoCm",
  "caixaLarguraCm",
  "caixaAlturaCm",
  "caixaPesoBrutoKg",
  "unidadeComprimentoCm",
  "unidadeLarguraCm",
  "unidadeAlturaCm",
  "unidadePesoBrutoKg",
  "palletBaseCaixas",
  "palletAlturaCaixas",
  "palletTotalCaixas",
]);

function lerFicha(linha: Record<string, unknown>, campo: string) {
  return Object.entries(linha).find(([chave]) =>
    (ALIASES_FICHA_LIDER[campo] || []).some((nome) => normalizar(nome) === normalizar(chave)),
  )?.[1];
}

function textoFicha(linha: Record<string, unknown>, campo: string) {
  const valor = lerFicha(linha, campo);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor ?? "").trim();
}

function numeroFicha(linha: Record<string, unknown>, campo: string) {
  const bruto = textoFicha(linha, campo).replace(/\s/g, "");
  if (!bruto) return null;
  const normalizado =
    bruto.includes(",") && bruto.includes(".")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto.replace(",", ".");
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

function possuiCabecalhoFicha(linha: Record<string, unknown>) {
  return Object.keys(linha).some((chave) =>
    Object.values(ALIASES_FICHA_LIDER).some((nomes) =>
      nomes.some((nome) => normalizar(nome) === normalizar(chave)),
    ),
  );
}

function converterPlanilha(bytes: Buffer): { linhas: CatalogoComercialInput[]; erros: string[] } {
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
  if (!primeiraAba) return { linhas: [], erros: ["A planilha não possui uma aba para importar."] };

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeiraAba, { defval: "" });
  if (linhas.length > 500) {
    return { linhas: [], erros: ["A importação está limitada a 500 linhas por arquivo."] };
  }
  const importadas: CatalogoComercialInput[] = [];
  const erros: string[] = [];
  const fichaTecnica = possuiCabecalhoFicha(linhas[0] || {});

  linhas.forEach((linha, indice) => {
    const descricao = fichaTecnica
      ? textoFicha(linha, "descricao")
      : lerTexto(linha, ["descricao", "descricaocomercial", "produto", "nome"]);
    if (!descricao) {
      if (Object.values(linha).some((valor) => String(valor).trim())) {
        erros.push(`Linha ${indice + 2}: descrição comercial não informada.`);
      }
      return;
    }
    if (fichaTecnica) {
      const ficha: Record<string, unknown> = {};
      Object.keys(ALIASES_FICHA_LIDER).forEach((campo) => {
        const bruto = textoFicha(linha, campo);
        ficha[campo] = CAMPOS_NUMERICOS_FICHA.has(campo)
          ? numeroFicha(linha, campo)
          : bruto || null;
        if (CAMPOS_NUMERICOS_FICHA.has(campo) && bruto && ficha[campo] === null) {
          erros.push(`Linha ${indice + 2}: ${campo} deve ser numérico.`);
        }
      });
      const codigo = String(ficha.codigoInterno || "").trim();
      importadas.push({
        codigoFornecedor: codigo || null,
        descricao,
        marca: null,
        categoria: null,
        subcategoria: null,
        skuReferencia: codigo || null,
        imagemUrl: null,
        fichaTecnica: "Ficha técnica Líder importada; revisão comercial pendente.",
        variacoesJson: null,
        dadosFichaLiderJson: JSON.stringify(ficha),
        precoSugerido: null,
        precoValidadeInicio: null,
        precoValidadeFim: null,
        estoqueDisponivel: null,
        prazoEntregaDias:
          typeof ficha.prazoEntregaDias === "number" ? ficha.prazoEntregaDias : null,
        pedidoMinimo: null,
        colecao: null,
        estacao: null,
        evento: null,
        origem: "FORNECEDOR",
        status: "RASCUNHO",
      });
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
      dadosFichaLiderJson: null,
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
      "Nenhuma linha válida foi encontrada. Use o modelo da ficha e preencha a coluna Descrição do Produto.",
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
        let sessao: { tipo: "interno" | "fornecedor"; codigo: string; identidade: string };
        try {
          const principal = lerSessaoPortal();
          if (!principal) throw new Error("Sessão do portal exigida.");
          if (principal.tipo === "interno") {
            const interno = exigirInternoRole("admin");
            sessao = { tipo: "interno", codigo: interno.codigo, identidade: interno.codigo };
          } else {
            const fornecedor = exigirSessaoFornecedor();
            sessao = {
              tipo: "fornecedor",
              codigo: fornecedor.codigo,
              identidade: `${fornecedor.codigo}:${fornecedor.email}`,
            };
          }
        } catch (cause) {
          return error(cause instanceof Error ? cause.message : "Sessão do portal exigida.", 401);
        }
        const porIdentidade = permitirRequisicao(
          request,
          "cerberus-import-identidade",
          { maximo: 2, janelaMs: 15 * 60_000 },
          sessao.identidade,
        );
        const porOrigem = permitirRequisicao(request, "cerberus-import-origem", {
          maximo: 10,
          janelaMs: 15 * 60_000,
        });
        const bloqueio = !porIdentidade.permitido ? porIdentidade : porOrigem;
        if (!bloqueio.permitido) {
          return Response.json(
            { error: "Muitas tentativas. Aguarde e tente novamente." },
            {
              status: 429,
              headers: {
                "cache-control": "no-store",
                "retry-after": String(bloqueio.retryAfterSegundos),
              },
            },
          );
        }
        let body: unknown;
        try {
          body = await readJsonBodyLimited(request);
        } catch (cause) {
          if (cause instanceof CerberusBodyTooLargeError) {
            return error(cause.message, 413);
          }
          if (cause instanceof CerberusInvalidJsonError) return error(cause.message, 400);
          return error("Corpo inválido.", 400);
        }
        if (!body || typeof body !== "object") return error("Corpo inválido.", 400);
        const candidate = body as Record<string, unknown>;
        const uploadId = typeof candidate.uploadId === "string" ? candidate.uploadId : "";
        const internalName =
          typeof candidate.internalName === "string" ? candidate.internalName : "";
        const sha256 = typeof candidate.sha256 === "string" ? candidate.sha256 : "";
        const fornecedorCodigo =
          typeof candidate.fornecedorCodigo === "string" ? candidate.fornecedorCodigo : undefined;
        if (!uploadId || !internalName || !sha256)
          return error("Campos obrigatórios ausentes.", 422);

        let uploadIdProcessando = "";
        try {
          const alvo = sessao.tipo === "interno" ? fornecedorCodigo : sessao.codigo;
          if (!alvo) return error("Fornecedor de destino exigido.", 422);
          const staged = await claimStagedUpload({
            uploadId,
            internalName,
            sha256,
            fornecedorCodigo: alvo,
          });
          uploadIdProcessando = staged.receipt.uploadId;
          const convertido = converterPlanilha(staged.bytes);
          if (convertido.erros.length) {
            throw new Error(convertido.erros.join(" "));
          }

          // Valida o lote inteiro antes da primeira gravação. Assim, uma planilha
          // com uma duplicidade não deixa metade dos produtos persistida.
          validarDuplicidadesCatalogo(convertido.linhas, {
            fornecedorCodigo: staged.receipt.fornecedorCodigo,
          });

          const tarefas: Array<Promise<CatalogoComercialDB>> = [];
          const transacao = db.transaction(() => {
            for (const linha of convertido.linhas) {
              tarefas.push(
                persistirCatalogoComercial(linha, {
                  fornecedorCodigo: staged.receipt.fornecedorCodigo,
                  validarDuplicidade: false,
                }),
              );
            }
            markStagedUploadConsumed(staged.receipt.uploadId);
          });
          transacao();
          const itens = await Promise.all(tarefas);
          return Response.json(
            { receipt: staged.receipt, itens },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (cause) {
          if (uploadIdProcessando) releaseStagedUpload(uploadIdProcessando, sha256);
          const message = cause instanceof Error ? cause.message : "Importação recusada.";
          const status = message.includes("não encontrado")
            ? 404
            : message.includes("já consumido") || message.includes("sendo processado")
              ? 409
              : message.includes("Sessão")
                ? 401
                : 422;
          return error(message, status);
        }
      },
    },
  },
});
