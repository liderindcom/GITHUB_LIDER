import { randomUuid } from "@/lib/uuid";
import { createServerFn } from "@tanstack/react-start";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { db } from "../server/db";
import {
  exigirInternoRole,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
} from "../server/sessao-portal";
import {
  garantirTabelasEdicaoAgenda,
  exigirLimite,
  idsFornecedorPresenca,
  lerEdicaoAgendaPromotor,
  lerRelatorioPortal,
  lerPromotoresNomesInterno,
  promotorDisponivelParaAgenda,
  fornecedorNomeCorresponde,
  lerRelatorioPresencaInterno,
  lerSimulacaoPortePromotoresInterno,
  lerStatusPromotoresExecucaoInterno,
  lerStatusPromotoresInterno,
  iniciarAtualizacaoStatusPromotoresInterno,
  normalizarAssignmentAgenda,
  obterMapaFornecedorPresenca,
  validarECalcularAgendaPromotor,
  type AgendaPromotorAssignment,
} from "./agenda-support";

export type AgendaCluster = {
  id: string;
  nome: string;
  lojas: string[];
  ativo?: boolean;
  atualizadoEm?: string | null;
};

function garantirTabelaAgendaClusters() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agenda_clusters (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        lojasJson TEXT NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1,
        criadoEm TEXT NOT NULL,
        atualizadoEm TEXT NOT NULL,
        atualizadoPor TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agenda_clusters_ativo
        ON agenda_clusters (ativo, atualizadoEm);
    `);
  } catch {
    // A migração também é executada na inicialização do banco.
  }
}

function normalizarLojasCluster(value: unknown): string[] {
  const lojas = Array.isArray(value) ? value : [];
  return [...new Set(lojas.map((loja) => String(loja).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function normalizarNomeCluster(value: unknown, id: string): string {
  const nome = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return (nome || id).slice(0, 120);
}

function normalizarIdCluster(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function clustersBaseDoRelatorio(relatorio: Record<string, unknown>): AgendaCluster[] {
  const policy = ((relatorio.design as Record<string, unknown> | undefined)?.scheduling_policy ??
    {}) as Record<string, unknown>;
  const clusters = Array.isArray(policy.clusters) ? policy.clusters : [];
  return clusters
    .map((cluster) => {
      const row = cluster as Record<string, unknown>;
      const id = normalizarIdCluster(row.id);
      return id
        ? {
            id,
            nome: normalizarNomeCluster(row.nome, id),
            lojas: normalizarLojasCluster(row.lojas),
            ativo: true,
          }
        : null;
    })
    .filter((cluster): cluster is AgendaCluster => Boolean(cluster));
}

function clustersPersistidos(): AgendaCluster[] {
  garantirTabelaAgendaClusters();
  try {
    const rows = db
      .prepare(
        `SELECT id, nome, lojasJson, ativo, atualizadoEm
         FROM agenda_clusters
         WHERE ativo = 1
         ORDER BY id`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows
      .map((row) => {
        const id = normalizarIdCluster(row.id);
        if (!id) return null;
        let lojas: unknown[] = [];
        try {
          const parsed = JSON.parse(String(row.lojasJson ?? "[]"));
          lojas = Array.isArray(parsed) ? parsed : [];
        } catch {
          lojas = [];
        }
        return {
          id,
          nome: normalizarNomeCluster(row.nome, id),
          lojas: normalizarLojasCluster(lojas),
          ativo: Number(row.ativo ?? 1) === 1,
          atualizadoEm: String(row.atualizadoEm ?? "") || null,
        } satisfies AgendaCluster;
      })
      .filter((cluster): cluster is AgendaCluster => Boolean(cluster));
  } catch {
    return [];
  }
}

function clustersEfetivosDoRelatorio(relatorio: Record<string, unknown>): AgendaCluster[] {
  const merged = new Map(
    clustersBaseDoRelatorio(relatorio).map((cluster) => [cluster.id, cluster]),
  );
  for (const cluster of clustersPersistidos()) merged.set(cluster.id, cluster);
  return [...merged.values()].filter((cluster) => cluster.lojas.length > 0);
}

function relatorioComClustersPersistidos(relatorio: Record<string, unknown>) {
  const design = (relatorio.design ?? {}) as Record<string, unknown>;
  const policy = (design.scheduling_policy ?? {}) as Record<string, unknown>;
  return {
    ...relatorio,
    design: {
      ...design,
      scheduling_policy: {
        ...policy,
        clusters: clustersEfetivosDoRelatorio(relatorio).map(({ id, nome, lojas }) => ({
          id,
          nome,
          lojas,
        })),
      },
    },
  } as Record<string, unknown>;
}

function lojasConhecidasDoRelatorio(relatorio: Record<string, unknown>): Set<string> {
  const agenda = Array.isArray(relatorio.agenda) ? relatorio.agenda : [];
  return new Set(
    agenda
      .map((row) => String((row as Record<string, unknown>).loja_id ?? "").trim())
      .filter(Boolean),
  );
}

function geografiaDaCidadeCluster(value: unknown, policy: Record<string, unknown>) {
  const cidade = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (!cidade) return null;
  const metropolitan = new Set(
    (Array.isArray(policy.metropolitan_cities)
      ? policy.metropolitan_cities
      : ["BELEM", "ANANINDEUA", "ICOARACI"]
    )
      .map((item) =>
        String(item ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );
  return metropolitan.has(cidade) ? "CAPITAL_METROPOLITANA" : "INTERIOR";
}

function validarCluster(
  relatorio: Record<string, unknown>,
  id: string,
  nome: string,
  lojas: string[],
  allowExisting: boolean,
) {
  if (!id || !/^CLUSTER_[A-Z0-9_-]+$/.test(id)) {
    throw new Error("O identificador do cluster deve seguir o padrão CLUSTER_nome.");
  }
  if (!nome) throw new Error("Informe um nome para o cluster.");
  if (!lojas.length) throw new Error("Selecione pelo menos uma loja para o cluster.");
  const conhecidas = lojasConhecidasDoRelatorio(relatorio);
  const desconhecidas = lojas.filter((loja) => !conhecidas.has(loja));
  if (desconhecidas.length) {
    throw new Error(`Loja(s) não encontrada(s) na rede: ${desconhecidas.join(", ")}.`);
  }
  const clusters = clustersEfetivosDoRelatorio(relatorio);
  if (!allowExisting && clusters.some((cluster) => cluster.id === id)) {
    throw new Error(`O cluster ${id} já existe.`);
  }
  const ocupadoPor = new Map<string, string>();
  for (const cluster of clusters) {
    if (cluster.id === id) continue;
    for (const loja of cluster.lojas) ocupadoPor.set(loja, cluster.id);
  }
  const conflitos = lojas.filter((loja) => ocupadoPor.has(loja));
  if (conflitos.length) {
    throw new Error(
      `As lojas ${conflitos.join(", ")} já pertencem a ${conflitos
        .map((loja) => ocupadoPor.get(loja))
        .filter(Boolean)
        .join(", ")}. Edite o cluster atual antes de movê-las.`,
    );
  }
  const policy = ((relatorio.design as Record<string, unknown> | undefined)?.scheduling_policy ??
    {}) as Record<string, unknown>;
  const cities = new Map(
    (Array.isArray(relatorio.agenda) ? relatorio.agenda : []).map((row) => {
      const item = row as Record<string, unknown>;
      return [String(item.loja_id ?? ""), geografiaDaCidadeCluster(item.cidade, policy)] as const;
    }),
  );
  const geografias = new Set(lojas.map((loja) => cities.get(loja)).filter(Boolean));
  if (geografias.size > 1) {
    throw new Error("Um cluster não pode misturar lojas da capital/metropolitana e do interior.");
  }
}

function gerarIdCluster(relatorio: Record<string, unknown>) {
  const ids = new Set(clustersEfetivosDoRelatorio(relatorio).map((cluster) => cluster.id));
  let numero = 1;
  while (ids.has(`CLUSTER_${numero}`)) numero += 1;
  return `CLUSTER_${numero}`;
}

function persistirCluster(cluster: AgendaCluster, atualizadoPor: string, criadoEm?: string) {
  garantirTabelaAgendaClusters();
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO agenda_clusters
      (id, nome, lojasJson, ativo, criadoEm, atualizadoEm, atualizadoPor)
     VALUES (?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       nome = excluded.nome,
       lojasJson = excluded.lojasJson,
       ativo = 1,
       atualizadoEm = excluded.atualizadoEm,
       atualizadoPor = excluded.atualizadoPor`,
  ).run(
    cluster.id,
    cluster.nome,
    JSON.stringify(cluster.lojas),
    criadoEm || agora,
    agora,
    atualizadoPor,
  );
  return { ...cluster, atualizadoEm: agora };
}

