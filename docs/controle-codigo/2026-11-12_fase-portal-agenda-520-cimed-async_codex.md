# Registro de Código — Agenda 520 Cimed e atualização RMS assíncrona

**Data:** 2026-11-12
**Autor/agente:** codex
**Projeto:** portal-fornecedor
**Fase/backlog:** correção da carga da Agenda 520 e do timeout 504 no painel administrativo
**Pedido/decisão vinculada:** tickets Harness de commit e deploy emitidos por Oscar
**Protocolo aplicado:** `/home/administrador/AGENTS.md`, bloco gerenciado `PROTOCOLO_MAOADC.md` (Tier 3).
**Status:** submetido_a_revisao

## Objetivo

Preservar o código canônico `104949` no importador da Agenda 520 e impedir que a atualização RMS bloqueie a requisição HTTP até causar 504 no Nginx.

## Arquivos editados

- `src/api.ts`
- `scripts/importar_perdas_rms_520_canonicas.py`

## Alterações

- A rota administrativa agora inicia `iniciarCargaRmsAssincrona` e retorna aceite imediato.
- O importador 520 preserva `104949`, mantendo as exceções legadas `101354` e `200069`.

## KPIs CODE

| KPI | Resultado | Evidência |
|---|---|---|
| CODE-01 | Pendente | build e smoke serão executados no fechamento |
| CODE-02 | Ativo | tickets Harness e caminho canônico |
| CODE-03 | Ativo | teste direto do normalizador previsto |
| CODE-04 | N/A | mudança cirúrgica, sem contrato novo |
| CODE-05 | Ativo | 504 não será declarado resolvido antes do smoke |
| CODE-07 | Ativo | este registro e commits do checkout |
| CODE-08 | Ativo | reutiliza worker assíncrono existente |
| CODE-09 | Ativo | exceções legadas preservadas |

## Pendências

- Executar build, publicar e validar HTTP.
- Reprocessar o lote canônico da Agenda 520 após a publicação.
- Confirmar consulta autenticada da Cimed no menu Perdas Físicas.
