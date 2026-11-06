import { addDays, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { lojaForaDoPortalFornecedor } from "@/lib/lojas-excluidas-portal";
import {
  all_produtos,
  createDynamicArrayProxy,
  getActiveSupplierCode,
  globalDbCache,
  lojas,
  produtos,
  type VendaMensal,
} from "./mock-data-catalog";

export type PedidoStatus = "Aberto" | "Faturado" | "Pendente" | "Entregue" | "Cancelado";
export type PedidoDestino = "Fornecedor" | "CDAM";

export type PedidoAgenda = {
  contexto: "Compras/Recebimento" | "Transferencia/CDAM";
  agendaEntrada: string;
  agendaParidade: string;
  regra: string;
};

export type PedidoItem = {
  sku: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  precoUnitario: number;
};

export type Pedido = {
  numero: string;
  destino: PedidoDestino;
  origemOperacional: string;
  destinoOperacional: string;
  agenda: PedidoAgenda;
  emissao: string;
  entregaPrevista: string;
  entradaCdam?: string;
  lojaId: string;
  status: PedidoStatus;
  totLiq?: number;
  itens: PedidoItem[];
};

const hoje = new Date();
export const d = (offset: number) => format(addDays(hoje, offset), "yyyy-MM-dd");

const all_pedidos: Pedido[] = [
  {
    numero: "PC-884210",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra:
        "Pedido emitido diretamente ao fornecedor; a entrada fiscal ocorre por agenda de compra/recebimento.",
    },
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
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra:
        "Pedido faturado pelo fornecedor contra filial/loja; deve alimentar recebimento e financeiro do fornecedor.",
    },
    emissao: d(-14),
    entregaPrevista: d(-4),
    entradaCdam: d(-5),
    lojaId: "05",
    status: "Entregue",
    itens: [
      { sku: "10010", quantidadePedida: 600, quantidadeFaturada: 600, precoUnitario: 12.25 },
      { sku: "10030", quantidadePedida: 1200, quantidadeFaturada: 1200, precoUnitario: 4.05 },
    ],
  },
  {
    numero: "PC-884176",
    destino: "CDAM",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Transferencia/CDAM",
      agendaEntrada: "66",
      agendaParidade: "65 / 148",
      regra:
        "Pedido abastece o deposito central; depois pode gerar transito/transferencia para lojas, sem tratar como venda direta da loja.",
    },
    emissao: d(-21),
    entregaPrevista: d(-2),
    entradaCdam: d(-10),
    lojaId: "12",
    status: "Entregue",
    itens: [
      { sku: "10020", quantidadePedida: 960, quantidadeFaturada: 360, precoUnitario: 8.2 },
      { sku: "10030", quantidadePedida: 840, quantidadeFaturada: 0, precoUnitario: 4.12 },
    ],
  },
  {
    numero: "PC-884166",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido direto ao fornecedor com entrega fisica registrada no CDAM.",
    },
    emissao: d(-24),
    entregaPrevista: d(-14),
    entradaCdam: d(-16),
    lojaId: "13",
    status: "Entregue",
    itens: [
      { sku: "10010", quantidadePedida: 520, quantidadeFaturada: 500, precoUnitario: 12.18 },
      { sku: "10020", quantidadePedida: 480, quantidadeFaturada: 480, precoUnitario: 8.05 },
    ],
  },
  {
    numero: "PC-884155",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra:
        "Pedido direto ao fornecedor com entrada no deposito central para abastecimento posterior.",
    },
    emissao: d(-31),
    entregaPrevista: d(-21),
    entradaCdam: d(-23),
    lojaId: "13",
    status: "Entregue",
    itens: [
      { sku: "10030", quantidadePedida: 1800, quantidadeFaturada: 1720, precoUnitario: 4.01 },
    ],
  },
  {
    numero: "PC-884149",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido direto ao fornecedor entregue no CDAM e elegivel para SLA logistico.",
    },
    emissao: d(-38),
    entregaPrevista: d(-29),
    entradaCdam: d(-30),
    lojaId: "13",
    status: "Entregue",
    itens: [{ sku: "10020", quantidadePedida: 900, quantidadeFaturada: 900, precoUnitario: 8.08 }],
  },
  {
    numero: "PC-884140",
    destino: "CDAM",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Transferencia/CDAM",
      agendaEntrada: "66",
      agendaParidade: "65 / 148",
      regra:
        "Pedido cancelado para o deposito central; manter separado dos pedidos diretos ao fornecedor para nao contaminar reposicao loja.",
    },
    emissao: d(-30),
    entregaPrevista: d(-18),
    lojaId: "01",
    status: "Cancelado",
    itens: [{ sku: "10010", quantidadePedida: 240, quantidadeFaturada: 0, precoUnitario: 12.6 }],
  },
  // Pedidos BTD Distribuidora (704894)
  {
    numero: "PC-990010",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido emitido diretamente ao fornecedor BTD.",
    },
    emissao: d(-5),
    entregaPrevista: d(2),
    lojaId: "01",
    status: "Aberto",
    itens: [
      { sku: "4244", quantidadePedida: 500, quantidadeFaturada: 0, precoUnitario: 25.54 },
      { sku: "1017", quantidadePedida: 300, quantidadeFaturada: 0, precoUnitario: 33.46 },
    ],
  },
  {
    numero: "PC-990020",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado por BTD.",
    },
    emissao: d(-12),
    entregaPrevista: d(-2),
    entradaCdam: d(-3),
    lojaId: "12",
    status: "Entregue",
    itens: [
      { sku: "3213", quantidadePedida: 1000, quantidadeFaturada: 1000, precoUnitario: 31.93 },
      { sku: "37", quantidadePedida: 1500, quantidadeFaturada: 1450, precoUnitario: 32.51 },
    ],
  },
  {
    numero: "PC-1123713",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Consul.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [{ sku: "3184972", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 1649.0 }],
  },
  {
    numero: "PC-1126056",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Panasonic.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [{ sku: "3127566", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 4189.0 }],
  },
  {
    numero: "PC-1126062",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Esmaltec.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [{ sku: "3041877", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 979.0 }],
  },
  {
    numero: "PC-1124390",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Panasonic e Consul.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [
      { sku: "3033157", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 1599.0 },
      { sku: "3072750", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 2959.0 },
    ],
  },
  {
    numero: "PC-1123557",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido em aberto pendente de faturamento pela Dako.",
    },
    emissao: d(-6),
    entregaPrevista: d(4),
    lojaId: "35",
    status: "Aberto",
    itens: [{ sku: "3187843", quantidadePedida: 1, quantidadeFaturada: 0, precoUnitario: 1989.0 }],
  },
  {
    numero: "PC-1123560",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido em aberto pendente de faturamento pela Atlas.",
    },
    emissao: d(-6),
    entregaPrevista: d(4),
    lojaId: "35",
    status: "Aberto",
    itens: [{ sku: "3151113", quantidadePedida: 1, quantidadeFaturada: 0, precoUnitario: 1439.0 }],
  },
  {
    numero: "PC-1124470",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Panasonic.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "78",
    status: "Entregue",
    itens: [{ sku: "3072752", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 2669.0 }],
  },
  {
    numero: "PC-1126818",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Brastemp.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [{ sku: "219992", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 1099.0 }],
  },
  {
    numero: "PC-1124432",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Clarice.",
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "60",
    status: "Entregue",
    itens: [{ sku: "3245593", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 569.0 }],
  },
  {
    numero: "PC-1124172",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido em aberto pendente de faturamento pela Clarice.",
    },
    emissao: d(-6),
    entregaPrevista: d(4),
    lojaId: "60",
    status: "Aberto",
    itens: [{ sku: "3245593", quantidadePedida: 1, quantidadeFaturada: 0, precoUnitario: 569.0 }],
  },
];

