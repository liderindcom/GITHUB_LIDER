import { addDays, format, subMonths } from "date-fns";

export const fornecedor = {
  codigo: "FORN-4050",
  nome: "Nestlé Brasil S/A",
  cnpj: "60.409.075/0001-52",
  cnpjSenhaInicial: "60409075000152",
};

export type Loja = { id: string; nome: string };

export const lojas: Loja[] = [
  { id: "01", nome: "Loja 01 - Líder Batista Campos" },
  { id: "05", nome: "Loja 05 - Líder Doca" },
  { id: "12", nome: "Loja 12 - Líder Humaitá" },
];

export type Produto = { sku: string; descricao: string; categoria: string; precoTabela: number; cmvUnit: number };

export const produtos: Produto[] = [
  { sku: "10010", descricao: "Nescau Chocolate Pó 400g", categoria: "Achocolatados", precoTabela: 12.9, cmvUnit: 9.1 },
  {
    sku: "10020",
    descricao: "Leite Condensado Moça Lata 395g",
    categoria: "Leites",
    precoTabela: 8.49,
    cmvUnit: 6.35,
  },
  {
    sku: "10030",
    descricao: "Biscoito Passatempo Recheado Chocolate 130g",
    categoria: "Biscoitos",
    precoTabela: 4.29,
    cmvUnit: 3.2,
  },
];

export const produtoPorSku = (sku: string) => produtos.find((p) => p.sku === sku)!;

export type PedidoStatus = "Aberto" | "Faturado" | "Pendente" | "Cancelado";

export type PedidoItem = {
  sku: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  precoUnitario: number;
};

export type Pedido = {
  numero: string;
  emissao: string;
  entregaPrevista: string;
  lojaId: string;
  status: PedidoStatus;
  itens: PedidoItem[];
};

const hoje = new Date();
const d = (offset: number) => format(addDays(hoje, offset), "yyyy-MM-dd");

export const pedidos: Pedido[] = [
  {
    numero: "PC-884210",
    emissao: d(-6),
    entregaPrevista: d(3),
    lojaId: "01",
    status: "Aberto",
    itens: [
      { sku: "10010", quantidadePedida: 480, quantidadeFaturada: 0, precoUnitario: 12.4 },
      { sku: "10020", quantidadePedida: 720, quantidadeFaturada: 0, precoUnitario: 8.1 },
    ],
  },
  {
    numero: "PC-884198",
    emissao: d(-14),
    entregaPrevista: d(-4),
    lojaId: "05",
    status: "Faturado",
    itens: [
      { sku: "10010", quantidadePedida: 600, quantidadeFaturada: 600, precoUnitario: 12.25 },
      { sku: "10030", quantidadePedida: 1200, quantidadeFaturada: 1200, precoUnitario: 4.05 },
    ],
  },
  {
    numero: "PC-884176",
    emissao: d(-21),
    entregaPrevista: d(-2),
    lojaId: "12",
    status: "Pendente",
    itens: [
      { sku: "10020", quantidadePedida: 960, quantidadeFaturada: 360, precoUnitario: 8.2 },
      { sku: "10030", quantidadePedida: 840, quantidadeFaturada: 0, precoUnitario: 4.12 },
    ],
  },
  {
    numero: "PC-884140",
    emissao: d(-30),
    entregaPrevista: d(-18),
    lojaId: "01",
    status: "Cancelado",
    itens: [{ sku: "10010", quantidadePedida: 240, quantidadeFaturada: 0, precoUnitario: 12.6 }],
  },
];

export const totalPedido = (pedido: Pedido) =>
  pedido.itens.reduce((acc, item) => acc + item.quantidadePedida * item.precoUnitario, 0);

export type VendaItem = {
  data: string;
  lojaId: string;
  sku: string;
  quantidade: number;
  valorUnitario: number;
};

function gerarVendas(): VendaItem[] {
  const rows: VendaItem[] = [];
  for (let dia = 45; dia >= 0; dia--) {
    for (const loja of lojas) {
      for (const produto of produtos) {
        const base = produto.sku === "10030" ? 46 : produto.sku === "10020" ? 28 : 19;
        const variacao = ((dia * 7 + Number(loja.id) * 13 + Number(produto.sku)) % 17) - 6;
        const quantidade = Math.max(3, base + variacao);
        const ajuste = ((dia + Number(loja.id)) % 5) * 0.07;
        rows.push({
          data: d(-dia),
          lojaId: loja.id,
          sku: produto.sku,
          quantidade,
          valorUnitario: Number((produto.precoTabela + ajuste).toFixed(2)),
        });
      }
    }
  }
  return rows;
}