export const fetchAgendaPromotoresSegmentada = createServerFn({ method: "GET" })
  .validator((data: { fornecedorCodigo: string; periodo?: string | null }) => ({
    fornecedorCodigo: normalizarCodigoFornecedor(data.fornecedorCodigo),
    periodo: data.periodo ?? null,
  }))
  .handler(async ({ data }) => {
    const sessao = lerSessaoPortal();
    if (!sessao) throw new Error("Sessão exigida.");
    const fornecedorCodigo =
      sessao.tipo === "fornecedor"
        ? normalizarCodigoFornecedor(resolverCodigoFornecedorDados(sessao.codigo))
        : data.fornecedorCodigo;
    if (!fornecedorCodigo) throw new Error("Fornecedor exigido para carregar a agenda.");

    const agendaRelatorio = relatorioComClustersPersistidos(
      lerRelatorioPortal("agenda-diaria-candidata.json"),
    );
    const controleRelatorio = lerRelatorioPortal("controle-promotores.json");
    const agenda = Array.isArray(agendaRelatorio.agenda)
      ? agendaRelatorio.agenda.filter(
          (linha) =>
            normalizarCodigoFornecedor(
              String((linha as { fornecedor_codigo?: unknown }).fornecedor_codigo ?? ""),
            ) === fornecedorCodigo,
        )
      : [];
    const suppliers = Array.isArray(controleRelatorio.suppliers) ? controleRelatorio.suppliers : [];
    const fornecedorControle = suppliers.find(
      (linha) =>
        normalizarCodigoFornecedor(
          String((linha as { fornecedor_codigo?: unknown }).fornecedor_codigo ?? ""),
        ) === fornecedorCodigo,
    );

    let simulacaoPorte: Record<string, unknown> | null = null;
    if (sessao.tipo === "interno") {
      try {
        exigirInternoRole("admin");
        const simulacaoRelatorio = lerSimulacaoPortePromotoresInterno();
        const linhasSimulacao = Array.isArray(simulacaoRelatorio?.suppliers)
          ? (simulacaoRelatorio.suppliers as Array<Record<string, unknown>>)
          : [];
        simulacaoPorte =
          (linhasSimulacao.find(
            (linha) =>
              normalizarCodigoFornecedor(String(linha.fornecedor_codigo ?? "")) ===
              fornecedorCodigo,
          ) as Record<string, unknown> | undefined) ?? null;
      } catch {
        simulacaoPorte = null;
      }
    }

    let equipe: Array<Record<string, unknown>> = [];
    if (sessao.tipo === "interno" || sessao.tipo === "fornecedor") {
      try {
        if (sessao.tipo === "interno") exigirInternoRole("admin");
        const relatorioNomes = lerPromotoresNomesInterno();
        const relatorioStatus = lerStatusPromotoresInterno();
        const statusRows = Array.isArray(relatorioStatus?.promotores)
          ? (relatorioStatus.promotores as Array<Record<string, unknown>>)
          : [];
        const statusById = new Map(
          statusRows.map((row) => [String(row.promotor_id ?? "").trim(), row]),
        );
        const nomes = Array.isArray(relatorioNomes?.promotores)
          ? (relatorioNomes.promotores as Array<Record<string, unknown>>)
          : [];
        const nomesCanonicos = Array.isArray(fornecedorControle?.fornecedor_nomes_canonicos)
          ? fornecedorControle.fornecedor_nomes_canonicos
              .map((nome) => String(nome || ""))
              .filter(Boolean)
          : [];
        equipe = nomes
          .filter(
            (row) =>
              (nomesCanonicos.length
                ? nomesCanonicos.some((nome) =>
                    fornecedorNomeCorresponde(row.fornecedor_nome_origem, nome),
                  )
                : fornecedorNomeCorresponde(
                    row.fornecedor_nome_origem,
                    fornecedorControle?.descricao_fornecedor,
                  )) && promotorDisponivelParaAgenda(row),
          )
          .map((row) => ({
            ...row,
            ...(statusById.get(String(row.promotor_id ?? "").trim()) || {}),
          }));
      } catch {
        equipe = [];
      }
    }
    let presenca: Record<string, unknown> | null = null;
    if (sessao.tipo === "interno") {
      try {
        exigirInternoRole("admin");
        const relatorioPresenca = lerRelatorioPresencaInterno(data.periodo);
        if (!relatorioPresenca) {
          presenca = {
            status: "AGUARDA_EXTRACAO",
            motivo: "A extração pseudonimizada ainda não foi publicada pelo worker de integração.",
          };
        } else {
          const supplierMap = obterMapaFornecedorPresenca(relatorioPresenca);
          const fornecedorIds = idsFornecedorPresenca(supplierMap, fornecedorCodigo);
          const byStore = Array.isArray(relatorioPresenca.by_store)
            ? (relatorioPresenca.by_store as Array<Record<string, unknown>>)
            : [];
          const visits = Array.isArray(relatorioPresenca.visits)
            ? (relatorioPresenca.visits as Array<Record<string, unknown>>)
            : [];
          presenca = {
            status: fornecedorIds.length ? "DISPONIVEL" : "AGUARDA_DE_PARA",
            motivo: fornecedorIds.length
              ? null
              : "Não há vínculo aprovado entre este fornecedor e a fonte de presença. O mapa exato por CNPJ e as exceções operacionais autorizadas já são aplicados automaticamente.",
            window: relatorioPresenca.window ?? null,
            period_reference: relatorioPresenca.period_reference ?? null,
            quality: relatorioPresenca.quality ?? null,
            fornecedor_id: fornecedorIds[0] ?? null,
            fornecedor_ids: fornecedorIds,
            by_store: fornecedorIds.length
              ? byStore.filter((row) => fornecedorIds.includes(String(row.fornecedor_id ?? "")))
              : [],
            visits: fornecedorIds.length
              ? visits.filter((row) => fornecedorIds.includes(String(row.fornecedor_id ?? "")))
              : [],
          };
        }
      } catch {
        // Detalhes de presença são exclusivos do papel administrador.
        presenca = null;
      }
    }

    return {
      generated_at: agendaRelatorio.generated_at,
      period_reference: agendaRelatorio.period_reference,
      design: agendaRelatorio.design,
      agenda,
      fornecedorControle: fornecedorControle ?? null,
      equipe,
      simulacaoPorte,
      presenca,
      agendaEdicao: (() => {
        const saved = lerEdicaoAgendaPromotor(
          fornecedorCodigo,
          String(agendaRelatorio.period_reference ?? ""),
        );
        if (!saved) return null;
        try {
          const totals = validarECalcularAgendaPromotor(
            fornecedorCodigo,
            String(agendaRelatorio.period_reference ?? ""),
            saved.assignments,
            agendaRelatorio,
            fornecedorControle as Record<string, unknown> | undefined,
            equipe.map((row) => String(row.promotor_id ?? "").trim()).filter(Boolean),
          );
          return {
            ...saved,
            total_visitas: totals.totalVisits,
            horas_planejadas: totals.plannedHours,
          };
        } catch {
          // Uma edição legada sem os novos blocos diários não pode derrubar a
          // tela. A agenda candidata será reconstruída na próxima edição.
          return null;
        }
      })(),
    };
  });

