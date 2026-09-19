import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/context/portal-context";
import {
  ATLAS_PERMISSOES,
  fetchAtlasAcessosUsuarios,
  fetchUsuariosInternos,
  salvarAtlasAcessoUsuario,
  type AtlasPermissao,
  type UsuarioInternoDB,
} from "@/api";

const rotulos: Record<AtlasPermissao, string> = {
  consultar_carteira: "Consultar carteira",
  ver_detalhes: "Ver detalhes e indicadores",
  negociar: "Preparar negociação",
  enviar_mensagens: "Enviar mensagens Appcom",
  criar_campanhas: "Criar campanhas",
  aprovar_campanhas: "Aprovar campanhas",
  solicitar_rebaixa: "Solicitar rebaixa",
  planejar_pedidos: "Planejar pedidos",
  emitir_pedidos: "Emitir pedidos",
  gerenciar_acessos: "Gerenciar acessos Atlas",
};

const grupos = [
  { titulo: "Consulta", itens: ["consultar_carteira", "ver_detalhes"] },
  {
    titulo: "Negociação e comunicação",
    itens: [
      "negociar",
      "enviar_mensagens",
      "criar_campanhas",
      "aprovar_campanhas",
      "solicitar_rebaixa",
    ],
  },
  {
    titulo: "Pedido e governança",
    itens: ["planejar_pedidos", "emitir_pedidos", "gerenciar_acessos"],
  },
] as const;

type AcessoSalvo = {
  username: string;
  papel: string;
  permissoes: AtlasPermissao[];
  segmentos: string[];
  compradores: string[];
};

export const Route = createFileRoute("/_portal/admin-permissoes")({
  component: PermissoesAtlasPage,
});