export const pedidos = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.pedidos
    ? globalDbCache.pedidos.filter((p) => !lojaForaDoPortalFornecedor(p.lojaId))
    : all_pedidos.map((p) => ({
        ...p,
        numero: p.numero.startsWith("PC-") ? p.numero.substring(3) : p.numero,
      }));
  return fonte
    .map((p) => ({
      ...p,
      itens: p.itens.filter((item: Pedido["itens"][number]) => activeSkus.has(item.sku)),
    }))
    .filter((p) => p.itens.length > 0 && !lojaForaDoPortalFornecedor(p.lojaId));
});

export const totalPedido = (pedido: Pedido) =>
  pedido.totLiq !== undefined && pedido.totLiq > 0
    ? pedido.totLiq
    : pedido.itens.reduce((acc, item) => acc + item.quantidadePedida * item.precoUnitario, 0);

export const quantidadesPedido = (pedido: Pedido) =>
  pedido.itens.reduce(
    (acc, item) => ({
      pedida: acc.pedida + item.quantidadePedida,
      faturada: acc.faturada + item.quantidadeFaturada,
    }),
    { pedida: 0, faturada: 0 },
  );

export const fillRatePedido = (pedido: Pedido) => {
  const totais = quantidadesPedido(pedido);
  if (totais.pedida <= 0) return 0;
  return (totais.faturada / totais.pedida) * 100;
};

