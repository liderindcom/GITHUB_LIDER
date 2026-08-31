import { segmentoIntelider } from "@/lib/acordo-acesso";
import nomesBruto from "@/lib/mercadologico-nomes.json";

type NomesDic = {
  depto: Record<string, string>;
  ncc: Record<string, string>;
  comprador: Record<string, string>;
};

const NOMES = nomesBruto as NomesDic;

function codigoNorm(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const n = Number(t.replace(",", "."));
  if (Number.isFinite(n) && String(t).match(/^-?\d+(\.0+)?$/)) return String(Math.trunc(n));
  const soDigitos = t.replace(/^0+/, "");
  if (/^\d+$/.test(t)) return soDigitos || "0";
  return t;
}

function ehPlaceholder(texto: string): boolean {
  const t = texto.trim();
  if (!t) return true;
  if (/^(departamento|se[cç][aã]o|grupo|subgrupo)\s+[\d.]+$/i.test(t)) return true;
  if (/^comprador\s+\d+$/i.test(t)) return true;
  if (/^[\d.\s/-]+$/.test(t)) return true;
  return false;
}

function extrairDescricao(codigo: string, descricaoRaw: string | null | undefined): string {
  let nome = String(descricaoRaw ?? "").trim();
  if (!nome) return "";
  const prefixos = codigo
    ? [`${codigo} - `, `${codigo}-`, `${codigo} – `, `${codigo} `]
    : [];
  for (const prefixo of prefixos) {
    if (nome.length > prefixo.length && nome.toUpperCase().startsWith(prefixo.toUpperCase())) {
      nome = nome.slice(prefixo.length).trim();
    }
  }
  if (ehPlaceholder(nome)) return "";
  return nome;
}

export const FILTRO_TODOS = "__todos__";

export type FiltroMercadologico = {
  segmento: string;
  departamento: string;
  secao: string;
  grupo: string;
  subgrupo: string;
  comprador: string;
};

export const FILTRO_VAZIO: FiltroMercadologico = {
  segmento: "",
  departamento: "",
  secao: "",
  grupo: "",
  subgrupo: "",
  comprador: "",
};

type ProdutoMix = {
  sku?: string;
  departamentoCodigo?: string | null;
  departamento?: string | null;
  secaoCodigo?: string | null;
  secao?: string | null;
  grupoCodigo?: string | null;
  grupo?: string | null;
  subgrupoCodigo?: string | null;
  subgrupo?: string | null;
  compradorCodigo?: string | null;
  compradorNome?: string | null;
};

export function rotuloSegmento(p: ProdutoMix) {
  return segmentoIntelider(p.departamentoCodigo, p.departamento) || "OUTROS";
}

export function rotuloDepartamento(p: ProdutoMix) {
  const cod = codigoNorm(p.departamentoCodigo);
  const doDic = cod ? NOMES.depto[cod] : "";
  if (doDic) return doDic;
  const extraido = extrairDescricao(cod, p.departamento);
  if (extraido) return extraido;
  return "Sem departamento";
}

export function rotuloSecao(p: ProdutoMix) {
  const depto = codigoNorm(p.departamentoCodigo);
  const secao = codigoNorm(p.secaoCodigo);
  const doDic = depto && secao ? NOMES.ncc[`${depto}.${secao}`] : "";
  if (doDic) return doDic;
  const extraido = extrairDescricao(secao, p.secao);
  if (extraido) return extraido;
  return "Sem seção";
}

export function rotuloGrupo(p: ProdutoMix) {
  const depto = codigoNorm(p.departamentoCodigo);
  const secao = codigoNorm(p.secaoCodigo);
  const grupo = codigoNorm(p.grupoCodigo);
  const doDic = depto && secao && grupo ? NOMES.ncc[`${depto}.${secao}.${grupo}`] : "";
  if (doDic) return doDic;
  const extraido = extrairDescricao(grupo, p.grupo);
  if (extraido) return extraido;
  return "Sem grupo";
}

export function rotuloSubgrupo(p: ProdutoMix) {
  const depto = codigoNorm(p.departamentoCodigo);
  const secao = codigoNorm(p.secaoCodigo);
  const grupo = codigoNorm(p.grupoCodigo);
  const sub = codigoNorm(p.subgrupoCodigo);
  const doDic =
    depto && secao && grupo && sub ? NOMES.ncc[`${depto}.${secao}.${grupo}.${sub}`] : "";
  if (doDic) return doDic;
  const extraido = extrairDescricao(sub, p.subgrupo);
  if (extraido) return extraido;
  return "Sem subgrupo";
}

