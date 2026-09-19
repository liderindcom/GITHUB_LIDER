# DCE - Release 2: leitura fria Vendas Anual

PROBLEMA: primeiro acesso a Vendas Anual recalcula quatro agregacoes sobre vendas_mensal.
EVIDENCIA: baseline 2.80 s; EXPLAIN fez Parallel Seq Scan e removeu 912843 linhas por worker.
CAUSA DIAGNOSTICADA: filtro fornecedor com igualdade ou LIKE e indices simples separados.
AMBIENTE: PostgreSQL integrado do Portal; usuario portal; tabela com 2738939 linhas.
ESCOPO EXATO: src/api.ts, benchmark, migration 009 e script de aplicacao.
FORA DE ESCOPO: valores comerciais, ETL, RMS Oracle, RM SQL Server e frontend.
MODO DE CORRECAO: igualdade no codigo canonico e indice parcial concorrente (fornecedorcodigo, anomes).
RISCOS: criacao concorrente falhar por lock ou indice invalido; codigo com digito perder leitura.
DETECCAO: script verifica plano sem Seq Scan; consulta completa confirmou zero codigos DV mapeados.
CRITERIO DE ABORTO: falha na criacao, plano sequencial ou divergencia de resultado.
ROLLBACK: DROP INDEX CONCURRENTLY IF EXISTS idx_vendas_mensal_fornecedor_anomes; restaurar filtro anterior.
PROVA EXIGIDA PARA GO: build passa; indice existe; EXPLAIN sem Seq Scan; benchmark sem divergencia.
DECISAO: GO tecnico para migration concorrente.
