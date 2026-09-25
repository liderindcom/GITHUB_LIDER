import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

type Solicitacao = {
  id: string;
  recebidaEm: string;
  fornecedor: string;
  planilha: string;
  periodo: string;
  itens: string;
};

const solicitacaoInicial: Solicitacao = {
  id: "brf-setembro",
  recebidaEm: "24/09/2026 18:00",
  fornecedor: "116408 — BRF S/A",
  planilha: "rebaixa_brf_2026-09.xls",
  periodo: "25/09/2026 a 30/09/2026",
  itens: "2",
};

export const Route = createFileRoute("/homologacao-rebaixa")({
  head: () => ({
    meta: [
      { title: "Homologação — Rebaixas recebidas do Portal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HomologacaoRebaixa,
});

function HomologacaoRebaixa() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([solicitacaoInicial]);
  const [selecionada, setSelecionada] = useState(solicitacaoInicial.id);
  const [mensagem, setMensagem] = useState(
    "Selecione uma planilha XLS ou XLSX para conferência visual.",
  );

  function adicionarFila() {
    if (!arquivo) {
      setMensagem("Selecione uma planilha antes de adicioná-la à fila.");
      return;
    }

    const id = `arquivo-${Date.now()}`;
    setSolicitacoes((atual) => [
      {
        id,
        recebidaEm: "Agora",
        fornecedor: "Fornecedor de teste",
        planilha: arquivo.name,
        periodo: "A conferir",
        itens: "—",
      },
      ...atual,
    ]);
    setSelecionada(id);
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = "";
    setMensagem("Planilha adicionada somente à fila visual desta homologação.");
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <header className="bg-[#123c69] px-7 py-5 text-white">
        <strong className="block text-xl">InteLider — Rebaixa do Fornecedor</strong>
        <span className="text-sm text-white/85">
          Homologação isolada · nenhum dado é enviado ao RMS ou ao CometNet
        </span>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6 pb-10">
        <p className="mb-5 rounded-md border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ambiente visual de validação. A seleção da planilha do Portal fica antes da lista de
          ofertas, para o comprador revisar a solicitação antes de criar a rebaixa oficial.
        </p>

        <section className="mb-6 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
          <h1 className="border-b border-slate-300 px-5 py-4 text-lg font-bold text-[#173d67]">
            Solicitações recebidas do Portal do Fornecedor
          </h1>
          <div className="p-5">
            <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-slate-200 pb-5">
              <label className="grid min-w-[330px] gap-1.5 text-sm font-bold">
                Planilha enviada pelo Portal
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="rounded border border-slate-300 p-2 text-sm font-normal"
                  onChange={(event) => {
                    const proximoArquivo = event.target.files?.[0] ?? null;
                    setArquivo(proximoArquivo);
                    setMensagem(
                      proximoArquivo
                        ? `Arquivo selecionado: ${proximoArquivo.name}`
                        : "Selecione uma planilha XLS ou XLSX para conferência visual.",
                    );
                  }}
                />
              </label>
              <button
                type="button"
                className="rounded border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-[#17436d]"
                onClick={adicionarFila}
              >
                Adicionar à fila
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Selecione uma solicitação para abrir a nova rebaixa. A operação oficial continua sob
                revisão do comprador.
              </p>
              <button
                type="button"
                disabled={!selecionada}
                className="rounded bg-[#1a70b8] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={() =>
                  setMensagem(
                    "Solicitação selecionada para revisão visual. Nenhuma rebaixa foi criada.",
                  )
                }
              >
                Usar solicitação selecionada
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-600" aria-live="polite">
              {mensagem}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full border-collapse text-sm">
                <thead className="bg-[#184a78] text-left text-white">
                  <tr>
                    <th className="p-2.5">Selecionar</th>
                    <th className="p-2.5">Recebida em</th>
                    <th className="p-2.5">Fornecedor</th>
                    <th className="p-2.5">Planilha</th>
                    <th className="p-2.5">Período solicitado</th>
                    <th className="p-2.5">Itens</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoes.map((solicitacao) => (
                    <tr
                      key={solicitacao.id}
                      className={selecionada === solicitacao.id ? "bg-sky-50" : ""}
                    >
                      <td className="border-b border-slate-200 p-2.5">
                        <input
                          type="radio"
                          name="solicitacao"
                          checked={selecionada === solicitacao.id}
                          aria-label={`Selecionar ${solicitacao.planilha}`}
                          onChange={() => setSelecionada(solicitacao.id)}
                        />
                      </td>
                      <td className="border-b border-slate-200 p-2.5">{solicitacao.recebidaEm}</td>
                      <td className="border-b border-slate-200 p-2.5">{solicitacao.fornecedor}</td>
                      <td className="border-b border-slate-200 p-2.5">{solicitacao.planilha}</td>
                      <td className="border-b border-slate-200 p-2.5">{solicitacao.periodo}</td>
                      <td className="border-b border-slate-200 p-2.5">{solicitacao.itens}</td>
                      <td className="border-b border-slate-200 p-2.5">
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                          Aguardando revisão
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-300 bg-white shadow-sm">
          <h2 className="border-b border-slate-300 px-5 py-4 text-lg font-bold text-[#173d67]">
            Listagem de Ofertas
          </h2>
          <div className="p-5 text-sm text-slate-600">
            Esta área representa a tela original de Rebaixa do Fornecedor. A fila acima deve
            aparecer antes dela; somente após selecionar uma solicitação o comprador inicia uma nova
            rebaixa.
          </div>
        </section>
      </main>
    </div>
  );
}