function PermissoesAtlasPage() {
  const { usuarioInterno } = usePortal();
  const [usuarios, setUsuarios] = useState<UsuarioInternoDB[]>([]);
  const [acessos, setAcessos] = useState<AcessoSalvo[]>([]);
  const [selecionado, setSelecionado] = useState("");
  const [papel, setPapel] = useState("comprador");
  const [permissoes, setPermissoes] = useState<AtlasPermissao[]>([
    "consultar_carteira",
    "ver_detalhes",
  ]);
  const [segmentos, setSegmentos] = useState("");
  const [compradores, setCompradores] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [permitido, setPermitido] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [listaUsuarios, listaAcessos] = await Promise.all([
        fetchUsuariosInternos(),
        fetchAtlasAcessosUsuarios(),
      ]);
      setUsuarios(listaUsuarios);
      setAcessos(listaAcessos as AcessoSalvo[]);
      setSelecionado((atual) => atual || listaUsuarios[0]?.username || "");
    } catch (erro) {
      setPermitido(false);
      toast.error(
        erro instanceof Error ? erro.message : "Não foi possível carregar as permissões.",
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const acessoAtual = useMemo(
    () => acessos.find((item) => item.username === selecionado),
    [acessos, selecionado],
  );
  useEffect(() => {
    if (!selecionado) return;
    if (acessoAtual) {
      setPapel(acessoAtual.papel);
      setPermissoes(acessoAtual.permissoes);
      setSegmentos(acessoAtual.segmentos.join(", "));
      setCompradores(acessoAtual.compradores.join(", "));
    } else {
      setPapel("comprador");
      setPermissoes(["consultar_carteira", "ver_detalhes"]);
      setSegmentos("");
      setCompradores("");
    }
  }, [selecionado, acessoAtual]);

  const alternar = (permissao: AtlasPermissao, marcada: boolean) => {
    setPermissoes((atuais) =>
      marcada ? [...new Set([...atuais, permissao])] : atuais.filter((item) => item !== permissao),
    );
  };

  const salvar = async () => {
    if (!selecionado) return;
    setSalvando(true);
    try {
      await salvarAtlasAcessoUsuario({
        data: {
          username: selecionado,
          papel,
          permissoes,
          segmentos: segmentos
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          compradores: compradores
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });
      toast.success("Permissões Atlas salvas.");
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar as permissões.");
    } finally {
      setSalvando(false);
    }
  };

  if (!usuarioInterno || !permitido)
    return (
      <PortalLayout
        titulo="Acesso restrito"
        descricao="Somente o gestor geral ou uma pessoa delegada pode administrar os acessos Atlas."
      >
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-10 text-center">
          <ShieldAlert className="mb-3 size-11 text-destructive" />
          <h2 className="font-bold">Sem autorização para gerenciar acessos</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Peça ao gestor geral para delegar nominalmente a permissão “Gerenciar acessos Atlas”.
          </p>
        </div>
      </PortalLayout>
    );

  return (
    <PortalLayout
      titulo="Permissões Atlas"
      descricao="Defina o escopo e cada ação permitida. Cargo organiza o perfil; não libera nenhuma ação sozinho."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge variant="secondary">Gestor geral e delegados</Badge>
        <Badge variant="outline">Alterações registradas</Badge>
        <Badge variant="outline">Escopo por segmento e comprador</Badge>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(26rem,1.2fr)]">
        <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
          <div>
            <h2 className="font-semibold">Pessoa e alcance</h2>
            <p className="text-sm text-muted-foreground">
              O alcance limita a carteira carregada no Atlas.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="atlas-usuario">Usuário interno</Label>
            <Select value={selecionado} onValueChange={setSelecionado}>
              <SelectTrigger id="atlas-usuario">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.username} value={usuario.username}>
                    {usuario.nome} · {usuario.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Papel Atlas</Label>
            <Select value={papel} onValueChange={setPapel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gestor_geral">Gestor geral</SelectItem>
                <SelectItem value="gestor_segmento">Gestor de segmento</SelectItem>
                <SelectItem value="secretaria_segmento">Secretária de segmento</SelectItem>
                <SelectItem value="comprador">Comprador</SelectItem>
                <SelectItem value="auxiliar_comprador">Auxiliar de comprador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="atlas-segmentos">Segmentos autorizados</Label>
            <Input
              id="atlas-segmentos"
              value={segmentos}
              onChange={(event) => setSegmentos(event.target.value)}
              placeholder="Ex.: Alimentar, Bazar"
            />
            <p className="text-xs text-muted-foreground">
              Separe os nomes por vírgula. Vazio só deve ser usado para gestor geral.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="atlas-compradores">Compradores autorizados</Label>
            <Input
              id="atlas-compradores"
              value={compradores}
              onChange={(event) => setCompradores(event.target.value)}
              placeholder="Códigos, separados por vírgula"
            />
            <p className="text-xs text-muted-foreground">
              A auxiliar recebe os códigos do comprador a que está vinculada.
            </p>
          </div>
        </section>
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold">Ações autorizadas</h2>
            <p className="text-sm text-muted-foreground">
              Marque explicitamente o que a pessoa pode executar. “Emitir pedidos” fica desmarcado
              para auxiliares.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {grupos.map((grupo) => (
              <div key={grupo.titulo}>
                <h3 className="mb-2 text-sm font-semibold">{grupo.titulo}</h3>
                <div className="space-y-3">
                  {grupo.itens.map((item) => (
                    <label key={item} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={permissoes.includes(item)}
                        onCheckedChange={(valor) => alternar(item, valor === true)}
                      />
                      <span>{rotulos[item]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {carregando
                ? "Carregando..."
                : "A autorização será validada no servidor, não apenas nesta tela."}
            </p>
            <Button onClick={() => void salvar()} disabled={!selecionado || salvando || carregando}>
              <ShieldCheck className="mr-2 size-4" />
              {salvando ? "Salvando..." : "Salvar permissões"}
            </Button>
          </div>
        </section>
      </div>
    </PortalLayout>
  );
}
