import { Navigate, createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  ArrowLeft,
  Moon,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  Filter,
  MessageCircle,
  Menu,
  Mic,
  Paperclip,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Square,
  Sparkles,
  Tag,
  Type,
  UserRound,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { fetchUsuariosFornecedor, fetchUsuariosInternos } from "@/api";
import { usePortal } from "@/context/portal-context";

type Mensagem = {
  id: string;
  autor: "lider" | "fornecedor";
  texto: string;
  data: string;
  lida?: boolean;
  anexo?: {
    id: string;
    tipo: "imagem" | "audio";
    nome: string;
    url?: string;
  };
};

type Conversa = {
  id: string;
  assunto: string;
  participante: string;
  categoria: string;
  resumo: string;
  status: "aberta" | "aguardando";
  atualizadaEm: string;
  naoLidas: number;
  contexto?: string;
  mensagens: Mensagem[];
  ordem: number;
};

type Aviso = {
  id: string;
  titulo: string;
  descricao: string;
  data: string;
  prioridade: "alta" | "normal";
  ordem: number;
};

type MonitoramentoAtlas = {
  id: string;
  titulo: string;
  descricao: string;
  situacao: string;
  prioridade: "alta" | "normal";
  ordem: number;
};

type ContatoAppCom = {
  id: string;
  nome: string;
  funcao: string;
};

const BANCO_MIDIAS_APPCOM = "appcom-lider-midias";
const LOJA_MIDIAS_APPCOM = "anexos";

function abrirBancoMidias() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const pedido = window.indexedDB.open(BANCO_MIDIAS_APPCOM, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(LOJA_MIDIAS_APPCOM)) {
        pedido.result.createObjectStore(LOJA_MIDIAS_APPCOM);
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function salvarMidia(id: string, midia: Blob) {
  const banco = await abrirBancoMidias();
  await new Promise<void>((resolve, reject) => {
    const transacao = banco.transaction(LOJA_MIDIAS_APPCOM, "readwrite");
    transacao.objectStore(LOJA_MIDIAS_APPCOM).put(midia, id);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
  banco.close();
}

async function carregarMidia(id: string) {
  const banco = await abrirBancoMidias();
  const midia = await new Promise<Blob | undefined>((resolve, reject) => {
    const pedido = banco
      .transaction(LOJA_MIDIAS_APPCOM, "readonly")
      .objectStore(LOJA_MIDIAS_APPCOM)
      .get(id);
    pedido.onsuccess = () => resolve(pedido.result as Blob | undefined);
    pedido.onerror = () => reject(pedido.error);
  });
  banco.close();
  return midia;
}

const contatosIniciais = [
  { id: "marina-souza", nome: "Marina Souza", funcao: "Compradora · Mercearia" },
  { id: "compras-lider", nome: "Compras Grupo Líder", funcao: "Equipe de compras" },
  { id: "cadastro-produtos", nome: "Cadastro de Produtos", funcao: "Grupo Líder" },
];

const avisosIniciais: Aviso[] = [
  {
    id: "vencimento-aurora",
    titulo: "Risco de vencimento identificado",
    descricao: "Atlas encontrou estoque com giro abaixo da validade. Avalie criar uma campanha.",
    data: "Hoje, 10:15",
    prioridade: "alta",
    ordem: 4,
  },
  {
    id: "proposta-recebida",
    titulo: "Proposta aguardando sua resposta",
    descricao: "Há uma proposta comercial vinculada à campanha de inverno.",
    data: "Ontem, 16:18",
    prioridade: "normal",
    ordem: 3,
  },
];

const monitoramentosAtlas: MonitoramentoAtlas[] = [
  {
    id: "atlas-vencimento-aurora",
    titulo: "Estoque próximo ao vencimento",
    descricao:
      "O giro atual não escoa o estoque antes da validade. Uma campanha pode reduzir a perda.",
    situacao: "Requer ação comercial",
    prioridade: "alta",
    ordem: 8,
  },
  {
    id: "atlas-campanha-inverno",
    titulo: "Campanha de inverno em acompanhamento",
    descricao:
      "A proposta foi encaminhada ao comprador. O Atlas acompanha venda média, estoque e adesão.",
    situacao: "Ação em curso",
    prioridade: "normal",
    ordem: 7,
  },
  {
    id: "atlas-crescimento-farol",
    titulo: "Crescimento abaixo do Farol",
    descricao: "O crescimento anual do fornecedor está abaixo da referência da categoria.",
    situacao: "Oportunidade de campanha",
    prioridade: "normal",
    ordem: 6,
  },
  {
    id: "atlas-ruptura",
    titulo: "Possível ruptura em itens de maior giro",
    descricao: "A cobertura estimada está abaixo do prazo de reposição para parte do sortimento.",
    situacao: "Validar disponibilidade",
    prioridade: "alta",
    ordem: 5,
  },
];

const IDS_CONVERSAS_DEMONSTRATIVAS = new Set([
  "pedido-2026-091",
  "campanha-inverno",
  "cadastro-produto",
]);

export const Route = createFileRoute("/comunicacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AppCom Líder | Grupo Líder" },
      {
        name: "description",
        content: "Aplicativo AppCom de comunicação entre o Grupo Líder e seus fornecedores.",
      },
    ],
    links: [{ rel: "manifest", href: "/comunicacao/manifest.webmanifest" }],
  }),
  component: ComunicacaoPage,
});