export function rotuloComprador(p: ProdutoMix) {
  const cod = codigoNorm(p.compradorCodigo);
  const doDic = cod ? NOMES.comprador[cod] : "";
  if (doDic) return doDic;
  const nome = extrairDescricao(cod, p.compradorNome);
  if (nome) return nome;
  return "Sem comprador";
}

export function filtroMercadologicoAtivo(f: FiltroMercadologico) {
  return Object.values(f).filter((v) => v && v !== FILTRO_TODOS).length;
}

export function produtoPassaFiltro(p: ProdutoMix, f: FiltroMercadologico) {
  if (f.segmento && rotuloSegmento(p) !== f.segmento) return false;
  if (f.departamento && rotuloDepartamento(p) !== f.departamento) return false;
  if (f.secao && rotuloSecao(p) !== f.secao) return false;
  if (f.grupo && rotuloGrupo(p) !== f.grupo) return false;
  if (f.subgrupo && rotuloSubgrupo(p) !== f.subgrupo) return false;
  if (f.comprador && rotuloComprador(p) !== f.comprador) return false;
  return true;
}

function unicos(valores: string[]) {
  return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function opcoesFiltroMercadologico(produtos: ProdutoMix[], f: FiltroMercadologico) {
  const base = (parcial: Partial<FiltroMercadologico>) =>
    produtos.filter((p) => produtoPassaFiltro(p, { ...FILTRO_VAZIO, ...parcial }));

  return {
    segmentos: unicos(produtos.map(rotuloSegmento)),
    departamentos: unicos(base({ segmento: f.segmento }).map(rotuloDepartamento)),
    secoes: unicos(base({ segmento: f.segmento, departamento: f.departamento }).map(rotuloSecao)),
    grupos: unicos(
      base({ segmento: f.segmento, departamento: f.departamento, secao: f.secao }).map(rotuloGrupo),
    ),
    subgrupos: unicos(
      base({
        segmento: f.segmento,
        departamento: f.departamento,
        secao: f.secao,
        grupo: f.grupo,
      }).map(rotuloSubgrupo),
    ),
    compradores: unicos(
      base({
        segmento: f.segmento,
        departamento: f.departamento,
        secao: f.secao,
        grupo: f.grupo,
        subgrupo: f.subgrupo,
      }).map(rotuloComprador),
    ),
  };
}

export function ajustarFiltroCascata(
  atual: FiltroMercadologico,
  campo: keyof FiltroMercadologico,
  valor: string,
  produtos: ProdutoMix[],
): FiltroMercadologico {
  const limpo = valor === FILTRO_TODOS ? "" : valor;
  const next: FiltroMercadologico = { ...atual, [campo]: limpo };
  if (campo === "segmento") {
    next.departamento = "";
    next.secao = "";
    next.grupo = "";
    next.subgrupo = "";
  } else if (campo === "departamento") {
    next.secao = "";
    next.grupo = "";
    next.subgrupo = "";
  } else if (campo === "secao") {
    next.grupo = "";
    next.subgrupo = "";
  } else if (campo === "grupo") {
    next.subgrupo = "";
  }
  const opcoes = opcoesFiltroMercadologico(produtos, next);
  if (next.departamento && !opcoes.departamentos.includes(next.departamento)) next.departamento = "";
  if (next.secao && !opcoes.secoes.includes(next.secao)) next.secao = "";
  if (next.grupo && !opcoes.grupos.includes(next.grupo)) next.grupo = "";
  if (next.subgrupo && !opcoes.subgrupos.includes(next.subgrupo)) next.subgrupo = "";
  if (next.comprador && !opcoes.compradores.includes(next.comprador)) next.comprador = "";
  return next;
}

let filtroAtual: FiltroMercadologico = { ...FILTRO_VAZIO };

export function getFiltroMercadologico() {
  return filtroAtual;
}

export function setFiltroMercadologicoStore(filtro: FiltroMercadologico) {
  filtroAtual = { ...filtro };
}