export const vendas: VendaItem[] = gerarVendas();

export const vendasMensais = Array.from({ length: 6 }, (_, i) => {
  const mes = subMonths(hoje, 5 - i);
  const fator = 1 + i * 0.08;
  return {
    mes: format(mes, "MMM/yy"),
    faturamento: Number((418000 * fator).toFixed(2)),
    volume: Math.round(31500 * fator),
  };
});

export type EstoqueLinha = { sku: string; lojaId: string; estoqueMinimo: number; estoqueAtual: number };

export const estoque: EstoqueLinha[] = [
  { sku: "10010", lojaId: "01", estoqueMinimo: 120, estoqueAtual: 0 },
  { sku: "10010", lojaId: "05", estoqueMinimo: 120, estoqueAtual: 96 },
  { sku: "10010", lojaId: "12", estoqueMinimo: 100, estoqueAtual: 340 },
  { sku: "10020", lojaId: "01", estoqueMinimo: 180, estoqueAtual: 420 },
  { sku: "10020", lojaId: "05", estoqueMinimo: 180, estoqueAtual: 150 },
  { sku: "10020", lojaId: "12", estoqueMinimo: 160, estoqueAtual: 0 },
  { sku: "10030", lojaId: "01", estoqueMinimo: 240, estoqueAtual: 610 },
  { sku: "10030", lojaId: "05", estoqueMinimo: 240, estoqueAtual: 238 },
  { sku: "10030", lojaId: "12", estoqueMinimo: 220, estoqueAtual: 705 },
];

export type StatusEstoque = "Ruptura" | "Atenção" | "Confortável";

export const statusEstoque = (linha: EstoqueLinha): StatusEstoque => {
  if (linha.estoqueAtual === 0) return "Ruptura";
  if (linha.estoqueAtual <= linha.estoqueMinimo) return "Atenção";
  return "Confortável";
};

export type Fatura = {
  id: string;
  numeroNota: string;
  emissao: string;
  vencimento: string;
  valor: number;
  status: "A vencer" | "Pago";
  lojaId: string;
};

export const faturas: Fatura[] = [
  { id: "FAT-9001", numeroNota: "NF 118420", emissao: d(-8), vencimento: d(1), valor: 124500, status: "A vencer", lojaId: "01" },
  { id: "FAT-9002", numeroNota: "NF 118455", emissao: d(-5), vencimento: d(12), valor: 86300.5, status: "A vencer", lojaId: "05" },
  { id: "FAT-9003", numeroNota: "NF 118477", emissao: d(-3), vencimento: d(27), valor: 152980.75, status: "A vencer", lojaId: "12" },
  { id: "FAT-9004", numeroNota: "NF 118501", emissao: d(-1), vencimento: d(44), valor: 64210.3, status: "A vencer", lojaId: "01" },
  { id: "FAT-8971", numeroNota: "NF 118330", emissao: d(-40), vencimento: d(-12), valor: 98750, status: "Pago", lojaId: "05" },
  { id: "FAT-8962", numeroNota: "NF 118298", emissao: d(-52), vencimento: d(-24), valor: 111230.4, status: "Pago", lojaId: "12" },
];

export type Agendamento = {
  id: string;
  chaveNfe: string;
  lojaId: string;
  data: string;
  horario: string;
  status: "Confirmado" | "Aguardando agendamento";
};

export const horariosDisponiveis = ["07:00", "08:30", "10:00", "11:30", "13:30", "15:00", "16:30"];

export const agendamentos: Agendamento[] = [
  {
    id: "AG-2201",
    chaveNfe: "15250860409075000152550010001184200019584127",
    lojaId: "01",
    data: d(2),
    horario: "08:30",
    status: "Confirmado",
  },
  {
    id: "AG-2202",
    chaveNfe: "15250860409075000152550010001184550019584231",
    lojaId: "05",
    data: d(5),
    horario: "13:30",
    status: "Confirmado",
  },
];

export const notasAguardandoAgendamento = [
  { numeroNota: "NF 118477", chaveNfe: "15250860409075000152550010001184770019584399", lojaId: "12" },
  { numeroNota: "NF 118501", chaveNfe: "15250860409075000152550010001185010019584512", lojaId: "01" },
];

export const TAXA_ANTECIPACAO_MENSAL = 0.018;