function ComunicacaoPage() {
  const { autenticado, carregandoSessao, fornecedor, sair, usuarioFornecedor, usuarioInterno } = usePortal();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [avisos, setAvisos] = useState(avisosIniciais);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  const [avisoSelecionado, setAvisoSelecionado] = useState<string | null>(null);
  const [monitoramentoSelecionado, setMonitoramentoSelecionado] = useState<string | null>(null);
  const [filtroEntrada, setFiltroEntrada] = useState<"todos" | "avisos" | "conversas" | "atlas">(
    "todos",
  );
  const [busca, setBusca] = useState("");
  const [buscaDestinatario, setBuscaDestinatario] = useState("");
  const [contatos, setContatos] = useState<ContatoAppCom[]>([]);
  const [filtro, setFiltro] = useState<"todas" | "aberta" | "aguardando">("todas");
  const [texto, setTexto] = useState("");
  const campoMensagemRef = useRef<HTMLTextAreaElement>(null);
  const campoImagemRef = useRef<HTMLInputElement>(null);
  const historicoRef = useRef<HTMLDivElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const partesAudioRef = useRef<Blob[]>([]);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [instalavel, setInstalavel] = useState<Event | null>(null);
  const [notificacao, setNotificacao] = useState<NotificationPermission | "indisponivel">(
    "default",
  );
  const [copiado, setCopiado] = useState(false);
  const [dispositivoMovel, setDispositivoMovel] = useState(false);
  const [instaladoComoApp, setInstaladoComoApp] = useState(false);
  const [configuracoesAbertas, setConfiguracoesAbertas] = useState(false);
  const [preferenciasNotificacao, setPreferenciasNotificacao] = useState(() => {
    if (typeof window === "undefined") return { conversas: true, avisos: true };
    try {
      const salvo = JSON.parse(window.localStorage.getItem("appcom-notificacoes") ?? "{}");
      return { conversas: salvo.conversas !== false, avisos: salvo.avisos !== false };
    } catch {
      return { conversas: true, avisos: true };
    }
  });
  const [modoEscuro, setModoEscuro] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("appcom-tema") === "escuro",
  );
  const [tamanhoTexto, setTamanhoTexto] = useState<"padrao" | "grande" | "muito-grande">(() => {
    if (typeof window === "undefined") return "padrao";
    const salvo = window.localStorage.getItem("appcom-tamanho-texto");
    return salvo === "grande" || salvo === "muito-grande" ? salvo : "padrao";
  });

  const comunicacaoUrl = "https://appcom.intelider.com.br";
  const qrUrl =
    "https://quickchart.io/qr?size=280&margin=2&text=" + encodeURIComponent(comunicacaoUrl);
  const ativa = conversas.find((conversa) => conversa.id === conversaAtiva) ?? conversas[0];

  useEffect(() => {
    if (!autenticado) {
      setContatos([]);
      return;
    }
    let ativo = true;
    async function carregarContatos() {
      try {
        if (usuarioFornecedor) {
          const usuarios = await fetchUsuariosFornecedor({ data: fornecedor.codigo });
          const lista = usuarios.filter((usuario) => usuario.ativo === 1 && usuario.email !== usuarioFornecedor.email).map((usuario) => ({ id: usuario.id, nome: usuario.nome, funcao: "Usuário do fornecedor" }));
          if (ativo) setContatos(lista);
          return;
        }
        if (usuarioInterno) {
          const usuarios = await fetchUsuariosInternos();
          const lista = usuarios
            .filter((usuario) => usuario.username !== usuarioInterno.username)
            .map((usuario) => ({ id: usuario.username, nome: usuario.nome, funcao: usuario.role }));
          if (ativo) setContatos(lista);
        }
      } catch (erro) {
        console.error("Não foi possível carregar os contatos do AppCom.", erro);
        if (ativo) setContatos([]);
      }
    }
    void carregarContatos();
    return () => { ativo = false; };
  }, [autenticado, fornecedor.codigo, usuarioFornecedor?.email, usuarioInterno?.username]);
  const identidadeAppCom =
    usuarioFornecedor ??
    (usuarioInterno
      ? { nome: usuarioInterno.nome, email: "Grupo Lider - " + usuarioInterno.role }
      : null);


  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((conversa) => {
      const correspondeFiltro = filtro === "todas" || conversa.status === filtro;
      const correspondeBusca =
        !termo ||
        [conversa.assunto, conversa.categoria, conversa.resumo].some((valor) =>
          valor.toLowerCase().includes(termo),
        );
      return correspondeFiltro && correspondeBusca;
    });
  }, [busca, conversas, filtro]);

  const entradas = useMemo(() => {
    const itens = [
      ...avisos.map((aviso) => ({ tipo: "aviso" as const, ordem: aviso.ordem, aviso })),
      ...monitoramentosAtlas.map((monitoramento) => ({
        tipo: "atlas" as const,
        ordem: monitoramento.ordem,
        monitoramento,
      })),
      ...conversasFiltradas.map((conversa) => ({
        tipo: "conversa" as const,
        ordem: conversa.ordem,
        conversa,
      })),
    ];
    return itens
      .filter(
        (item) =>
          (filtroEntrada === "todos" && item.tipo !== "atlas") ||
          (filtroEntrada === "atlas"
            ? item.tipo === "atlas"
            : filtroEntrada === "avisos"
              ? item.tipo === "aviso"
              : item.tipo === "conversa"),
      )
      .sort((a, b) => b.ordem - a.ordem);
  }, [avisos, conversasFiltradas, filtroEntrada]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/appcom-sw.js", { scope: "/" });
    }
    const mobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    setDispositivoMovel(mobile);
    setInstaladoComoApp(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstalavel(event);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("appcom-notificacoes", JSON.stringify(preferenciasNotificacao));
  }, [preferenciasNotificacao]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("appcom-tema", modoEscuro ? "escuro" : "claro");
  }, [modoEscuro]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tamanho = {
      padrao: "16px",
      grande: "18px",
      "muito-grande": "20px",
    }[tamanhoTexto];
    const anterior = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = tamanho;
    window.localStorage.setItem("appcom-tamanho-texto", tamanhoTexto);
    return () => {
      document.documentElement.style.fontSize = anterior;
    };
  }, [tamanhoTexto]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const carregarHistorico = async () => {
      const salvo = window.localStorage.getItem("comunicacao-lider-conversas");
      if (salvo) {
        try {
          const restauradas = (JSON.parse(salvo) as Conversa[]).filter(
            (conversa) => !IDS_CONVERSAS_DEMONSTRATIVAS.has(conversa.id),
          );
          const comMidias = await Promise.all(
            restauradas.map(async (conversa) => ({
              ...conversa,
              mensagens: await Promise.all(
                conversa.mensagens.map(async (mensagem) => {
                  if (!mensagem.anexo) return mensagem;
                  const id = mensagem.anexo.id || `midia-legada-${conversa.id}-${mensagem.id}`;
                  let midia = await carregarMidia(id).catch(() => undefined);
                  if (!midia && mensagem.anexo.url?.startsWith("data:")) {
                    midia = await fetch(mensagem.anexo.url).then((resposta) => resposta.blob());
                    await salvarMidia(id, midia);
                  }
                  return midia
                    ? {
                        ...mensagem,
                        anexo: { ...mensagem.anexo, id, url: URL.createObjectURL(midia) },
                      }
                    : { ...mensagem, anexo: { ...mensagem.anexo, id } };
                }),
              ),
            })),
          );
          setConversas(comMidias);
        } catch {
          window.localStorage.removeItem("comunicacao-lider-conversas");
        }
      }
      setHistoricoCarregado(true);
    };
    void carregarHistorico();
    if (!("Notification" in window)) {
      setNotificacao("indisponivel");
    } else {
      setNotificacao(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!historicoCarregado || typeof window === "undefined") return;
    const paraSalvar = conversas.map((conversa) => ({
      ...conversa,
      mensagens: conversa.mensagens.map((mensagem) =>
        mensagem.anexo
          ? {
              ...mensagem,
              anexo: {
                id: mensagem.anexo.id,
                tipo: mensagem.anexo.tipo,
                nome: mensagem.anexo.nome,
              },
            }
          : mensagem,
      ),
    }));
    window.localStorage.setItem("comunicacao-lider-conversas", JSON.stringify(paraSalvar));
  }, [conversas, historicoCarregado]);

  useEffect(() => {
    if (!conversaAtiva) return;
    const quadro = window.requestAnimationFrame(() => {
      historicoRef.current?.scrollTo({
        top: historicoRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [conversaAtiva, conversas]);

  async function instalar() {
    const prompt = instalavel as (Event & { prompt?: () => Promise<void> }) | null;
    if (prompt?.prompt) {
      await prompt.prompt();
      setInstalavel(null);
    }
  }

  async function pedirNotificacao() {
    if (!("Notification" in window)) {
      setNotificacao("indisponivel");
      return;
    }
    setNotificacao(await Notification.requestPermission());
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(comunicacaoUrl);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  }

  function alternarFiltro(filtro: "avisos" | "conversas" | "atlas") {
    setConversaAtiva(null);
    setAvisoSelecionado(null);
    setMonitoramentoSelecionado(null);
    setFiltroEntrada((atual) => (atual === filtro ? "todos" : filtro));
  }

  const contatosEncontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return contatos.filter((contato) =>
      [contato.nome, contato.funcao].some((valor) => valor.toLowerCase().includes(termo)),
    );
  }, [busca, contatos]);

  const destinatariosSugeridos = useMemo(() => {
    const termo = buscaDestinatario.trim().toLowerCase();
    if (!termo) return contatos.slice(0, 2);
    return contatos.filter((contato) =>
      [contato.nome, contato.funcao].some((valor) => valor.toLowerCase().includes(termo)),
    );
  }, [buscaDestinatario, contatos]);

  function iniciarConversa(contato: ContatoAppCom) {
    const existente = conversas.find((conversa) => conversa.participante === contato.nome);
    if (existente) {
      setConversaAtiva(existente.id);
      return;
    }
    const id = `nova-${Date.now()}`;
    setConversas((atuais) => [
      {
        id,
        participante: contato.nome,
        assunto: "Nova conversa",
        categoria: "Conversa",
        resumo: "Conversa iniciada. Escreva a primeira mensagem.",
        status: "aberta",
        atualizadaEm: "Agora",
        naoLidas: 0,
        contexto: contato.funcao,
        mensagens: [],
        ordem: Date.now(),
      },
      ...atuais,
    ]);
    setBusca("");
    setFiltroEntrada("todos");
    setConversaAtiva(id);
  }

  function iniciarConversaPorAviso(aviso: Aviso, contato: ContatoAppCom) {
    const id = `aviso-${aviso.id}-${Date.now()}`;
    setConversas((atuais) => [
      {
        id,
        participante: contato.nome,
        assunto: aviso.titulo,
        categoria: "Aviso",
        resumo: "Conversa iniciada a partir de um aviso do AppCom.",
        status: "aguardando",
        atualizadaEm: "Agora",
        naoLidas: 0,
        contexto: "Aviso tratado",
        ordem: Date.now(),
        mensagens: [
          {
            id: `mensagem-${id}`,
            autor: "lider",
            texto: aviso.descricao,
            data: "Agora",
          },
        ],
      },
      ...atuais,
    ]);
    setAvisos((atuais) => atuais.filter((item) => item.id !== aviso.id));
    setAvisoSelecionado(null);
    setFiltroEntrada("todos");
    setConversaAtiva(id);
  }

  function encaminharMonitoramento(
    monitoramento: MonitoramentoAtlas,
    contato: ContatoAppCom,
  ) {
    const id = `atlas-${monitoramento.id}-${Date.now()}`;
    setConversas((atuais) => [
      {
        id,
        participante: contato.nome,
        assunto: monitoramento.titulo,
        categoria: "Atlas",
        resumo: "Monitoramento do Atlas encaminhado para avaliação.",
        status: "aguardando",
        atualizadaEm: "Agora",
        naoLidas: 0,
        contexto: monitoramento.situacao,
        ordem: Date.now(),
        mensagens: [
          {
            id: `mensagem-${id}`,
            autor: "lider",
            texto: `Atlas identificou: ${monitoramento.descricao}`,
            data: "Agora",
          },
        ],
      },
      ...atuais,
    ]);
    setMonitoramentoSelecionado(null);
    setFiltroEntrada("todos");
    setConversaAtiva(id);
  }

  function enviarAnexo(anexo: NonNullable<Mensagem["anexo"]>) {
    if (!ativa) return;
    const novaMensagem: Mensagem = {
      id: "anexo-" + Date.now(),
      autor: "fornecedor",
      texto: anexo.tipo === "imagem" ? "Imagem enviada" : "Mensagem de áudio",
      data: "Agora",
      anexo,
    };
    setConversas((atuais) =>
      atuais.map((conversa) =>
        conversa.id === ativa.id
          ? {
              ...conversa,
              status: "aguardando",
              atualizadaEm: "Agora",
              mensagens: [...conversa.mensagens, novaMensagem],
              ordem: Date.now(),
            }
          : conversa,
      ),
    );
  }

  function enviarImagem(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string") {
        const id = `imagem-${Date.now()}`;
        void salvarMidia(id, arquivo).then(() =>
          enviarAnexo({ id, tipo: "imagem", nome: arquivo.name, url: leitor.result }),
        );
      }
    };
    leitor.readAsDataURL(arquivo);
  }

  async function iniciarGravacaoAudio() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      window.alert("A gravação de áudio não é compatível com este navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(stream);
      partesAudioRef.current = [];
      gravador.ondataavailable = (event) => {
        if (event.data.size > 0) partesAudioRef.current.push(event.data);
      };
      gravador.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(partesAudioRef.current, { type: gravador.mimeType || "audio/webm" });
        if (audio.size === 0) return;
        const leitor = new FileReader();
        leitor.onload = () => {
          if (typeof leitor.result === "string") {
            const id = `audio-${Date.now()}`;
            void salvarMidia(id, audio).then(() =>
              enviarAnexo({ id, tipo: "audio", nome: "audio.webm", url: leitor.result }),
            );
          }
        };
        leitor.readAsDataURL(audio);
      };
      gravador.start();
      gravadorRef.current = gravador;
      setGravandoAudio(true);
    } catch {
      window.alert("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function pararGravacaoAudio() {
    gravadorRef.current?.stop();
    gravadorRef.current = null;
    setGravandoAudio(false);
  }

  function enviarMensagem() {
    const valor = texto.trim();
    if (!valor || !ativa) return;
    const novaMensagem: Mensagem = {
      id: "local-" + Date.now(),
      autor: "fornecedor",
      texto: valor,
      data: "Agora",
    };
    setConversas((atuais) =>
      atuais.map((conversa) =>
        conversa.id === ativa.id
          ? {
              ...conversa,
              status: "aguardando",
              atualizadaEm: "Agora",
              mensagens: [...conversa.mensagens, novaMensagem],
              ordem: Date.now(),
            }
          : conversa,
      ),
    );
    setTexto("");
    if (campoMensagemRef.current) {
      campoMensagemRef.current.style.height = "auto";
    }
  }

  if (carregandoSessao) {
    return <main className="min-h-screen bg-background" />;
  }

  if (!autenticado || !identidadeAppCom) {
    return <Navigate to="/login" search={{ origem: "comunicacao" }} replace />;
  }

  return (
    <main
      className={
        "h-[100dvh] overflow-hidden bg-background text-foreground " +
        (modoEscuro ? "appcom-dark" : "")
      }
    >
      <div className="mx-auto flex h-full w-full max-w-none flex-col space-y-4 overflow-hidden p-3 sm:p-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Grupo Líder · aplicativo
          </p>
          <div className="mt-1 flex w-full items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">AppCom Líder</h1>
            <button
              type="button"
              onClick={() => setConfiguracoesAbertas(true)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/70 text-foreground transition hover:border-primary/40 hover:bg-primary/5"
              aria-label="Abrir configurações do AppCom"
              title="Configurações"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </header>

        {!conversaAtiva && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar aviso ou conversa"
                className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none ring-primary transition focus:ring-2"
              />
            </div>
            <section className="grid grid-cols-3 gap-2 sm:gap-3">
              <Metric
                icon={<Bell className="size-4" />}
                label="Avisos"
                value={String(avisos.length)}
                active={filtroEntrada === "avisos"}
                onClick={() => alternarFiltro("avisos")}
              />
              <Metric
                icon={<MessageCircle className="size-4" />}
                label="Conversas"
                value={String(conversas.length)}
                active={filtroEntrada === "conversas"}
                onClick={() => alternarFiltro("conversas")}
              />
              <Metric
                icon={<Sparkles className="size-5" />}
                active={filtroEntrada === "atlas"}
                onClick={() => alternarFiltro("atlas")}
                atlas
              />
            </section>

            {dispositivoMovel && !instaladoComoApp ? (
              <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Smartphone className="size-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Instale o AppCom Líder</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Instale o aplicativo para abrir a comunicação rapidamente e receber avisos
                        do Grupo Líder.
                      </p>
                    </div>
                  </div>
                  {instalavel ? (
                    <button
                      type="button"
                      onClick={() => void instalar()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm"
                    >
                      <Smartphone className="size-4" /> Instalar AppCom
                    </button>
                  ) : (
                    <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                      No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de
                      Início”. No Android, use o menu do navegador e escolha “Instalar aplicativo”.
                    </p>
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}

        {configuracoesAbertas && (
          <section className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6">
            <div className="mx-auto max-w-xl">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <button
                  type="button"
                  onClick={() => setConfiguracoesAbertas(false)}
                  className="inline-flex size-10 items-center justify-center rounded-xl border border-border hover:bg-muted"
                  aria-label="Voltar para conversas"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <div>
                  <h2 className="font-display text-xl font-bold">Configurações</h2>
                  <p className="text-xs text-muted-foreground">AppCom Líder</p>
                </div>
              </div>
              <div className="space-y-3 py-5">
                <section className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">Notificações</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Escolha quais avisos comuns deseja receber neste dispositivo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void pedirNotificacao()}
                      className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"
                    >
                      {notificacao === "granted" ? "Ativadas" : "Ativar"}
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 border-t border-border pt-3">
                    {(
                      [
                        ["conversas", "Conversas", "Novas mensagens e respostas."],
                        ["avisos", "Avisos", "Atualizações operacionais do AppCom."],
                      ] as const
                    ).map(([tipo, titulo, descricao]) => (
                      <div key={tipo} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{titulo}</p>
                          <p className="text-xs text-muted-foreground">{descricao}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={preferenciasNotificacao[tipo]}
                          onClick={() =>
                            setPreferenciasNotificacao((atual) => ({
                              ...atual,
                              [tipo]: !atual[tipo],
                            }))
                          }
                          className={
                            "rounded-lg px-3 py-2 text-xs font-semibold " +
                            (preferenciasNotificacao[tipo]
                              ? "bg-primary text-primary-foreground"
                              : "border border-border text-muted-foreground")
                          }
                        >
                          {preferenciasNotificacao[tipo] ? "Ativado" : "Pausado"}
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Atlas crítico</p>
                        <p className="text-xs text-muted-foreground">
                          Risco relevante para a operação não pode ser silenciado.
                        </p>
                      </div>
                      <span className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                        Sempre ativo
                      </span>
                    </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="font-semibold">Aplicativo</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {instaladoComoApp
                      ? "O AppCom está instalado neste dispositivo."
                      : "Instale o AppCom na tela inicial para acessá-lo como um aplicativo."}
                  </p>
                  {instalavel && !instaladoComoApp && (
                    <button
                      type="button"
                      onClick={() => void instalar()}
                      className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Instalar AppCom
                    </button>
                  )}
                </section>
                <section className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold">
                        {modoEscuro ? <Moon className="size-4" /> : <Sun className="size-4" />}
                        Modo escuro
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Reduz o brilho da tela para uso noturno.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModoEscuro((atual) => !atual)}
                      className={
                        "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold " +
                        (modoEscuro
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground")
                      }
                    >
                      {modoEscuro ? "Ativado" : "Ativar"}
                    </button>
                  </div>
                </section>
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Type className="size-4" /> Tamanho dos caracteres
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Escolha um tamanho confortável para leitura.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["padrao", "Padrão"],
                        ["grande", "Grande"],
                        ["muito-grande", "Maior"],
                      ] as const
                    ).map(([valor, rotulo]) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setTamanhoTexto(valor)}
                        className={
                          "rounded-lg px-2 py-2 text-xs font-semibold " +
                          (tamanhoTexto === valor
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground")
                        }
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="font-semibold">Dispositivos e sessão</h3>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-medium">Este dispositivo</p>
                      <p className="text-xs text-muted-foreground">Sessão ativa do AppCom</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                      Conectado
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Para sua segurança, cada usuário mantém somente uma sessão ativa. Ao entrar em
                    outro aparelho, a sessão anterior é encerrada.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConfiguracoesAbertas(false);
                      sair();
                    }}
                    className="mt-4 w-full rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Sair do AppCom
                  </button>
                </section>
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="font-semibold">Conta</h3>
                  <p className="mt-1 text-sm font-medium">{identidadeAppCom.nome}</p>
                  <p className="text-xs text-muted-foreground">{identidadeAppCom.email}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Fornecedor: {fornecedor.nome}
                  </p>
                </section>
              </div>
            </div>
          </section>
        )}

        <section
          className={
            "grid min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card/70 shadow-panel " +
            (conversaAtiva ? "lg:grid-cols-1" : "lg:grid-cols-[320px_minmax(0,1fr)]")
          }
        >
          <aside
            className={
              (conversaAtiva ? "hidden " : "") +
              "flex min-h-0 flex-col border-b border-border bg-background/40 lg:border-b-0 lg:border-r"
            }
          >
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-2 [-webkit-overflow-scrolling:touch]">
              {contatosEncontrados.map((contato) => (
                <button
                  key={contato.id}
                  type="button"
                  onClick={() => iniciarConversa(contato)}
                  className="mb-1 flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition hover:bg-muted/60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {contato.nome.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{contato.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {contato.funcao} · iniciar conversa
                    </span>
                  </span>
                </button>
              ))}
              {entradas.map((item) =>
                item.tipo === "aviso" ? (
                  <div key={item.aviso.id} className="rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAvisoSelecionado((atual) =>
                          atual === item.aviso.id ? null : item.aviso.id,
                        );
                        setBuscaDestinatario("");
                      }}
                      className="w-full rounded-2xl p-3 text-left transition hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-sm font-semibold">
                          {item.aviso.titulo}
                        </span>
                        <Bell
                          className={
                            "size-4 shrink-0 " +
                            (item.aviso.prioridade === "alta" ? "text-destructive" : "text-primary")
                          }
                        />
                      </div>
                      <p className="mt-2 max-w-full break-words text-xs leading-5 text-muted-foreground">
                        {item.aviso.descricao}
                      </p>
                      <span className="mt-2 block text-[11px] text-muted-foreground">
                        {item.aviso.data}
                      </span>
                    </button>
                    {avisoSelecionado === item.aviso.id && (
                      <div className="mx-3 mb-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-primary">Iniciar conversa com</p>
                        <div className="relative mt-2">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={buscaDestinatario}
                            onChange={(event) => setBuscaDestinatario(event.target.value)}
                            placeholder="Buscar pessoa"
                            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-2 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {destinatariosSugeridos.map((contato) => (
                            <button
                              key={contato.id}
                              type="button"
                              onClick={() => iniciarConversaPorAviso(item.aviso, contato)}
                              className="rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs font-semibold hover:border-primary/50"
                            >
                              {contato.nome}
                            </button>
                          ))}
                          {destinatariosSugeridos.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Nenhum contato encontrado.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : item.tipo === "atlas" ? (
                  <div key={item.monitoramento.id} className="rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMonitoramentoSelecionado((atual) =>
                          atual === item.monitoramento.id ? null : item.monitoramento.id,
                        );
                        setBuscaDestinatario("");
                      }}
                      className="w-full rounded-2xl p-3 text-left transition hover:bg-muted/60"
                    >
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Sparkles className="size-3.5" />
                          </span>
                          <span className="min-w-0 break-words text-sm font-semibold">
                            {item.monitoramento.titulo}
                          </span>
                        </div>
                        <span
                          className={
                            "max-w-full break-words rounded-full px-2 py-1 text-[10px] font-bold " +
                            (item.monitoramento.prioridade === "alta"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary")
                          }
                        >
                          {item.monitoramento.situacao}
                        </span>
                      </div>
                      <p className="mt-2 max-w-full break-words text-xs leading-5 text-muted-foreground">
                        {item.monitoramento.descricao}
                      </p>
                    </button>
                    {monitoramentoSelecionado === item.monitoramento.id && (
                      <div className="mx-3 mb-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-primary">Encaminhar para</p>
                        <div className="relative mt-2">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={buscaDestinatario}
                            onChange={(event) => setBuscaDestinatario(event.target.value)}
                            placeholder="Buscar pessoa"
                            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-2 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {destinatariosSugeridos.map((contato) => (
                            <button
                              key={contato.id}
                              type="button"
                              onClick={() => encaminharMonitoramento(item.monitoramento, contato)}
                              className="rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs font-semibold hover:border-primary/50"
                            >
                              {contato.nome}
                            </button>
                          ))}
                          {destinatariosSugeridos.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Nenhum contato encontrado.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    key={item.conversa.id}
                    type="button"
                    onClick={() => setConversaAtiva(item.conversa.id)}
                    className="w-full rounded-2xl p-3 text-left transition hover:bg-muted/60"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {item.conversa.participante.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {item.conversa.participante}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {item.conversa.atualizadaEm}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-xs font-medium text-foreground">
                          {item.conversa.assunto}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="min-w-0 break-words text-xs text-muted-foreground">
                            {item.conversa.resumo}
                          </span>
                          {item.conversa.naoLidas > 0 && (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              {item.conversa.naoLidas}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ),
              )}
              {entradas.length === 0 && (
                <p className="p-5 text-center text-sm text-muted-foreground">
                  Nenhum aviso ou conversa encontrado.
                </p>
              )}
            </div>
          </aside>

          {ativa && conversaAtiva ? (
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                ref={historicoRef}
                className="min-w-0 flex-1 touch-pan-y space-y-4 overflow-y-auto overscroll-contain bg-background/30 p-4 sm:p-6 [-webkit-overflow-scrolling:touch]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
                  <div>
                    <button
                      type="button"
                      onClick={() => setConversaAtiva(null)}
                      className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <ArrowLeft className="size-4" /> Voltar
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {ativa.categoria}
                      </span>
                      <span className="text-xs text-muted-foreground">{ativa.atualizadaEm}</span>
                    </div>
                    <h2 className="mt-2 break-words font-display text-xl font-bold">
                      {ativa.assunto}
                    </h2>
                    <p className="mt-1 max-w-full break-words text-sm text-muted-foreground">
                      {ativa.resumo}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <CircleHelp className="size-4" /> Ajuda
                  </button>
                </div>
                {ativa.mensagens.map((mensagem) => (
                  <div
                    key={mensagem.id}
                    className={
                      "flex " + (mensagem.autor === "fornecedor" ? "justify-end" : "justify-start")
                    }
                  >
                    <div
                      style={
                        mensagem.anexo
                          ? { width: "min(300px, calc(100vw - 64px))", maxWidth: "100%" }
                          : undefined
                      }
                      className={
                        "min-w-0 max-w-full rounded-2xl px-4 py-3 shadow-sm " +
                        (mensagem.anexo ? "" : "w-fit max-w-[85%] sm:max-w-[70%]") +
                        " " +
                        (mensagem.autor === "fornecedor"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border border-border bg-muted/70 text-foreground")
                      }
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {mensagem.autor === "fornecedor" ? "Você" : "Grupo Líder"}
                        <span>·</span>
                        <span>{mensagem.data}</span>
                      </div>
                      {mensagem.anexo?.tipo === "imagem" && (
                        <img
                          src={mensagem.anexo.url}
                          alt={mensagem.anexo.nome}
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: "100%",
                            height: "auto",
                          }}
                          className="mb-2 rounded-xl object-cover"
                        />
                      )}
                      {mensagem.anexo?.tipo === "audio" && (
                        <audio
                          controls
                          src={mensagem.anexo.url}
                          style={{ display: "block", width: "100%", maxWidth: "100%" }}
                          className="mb-2"
                        />
                      )}
                      <p className="text-sm leading-6">{mensagem.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="shrink-0 border-t border-border bg-card/80 p-3 sm:p-4">
                <div className="flex min-w-0 max-w-full items-end gap-2 overflow-hidden rounded-2xl border border-border bg-background p-2 focus-within:border-primary/60">
                  <input
                    ref={campoImagemRef}
                    type="file"
                    accept="image/*"
                    onChange={enviarImagem}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => campoImagemRef.current?.click()}
                    className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
                    title="Enviar imagem"
                  >
                    <Paperclip className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      gravandoAudio ? pararGravacaoAudio() : void iniciarGravacaoAudio()
                    }
                    className={
                      "rounded-xl p-2 transition " +
                      (gravandoAudio
                        ? "bg-destructive text-destructive-foreground"
                        : "text-muted-foreground hover:bg-muted")
                    }
                    title={gravandoAudio ? "Parar gravação" : "Gravar áudio"}
                  >
                    {gravandoAudio ? <Square className="size-5" /> : <Mic className="size-5" />}
                  </button>
                  <textarea
                    ref={campoMensagemRef}
                    value={texto}
                    onChange={(event) => {
                      setTexto(event.target.value);
                      event.currentTarget.style.height = "auto";
                      event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        enviarMensagem();
                      }
                    }}
                    placeholder={
                      autenticado ? "Escreva uma resposta..." : "Entre para responder à conversa"
                    }
                    disabled={!autenticado}
                    rows={1}
                    className="min-w-0 max-h-32 min-h-10 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={enviarMensagem}
                    disabled={!autenticado || !texto.trim()}
                    className="rounded-xl bg-primary p-3 text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Enviar"
                  >
                    <Send className="size-5" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  active = false,
  atlas = false,
  onClick,
}: {
  icon: ReactNode;
  label?: string;
  value?: string;
  active?: boolean;
  atlas?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={atlas ? "Atlas: monitoramento ativo" : label}
      title={atlas ? "Atlas: monitoramento ativo" : label}
      className={
        (atlas
          ? "flex items-center justify-center rounded-xl p-2.5 sm:p-3 "
          : "flex min-w-0 items-center gap-2 rounded-xl p-2.5 text-left sm:p-3 ") +
        "border transition " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card/70 hover:border-primary/40 hover:bg-primary/5")
      }
    >
      <span
        className={
          (atlas ? "flex size-9 " : "hidden size-8 sm:flex ") +
          "shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        }
      >
        {icon}
      </span>
      {!atlas && (
        <div className="min-w-0">
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{label}</p>
          <p className="truncate font-display text-sm font-bold sm:text-base">{value}</p>
        </div>
      )}
    </button>
  );
}

function ContextCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
      <ChevronRight className="mt-3 size-4 text-muted-foreground" />
    </div>
  );
}
