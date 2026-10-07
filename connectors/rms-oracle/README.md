# Conector RMS local

Agente de leitura somente para instalar no servidor do RMS do cliente. O agente
consulta o banco local, normaliza os registros e envia lotes HTTPS ao Portal.

## Princípios

- nunca grava no RMS;
- não depende do CometNet;
- mantém um identificador idempotente por registro;
- armazena a fila localmente quando o Portal estiver indisponível;
- a consulta SQL fica configurada por adaptador e é homologada antes da ativação.

## Instalação inicial

1. Copie `.env.example` para `.env` e preencha uma credencial Oracle somente leitura.
2. Configure `ORACLE_SQL_FILE` com a consulta autorizada da Agenda 520.
3. Execute `python3 agent.py --dry-run` para validar conexão e quantidade.
4. Execute `python3 agent.py --send` somente depois da conferência dos totais.

O agente envia o contrato `agenda_520_perdas_v1`. Nenhuma senha deve ser commitada.

## Tabelas do adaptador Agenda 520

O SQL reproduz o núcleo validado da procedure interna `DESEN.PROC_COBRANCA_AGEN520`.
Ele lê somente `AG1IENSA`, `AG1FENSA`, `AA3CITEM`, `AA1CTCON`, `AA1CFISC` e
`AA2CTIPO`, além de `RMS.F_CRFCFOP`. As tabelas `CONSULTA.TB_AG520_*`
do CometNet não são usadas pelo conector.

O usuário do agente precisa receber `SELECT` somente nessas tabelas e `EXECUTE`
somente na função fiscal necessária. O usuário não deve receber permissão de
`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER` ou `GRANT`.