export const criarAgendaCluster = createServerFn({ method: "POST" })
  .validator((data: { nome: string; lojas: unknown[] }) => ({
    nome: normalizarNomeCluster(data.nome, "").slice(0, 120),
    lojas: normalizarLojasCluster(data.lojas),
  }))
  .handler(async ({ data }) => {
    const sessao = exigirInternoRole("admin");
    const relatorioBase = lerRelatorioPortal("agenda-diaria-candidata.json");
    const id = gerarIdCluster(relatorioBase);
    validarCluster(relatorioBase, id, data.nome, data.lojas, false);
    const cluster = persistirCluster(
      { id, nome: data.nome, lojas: data.lojas, ativo: true },
      `interno:${String(sessao.codigo || "admin")}`.slice(0, 180),
    );
    return { status: "SALVO", cluster };
  });

export const salvarAgendaCluster = createServerFn({ method: "POST" })
  .validator((data: { id: string; nome: string; lojas: unknown[] }) => ({
    id: normalizarIdCluster(data.id),
    nome: normalizarNomeCluster(data.nome, normalizarIdCluster(data.id)).slice(0, 120),
    lojas: normalizarLojasCluster(data.lojas),
  }))
  .handler(async ({ data }) => {
    const sessao = exigirInternoRole("admin");
    const relatorioBase = lerRelatorioPortal("agenda-diaria-candidata.json");
    validarCluster(relatorioBase, data.id, data.nome, data.lojas, true);
    const existente = clustersEfetivosDoRelatorio(relatorioBase).find(
      (cluster) => cluster.id === data.id,
    );
    if (!existente) throw new Error("Cluster não encontrado.");
    const cluster = persistirCluster(
      { id: data.id, nome: data.nome, lojas: data.lojas, ativo: true },
      `interno:${String(sessao.codigo || "admin")}`.slice(0, 180),
      existente.atualizadoEm || undefined,
    );
    return { status: "SALVO", cluster };
  });

