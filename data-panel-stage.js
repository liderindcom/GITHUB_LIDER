window.MAOADC_PROTOCOL_DATA = {
  updatedAt: "2026-10-08",
  panelUsers: [
    { userId: "administrador", name: "Administrador", email: "administrador@isaura", role: "superuser", scope: "maoadc-coliseum", status: "active", coliseumAccess: "granted", source: "Política inicial Coliseum" },
    { userId: "geormanny", name: "Geormanny", email: "a cadastrar", role: "superuser", scope: "maoadc-coliseum", status: "active", coliseumAccess: "granted", source: "Política inicial Coliseum" },
    { userId: "bernnardo", name: "Bernnardo", email: "a cadastrar", role: "operator", scope: "maoadc-coliseum", status: "active", coliseumAccess: "pending", source: "Política inicial Coliseum" }
  ],
  securityCenter: {
    mode: "OFFLINE",
    source: "API Cerberus não conectada",
    sourceState: "offline",
    observedAt: null,
    integrity: "não verificada — demonstração",
    userRole: "viewer",
    routes: ["/admin/seguranca", "/api/admin/seguranca", "/api/admin/seguranca/[id]"],
    dependencies: [
      {
        name: "Auth admin",
        status: "pendente",
        detail: "Destino precisa prover verifyToken(), adminAuth(), cookie admin_token e layout protegido."
      },
      {
        name: "Banco de dados",
        status: "pendente",
        detail: "Destino precisa prover src/lib/db.ts compatível com as queries exportadas."
      },
      {
        name: "Tabela security_events",
        status: "pendente",
        detail: "Centro de Segurança depende da tabela security_events para listar, deduplicar e resolver incidentes."
      },
      {
        name: "UI /admin/seguranca",
        status: "exportado",
        detail: "SegurancaClient.tsx foi empacotado com filtros, pulso, detalhe e geração de briefing."
      },
      {
        name: "Lib security-events.ts",
        status: "exportado",
        detail: "Inclui fingerprint, dedup de 15 minutos e buildAgentBrief para acionar agentes."
      }
    ],
    events: [
      {
        id: 101,
        product: "isaura",
        severity: "high",
        category: "ai_injection",
        threats: ["prompt_injection", "system_prompt_probe"],
        status: "aberto",
        preview: "Tentativa de instruir o agente a ignorar protocolo e revelar contexto de sistema.",
        source: "Centro de Segurança local",
        createdAt: "2026-07-27T10:15:00Z"
      },
      {
        id: 102,
        product: "maoadc",
        severity: "critical",
        category: "access",
        threats: ["secret_exfiltration", "env_read"],
        status: "em_investigacao",
        preview: "Vetor residual mapeado: leitura de .env por cat/grep ainda exige enforcement mecânico.",
        source: "Matriz de riscos MAOADC",
        createdAt: "2026-07-27T11:20:00Z"
      },
      {
        id: 103,
        product: "lider",
        severity: "medium",
        category: "infra",
        threats: ["runtime_incomplete", "protocol_check_fail"],
        status: "acionado_agentes",
        preview: "Snapshot Lider indica runtime parcial e protocol check falhando no alvo de rollout.",
        source: "Snapshot MAOADC Lider",
        createdAt: "2026-07-27T12:05:00Z"
      }
    ],
    briefTemplate: [
      "[INCIDENTE SEGURANCA]",
      "Produto: {product}",
      "Severidade: {severity}",
      "Categoria: {category}",
      "Status: {status}",
      "Ameaças: {threats}",
      "Prévia sanitizada: {preview}",
      "",
      "Pedido aos agentes:",
      "1. Confirmar se é ataque real, barulho ou falso positivo.",
      "2. Se real, mitigar com a ação mais reversível e segura.",
      "3. Não expor tokens/segredos.",
      "4. Reportar evidência, risco residual e próximo passo."
    ].join("\n")
  },
  constellation: {
    title: "Constelação da VPS",
    graphPath: "./assets/vps-constellation/graph.html",
    dataPath: "./assets/vps-constellation/constellation.json",
    reportPath: "./assets/vps-constellation/REPORT.md",
    host: "isaura",
    ip: "10.15.2.100",
    status: "local",
    note: "Snapshot gerado nesta VPS a partir de caminhos curados; não publica conteúdo de arquivos e ignora segredos/dados brutos."
  },
  rmsMasterData: {
    classification: {
      title: "Classificação Mercadológica RMS",
      status: "candidato",
      updatedAt: "2026-08-16",
      projectId: "painel-fornecedor",
      structure: "000 departamento · 00 seção · 00 grupo · 00 subgrupo",
      source: "RMS.AA3CNVCC.NCC_DESCRICAO",
      summary: "O Portal Fornecedor guarda os códigos mercadológicos reais, mas os nomes locais ainda são genéricos. A fonte candidata para nome funcional é AA3CNVCC, com cobertura de 100% das chaves extraídas.",
      metrics: [
        { label: "chaves RMS", value: "7.901" },
        { label: "cobertura NCC", value: "100%" },
        { label: "linhas descoberta", value: "1.670" },
        { label: "piso/revestimento", value: "49" }
      ],
      examples: [
        { code: "110.88.01.07", description: "PISO CERAMICO ATE 70X70", treatment: "Home Center vendável" },
        { code: "110.88.02.02", description: "PISO VINILICO ATE 20X120", treatment: "Home Center vendável" },
        { code: "110.88.03.15", description: "PORCELANATO ATE 60X60", treatment: "Home Center vendável" },
        { code: "110.88.04.10", description: "REVESTIMENTO ATE 30X60", treatment: "Home Center vendável" },
        { code: "600.94.01.01", description: "CONSTRUCAO", treatment: "uso/obra/reforma candidato" },
        { code: "600.94.10.01", description: "PECAS DE REPOSICAO", treatment: "uso/manutenção candidato" }
      ],
      artifacts: [
        "/home/administrador/rms/docs/classificacao-mercadologica-portal-candidato-2026-08-16.md",
        "/home/administrador/rms/dados/portal-fornecedor-dados-mestres/classificacao_mercadologica_portal_com_nomes_rms_candidato.tsv",
        "/home/administrador/rms/dados/portal-fornecedor-dados-mestres/classificacao_mercadologica_piso_porcelanato_com_nomes_rms_candidato.tsv",
        "/home/administrador/rms/dados/portal-fornecedor-dados-mestres/portal_fornecedor_dados_mestres_21_classificacao_mercadologica_dicionario.tsv"
      ],
      decision: "A regra operacional ainda não está homologada. Próximo passo: aceite funcional por chave mercadológica, não por departamento isolado."
    }
  },
  projectControl: {
    title: "Controle de Código",
    source: "/home/administrador/maoadc-protocol-panel/docs/controle-codigo-painel.md",
    owner: "Oscar",
    updatedAt: "2026-09-24",
    objective: "Operar o desenvolvimento pelo MAOADC Project Harness: Codex como C-Level, Gemini como VP Segurança, Grok como VP Arquitetura/UI; Muse, DeepSeek, K3 e Reasonix como executores. Claude não é modelo/dev ativo. Volume, linhas e fora de escopo são medidos por fonte formal Git/medição.",
    currentPhase: {
      short: "Harness",
      name: "MAOADC Project Harness — governança de projetos e controle de código",
      status: "Em governança"
    },
    immediateGoals: [
      {
        title: "Formalizar divisão gestor/dev/auditor",
        detail: "GOVERNANCA_AGENTES.md: Codex gestor; Grok/DeepSeek dev; Gemini/Codex auditor.",
        done: true
      },
      {
        title: "Sessão de aceite RH/Folha RH-001 a RH-012",
        detail: "Usar docs/homologacao-rh-folha-kpis.md; não marcar homologado sem termo.",
        done: false
      },
      {
        title: "Registrar entrega e auditoria por papel",
        detail: "Grok/DeepSeek implementam; Gemini/Codex auditam; Codex coordena painel, backlog e CODE.",
        done: false
      }
    ],
    roadmap: [
      {
        phase: "Fase 1",
        title: "Time de agentes visível no Controle de Código",
        detail: "Grok, Gemini e Codex cadastrados; slots 04–10 livres.",
        status: "Concluída",
        done: true
      },
      {
        phase: "Fase 2",
        title: "Divisão operacional RM/RMS",
        detail: "Codex coordena; Grok e DeepSeek codam; Gemini e Codex auditam.",
        status: "Ativa desde 2026-08-03",
        done: true
      },
      {
        phase: "Fase 3",
        title: "Homologação funcional KPIs RH-001 a RH-012",
        detail: "Aceite RH/Folha + reconciliação com relatório oficial do RM.",
        status: "Pendente de Oscar/RH",
        done: false
      },
      {
        phase: "Fase 4",
        title: "Fontes condicionadas RH-013 a RH-015",
        detail: "Ponto/afastamentos, férias e fonte de receita (RH-015).",
        status: "Condicionado",
        done: false
      }
    ],
    done: [
      {
        title: "Cadastro dos programadores Grok, Gemini e Codex",
        detail: "data.js — projectControl.programmers slots 01–03 (2026-07-29)."
      },
      {
        title: "Pacote mestre de homologação RH/Folha",
        detail: "RM/docs/homologacao-rh-folha-kpis.md e catálogo atualizado (autor: Grok)."
      },
      {
        title: "Governança: três programadores plenos",
        detail: "RM/GOVERNANCA_AGENTES.md — todos editam e produzem código para comparação de eficiência (autor: Grok, 2026-07-29)."
      },
      {
        title: "Governança RM/RMS gestor/dev/auditor",
        detail: "RM/GOVERNANCA_AGENTES.md — Codex gestor; Grok/DeepSeek dev; Gemini/Codex auditor (decisão Oscar, 2026-08-03)."
      },
      {
        title: "Aceite funcional assistido RH-007 a RH-009 (Grok)",
        detail: "RM/relatorios/kpis/ACEITE_FUNCIONAL_RH-007_RH-009_GROK_2026-07-29.md — pacote pronto; homologação blocked sem Folha."
      },
      {
        title: "Portal Fornecedor Fase 4 — UI operacional candidata (Codex)",
        detail: "Pedidos sem loja→CDAM, Relatório MIX REtqCob e Contas a Receber/deduções registrados em RM/docs/controle-codigo em 2026-08-06; lint/build/smoke local OK, sem homologação funcional."
      },
      {
        title: "Portal Fornecedor 2026-08-24 — lote UI + compra da loja no sell-out (Grok)",
        detail: "Registros em RM/docs/controle-codigo/2026-08-24_fase-2-4_portal-*.md. Pedido+DV, comprador, logística XML, BRF 11640, estoque/perdas/contas, sell-out QTDENT×embalagem. Sem homologação."
      },
      {
        title: "Portal Fornecedor 2026-08-31 — vendas mensal 24 meses Black & Decker 103448 (Grok)",
        detail: "RM/docs/controle-codigo/2026-08-31_fase-2-4_portal-vendas-mensal-103448_grok.md. Refresh deixava só 90d em vendas_mensal; Postgres agora 2025-01..2026-08 (2273 linhas)."
      },
      {
        title: "Portal Fornecedor 2026-08-31 — carga MES na madrugada (Grok)",
        detail: "RM/docs/controle-codigo/2026-08-31_fase-2-4_portal-vendas-mensal-mes-madrugada_grok.md. Cron 02:00 Belém lê AGG_VDA_PROD_MES; 10 faltantes. Sem AGG_VDA_PROD diária."
      },
      {
        title: "Portal Fornecedor 2026-08-31 — e-mail obrigatório e recuperar senha (Grok)",
        detail: "RM/docs/controle-codigo/2026-08-31_fase-2-4_portal-login-email-recuperar-senha_grok.md. E-mail é o login; primeiro acesso = e-mail + CNPJ; Esqueci a senha prova o CNPJ (sem SMTP)."
      },
      {
        title: "Portal Fornecedor 2026-08-31 — menu Corrigir senha (Grok)",
        detail: "RM/docs/controle-codigo/2026-08-31_fase-2-4_portal-menu-corrigir-senha_grok.md. Sem recuperação na tela de login; o portal pede a troca no menu e bloqueia o resto até gravar senha nova."
      },
      {
        title: "Portal Fornecedor 2026-08-31 — dashboard filtra segmento (Grok)",
        detail: "RM/docs/controle-codigo/2026-08-31_fase-2-4_portal-dashboard-filtro-segmento_grok.md. fetchComprasAno restringe SKU ao mix; título do dashboard mostra o segmento."
      },
      {
        title: "MAOADC Arena Fase 4 — Disjuntor Evolutivo (Grok)",
        detail: "service-plane/circuit-breaker daemon Go :8093 Closed/Open/Half-Open; quarentena /artifacts/mpr; deny-list; 38 testes -race. Registro RM/docs/controle-codigo/2026-09-03_fase-4_disjuntor-evolutivo_grok.md; commit 4ebe0fd; bico msg_20260903_000238_299."
      },
      {
        title: "MAOADC P0/P1 — Harness contrato de entrega e release manifest (Grok)",
        detail: "completed passa a exigir contrato formal + evidência mínima; FSM estrita com compat legado; release 1.2.0 tested; validate-artifacts sem delete. Registro RM/docs/controle-codigo/2026-09-03_fase-p0-p1_harness-contrato-release-manifest_grok.md; bico msg_20260903_185536_812."
      },
      {
        title: "K3 e Reasonix registrados como executores ativos (Grok)",
        detail: "policy.agentOrg + productExecutors + agent-task. Controles preservados: escopo, evidência, testes, hash/commit, auditor distinto; sem segredos/deploy. CODE 2026-09-03_execucao_k3-reasonix-devs-ativos_grok.md; bico msg_20260903_203442_563."
      },
      {
        title: "Claude removido da lista operacional de devs ativos (Grok)",
        detail: "Saiu de HARNESS_AGENTS, productExecutors, protocol-targets ativos e mailbox send --to claude. Histórico, auditorias, mensagens e CLAUDE.md preservados. CODE 2026-09-03_execucao_claude-inativo-devs_grok.md; bico msg_20260903_203525_070."
      }
    ],
    pending: [
      {
        title: "Aceite funcional RH/Folha (sessão humana)",
        detail: "Decisões D1–D9 e termos nos pacotes ACEITE_* e homologacao-rh-folha-kpis.md."
      },
      {
        title: "Lotes ACEITE ainda faltantes (se aplicável)",
        detail: "Verificar se Gemini fechou RH-004 a RH-006; Codex já entregou 001–003 e 010–012."
      },
      {
        title: "Próximas entregas com revisão antes de promoção",
        detail: "Implementação por Grok/DeepSeek e auditoria por Gemini/Codex, com registro CODE."
      }
    ],
    blockers: [
      {
        title: "Homologação não é automática",
        question: "Oscar/RH precisa assinar o termo de aceite antes de marcar KPI como homologado no catálogo."
      }
    ],
    programmers: [
      {
        id: "grok",
        name: "Grok",
        avatar: "GR",
        role: "VP Arquitetura/UI",
        status: "Ativo",
        focus: "Arquitetura de produto, experiência, integração visual e auditoria independente.",
        currentTask: "Control Room do Coliseum (DEV-04, bico msg_20260904_040248_969) — Campo/Cartório, estados ortogonais, DEMO/CONNECTED/OFFLINE.",
        branch: "/home/administrador/maoadc-arena",
        checkpoint: "2026-09-04 — evidência RM/docs/controle-codigo/2026-09-04_execucao_control-room-coliseum_grok.md (commit e7b425d, bico msg_20260904_040248_969)",
        done: [
          "SQL e fichas KPIs RH-001 a RH-012 (base técnica)",
          "docs/homologacao-rh-folha-kpis.md (pacote mestre de aceite)",
          "Atualização catalogo-kpis-rh.md, indice.md, README RM",
          "Cadastro Grok/Gemini/Codex em maoadc-protocol-panel/data.js",
          "GOVERNANCA: três agentes autorizados a codar (comparação de eficiência)",
          "ACEITE_FUNCIONAL_RH-007_RH-009_GROK_2026-07-29.md — proventos, descontos/líquido, horas extras",
          "2026-08-03 revisão dev formal RM/RMS fases 0-7 (bicos Codex msg_20260803_140346_176 + 134942_162 + 135743_111)",
          "Validadores locais contracts/phase2/phase45/phase67 reproduzidos OK; sem hot path RM/RMS",
          "2026-08-03 Portal Fornecedor Fase 0: 9 JSON Schemas, migrations RLS, regras antecipação, validate_contracts.py (msg_20260803_151437_314)",
          "2026-08-24 pedido NROPED-DIGPED em todo o portal (RM + portal docs)",
          "2026-08-24 /pedidos: coluna Comprador no lugar de Agenda",
          "2026-08-24 logística: detalhe XML/pedido no portal (SEFA só atalho)",
          "2026-08-24 recarga BRF 11640 (RMS SELECT)",
          "2026-08-24 lote UI: acordo acesso, estoque/qualidade, perdas mês, dashboard DV, meus itens sem Comercial, contas só abertas",
          "2026-08-24 sell-out: compra da loja = transf. CDAM (estocado) ou entrega fornecedor (direto); un = QTDENT×embalagem",
          "2026-08-24 gate Controle de Código: collab.py code-control close + cláusula nas instruções; patch da fonte canônica para Oscar",
          "2026-08-31 sell-out mensal 24 meses: refresh RMS não tesoura mais em 90d; Black & Decker 103448 recarregado (20 meses no Postgres)",
          "2026-08-31 carga faltantes via AGG_VDA_PROD_MES na madrugada (cron 02:00 Belém); AGG_VDA_PROD diária não é lida",
          "2026-08-31 liberados de dia entram no --faltantes (acessoLiberado=1); mensal 24m via MES no refresh diurno",
          "2026-08-31 portal: apagado symlink circular portal-fornecedor/portal-fornecedor; Vite followSymlinks=false; HTTPS 200",
          "2026-08-31 usuários internos: JAR não estava no Postgres; createUsuarioInterno deixa de mentir 'já existe'",
          "2026-08-31 filtro mix no header: valores reais (segmento/depto/seção/grupo/subgrupo/comprador), não só agrupamento",
          "2026-08-31 filtro mix: descrição NCC/depto/comprador no lugar de Departamento 110 / Seção 110.80",
          "2026-08-31 login fornecedor: CNPJ como identificador/senha; 20922 Futura com vigência 2026-08-31..2027-08-31",
          "2026-08-31 vigência: input date não grava vazio no meio da digitação do ano",
          "2026-08-31 login: fetchFornecedor POST (CNPJ não quebra URL); Vite reiniciado",
          "2026-08-31 login-screen: removida ref a fornecedor.codigo que derrubava a tela",
          "2026-08-31 login: mostrar/ocultar senha + aviso se digitarem o código 209228 no lugar do CNPJ",
          "2026-08-31 login: e-mail obrigatório (não mais porta vazia); primeiro acesso cria usuário; Esqueci a senha com prova do CNPJ",
          "2026-08-31 login: removida recuperação pública; menu Corrigir senha obriga troca após senha=CNPJ",
          "2026-08-31 dashboard: pedido/entregue/perda e gráfico passam a filtrar SKU pelo segmento/mix do cabeçalho",
          "2026-09-03 Disjuntor Evolutivo (Fase 4): daemon Go :8093 Closed/Open/Half-Open, quarentena /artifacts/mpr, deny-list de rede, 38 testes -race; commit 4ebe0fd msg_20260903_000238_299",
          "2026-09-03 P0/P1 Harness: completed exige contrato de entrega + evidência; transições estritas com compat legado; release manifest 1.2.0 tested; validate-artifacts sem apagar; 40 unittest; bico msg_20260903_185536_812",
          "2026-09-03 registro operacional: K3 e Reasonix como executores ativos (Rust/Go+segurança; automação/integração/observabilidade); controles agent-task/escopo/evidência/testes/hash/auditor distintos; sem segredos/deploy; bico msg_20260903_203442_563",
          "2026-09-03 Claude removido da lista operacional de modelos/devs ativos; histórico/auditorias/mensagens/CLAUDE.md preservados; agent-task e mailbox send recusam claude; bico msg_20260903_203525_070",
          "2026-09-04 Control Room Coliseum: Campo/Cartório, estados ortogonais, timeline de contratos, modos DEMO/CONNECTED/OFFLINE; copy de efetivação removida em simulação; npm test 11/11 + npm build; commit e7b425d; bico msg_20260904_040248_969"
        ],
        pending: [
          "Revisão Codex/Gemini do pacote portal-fornecedor 2026-08-24",
          "Agendar carga de transferencias_cdam (hoje é script manual)",
          "Expor /status do disjuntor no Control Room quando houver backend (hoje o mapa em DEMO é estático)",
          "Backend Cartório/API Coliseum para o modo CONNECTED deixar de cair em OFFLINE",
          "Gemini auditar release 1.2.0 (tested → audited); Oscar autorizar commit da fonte untracked",
          "Atualizar este card a cada entrega de código (crédito de eficiência)"
        ],
        blockers: [
          "Homologação RH-007/008/009 bloqueada até relatório oficial + aceite Folha (não inventar homologado)",
          "Piloto real RH-015 bloqueado: EXT aceites + auditoria Gemini + sem origem real"
        ],
        codeVolume: {
          deliveriesInScope: 16,
          deliveriesOutOfScope: 0,
          linesInScope: 4977,
          linesOutOfScope: 0,
          outOfScopeItems: [],
          measuredAt: "2026-09-04",
          method: "3542 anteriores + 1435 adicionadas no commit e7b425d (control-room Coliseum DEV-04). git show --numstat e7b425d. Sem remoto."
        },
        kpis: {
          "CODE-01": "Ativo",
          "CODE-02": "Ativo",
          "CODE-03": "Ativo",
          "CODE-04": "Pendente",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "Ativo",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      },
      {
        id: "gemini",
        name: "Gemini",
        avatar: "GE",
        role: "VP Segurança",
        status: "Ativo",
        focus: "Segurança, proteção de prompts, riscos, privacidade, LGPD e guardrails.",
        currentTask: "Auditoria de segurança e proteção do Harness; histórico Git medido no Painel Fornecedor.",
        branch: "/lider/portal-fornecedor",
        checkpoint: "2026-08-15 — papel atualizado para VP Segurança; linhas medidas por git log --numstat",
        done: [
          "Revisões históricas em bicos RH-001/002/006 (fase anterior: só revisão)",
          "Slot de programador cadastrado no Controle de Código"
        ],
        pending: [
          "Ler bico aviso DeepSeek: msg_20260729_160009_498 (mailbox local ~/.agent-collab/mailbox)",
          "Revisar entregas 2026-08-03 do RM/RMS Integrador",
          "Registrar achados e decisão de qualidade por CODE"
        ],
        blockers: [],
        codeVolume: {
          deliveriesInScope: null,
          deliveriesOutOfScope: 0,
          linesInScope: null,
          linesOutOfScope: null,
          outOfScopeItems: [],
          measuredAt: "2026-08-15",
          method: "Entregas e linhas vindas de code-volume-measurements.js quando disponíveis."
        },
        kpis: {
          "CODE-01": "N/A",
          "CODE-02": "Ativo",
          "CODE-03": "N/A",
          "CODE-04": "Ativo",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "N/A",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      },
      {
        id: "codex",
        name: "Codex",
        avatar: "CX",
        role: "C-Level",
        status: "Ativo",
        focus: "Direção técnica, governança de engenharia, Harness, gates, painel e homologação.",
        currentTask: "Atlas Arquivo B: planilha com sugestão antes da situação.",
        branch: "master — /home/administrador/maoadc-arena",
        checkpoint: "2026-10-19 — RM/docs/controle-codigo/2026-10-19_fase-0_arquivo-b-ordem-colunas_codex.md; sugestão antes da situação publicada no Worker db8fcc21; CSV preservado.",
        done: [
          "RM/RMS 2026-10-14: migration aditiva e worker RMS read-only do Fill Rate criados; dry-run real de 14/09 validado, PostgreSQL ainda não aplicado.",
          "Atlas 2026-10-15: menu Fill Rate ganhou aba Qualidade logística; reutiliza indicadores reais e deixa OTIF/prazo/causa explicitamente sem evento até nova integração (Worker 3e51c47e).",
          "Atlas 2026-10-17: projeto Arquivo B criado no menu em modo somente leitura; documentação, premissas e critérios de shadow mode registrados; sem consulta RMS ou emissão de pedido.",
          "Atlas 2026-10-18: Arquivo B arredonda itens comuns acima de 60% para palete fechado, força palete para Top Star quando possível, respeita capacidade/CDAM e sinaliza exceções; Worker 7359c81d; validado_local/candidato.",
          "Atlas 2026-10-18: Arquivo B ganhou resumo por subgrupo com listas Pedido/Não pedido e comparação entre edição final e sugestão calculada; Worker bd4ec304; validado_local/candidato.",
          "Atlas 2026-10-18: Arquivo B ganhou exportação CSV compatível com Excel/Sheets, uma linha por SKU e sugestao_pedido na última coluna; Worker 5807fee9; validado_local/candidato.",
          "Atlas 2026-10-18: planilha completa passou a aparecer no card Resultado por loja e subgrupo, com sugestão de pedido na última coluna e rolagem horizontal; Worker ab7c35c4; validado_local/candidato.",
          "Atlas 2026-10-18: card Resultado por loja e subgrupo ganhou seleção por Departamento, Seção, Grupo e Subgrupo; planilha, resumo, indicadores e exportação acompanham a seleção; Worker 89de0052; validado_local/candidato.",
          "Atlas 2026-10-18: filtro sequencial substituído por quatro caixas independentes dentro do card Resultado por loja e subgrupo; todas as seleções podem ser combinadas; Worker d83f4fe0; validado_local/candidato.",
          "Atlas 2026-10-18: cards verdes Pedido/Não pedido removidos; Arquivo B ficou com planilha única e quatro filtros de classificação; Worker 31ce0e74; validado_local/candidato.",
          "Atlas 2026-10-18: Importar CSV e Recalcular removidos; cálculo automático mantido e Mostrar alertas virou botão principal acima da planilha; Worker f731498f; validado_local/candidato.",
          "Atlas 2026-10-18: quatro cards de indicadores passaram a ser botões filtráveis; SKUs, Alertas, Top Stars e Faltas de CDAM; Worker c98ed05b; validado_local/candidato.",
          "Atlas 2026-10-18: quatro cards clicáveis compactados para ocupar menos espaço acima da planilha; Worker d98bdb0f; validado_local/candidato.",
          "Atlas 2026-10-19: Arquivo B recebeu programação por loja baseada no Reforço de faturamento do CometNet; painel administrativo cadastra loja→grupo e seção→grupo, e a planilha filtra o dia e ordena por seção; Worker 0b519aad; health/assets HTTP 200.",
          "Atlas 2026-10-19: Arquivo B passou a tratar produto novo por estoque padrão/exposição ou produto referência do subgrupo e retorno após ruptura de 60+ dias por demanda anterior/referência, sem penalizar o histórico; Worker 1ab1ff31; asset HTTP 200.",
          "Atlas 2026-10-19: planilha do Arquivo B passou a mostrar Sugestão de pedido antes de Situação; exportação CSV mantém sugestão na última coluna; Worker db8fcc21; node --check e deploy PASS.",
          "Atlas 2026-10-15: painel Fill Rate passou a exibir descrição junto aos códigos de departamento, seção, grupo, subgrupo e produto; dados vêm do cadastro PostgreSQL real, sem mock.",
          "RM/RMS 2026-10-14: worker Fill Rate passou a ler RMS em lotes; migration aplicada e corte 15/08–14/09 reconciliado no PostgreSQL com 777.157 linhas e repetição idempotente.",
          "RM/RMS 2026-10-14: Fase 3 materializou agregações Fill Rate por loja, departamento, seção, grupo, subgrupo e SKU; 79.015 linhas, somas reconciliadas e execução idempotente.",
          "RM/RMS 2026-10-14: Fase 4 criou API somente leitura /fill-rate e /fill-rate/summary sobre PostgreSQL; smoke test real reconciliado, sem publicação Atlas.",
          "Atlas 2026-10-14: tela Fill Rate CDAM conectada aos endpoints; Portal expõe rotas GET read-only sobre PostgreSQL, sem fallback; commit 79bee63, Worker d892a2ed, build e smoke público 200 validados.",
          "RM/RMS 2026-10-14: G1 documentou chave natural e reexecução idempotente do Fill Rate; amostra real de 10.000 linhas sem duplicidade, checagem global pendente.",
          "RM/RMS 2026-10-14: consulta read-only versionada do Fill Rate CDAM por loja e mercadológico; dry-run real de 90 dias reconciliado em 92,98%, sem schema/ETL.",
          "Portal/CometNet 2026-09-24: homologação isolada da fila de rebaixas criada; caixa de seleção da planilha fica antes da listagem de ofertas, sem RMS/CometNet/SMB.",
          "Pacotes e revisões técnicas em KPIs RH (fase anterior: ênfase em revisão)",
          "Slot de programador cadastrado no Controle de Código",
          "RM/RMS Integrador: ADR inicial, 8 contratos JSON controlados, migrations 001..005, schema doc e validate_contracts.py",
          "RM/RMS Integrador Fase 2: inventario RMS, SQLs candidatas de faturamento/margem, de-para piloto candidato e validate_rms_phase2.py",
          "Skill local ~/.codex/skills/rm-rms-integrador com SKILL.md, project-guide e wrappers de validacao",
          "Governança RM/RMS: Codex gestor; Grok/DeepSeek dev; Gemini/Codex auditor",
          "Fase 4/5 controlada: seeds RM/RMS, sync-worker dry-run, API cache local, runbook e validate_phase45.py",
          "Fase 6/7 candidata: schemas RH-015, builder, metas controladas, pacote piloto e validate_phase67.py",
          "Solicitações formais emitidas: Gemini msg_20260803_140346_160; Grok msg_20260803_140346_176; DeepSeek msg_20260803_140346_182; all msg_20260803_140346_383",
          "Pacote grants DBA RM/RMS RH-015 preparado em rm-rms-integrador/docs/pacote-grants-dba-rm-rms-rh-015.md",
          "Evidencia parcial RM localizada: RM/docs/arquitetura-seguranca-lgpd.md registra credencial Isaura com CONNECT/SELECT via gateway auditado",
          "Definicao funcional RH-015 V1 preparada: faturamentoLiquido RMS e custoPessoalTotal RM por competencia",
          "Termo Operacao/TI preparado para lojas reais e de-para RM/RMS",
          "Termo Seguranca/LGPD preparado para retencao, supressao, perfis e aceite obrigatorio no login",
          "Portal Fornecedor 2026-08-06: pedidos exibe apenas pedidos diretos do fornecedor, removendo pedidos loja→CDAM do menu (validado_local/candidato)",
          "Portal Fornecedor 2026-08-06: Relatório MIX REtqCob criado a partir do PDF relatorio lider.pdf, com matriz por filiais e exportação CSV (validado_local/candidato)",
          "Portal Fornecedor 2026-08-06: menu Contas a Receber criado para débitos do fornecedor e abatimento no próximo pagamento (validado_local/candidato)"
          ,"RM/RMS Passo 5 2026-08-16: pacote read-only P0/P1/P2 executado e plano ETL/cache criado; seis TSVs restritos, sem publicação no Portal (validado_local/aguarda_aceite)"
          ,"RM/RMS Passo 6 2026-08-16: matriz de decisão P0 criada a partir dos seis TSVs, liberando staging/dry-run local e mantendo publicação bloqueada (validado_local/aguarda_aceite)"
          ,"2026-09-03 — MAOADC Core Fases 2–5 integradas no commit ba51f19: Cerberus, serviços Go, onboard e control-room (validado_local; sem push)"
          ,"Portal → Atlas 2026-09-13: contrato candidato de leitura de ofertas e rebaixas, filtrado por fornecedor e protegido por token (build verde; aguarda infraestrutura)"
           ,"Atlas interno 2026-09-14: rota /atlas e API por sessão conectadas à tabela canônica ofertas_intelider (build verde; 401 sem sessão)"
           ,"Atlas 2026-09-14: logo canônico aplicado a todas as visões e às impressões internas (ativo HTTPS validado)"
           ,"Atlas 2026-09-14: logo original configurado como favicon e ícone de atalho local"
          ,"Atlas público 2026-09-14: logo e favicon publicados em liderindcom-atlas.lider-indcom.workers.dev (versão 783b0359)"
          ,"Atlas 2026-10-14: filtros Início/Fim/CDAM/Loja/Nível/Atualizar do Fill Rate compactados em uma linha no desktop; responsividade preservada."
          ,"Atlas 2026-10-14: troca de filtro recarrega a consulta e limpa a tabela anterior; CDAM 2011 não mantém linha antiga de 2038. Worker 096ae4b9."
          ,"Atlas público 2026-09-18: Compra removeu o protótipo estático; fornecedor e SKU vêm da API canônica (commit 3bd27c0; Worker fcc92141)."
          ,"Atlas público 2026-09-18: cartões da Compra substituídos por dados canônicos de cadastro, estoque, pedidos, vendas e filiais (commit 76807d3; Worker a7e254a6)."
          ,"Atlas público 2026-09-18: abas da Compra confirmadas — dados reais em Comprar/Filiais/Vendas e bloqueio explícito nas fontes indisponíveis (commit 9473e67; Worker 20660188)."
          ,"Atlas público 2026-09-18: EAN integrado ao Produto e cartões de Situação/Ação ampliados na Compra (commit d4c31d0; Worker c9be0972)."
          ,"Atlas público 2026-09-18: grades da Compra corrigidas; valores de cadastro, estoque e pedidos legíveis no navegador (commit ca15ed5; Worker 8dd444bd)."
          ,"Atlas público 2026-09-18: tela de Compra estabilizada sem flash, com rolagem normal e dados canônicos legíveis (commit 24bb6b3; Worker e5308558)."
          ,"Atlas público 2026-09-14: tela em branco corrigida; HTML remoto validado sem visibility:hidden (versão 37662153)"
          ,"Atlas público 2026-09-14: logo de impressão corrigido; portal volta a ocupar a tela (versão 630c8c29)"
          ,"Atlas público 2026-09-14: painel lateral persistente no desktop, menu recolhível no celular (versão 3d870c11)"
          ,"Atlas público 2026-09-14: painel lateral recolhível por ícones no desktop (versão 25cc0e48)"
          ,"Atlas público 2026-09-14: recolhimento automático do painel lateral após 10 s sem uso (versão 1de573f8)"
          ,"Atlas publico 2026-09-14: Farol Anual encaminha para a pagina canonica Vendas Anual do Portal (versao 6a69d745; validado_local)"
          ,"Atlas público 2026-09-14: colunas do Farol Anual compactadas (versão 76df3900)"
          ,"Atlas público 2026-09-14: Estoque e Mix sem rolagem horizontal e coluna de fornecedor ampliada (versão b435911d)"
          ,"Portal 2026-09-14: administrador oscar criado; lider mantido temporariamente para testes"
          ,"Atlas 2026-09-14: camada canônica PostgreSQL carregada e reconciliada (produto, fornecedor, comprador e loja; sem RMS/RM direto)"
          ,"Atlas 2026-09-14: fornecedor mestre separado de serviço Portal; não contratados sem acesso e 20 acessos legados isolados para revisão"
          ,"Atlas interno 2026-09-14: tela branca do iframe corrigida em fail-open; HTTPS 8090 e sintaxe JS validados localmente"
          ,"Atlas interno 2026-09-14: Compra CRBS bloqueia valores demonstrativos e expõe apenas campos com fonte canônica"
          ,"Atlas interno 2026-09-14: módulos decisórios integralmente bloqueados até validar dados e fórmulas canônicas"
          ,"Atlas F1 2026-10-13: pacote técnico de auditoria NCM/CEST, XML × cadastro, regras PDV_TAB_TRIB, cálculo observado e simulador offline de preço criado; validado_local, execução e aceite fiscal pendentes."
          ,"Atlas F2 2026-10-13: fluxo RMS de pagar, receber, cartões, vales e antecipações mapeado; pago no RMS permanece pago_registrado até a conciliação bancária."
          ,"Atlas F3 2026-10-13: taxonomia de pagamentos separa natureza econômica, forma, efeito no caixa e efeito na DRE; classificador preserva sem_classificacao e aguarda aceite."
        ,
          "Atlas 2026-09-17: painel financeiro interno incluído na tela de compras; Portal do Fornecedor preservado (validado local)"
          ,"Portal 2026-09-17: sessão interna inicia sem fornecedor e só consulta dados após seleção explícita (build e HTTP 200)"
          ,"Atlas 2026-09-18: Carteira, fornecedores e compra consultam a carga atual `fornecedores`; dependência `atlas_fornecedores` e status partial removidos (build e API pública validados)"
          ,"Atlas público 2026-09-18: coluna Confiança e textos complete removidos; tela de Compra recebe rolagem vertical (Worker d0f06329 publicado e HTTPS validado; rolagem, fornecedor demonstrativo e cache da Compra corrigidos)"
          ,"Portal do Fornecedor 2026-09-18: build recompilado e runtime Node restaurado após 502; rotas interna e pública HTTP 200."
          ,"Portal do Fornecedor 2026-09-19: Perdas Físicas removida do fallback demonstrativo; exibe somente Agenda 520 canônica por fornecedor (build e HTTP 200)."
          ,"Portal do Fornecedor 2026-09-19: dimensão de estoque ganhou cabeçalhos legíveis por quebra de linha e coluna Estoque nas lojas, consolidada por SKU (build e HTTP 200)."
          ,"Portal do Fornecedor 2026-09-19: novo fornecedor só é liberado após carga RMS conferida no PostgreSQL; Controle de Acesso exibe o estado auditável (build verde; aguardando primeira carga real)."
          ,"Portal do Fornecedor 2026-09-20: carga RMS completa validada em BRF 11640; divergência de 16 chaves duplicadas de estoque corrigida por consolidação SKU+loja."
          ,"Portal do Fornecedor 2026-09-20: HTML sem cache impede manifesto de bundles obsoleto e restaura carregamento dos valores após build."
          ,"Atlas 2026-09-20: staging agregado de MOVCAIXAGZ criado com modalidade nula rastreada como DINHEIRO/D0; migration aplicada, primeira carga aguarda janela DBA."
          ,"Portal do Fornecedor 2026-09-20: ofertas de validade passam a ser carregadas por leitura oficial do CometNet e conciliadas por produto RMS + fornecedor no PostgreSQL; filial 27 validada com 36 registros."
          ,"Portal do Fornecedor 2026-09-20: rebaixas vigentes carregadas do CometNet por capa, item e filial; 16.728 fatos canônicos sem rateio inventado."
          ,"Portal do Fornecedor 2026-09-20: abertura por fornecedor agora publica cadastro, catálogo e estoque primeiro; vendas detalhadas e menus secundários hidratam em segundo plano, sem dados do fornecedor anterior."
          ,"Atlas 2026-09-20: snapshot operacional SKU×fornecedor publicado no PostgreSQL com corte, hash e linhagem; 37 linhas preservam SEM_BASE_FINANCEIRA, sem rateio por SKU."
          ,"Atlas público 2026-09-20: tela de Compra preservada recuperada do worktree candidato e republicada no Worker 5525f536; painel financeiro mantido explicitamente sem base financeira."
          ,"Portal do Fornecedor 2026-09-23: Controle de Acesso mostra somente fornecedores liberados; o bloqueio retira a linha após confirmação e acordos ativos podem ser impressos (build local concluído; deploy pendente)."
          ,"MAOADC 2026-09-23: watcher de bicos Grok corrigido para usar somente os binários do usuário do serviço; bico pendente retomado sem PermissionError."
          ,"Portal do Fornecedor 2026-09-23: Fill Rate considera falta apenas após 30 dias sem faturamento; parcial não integra a base e competência jovem é prévia."
          ,"Portal do Fornecedor 2026-09-24: Validar carga RMS inicia subprocesso assíncrono, evita 504 e bloqueia duplicidade por fornecedor."
          ,"Portal do Fornecedor 2026-09-24: Contas a Receber voltou a exibir débitos vencidos, destacados sem alterar saldo ou cálculo financeiro."
          ,"Portal do Fornecedor 2026-09-23: curva ABC dinâmica corrigida para comparar SKUs por subgrupo mercadológico na janela móvel de 90 dias."
          ,"Portal do Fornecedor 2026-09-23: fornecedor pode imprimir a proposta de rebaixa com itens, filiais, período e valores estimados antes do envio."
          ,"Portal do Fornecedor 2026-09-23: acordo impresso traz URL canônica e passo a passo do primeiro acesso com código RMS, e-mail corporativo e troca da senha inicial."
          ,"Coliseum 2026-09-23: tese consultiva propõe 1 promotor a cada 80 salários mínimos em vendas, alocado por demanda da loja e solicitado via AppCom sem comprador como gargalo."
          ,"Coliseum 2026-09-24: debate de promotores exige alternativas independentes, crítica do modelo-base e pilotos comparáveis; não há ratificação automática da fórmula inicial."
          ,"MAOADC 2026-09-24: projeto Células de Disponibilidade via AppCom criado com filtro causal, teto contínuo de 80 SM, fases 0–5 e piloto controlado."
          ,"MAOADC 2026-09-24: projeto Células de Disponibilidade reduzido a três fases, com trilhas paralelas de backend/dados, UX e validação."
          ,"MAOADC 2026-09-24: time de Células de Disponibilidade corrigido para Codex, Grok, Reasonix e Z.AI; agentes indisponíveis retirados da alocação ativa."
          ,"MAOADC 2026-09-24: grafo do projeto criado e Fase 0 iniciada; Reasonix executa o motor sombra, Grok revisa e Z.AI participa de forma consultiva até habilitação formal no Harness."
          ,"Atlas 2026-09-25: espaçamento vertical da coluna Comprar uniformizado em 25px entre as caixas (commit 79f8ac5; staging atualizado; publicação pendente)."
          ,"Atlas 2026-09-27: alinhamento da pesquisa de preço e cinco conjuntos de condições aplicado diretamente na montagem para vencer regras CSS legadas (commit 96ba429; publicação Wrangler pendente)."
          ,"Painel Líder 2026-09-28: aba Protocolos corrigida; app.js não aborta mais quando o botão de navegação não possui span, e cache-bust atualizado."
          ,"Portal do Fornecedor 2026-09-28: inclusão inicia carga RMS assíncrona, mantém o gate de completude e só ativa degustação após confirmação; evita 504."
          ,"Cerberus Fase 2 2026-09-30: ingestor sintético com allowlist, rejeição de conteúdo sensível, redação por papel, journal 0600/hash chain/fsync, dedup persistente, retenção, limites e backpressure; commit 5d135ea; produção NO-GO."
          ,"Cerberus Fase 3 2026-10-01: API isolada com token HMAC configurável, RBAC deny-by-default, CORS allowlist, resolução assinada/idempotente, health autenticado e alertas redigidos; commit ce85ac1; produção NO-GO."
          ,"Cerberus Fase 4 2026-10-02: Centro de Segurança distingue DEMO/CONNECTED/OFFLINE, mostra fonte/idade/integridade, marca fixtures e restringe briefing por papel; commit 5fc1a79; produção NO-GO."
          ,"Portal → CometNet 2026-10-02: WAR candidato da fila de rebaixas gerado e validado localmente; publicação bloqueada até provisionar URL HTTPS, token e mapa comprador→segmentos no WildFly."
          ,"Portal 2026-10-02: cópia integral isolada Rebaixa MAOADC criada com rota, API, tabela e e-mail próprios; build validado localmente, fluxo original preservado."
          ,"CometNet 2026-10-02: Rebaixa MAOADC adicionada dentro de Rebaixa dos fornecedores com página/servlet próprios; WAR candidato gerado, publicação WildFly pendente."
          ,"Cerberus Fase 5 2026-10-07: runner Reasonix v4 aplicado no /opt, com timeouts 1200/1260 para parecer, 2400/2700 para execução, doctor fail-closed, allowlist e projeto obrigatório; serviço recarregado e ativo (PID 3041916)."
          ,"Cerberus Fase 5 2026-10-07: bico operacional msg_20261007_025415_069 concluído; leitura de maoadc-arena, doctor fail-closed e timeouts 1200/1260 confirmados no processo vivo, sem edição de arquivos."
          ,"Cerberus 2026-10-15: claim de upload staged endurecido com hash no predicado atômico; gate offline 8/8 e build PASS; produção continua NO-GO."
          ,"RM/RMS 2026-10-14: projeto Fill Rate CDAM → Lojas criado com quatro estados, KPIs, dimensões, cortes e gates; debate do Coliseu pendente antes de schema/ETL."
          ,"Atlas 2026-10-14: menu Fill Rate CDAM → Lojas adicionado como módulo de análise sem dados fictícios; filtros e KPIs aguardam contrato e base validados."
          ,"RM/RMS 2026-10-14: Fase 0 do Fill Rate documenta responsáveis (Codex, Grok/DeepSeek, operação), linguagens e gates G0–G5; histórico causal bloqueado sem snapshot."
        ],
        pending: [
          "Ler bico aviso DeepSeek: msg_20260729_160009_641 (mailbox local ~/.agent-collab/mailbox)",
          "ACK DeepSeek: usuario informou resposta, mas evidencia local nao localizada nos bicos msg_20260803_140346_182/msg_20260803_152451_785",
          "Auditoria Codex registrada em 2026-08-03_auditoria-codex_fases-4-7_rm-rms.md",
          "DBA RM confirmar se read-only existente cobre RH-015/views agregadas ou exige usuario/role dedicado",
          "DBA RMS devolver evidência formal de grants read-only em views agregadas",
          "Controladoria/RH/Folha assinar definicao V1 de receita/custo RH-015",
          "Operacao/TI preencher e assinar termo de lojas reais e de-para",
          "Seguranca/LGPD assinar termo de retencao, supressao, perfis e aceite no login",
          "Executar migrations em PostgreSQL local autorizado quando houver ambiente definido",
          "Oscar acionar aceites externos do pacote RM/docs/solicitacoes-auditoria-aceites-rm-rms-2026-08-03.md",
          "Revisão funcional/Gemini das entregas Portal Fornecedor 2026-08-06 antes de qualquer promoção para homologado"
          ,"Revisão DBA/funcional dos agregados P0/P1/P2, de-para de fornecedor virtual e dry-run SQLite/cache do Passo 5"
          ,"Aceite da matriz P0: marca opcional, lifecycle, exceções de fornecedor e tipo de item antes do dry-run SQLite"
          ,"Revisão independente/Gemini do pacote MAOADC Core antes de qualquer promoção"
          ,"Atlas interno: validar leitura autenticada no navegador e conectar progressivamente estoque, vendas, pedidos, preços e regras canônicas"
          ,"Atlas: solicitar janela DBA para primeira extração MOVCAIXAGZ e validar reconciliação de contagem, soma e checksum antes de qualquer consumo na interface"
          ,"Portal: definir a agenda operacional para importar diariamente validade e rebaixas após o fechamento das fontes."
          ,"Atlas: não calcular caixa por SKU até existirem corte conciliado, CP/CR, reserva, política aprovada e chave financeira compatível."
          ,"Atlas F1: solicitar janela DBA, confirmar joins/datas, executar amostra fiscal agregada e obter revisão independente da Controladoria/tributarista antes de qualquer conclusão ou publicação de preço."
          ,"Atlas F2: solicitar janela DBA/Financeiro para amostra agregada venda → recebível → crédito/antecipação e definir a futura regra de conciliação bancária."
          ,"Atlas F3: obter de-para aprovado de contas/tipos de despesa/centros de custo; executar amostra agregada; revisar tributos, folha, estrutural, dívida e CAPEX; definir rateio da Loja 24 sem inventar driver."
          ,"Cerberus Fase 0: runtime allowlisted separado do diretório Git, servidor com deny-by-default e bind loopback; decisão agent-memory-20260929-1fc15c74401f4314."
          ,"Cerberus: avaliar endurecimentos não bloqueantes (msg_id, leases em early-returns, template e criação atômica do prompt)."
          ,"Coliseu: revisar projeto Fill Rate CDAM → Lojas, snapshot de estoque, regra de rateio, lista canônica de CDAM e tratamento de cancelamentos/substituições antes da execução."
        ],
        blockers: ["Instalação/reload da unit systemd depende de acesso root; supervisor atualizado está ativo no host.", "Proxy autenticado ainda não foi definido no code-map; acesso externo permanece fechado por loopback."],
        codeVolume: {
          deliveriesInScope: 64,
          deliveriesOutOfScope: 0,
          linesInScope: null,
          linesOutOfScope: null,
          outOfScopeItems: [],
          measuredAt: "2026-10-18",
          method: "Entregas registradas no CODE; ordem visual da planilha publicada no Worker db8fcc21; node --check e deploy PASS; CSV preservado."
        },
        kpis: {
          "CODE-01": "Ativo",
          "CODE-02": "Ativo",
          "CODE-03": "Ativo",
          "CODE-04": "Ativo",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "Ativo",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        avatar: "DS",
        role: "Executor",
        status: "Ativo",
        focus: "Execução de backend, dados, integrações, algoritmos e testes lógicos.",
        currentTask: "Executor técnico disponível para fases autorizadas pelo Harness.",
        branch: "Harness: branch por fase autorizada",
        checkpoint: "2026-08-15 — papel atualizado para Executor no MAOADC Project Harness",
        done: [
          "Slot cadastrado no Controle de Código",
          "Pacote onboarding maoadc-bootstrap-deepseek",
          "Bico aviso de disponibilidade → grok, gemini, codex, all (mailbox local)"
        ],
        pending: [
          "Concluir ACK_KPIS_DEV_CONTROLE_CODIGO antes de codificar",
          "Primeira entrega de código RM/RMS com crédito no próprio card"
        ],
        blockers: [
          "Mailbox canônica /opt/agent-collab root-only — usar ~/.agent-collab até ACL liberada"
        ],
        codeVolume: {
          deliveriesInScope: 0,
          deliveriesOutOfScope: 0,
          linesInScope: null,
          linesOutOfScope: null,
          outOfScopeItems: [],
          measuredAt: "2026-08-15",
          method: "Sem fonte Git/medição atribuída ao DeepSeek neste snapshot."
        },
        kpis: {
          "CODE-01": "N/A",
          "CODE-02": "Ativo",
          "CODE-03": "N/A",
          "CODE-04": "N/A",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "N/A",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      },
      {
        id: "muse",
        name: "Muse",
        avatar: "MU",
        role: "Executor",
        status: "Ativo",
        focus: "Execução de frontend, UX/UI, telas e experiência de uso.",
        currentTask: "Executor de interface disponível para fases autorizadas pelo Harness.",
        branch: "Harness: branch por fase autorizada",
        checkpoint: "2026-08-15 — papel atualizado para Executor no MAOADC Project Harness",
        done: [],
        pending: [
          "Aguardar fase com plano aprovado e delegação explícita no Harness."
        ],
        blockers: [],
        codeVolume: {
          deliveriesInScope: 0,
          deliveriesOutOfScope: 0,
          linesInScope: null,
          linesOutOfScope: null,
          outOfScopeItems: [],
          measuredAt: "2026-08-15",
          method: "Sem fonte Git/medição atribuída ao Muse neste snapshot."
        },
        kpis: {
          "CODE-01": "N/A",
          "CODE-02": "Ativo",
          "CODE-03": "N/A",
          "CODE-04": "N/A",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "N/A",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      },
      {
        id: "k3",
        name: "Kimi (k3)",
        avatar: "K3",
        role: "Executor",
        status: "Ativo",
        focus: "Backend/core Rust/Go, segurança de runtime e testes.",
        currentTask: "2026-09-04 — Contrato de Realidade v1 entregue: maoadc-arena contracts/reality-contract + módulo reality no cerberus (bico msg_20260904_040248_399).",
        branch: "maoadc-arena/contracts",
        checkpoint: "2026-09-04 — DEV-01: schema reality-contract/v1 + validador fail-closed Rust (reality.rs + CLI contract-validate/contract-transition, exits 6/7); 82 testes cargo OK + 58 unittest pendencias OK; commit c30e3a5; registro 2026-09-04_dev-01_contrato-realidade-estados-ortogonais_k3.md",
        done: [
          "2026-09-04 — Bico [EXECUCAO-AUTORIZADA][DEV-01] Contrato de Realidade (msg_20260904_040248_399): schema v1, 5 estados ortogonais, falsificadores tipados, transições mínimas, rejeição de contratos incompletos, 82 testes cargo + 9 testes CLI",
          "2026-09-03 — Bico [EXECUCAO-AUTORIZADA] schema pendências operacionais (msg_20260903_205025_404): contrato v1 consumido por Cockpit/Painel Líder, validador stdlib, adapters collab+harness, 58 testes, evidências reproduzíveis",
          "2026-09-03 — Bico [EXECUCAO-AUTORIZADA] dependency-proxy Go (msg_20260902_235553_341): proxy :8094, Task Token HMAC-SHA256, whitelist de registries, cache imutável SHA-256, provenance.jsonl",
          "2026-09-03 — Onboarding: alvo em protocol-targets.json + protocol sync + cláusula CONTROLE-CODIGO-LIDER em ~/.kimi-code/AGENTS.md"
        ],
        pending: [],
        blockers: [],
        codeVolume: {
          deliveriesInScope: 3,
          deliveriesOutOfScope: 0,
          linesInScope: 4546,
          linesOutOfScope: null,
          outOfScopeItems: [],
          measuredAt: "2026-09-04",
          method: "Soma de diffs: dependency-proxy main.go+main_test.go (744) + contrato pendencias-operacionais/v1 commit dcb64e0 (2053) + Contrato de Realidade v1 commit c30e3a5 (1749). Evidências em docs/controle-codigo/evidence/."
        },
        kpis: {
          "CODE-01": "Ativo",
          "CODE-02": "Ativo",
          "CODE-03": "Ativo",
          "CODE-04": "N/A",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "Ativo",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      },
      {
        id: "reasonix",
        name: "Reasonix",
        avatar: "RX",
        role: "Executor",
        status: "Ativo",
        focus: "Automação, integração, validação, observabilidade e tooling.",
        currentTask: "Células de Disponibilidade — projeto detalhado para implementação em quatro ondas; Onda A/B autorizáveis em modo sombra.",
        branch: "Harness: branch por fase autorizada",
        checkpoint: "2026-09-29 — projeto de implementação a75b2c1; capacidade sem headcount, TypeScript/PostgreSQL, gates e quatro ondas definidos; CODE 2026-09-29_projeto-implementacao-celulas-disponibilidade_codex.md.",
        done: [
          "2026-09-03 — Registro operacional como executor de desenvolvimento ativo no MAOADC Project Harness",
          "2026-09-24 — Fase 0 motor sombra: contratos, portão causal, células, horas/teto e linhagem; bico msg_20260924_165812_998; commit 0d36e9439d58d61b199553dde48dd4741c0e000a; validação 29/29",
          "2026-09-24 — Fase 0 ajustes N1–N10: bico msg_20260924_184945_161; commit bb788efb818ef64dd3363ae0660a3eb63e84ba46; validação 59/59; sem merge",
          "2026-09-25 — Correção de cortes multi-semana; commit ca6486b9c3716da1b23e4396ebc4b5f4d850b5ff; validação 60/60; sem merge",
          "2026-09-28 — Integração limpa do motor sombra (226a071) e ETL read-only/painel interno (ad78728); validação 63/63",
          "2026-09-29 — Projeto detalhado Coliseum, commit a75b2c1; quatro ondas, controle trimestral/semanal e critérios GO/HOLD/NO-GO; CODE 2026-09-29_projeto-implementacao-celulas-disponibilidade_codex.md"
        ],
        pending: [
          "Provisionar portal.estoque_corte por ETL somente leitura e formalizar dono da fila de exceções",
          "Obter decisão do Coliseum, ETL histórico, dono da fila e parecer jurídico antes de piloto; sem comunicação real ou deploy"
        ],
        blockers: [],
        codeVolume: {
          deliveriesInScope: 4,
          deliveriesOutOfScope: 0,
          linesInScope: 4451,
          linesOutOfScope: null,
          outOfScopeItems: [],
          measuredAt: "2026-09-28",
          method: "Commits 0d36e9439d58d61b199553dde48dd4741c0e000a e bb788efb818ef64dd3363ae0660a3eb63e84ba46 em branches isoladas do Harness; linhas adicionadas reportadas pelo Git."
        },
        kpis: {
          "CODE-01": "N/A",
          "CODE-02": "Ativo",
          "CODE-03": "N/A",
          "CODE-04": "N/A",
          "CODE-05": "Ativo",
          "CODE-06": "N/A",
          "CODE-07": "Ativo",
          "CODE-08": "N/A",
          "CODE-09": "Ativo",
          "CODE-10": "N/A"
        }
      }
    ],
    kpis: [
      { id: "CODE-01", name: "Check verde", status: "Parcial", detail: "Build, lint, typecheck e testes relevantes passam antes de fechar a entrega." },
      { id: "CODE-02", name: "Gate respeitado", status: "Ativo", detail: "Toda mudança de código passa por ticket, escopo claro e caminho canônico." },
      { id: "CODE-03", name: "Teste para lógica crítica", status: "N/A", detail: "Toda regra de negócio nova ou alterada tem teste proporcional ao risco." },
      { id: "CODE-04", name: "Coautoria ou revisão registrada", status: "Ativo", detail: "Mudanças sensíveis têm revisão, auditoria ou decisão registrada." },
      { id: "CODE-05", name: "Overclaim zero", status: "Ativo", detail: "Não declarar pronto, validado ou em produção sem evidência real." },
      { id: "CODE-06", name: "Retrabalho pós-auditoria", status: "N/A", detail: "Correções necessárias depois de revisão; quanto menor, melhor." },
      { id: "CODE-07", name: "Origem rastreada", status: "Ativo", detail: "Mudança importante aponta para pedido, decisão, commit, checkpoint ou referência." },
      { id: "CODE-08", name: "Complexidade sob controle", status: "Parcial", detail: "Evitar crescer monólito, duplicação, gambiarra e acoplamento sem necessidade." },
      { id: "CODE-09", name: "Não piorar legado", status: "Ativo", detail: "Cada alteração preserva ou melhora a saúde do código existente." },
      { id: "CODE-10", name: "Defeito escapado", status: "N/A", detail: "Bugs que passaram por nós e apareceram em uso real, homologação ou produção." }
    ],
    files: [
      "/home/administrador/maoadc-protocol-panel/data.js",
      "/home/administrador/maoadc-protocol-panel/docs/controle-codigo-painel.md",
      "/home/administrador/RM/GOVERNANCA_AGENTES.md",
      "/home/administrador/RM/docs/homologacao-rh-folha-kpis.md",
      "/home/administrador/RM/docs/catalogo-kpis-rh.md",
      "/home/administrador/RM/docs/checklist-fechamento-mensal-folha.md",
      "/home/administrador/RM/relatorios/kpis/ACEITE_FUNCIONAL_RH-007_RH-009_GROK_2026-07-29.md",
      "/home/administrador/RM/docs/controle-codigo/2026-08-06_fase-4_portal-pedidos-remove-loja-cdam_codex.md",
      "/home/administrador/RM/docs/controle-codigo/2026-08-06_fase-4_portal-relatorio-mix-retqcob_codex.md",
      "/home/administrador/RM/docs/controle-codigo/2026-08-06_fase-4_portal-contas-receber-deducoes_codex.md",
      "/home/administrador/portal-fornecedor/src/routes/_portal.contas-receber.tsx",
      "/home/administrador/portal-fornecedor/src/routes/_portal.relatorio-mix.tsx",
      "/home/administrador/maoadc-arena/service-plane/circuit-breaker/main.go",
      "/home/administrador/maoadc-arena/service-plane/circuit-breaker/breaker.go",
      "/home/administrador/maoadc-arena/trusted-core/cerberus/",
      "/home/administrador/maoadc-arena/service-plane/artifact-service/",
      "/home/administrador/maoadc-arena/service-plane/dependency-proxy/",
      "/home/administrador/maoadc-arena/service-plane/onboard/",
      "/home/administrador/maoadc-arena/control-room/",
      "/home/administrador/RM/docs/controle-codigo/2026-09-03_fase-4_disjuntor-evolutivo_grok.md",
      "/home/administrador/maoadc-project-harness/harness.py",
      "/home/administrador/maoadc-project-harness/delivery_contract.py",
      "/home/administrador/maoadc-arena/docs/RELEASE_MANIFEST.md",
      "/home/administrador/RM/docs/controle-codigo/2026-09-03_fase-p0-p1_harness-contrato-release-manifest_grok.md",
      "/home/administrador/RM/docs/controle-codigo/2026-09-03_execucao_k3-reasonix-devs-ativos_grok.md",
      "/home/administrador/maoadc-project-harness/tests/test_active_executors.py",
      "/home/administrador/RM/docs/controle-codigo/2026-09-03_execucao_claude-inativo-devs_grok.md",
      "/opt/agent-collab/collab.py",
      "/opt/agent-collab/mailbox_watcher.py",
      "/opt/agent-collab/protocol-targets.json"
    ],
    checkpoint: "2026-09-03 — Claude inativo na lista operacional; CODE 2026-09-03_execucao_claude-inativo-devs_grok.md"
  },
  controlFamilies: [
    {
      name: "SO/ACL/mandato/path",
      strength: "Alta para não-root",
      evidence: "Permissões, grupos, ACL, chattr, mandato root-owned e whereami.",
      status: "parcial"
    },
    {
      name: "Protocolo escrito",
      strength: "Conduta e especificação",
      evidence: "Regra na fonte canônica e cópias sincronizadas.",
      status: "ativo"
    },
    {
      name: "Gates/hooks/ticket/lock",
      strength: "Dente mecânico no harness",
      evidence: "Teste real de deny/allow, log do gate, ticket e lock.",
      status: "parcial"
    },
    {
      name: "Rito multiagente/event_id",
      strength: "Freio de processo",
      evidence: "Decision record, decision verify, bico final e red team independente.",
      status: "ativo"
    },
    {
      name: "Watcher/watchdog/session hooks",
      strength: "Automação do rito",
      evidence: "Serviço/PM2/cron ativo, logs e health verificado.",
      status: "documentado"
    },
    {
      name: "Git + deploy canônico",
      strength: "Anti-edit-prod",
      evidence: "Commit, push, deploy por script e runtime confirmado.",
      status: "parcial"
    },
    {
      name: "Rede/host/backup/failover",
      strength: "Perímetro e continuidade",
      evidence: "Serviço ativo, cron, backup restaurável, TLS e monitoramento.",
      status: "documentado"
    },
    {
      name: "Auth/roles/tenant no app",
      strength: "Segurança de runtime",
      evidence: "Teste de autorização, isolamento tenant e schemas/API.",
      status: "documentado"
    },
    {
      name: "Ingestão + untrusted_context",
      strength: "Anti prompt-injection de conteúdo",
      evidence: "Conversão marcada, banner, delimitador neutralizado e uso passivo.",
      status: "ativo"
    },
    {
      name: "Autoridade humana de Oscar",
      strength: "Soberania final",
      evidence: "Autorização no chat do executor ou decisão com lastro verificável.",
      status: "ativo"
    }
  ],
  risks: [
    {
      name: "Editar produção/VPS3 na mão",
      protocol: "Sim",
      enforcement: "Fraco/parcial",
      closesVector: "Não",
      gap: "SSH/scp/rsync para prod e edição em runtime fora do fluxo Git/deploy.",
      mitigation: "Deny ou Tier 4 verificado para acesso manual a prod e escrita fora do caminho Git."
    },
    {
      name: "Schema/migration/dados",
      protocol: "Sim",
      enforcement: "Parcial por path/ticket",
      closesVector: "Não",
      gap: "SQL destrutivo via shell ou arquivo com nome inocente.",
      mitigation: "Classificar DROP/TRUNCATE/DELETE amplo/ALTER perigoso como admin/sensitive."
    },
    {
      name: "Segredos/token/.env/chaves",
      protocol: "Sim",
      enforcement: "Parcial em paths de escrita",
      closesVector: "Não",
      gap: "Leitura/exfiltração por cat, grep, stdout, chat ou path alternativo.",
      mitigation: "Restringir leitura de paths de segredo e impedir impressão em stdout/chat/checkpoint."
    },
    {
      name: "Shell administrativo/sudoers/permissão",
      protocol: "Sim",
      enforcement: "Médio no PreToolUse",
      closesVector: "Não plenamente",
      gap: "event_id sem decision verify, payload fail-open e ofuscação.",
      mitigation: "Gate chama decision verify; payload inválido em ferramenta sensível falha fechado."
    }
  ],
  sources: [
    {
      title: "Protocolo MAOADC — fonte canônica do runtime",
      path: "/lider/.agent-collab/protocol/PROTOCOLO_MAOADC.md",
      family: "Protocolo escrito",
      status: "ativo",
      summary: "Fonte normativa vigente para comportamento dos agentes; cópias de bootstrap e payload são derivações, não novas autoridades.",
      tags: ["fonte-canônica", "normativo", "tiers", "anti-overclaim"]
    },
    {
      title: "Enciclopédia MAOADC Coliseum",
      path: "/home/administrador/maoadc-project-harness/docs/ENCICLOPEDIA_MAOADC_COLISEUM.md",
      family: "Protocolo escrito",
      status: "documentado",
      summary: "Explica a arquitetura, a hierarquia das fontes, o Harness, RAG, Constelações, BICOs, CODE e limites operacionais.",
      tags: ["coliseum", "harness", "rag", "onboarding"]
    },
    {
      title: "Manual de Uso do MAOADC",
      path: "/home/administrador/maoadc-project-harness/docs/MANUAL_USO_MAOADC.md",
      family: "Onboarding e operação",
      status: "documentado",
      summary: "Guia diário para registrar demandas, usar Harness, debates, BICOs, Painel Líder, Cerberus, CODE, testes e encerramento.",
      tags: ["manual", "uso-diário", "onboarding", "equipe"]
    },
    {
      title: "Atlas do Conhecimento — índice de fontes",
      path: "/home/administrador/maoadc-protocol-panel/assets/knowledge-constellation/sources.json",
      family: "Ingestão + untrusted_context",
      status: "pilot",
      summary: "Índice piloto de ideias, projetos, contratos, evidências, decisões, agentes, bloqueios e aprendizados; não concede autorização.",
      tags: ["conhecimento", "rag", "proveniência", "pilot"]
    },
    {
      title: "Protocolo Segurança MAOADC",
      path: "/home/administrador/PROTOCOLO_SEGURANCA_MAOADC.md",
      family: "Protocolo escrito",
      status: "ativo",
      summary: "Fonte canônica local com tiers, locks, decisão, portabilidade Lider e matriz de enforcement residual.",
      tags: ["fonte-canônica", "tiers", "lider", "gates", "anti-overclaim"]
    },
    {
      title: "Snapshot MAOADC Lider",
      path: "/home/administrador/2026-07-27-maoadc-lider-snapshot.md",
      family: "Git + deploy canônico",
      status: "parcial",
      summary: "Baseline factual do rollout Lider: staging real, status pronto_com_restricoes e gaps bloqueantes.",
      tags: ["lider", "snapshot", "rollout", "gaps"]
    },
    {
      title: "Protocolo Bootstrap Lider",
      path: "/home/administrador/maoadc-bootstrap-lider/PROTOCOLO_MAOADC.md",
      family: "Protocolo escrito",
      status: "documentado",
      summary: "Cópia de protocolo empacotada para bootstrap do Lider.",
      tags: ["lider", "bootstrap", "protocolo"]
    },
    {
      title: "AGENTS Codex Bootstrap",
      path: "/home/administrador/maoadc-bootstrap-lider/AGENTS.codex.md",
      family: "Protocolo escrito",
      status: "documentado",
      summary: "Instruções geradas para Codex no pacote de bootstrap Lider.",
      tags: ["codex", "bootstrap", "instruções"]
    },
    {
      title: "GEMINI Bootstrap",
      path: "/home/administrador/maoadc-bootstrap-lider/GEMINI.md",
      family: "Protocolo escrito",
      status: "documentado",
      summary: "Instruções geradas para Gemini no pacote de bootstrap Lider.",
      tags: ["gemini", "bootstrap", "instruções"]
    },
    {
      title: "Graphify Skill Lider",
      path: "/home/administrador/maoadc-bootstrap-lider/GROK_GRAPHIFY_SKILL.md",
      family: "Ingestão + untrusted_context",
      status: "documentado",
      summary: "Skill Graphify para navegação passiva de projeto, sem autoridade de decisão.",
      tags: ["grok", "graphify", "índice-passivo"]
    },
    {
      title: "README Instalação Manual Lider",
      path: "/home/administrador/maoadc-bootstrap-lider/README-INSTALACAO-MANUAL.md",
      family: "Watcher/watchdog/session hooks",
      status: "documentado",
      summary: "Procedimento manual do bootstrap Lider e instalação de artefatos.",
      tags: ["lider", "instalação", "bootstrap"]
    },
    {
      title: "Pacote Access Lider",
      path: "/home/administrador/maoadc-access-lider-20260722/README.md",
      family: "SO/ACL/mandato/path",
      status: "parcial",
      summary: "Pacote de acesso com maoadc-admin, whereami, mandates e code-map vazio.",
      tags: ["acesso", "whereami", "mandatos", "code-map"]
    },
    {
      title: "Pacote Bico Lider",
      path: "/home/administrador/maoadc-bico-lider-20260722/README.md",
      family: "Watcher/watchdog/session hooks",
      status: "parcial",
      summary: "Pacote do bico com collab, mailbox watcher e payload de instruções.",
      tags: ["bico", "watcher", "collab"]
    },
    {
      title: "Payload AGENTS Lider",
      path: "/home/administrador/maoadc-bico-lider-20260722/payload/repo/AGENTS.md",
      family: "Protocolo escrito",
      status: "documentado",
      summary: "Arquivo de instrução do payload de bico Lider.",
      tags: ["payload", "agents", "lider"]
    },
    {
      title: "Payload CLAUDE Lider",
      path: "/home/administrador/maoadc-bico-lider-20260722/payload/repo/CLAUDE.md",
      family: "Protocolo escrito",
      status: "documentado",
      summary: "Arquivo de instrução Claude do payload de bico Lider.",
      tags: ["payload", "claude", "lider"]
    },
    {
      title: "Constelação da VPS - dados",
      path: "/home/administrador/maoadc-protocol-panel/assets/vps-constellation/constellation.json",
      family: "Ingestão + untrusted_context",
      status: "local",
      summary: "Snapshot JSON da isaura com projetos, diretórios e arquivos seguros; exclui segredos e dados brutos.",
      tags: ["isaura", "constelacao", "snapshot", "local"]
    },
    {
      title: "Constelação da VPS - relatório",
      path: "/home/administrador/maoadc-protocol-panel/assets/vps-constellation/REPORT.md",
      family: "Ingestão + untrusted_context",
      status: "local",
      summary: "Relatório resumido do snapshot local da VPS isaura.",
      tags: ["isaura", "constelacao", "relatorio"]
    },
    {
      title: "Gerador da Constelação da VPS",
      path: "/home/administrador/maoadc-protocol-panel/scripts/build-vps-constellation.py",
      family: "Ingestão + untrusted_context",
      status: "local",
      summary: "Script que regenera o snapshot da VPS para a aba Constelação.",
      tags: ["isaura", "constelacao", "gerador"]
    },
    {
      title: "Projeto Controle de Acesso",
      path: "/home/administrador/controle-acesso/PROJETO_SEGURANCA.md",
      family: "SO/ACL/mandato/path",
      status: "documentado",
      summary: "Documento do projeto de segurança e controle de acesso.",
      tags: ["controle-acesso", "segurança", "acl"]
    },
    {
      title: "Controle de Acesso README",
      path: "/home/administrador/controle-acesso/README.md",
      family: "SO/ACL/mandato/path",
      status: "documentado",
      summary: "Visão operacional do módulo local de controle de acesso.",
      tags: ["controle-acesso", "readme"]
    },
    {
      title: "Owners de Protocolo",
      path: "/home/administrador/controle-acesso/config/protocol_owners.json",
      family: "Autoridade humana de Oscar",
      status: "documentado",
      summary: "Configuração de owners para protocolos no controle de acesso.",
      tags: ["owners", "governança", "json"]
    },
    {
      title: "RM v1 Protocol",
      path: "/home/administrador/controle-acesso/config/protocols/rm_v1.json",
      family: "SO/ACL/mandato/path",
      status: "documentado",
      summary: "Definição JSON de protocolo RM dentro do controle de acesso.",
      tags: ["rm", "json", "controle-acesso"]
    }
  ]
};