export const fillRateGeral = (lista: Pedido[]) => {
  const totais = lista
    .filter((pedido) => pedido.status !== "Cancelado")
    .reduce(
      (acc, pedido) => {
        const atual = quantidadesPedido(pedido);
        return {
          pedida: acc.pedida + atual.pedida,
          faturada: acc.faturada + atual.faturada,
        };
      },
      { pedida: 0, faturada: 0 },
    );
  if (totais.pedida <= 0) return 0;
  return (totais.faturada / totais.pedida) * 100;
};

const diasEntre = (inicio: string, fim: string) => {
  const inicioMs = new Date(`${inicio}T12:00:00`).getTime();
  const fimMs = new Date(`${fim}T12:00:00`).getTime();
  return Math.max(0, Math.round((fimMs - inicioMs) / 86400000));
};

export const leadTimeEntregaCdam = (pedido: Pedido) =>
  pedido.entradaCdam ? diasEntre(pedido.emissao, pedido.entradaCdam) : null;

export const ultimosPedidosEntreguesCdam = (lista: Pedido[], limite = 5) =>
  lista
    .filter((pedido) => pedido.status === "Entregue" && pedido.entradaCdam)
    .sort((a, b) => (b.entradaCdam ?? "").localeCompare(a.entradaCdam ?? ""))
    .slice(0, limite);

export const tempoMedioEntregaCdam = (lista: Pedido[], limite = 5) => {
  const entregues = ultimosPedidosEntreguesCdam(lista, limite);
  if (entregues.length === 0) return null;
  const total = entregues.reduce((acc, pedido) => acc + (leadTimeEntregaCdam(pedido) ?? 0), 0);
  return total / entregues.length;
};

export type VendaItem = {
  data: string;
  lojaId: string;
  sku: string;
  quantidade: number;
  valorUnitario: number;
};

function gerarVendas(): VendaItem[] {
  const rows: VendaItem[] = [];
  for (let dia = 89; dia >= 0; dia--) {
    for (const loja of lojas) {
      for (const produto of all_produtos) {
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

const all_vendas: VendaItem[] = gerarVendas();

export const vendas = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.vendas
    ? globalDbCache.vendas
    : all_vendas.filter((v) => activeSkus.has(v.sku));
  return fonte.filter((v) => activeSkus.has(v.sku) && !lojaForaDoPortalFornecedor(v.lojaId));
});

const all_vendasMensais = (code: string) => {
  const faturamento = code === "704894" ? 2070000 : 418000;
  const volume = code === "704894" ? 150000 : 31500;
  return Array.from({ length: 12 }, (_, i) => {
    const mes = subMonths(hoje, 11 - i);
    const fator = 1 + i * 0.08;
    return {
      mes: format(mes, "MMM/yy", { locale: ptBR }),
      faturamento: Number((faturamento * fator).toFixed(2)),
      volume: Math.round(volume * fator),
    };
  });
};

export const vendasMensais = new Proxy([], {
  get(target, prop) {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      const value = Reflect.get(list, prop);
      if (typeof value === "function") {
        return value.bind(list);
      }
      return value;
    }
    const list = all_vendasMensais(getActiveSupplierCode());
    const value = Reflect.get(list, prop);
    if (typeof value === "function") {
      return value.bind(list);
    }
    return value;
  },
  getOwnPropertyDescriptor(target, prop) {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      return Reflect.getOwnPropertyDescriptor(list, prop);
    }
    const list = all_vendasMensais(getActiveSupplierCode());
    return Reflect.getOwnPropertyDescriptor(list, prop);
  },
  ownKeys() {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      return Reflect.ownKeys(list);
    }
    const list = all_vendasMensais(getActiveSupplierCode());
    return Reflect.ownKeys(list);
  },
}) as VendaMensal[];
