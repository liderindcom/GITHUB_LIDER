import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  fetchRebaixaDestinatarios,
  saveRebaixaDestinatario,
  type RebaixaCompradorDB,
  type RebaixaDestinatarioDB,
} from "@/api";
import { SEGMENTOS_INTELIDER } from "@/lib/acordo-acesso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function RebaixaDestinatariosTab() {
  const [linhas, setLinhas] = useState<RebaixaDestinatarioDB[]>([]);
  const [compradores, setCompradores] = useState<RebaixaCompradorDB[]>([]);
  const [editando, setEditando] = useState<RebaixaDestinatarioDB | null>(null);
  const [compradorCodigo, setCompradorCodigo] = useState("");
  const [papel, setPapel] = useState<"comprador" | "auxiliar">("comprador");
  const [segmento, setSegmento] = useState<string>(SEGMENTOS_INTELIDER[0] ?? "OUTROS");
  const [emailPrincipal, setEmailPrincipal] = useState("");
  const [emailAlternativo, setEmailAlternativo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const dados = await fetchRebaixaDestinatarios({});
      setLinhas(dados.destinatarios);
      setCompradores(dados.compradores);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Acesso administrativo exigido.");
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const limpar = () => {
    setEditando(null);
    setCompradorCodigo("");
    setPapel("comprador");
    setSegmento(SEGMENTOS_INTELIDER[0] ?? "OUTROS");
    setEmailPrincipal("");
    setEmailAlternativo("");
    setAtivo(true);
  };

  const editar = (linha: RebaixaDestinatarioDB) => {
    setEditando(linha);
    setCompradorCodigo(linha.compradorCodigo);
    setPapel(linha.papel);
    setSegmento(linha.segmento);
    setEmailPrincipal(linha.emailPrincipal);
    setEmailAlternativo(linha.emailAlternativo || "");
    setAtivo(linha.ativo === 1);
  };

  const salvar = async () => {
    const comprador = compradores.find((item) => item.codigo === compradorCodigo);
    if (!comprador) {
      toast.error("Selecione um comprador existente no cadastro comercial.");
      return;
    }
    setSalvando(true);
    try {
      await saveRebaixaDestinatario({
        data: {
          ...(editando ? { id: editando.id } : {}),
          compradorCodigo,
          compradorNome: comprador.nome,
          papel,
          segmento,
          emailPrincipal,
          emailAlternativo: emailAlternativo || null,
          ativo: ativo ? 1 : 0,
        },
      });
      toast.success("Destinatário de rebaixa salvo.");
      limpar();
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {editando ? "Editar destinatário" : "Novo destinatário de rebaixa"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold">
            Comprador
            <select
              value={compradorCodigo}
              onChange={(event) => setCompradorCodigo(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Selecione...</option>
              {compradores.map((comprador) => (
                <option key={comprador.codigo} value={comprador.codigo}>
                  {comprador.nome} ({comprador.codigo})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Papel
            <select
              value={papel}
              onChange={(event) => setPapel(event.target.value as "comprador" | "auxiliar")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="comprador">Comprador</option>
              <option value="auxiliar">Auxiliar</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Segmento
            <select
              value={segmento}
              onChange={(event) => setSegmento(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {SEGMENTOS_INTELIDER.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <Input
            type="email"
            placeholder="E-mail principal"
            value={emailPrincipal}
            onChange={(event) => setEmailPrincipal(event.target.value)}
          />
          <Input
            type="email"
            placeholder="E-mail alternativo (opcional)"
            value={emailAlternativo}
            onChange={(event) => setEmailAlternativo(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
            />
            Destinatário ativo
          </label>
          <div className="flex gap-2 md:col-span-2 lg:col-span-3">
            <Button disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando..." : "Salvar destinatário"}
            </Button>
            {editando ? (
              <Button variant="outline" onClick={limpar}>
                Cancelar
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2 lg:col-span-3">
            O cadastro é validado no servidor. Compradores e auxiliares não editam seus próprios
            destinatários; a aba exige permissão de gestão Atlas.
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Destinatários cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2">Comprador</th>
                  <th className="p-2">Papel</th>
                  <th className="p-2">Segmento</th>
                  <th className="p-2">E-mails</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.id} className="border-t">
                    <td className="p-2">
                      {linha.compradorNome} ({linha.compradorCodigo})
                    </td>
                    <td className="p-2">{linha.papel}</td>
                    <td className="p-2">{linha.segmento}</td>
                    <td className="p-2">
                      {linha.emailPrincipal}
                      {linha.emailAlternativo ? `, ${linha.emailAlternativo}` : ""}
                    </td>
                    <td className="p-2">{linha.ativo === 1 ? "Ativo" : "Inativo"}</td>
                    <td className="p-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => editar(linha)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!linhas.length ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum destinatário cadastrado.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

