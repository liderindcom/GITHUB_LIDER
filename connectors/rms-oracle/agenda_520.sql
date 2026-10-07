-- Agenda 520 direta do RMS. A conta reproduz o núcleo da
-- DESEN.PROC_COBRANCA_AGEN520, sem consultar o CometNet.
-- Requer grants somente leitura nas tabelas listadas no README.
SELECT
  data_agenda AS data,
  TO_CHAR(fornecedor_codigo) AS fornecedor_codigo,
  fornecedor AS fornecedor_nome,
  TO_CHAR(loja_origem) AS loja_codigo,
  origem AS loja_nome,
  TO_CHAR(nota) AS numero_nota,
  serie,
  TO_CHAR(codigo) || TO_CHAR(digito) AS sku,
  descricao AS produto_descricao,
  qtde AS quantidade,
  custo AS valor_unitario,
  subtotal AS valor_total,
  1 AS ocorrencias
FROM (
  SELECT DISTINCT
    eschc_data3 AS data_agenda,
    eschc_nro_nota3 AS nota,
    eschc_ser_nota3 AS serie,
    esitc_codigo AS codigo,
    esitc_digito AS digito,
    git_descricao AS descricao,
    entsai_quanti_un AS qtde,
    entsai_prc_un AS custo,
    entsai_estq_ant AS subtotal,
    git_cod_for AS fornecedor_codigo,
    (SELECT tip_razao_social FROM RMS.AA2CTIPO WHERE tip_codigo = git_cod_for) AS fornecedor,
    eschljc_codigo3 AS loja_origem,
    (SELECT tip_nome_fantasia FROM RMS.AA2CTIPO WHERE tip_codigo = eschljc_codigo3) AS origem
  FROM RMS.AG1IENSA, RMS.AG1FENSA f, RMS.AA3CITEM i, RMS.AA1CTCON
  WHERE tbc_agenda(+) = eschc_agenda
    AND tbc_codigo(+) = 0
    AND eschc_agenda = 520
    AND esitc_codigo = git_cod_item
    AND esitc_digito = git_digito
    AND eschc_data BETWEEN TO_NUMBER('1' || TO_CHAR(ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -12), 'RRMMDD'))
                       AND TO_NUMBER('1' || TO_CHAR(SYSDATE - 1, 'RRMMDD'))
    AND (RMS.F_CRFCFOP(0, NVL(f.entsai_cfop, 0)) = 390 OR NVL(f.entsai_cfop, 0) = 0)
    AND tbc_intg_3 = 'S'
    AND esit_codigo(+) = esitc_codigo
    AND esit_digito(+) = esitc_digito
    AND esch_data(+) = eschc_data
    AND esch_agenda(+) = eschc_agenda
    AND eschlj_codigo(+) = eschljc_codigo
    AND eschlj_digito(+) = eschljc_digito
    AND esch_nro_nota(+) = eschc_nro_nota
    AND esch_ser_nota(+) = eschc_ser_nota
    AND eschljc_codigo = esclc_codigo
    AND NVL((SELECT NVL(fis_situacao, 0)
               FROM RMS.AA1CFISC fis
              WHERE fis.fis_oper = eschc_agenda3
                AND fis.fis_dta_agenda = eschc_data3
                AND fis.fis_nro_nota = eschc_nro_nota3
                AND fis.fis_serie = eschc_ser_nota3
                AND fis.fis_loj_org = eschljc_codigo3), 0) <> '9'
)