export const salvarAgendaPromotoresEdicao = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; periodo: string; assignments: unknown[] }) => ({
    fornecedorCodigo: normalizarCodigoFornecedor(data.fornecedorCodigo),
    periodo: String(data.periodo ?? ""),
    assignments: Array.isArray(data.assignments) ? data.assignments.slice(0, 5000) : [],
  }))
  .handler(async ({ data }) => {
    const sessao = lerSessaoPortal();
    if (!sessao) throw new Error("Sessão exigida.");
    const fornecedorCodigo =
      sessao.tipo === "fornecedor"
        ? normalizarCodigoFornecedor(resolverCodigoFornecedorDados(sessao.codigo))
        : data.fornecedorCodigo;
    if (!fornecedorCodigo) throw new Error("Fornecedor exigido para salvar a agenda.");
    if (sessao.tipo === "interno") exigirInternoRole("admin");
    if (sessao.tipo === "fornecedor" && fornecedorCodigo !== data.fornecedorCodigo) {
      // O fornecedor só pode alterar a própria agenda, mesmo que alguém tente
      // enviar outro código pelo navegador.
      throw new Error("A sessão não pode alterar a agenda de outro fornecedor.");
    }
    const assignments = data.assignments.map(normalizarAssignmentAgenda);
    if (assignments.some((item) => !item))
      throw new Error("Há blocos de agenda com formato inválido.");
    const agendaRelatorio = relatorioComClustersPersistidos(
      lerRelatorioPortal("agenda-diaria-candidata.json"),
    );
    const controleRelatorio = lerRelatorioPortal("controle-promotores.json");
    const suppliers = Array.isArray(controleRelatorio.suppliers)
      ? (controleRelatorio.suppliers as Array<Record<string, unknown>>)
      : [];
    const fornecedorControle = suppliers.find(
      (linha) =>
        normalizarCodigoFornecedor(String(linha.fornecedor_codigo ?? "")) === fornecedorCodigo,
    );
    const nomesRelatorio = lerPromotoresNomesInterno();
    const equipePermitida = new Map<string, string>();
    const nomesCanonicos = Array.isArray(fornecedorControle?.fornecedor_nomes_canonicos)
      ? fornecedorControle.fornecedor_nomes_canonicos
          .map((nome) => String(nome || ""))
          .filter(Boolean)
      : [];
    for (const row of Array.isArray(nomesRelatorio?.promotores)
      ? (nomesRelatorio.promotores as Array<Record<string, unknown>>)
      : []) {
      if (
        !(nomesCanonicos.length
          ? nomesCanonicos.some((nome) =>
              fornecedorNomeCorresponde(row.fornecedor_nome_origem, nome),
            )
          : fornecedorNomeCorresponde(
              row.fornecedor_nome_origem,
              fornecedorControle?.descricao_fornecedor,
            ))
      )
        continue;
      if (!promotorDisponivelParaAgenda(row)) continue;
      const id = String(row.promotor_id ?? "").trim();
      if (id) equipePermitida.set(id, String(row.nome ?? "").trim());
    }
    for (const assignment of assignments as AgendaPromotorAssignment[]) {
      const promotorIds = [
        ...new Set(
          (assignment.promotor_ids?.length
            ? assignment.promotor_ids
            : assignment.promotor_id
              ? [assignment.promotor_id]
              : []
          )
            .map((id) => String(id).trim())
            .filter(Boolean),
        ),
      ];
      if (promotorIds.some((id) => !equipePermitida.has(id))) {
        throw new Error(
          "Um dos promotores escolhidos não pertence à equipe autorizada deste fornecedor.",
        );
      }
      assignment.promotor_ids = promotorIds;
      assignment.promotor_nomes = promotorIds.map((id) => equipePermitida.get(id) ?? "");
      assignment.promotor_id = promotorIds[0] ?? null;
      assignment.promotor_nome = assignment.promotor_nomes[0] ?? null;
    }
    const totals = validarECalcularAgendaPromotor(
      fornecedorCodigo,
      data.periodo,
      assignments as AgendaPromotorAssignment[],
      agendaRelatorio,
      fornecedorControle,
      [...equipePermitida.keys()],
    );
    garantirTabelasEdicaoAgenda();
    const agora = new Date().toISOString();
    const atualizadoPor = `${sessao.tipo}:${
      sessao.tipo === "fornecedor" ? fornecedorCodigo : String(sessao.codigo || "interno")
    }`.slice(0, 180);
    const atual = db
      .prepare(
        `SELECT versao, assignmentsJson, atualizadoEm
         FROM agenda_promotor_edicoes
         WHERE fornecedorCodigo = ? AND periodo = ?`,
      )
      .get(fornecedorCodigo, data.periodo) as
      { versao?: number; assignmentsJson?: string; atualizadoEm?: string } | undefined;
    const versao = Number(atual?.versao || 0) + 1;
    if (atual?.assignmentsJson) {
      db.prepare(
        `INSERT INTO agenda_promotor_edicoes_historico
          (id, fornecedorCodigo, periodo, versao, assignmentsJson, criadoEm, criadoPor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUuid(),
        fornecedorCodigo,
        data.periodo,
        Number(atual.versao || 1),
        atual.assignmentsJson,
        String(atual.atualizadoEm || agora),
        atualizadoPor,
      );
    }
    db.prepare(
      `INSERT INTO agenda_promotor_edicoes
        (fornecedorCodigo, periodo, versao, assignmentsJson, atualizadoEm, atualizadoPor)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (fornecedorCodigo, periodo) DO UPDATE SET
         versao = excluded.versao,
         assignmentsJson = excluded.assignmentsJson,
         atualizadoEm = excluded.atualizadoEm,
         atualizadoPor = excluded.atualizadoPor`,
    ).run(
      fornecedorCodigo,
      data.periodo,
      versao,
      JSON.stringify(assignments),
      agora,
      atualizadoPor,
    );
    return {
      status: "SALVA",
      fornecedorCodigo,
      periodo: data.periodo,
      versao,
      assignments,
      total_visitas: totals.totalVisits,
      horas_planejadas: totals.plannedHours,
      atualizado_em: agora,
    };
  });

export const fetchAgendaPromotoresPresenca = createServerFn({ method: "GET" })
  .validator((data: { fornecedorCodigo: string; periodo?: string | null }) => ({
    fornecedorCodigo: normalizarCodigoFornecedor(data.fornecedorCodigo),
    periodo: data.periodo ?? null,
  }))
  .handler(async ({ data }) => {
    exigirInternoRole("admin");
    const relatorio = lerRelatorioPresencaInterno(data.periodo);
    if (!relatorio) {
      return {
        status: "AGUARDA_EXTRACAO",
        motivo: "A extração pseudonimizada ainda não foi publicada pelo worker de integração.",
      };
    }
    const supplierMap = obterMapaFornecedorPresenca(relatorio);
    const fornecedorIds = idsFornecedorPresenca(supplierMap, data.fornecedorCodigo);
    const byStore = Array.isArray(relatorio.by_store)
      ? (relatorio.by_store as Array<Record<string, unknown>>)
      : [];
    const visits = Array.isArray(relatorio.visits)
      ? (relatorio.visits as Array<Record<string, unknown>>)
      : [];
    return {
      status: fornecedorIds.length ? "DISPONIVEL" : "AGUARDA_DE_PARA",
      motivo: fornecedorIds.length
        ? null
        : "Não há vínculo aprovado entre este fornecedor e a fonte de presença. O mapa exato por CNPJ e as exceções operacionais autorizadas já são aplicados automaticamente.",
      window: relatorio.window ?? null,
      period_reference: relatorio.period_reference ?? null,
      quality: relatorio.quality ?? null,
      fornecedor_id: fornecedorIds[0] ?? null,
      fornecedor_ids: fornecedorIds,
      by_store: fornecedorIds.length
        ? byStore.filter((row) => fornecedorIds.includes(String(row.fornecedor_id ?? "")))
        : [],
      visits: fornecedorIds.length
        ? visits.filter((row) => fornecedorIds.includes(String(row.fornecedor_id ?? "")))
        : [],
    };
  });

export const fetchStatusPromotoresExecucao = createServerFn({ method: "GET" }).handler(async () => {
  exigirInternoRole("admin");
  return lerStatusPromotoresExecucaoInterno();
});

export const forcarAtualizacaoStatusPromotores = createServerFn({ method: "POST" }).handler(
  async () => {
    exigirInternoRole("admin");
    exigirLimite("promotores-status-force", 1, 60_000);
    return iniciarAtualizacaoStatusPromotoresInterno();
  },
);
