import sys
import os
import sqlite3
from pathlib import Path

# Try to import oracledb
try:
    import oracledb
except ImportError:
    print("oracledb is required. Install it using pip.", file=sys.stderr)
    sys.exit(1)

def parse_rms_date(rms_date):
    try:
        s = str(int(rms_date))
        if len(s) == 7 and s[0] == '1':
            year = "20" + s[1:3]
            month = s[3:5]
            day = s[5:7]
            return f"{year}-{month}-{day}"
    except:
        pass
    return "2026-08-01"

def clean_code(value, default="0"):
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    if text.endswith(".0"):
        text = text[:-2]
    return text

def clean_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None

def mercadological_code(depto, secao, grupo, subgrupo):
    return ".".join([
        depto.zfill(3),
        secao.zfill(2),
        grupo.zfill(2),
        subgrupo.zfill(2),
    ])

def technical_label(prefix, code):
    return f"{prefix} {code}"


def rms_number(value):
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    return number


def load_depto_names():
    path = Path(
        "/home/administrador/rms/dados/portal-fornecedor-dados-mestres/depto_nome_comercial_v1.tsv"
    )
    names = {}
    if not path.exists():
        return names
    import csv

    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            code = clean_code(row.get("department_code"), "")
            name = clean_text(row.get("department_name"))
            if code and name:
                names[code] = name
    return names

def load_curated_sheet_data():
    mapping = {}
    import csv
    super_path = Path("/home/administrador/rms/dados/portal-fornecedor-dados-mestres/google_sheet_supermercado_2026_raw.csv")
    if super_path.exists():
        with super_path.open(encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            next(reader) # skip headers
            for row in reader:
                if len(row) > 81:
                    sku_raw = row[2].strip()
                    sist = row[55].strip().upper()
                    abc = row[81].strip().upper()
                    if sku_raw.isdigit() and len(sist) > 0:
                        norm_sist = "ESTOCADO"
                        if "DIRETO" in sist or "D. LOJA" in sist:
                            norm_sist = "D. LOJA"
                        elif "DIRET" in sist:
                            norm_sist = "DIRET"
                        
                        norm_abc = "D"
                        if abc in ["A", "B", "C", "D"]:
                            norm_abc = abc
                        
                        info = {
                            "sist": norm_sist,
                            "abc": norm_abc
                        }
                        if len(sku_raw) > 1:
                            mapping[sku_raw[:-1]] = info
                        mapping[sku_raw] = info
    return mapping

def format_cnpj(raw, code):
    """CNPJ de AA2CTIPO.TIP_CGC_CPF. Sem CGC, cai no sintetico antigo."""
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) == 14:
        pretty = f"{digits[0:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"
        return pretty, digits
    fake = f"00.000.{int(code):03d}/0001-99"
    return fake, "".join(ch for ch in fake if ch.isdigit())


def ensure_column(cursor, table, column, definition):
    cursor.execute(f"PRAGMA table_info({table})")
    columns = {row[1] for row in cursor.fetchall()}
    if column not in columns:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

def main():
    # Thick client configuration
    lib_dir = "/home/administrador/instantclient_19_25"
    try:
        oracledb.init_oracle_client(lib_dir=lib_dir)
    except Exception as e:
        pass
        
    user = os.environ.get("RMS_USER", "ISAURA")
    password = os.environ.get("RMS_PASSWORD", "PRD1Z4UR4")
    host = os.environ.get("RMS_HOST", "10.15.2.26")
    port = int(os.environ.get("RMS_PORT", "1521"))
    sid = os.environ.get("RMS_SID", "RMSPRD")
    if not password:
        print("RMS_PASSWORD não definido no ambiente.", file=sys.stderr)
        sys.exit(1)
    
    # Define SQLite DB path
    db_dir = Path("/lider/portal-fornecedor/db")
    db_dir.mkdir(parents=True, exist_ok=True)
    db_path = db_dir / "portal.db"
    
    print(f"Iniciando sincronização do Oracle RMS para {db_path}...")
    
    # 1. Connect to SQLite and create schema
    sqlite_conn = sqlite3.connect(str(db_path))
    sqlite_cursor = sqlite_conn.cursor()
    
    sqlite_cursor.executescript("""
        CREATE TABLE IF NOT EXISTS fornecedores (
            codigo TEXT PRIMARY KEY,
            nome TEXT,
            cnpj TEXT,
            cnpjSenhaInicial TEXT,
            destinatario TEXT,
            modeloEntrega TEXT,
            agendaRecebimentoCdam INTEGER,
            filialEntregaPadrao TEXT,
            prazoPagamentoDias INTEGER,
            descontoFinanceiroPct REAL,
            condicaoPagamentoLabel TEXT,
            prazoTipo TEXT
        );
        
        CREATE TABLE IF NOT EXISTS produtos (
            sku TEXT PRIMARY KEY,
            codigoProdutoRms TEXT,
            digitoProdutoRms TEXT,
            descricao TEXT,
            categoria TEXT,
            departamentoCodigo TEXT,
            departamento TEXT,
            secaoCodigo TEXT,
            secao TEXT,
            grupoCodigo TEXT,
            grupo TEXT,
            subgrupoCodigo TEXT,
            subgrupo TEXT,
            familia TEXT,
            papelMercadologico TEXT,
            precoTabela REAL,
            cmvUnit REAL,
            fornecedorCodigo TEXT,
            compradorCodigo TEXT,
            compradorNome TEXT,
            embalagemCompra REAL,
            tipoEmbalagemCompra TEXT,
            linha TEXT,
            sistematica TEXT,
            abc TEXT
        );

        CREATE TABLE IF NOT EXISTS produtos_lojas_bloqueios (
            sku TEXT,
            lojaId TEXT,
            bloqueio INTEGER,
            PRIMARY KEY (sku, lojaId)
        );
        CREATE INDEX IF NOT EXISTS idx_bloq_sku ON produtos_lojas_bloqueios(sku);
        
        CREATE TABLE IF NOT EXISTS estoque (
            sku TEXT NOT NULL,
            lojaId TEXT NOT NULL,
            estoqueAtual REAL NOT NULL,
            PRIMARY KEY (sku, lojaId)
        );
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            lojaId TEXT,
            sku TEXT,
            quantidade REAL,
            valorUnitario REAL
        );
        
        CREATE TABLE IF NOT EXISTS perdas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fornecedorCodigo TEXT,
            lojaId TEXT,
            lojaNome TEXT,
            sku TEXT,
            produtoDescricao TEXT,
            quantidade REAL,
            valorUnitario REAL,
            valorTotal REAL,
            data TEXT,
            ocorrencias INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_produtos_forn ON produtos(fornecedorCodigo);
        CREATE INDEX IF NOT EXISTS idx_vendas_sku ON vendas(sku);
        CREATE INDEX IF NOT EXISTS idx_perdas_forn ON perdas(fornecedorCodigo);
    """)
    sqlite_conn.commit()
    try:
        sqlite_cursor.execute("ALTER TABLE produtos ADD COLUMN sistematica TEXT")
        sqlite_conn.commit()
    except sqlite3.OperationalError:
        pass
    try:
        sqlite_cursor.execute("ALTER TABLE produtos ADD COLUMN abc TEXT")
        sqlite_conn.commit()
    except sqlite3.OperationalError:
        pass
    sqlite_conn.commit()

    ensure_column(sqlite_cursor, "fornecedores", "prazoTipo", "TEXT")
    ensure_column(sqlite_cursor, "produtos", "compradorCodigo", "TEXT")
    ensure_column(sqlite_cursor, "produtos", "compradorNome", "TEXT")
    ensure_column(sqlite_cursor, "produtos", "embalagemCompra", "REAL")
    ensure_column(sqlite_cursor, "produtos", "tipoEmbalagemCompra", "TEXT")
    sqlite_conn.commit()
    
    # 2. Connect to Oracle RMS
    try:
        oracle_conn = oracledb.connect(user=user, password=password, host=host, port=port, sid=sid)
        print("Conectado ao Oracle RMS com sucesso!")
        oracle_cursor = oracle_conn.cursor()
    except Exception as e:
        print(f"Erro ao conectar ao Oracle RMS: {e}", file=sys.stderr)
        sys.exit(1)
        
    try:
        # STEP 1: Sync Suppliers
        print("\n--- 1. Carregando Fornecedores ---")
        # Sincronizar somente fornecedores ativos que tenham produtos ativos
        oracle_cursor.execute("""
            SELECT DISTINCT i.GIT_COD_FOR
            FROM RMS.AA3CITEM i
            WHERE i.GIT_COD_FOR IS NOT NULL
              AND (
                i.GIT_DAT_SAI_LIN IS NULL
                OR i.GIT_DAT_SAI_LIN = 0
                OR EXISTS (
                    SELECT 1
                    FROM RMS.AA2CESTQ e
                    WHERE e.GET_COD_PRODUTO = i.GIT_COD_ITEM
                      AND NVL(e.GET_ESTOQUE, 0) > 0
                )
              )
        """)
        supplier_codes = [int(row[0]) for row in oracle_cursor.fetchall()]
        print(f"Total de fornecedores ativos encontrados no Oracle: {len(supplier_codes)}")

        oracle_cursor.execute(
            """
            SELECT TIP_CODIGO, TRIM(TIP_RAZAO_SOCIAL), TRIM(TIP_NOME_FANTASIA), TRIM(TIP_CGC_CPF)
            FROM RMS.AA2CTIPO
            WHERE TIP_LOJ_CLI = 'F'
            """
        )
        identidade_por_forn = {}
        for tip_codigo, razao, fantasia, cgc in oracle_cursor.fetchall():
            identidade_por_forn[int(tip_codigo)] = (razao, fantasia, cgc)

        oracle_cursor.execute(
            """
            SELECT
              f.FOR_CODIGO,
              f.FOR_COND_1,
              TRIM(c.PGT_DESCRICAO),
              c.PGT_DATA,
              (
                SELECT MAX(p.PPG_DIAS_PRAZO)
                FROM RMS.AA3CPPGT p
                WHERE p.PPG_CODIGO = f.FOR_COND_1
              ),
              (
                SELECT MAX(NVL(p.PPG_PERC_DESC_FIN, 0))
                FROM RMS.AA3CPPGT p
                WHERE p.PPG_CODIGO = f.FOR_COND_1
              )
            FROM RMS.AA2CFORN f
            LEFT JOIN RMS.AA3CCPGT c ON c.PGT_CODIGO = f.FOR_COND_1
            """
        )
        cond_por_forn = {}
        for code, cond, label, pgt_data, prazo, desc_fin in oracle_cursor.fetchall():
            cond_por_forn[int(code)] = (cond, label, pgt_data, prazo, desc_fin)
        
        sqlite_cursor.execute("SELECT codigo FROM fornecedores")
        portal_codes = {str(row[0]) for row in sqlite_cursor.fetchall()}
        atualizados = 0
        ignorados = 0

        # Só atualiza quem já está no portal. Inativo não volta pelo sync.
        for code in supplier_codes:
            if str(code) not in portal_codes:
                ignorados += 1
                continue

            razao, fantasia, cgc = identidade_por_forn.get(int(code), (None, None, None))
            nome = (razao or fantasia or "").strip() or f"FORNECEDOR COD {code}"
            cnpj, cnpj_clean = format_cnpj(cgc, code)

            cond = cond_por_forn.get(int(code))
            if cond:
                _cod_cond, label, pgt_data, prazo, desc = cond
                prazo = int(prazo) if prazo is not None else None
                desc = float(desc) if desc is not None else 0.0
                label = label or (f"{prazo} ddl" if prazo is not None else None)
                tipo_prazo = {"E": "DDE", "R": "DDR"}.get((pgt_data or "").strip().upper())
            else:
                prazo = None
                desc = 0.0
                label = None
                tipo_prazo = None

            sqlite_cursor.execute("""
                UPDATE fornecedores SET
                  nome=?,
                  cnpj=?,
                  cnpjSenhaInicial=?,
                  destinatario=?,
                  filialEntregaPadrao=?,
                  prazoPagamentoDias=?,
                  descontoFinanceiroPct=?,
                  condicaoPagamentoLabel=?,
                  prazoTipo=?
                WHERE codigo=?
            """, (nome, cnpj, cnpj_clean, "Grupo Líder", "2011", prazo, desc, label, tipo_prazo, str(code)))
            atualizados += 1

        sqlite_conn.commit()
        print(
            f"Fornecedores do portal atualizados: {atualizados}. "
            f"Ignorados fora do portal: {ignorados}."
        )
        
        # STEP 2: Sync Products (Items)
        print("\n--- 2. Carregando Produtos (Items) ---")
        curated_sheet = load_curated_sheet_data()
        oracle_cursor.execute("""
            SELECT 
                i.GIT_COD_ITEM, i.GIT_DIGITO, COALESCE(i.GIT_DESCRICAO, t.DET_DESC_MARKETING), i.GIT_COD_FOR,
                i.GIT_DEPTO, i.GIT_SECAO, i.GIT_GRUPO, i.GIT_SUBGRUPO,
                i.GIT_COMPRADOR,
                ccp.CMP_NOME,
                i.GIT_EMB_FOR, i.GIT_TPO_EMB_FOR, i.GIT_LINHA,
                TRIM(n_sub.NCC_DESCRICAO),
                i.GIT_PRC_VEN_1,
                i.GIT_CUS_MED,
                TRIM(n_sec.NCC_DESCRICAO),
                TRIM(n_grp.NCC_DESCRICAO),
                i.GIT_SIS_ABAST
            FROM RMS.AA3CITEM i
            LEFT JOIN RMS.AA1DITEM t ON i.GIT_COD_ITEM = t.DET_COD_ITEM
            LEFT JOIN RMS.AA3CNVCC n_sub
              ON n_sub.NCC_DEPARTAMENTO = i.GIT_DEPTO
             AND n_sub.NCC_SECAO = i.GIT_SECAO
             AND n_sub.NCC_GRUPO = i.GIT_GRUPO
             AND n_sub.NCC_SUBGRUPO = i.GIT_SUBGRUPO
            LEFT JOIN RMS.AA3CNVCC n_sec
              ON n_sec.NCC_DEPARTAMENTO = i.GIT_DEPTO
             AND n_sec.NCC_SECAO = i.GIT_SECAO
             AND NVL(n_sec.NCC_GRUPO, 0) = 0
             AND NVL(n_sec.NCC_SUBGRUPO, 0) = 0
            LEFT JOIN RMS.AA3CNVCC n_grp
              ON n_grp.NCC_DEPARTAMENTO = i.GIT_DEPTO
             AND n_grp.NCC_SECAO = i.GIT_SECAO
             AND n_grp.NCC_GRUPO = i.GIT_GRUPO
             AND NVL(n_grp.NCC_SUBGRUPO, 0) = 0
            LEFT JOIN RMS.CAD_COMPRADOR_CP ccp ON ccp.CMP_COMPRADOR = i.GIT_COMPRADOR
            WHERE i.GIT_COD_ITEM IS NOT NULL AND i.GIT_COD_FOR IS NOT NULL
              AND (
                i.GIT_DAT_SAI_LIN IS NULL
                OR i.GIT_DAT_SAI_LIN = 0
                OR EXISTS (
                    SELECT 1
                    FROM RMS.AA2CESTQ e
                    WHERE e.GET_COD_PRODUTO = i.GIT_COD_ITEM
                      AND NVL(e.GET_ESTOQUE, 0) > 0
                )
              )
        """)
        products = oracle_cursor.fetchall()
        print(f"Total de produtos encontrados no Oracle: {len(products)}")
        depto_nomes = load_depto_names()
        
        for p in products:
            sku = str(p[0])
            codigo_rms = str(p[0])
            digito = str(p[1]) if p[1] is not None else "0"
            descricao = p[2].strip() if p[2] and p[2] is not None else f"PRODUTO SKU {sku}"
            forn_code = str(int(p[3])) if p[3] is not None else str(p[3])
            
            # Classificação mercadológica
            depto_cod = clean_code(p[4], "100")
            secao_cod = clean_code(p[5], "1")
            grupo_cod = clean_code(p[6], "1")
            subgrupo_cod = clean_code(p[7], "1")
            comprador_codigo = str(p[8]) if p[8] is not None else None
            comprador_nome = p[9].strip() if p[9] and p[9] is not None else None
            embalagem_compra = float(p[10]) if p[10] is not None and float(p[10]) > 0 else None
            tipo_embalagem_compra = p[11].strip() if p[11] and p[11] is not None else None
            linha = p[12].strip() if p[12] and p[12] is not None else None
            classificacao_nome = clean_text(p[13])
            classificacao_codigo = mercadological_code(depto_cod, secao_cod, grupo_cod, subgrupo_cod)
            preco = rms_number(p[14])
            cmv = rms_number(p[15])
            secao_ncc = clean_text(p[16])
            grupo_ncc = clean_text(p[17])
            depto_nome = depto_nomes.get(depto_cod) or technical_label("Departamento", depto_cod.zfill(3))
            secao_nome = secao_ncc or technical_label("Seção", f"{depto_cod.zfill(3)}.{secao_cod.zfill(2)}")
            grupo_nome = grupo_ncc or technical_label("Grupo", f"{depto_cod.zfill(3)}.{secao_cod.zfill(2)}.{grupo_cod.zfill(2)}")
            subgrupo_nome = classificacao_nome or technical_label("Subgrupo", classificacao_codigo)
            categoria_nome = classificacao_nome or subgrupo_nome
            familia_nome = classificacao_codigo
            
            # Calculate systematic and ABC
            sheet_info = curated_sheet.get(sku, {})
            sist_text = sheet_info.get("sist")
            abc_text = sheet_info.get("abc", "D")

            if len(p) > 18 and p[18] == 10:
                sist_text = "10"
            elif not sist_text:
                if len(p) > 18 and p[18] == 11:
                    sist_text = "D. LOJA"
                elif len(p) > 18 and p[18] == 20:
                    sist_text = "DIRET"
                else:
                    sist_text = "ESTOCADO"

            sqlite_cursor.execute("""
                INSERT INTO produtos
                (sku, codigoProdutoRms, digitoProdutoRms, descricao, categoria, departamentoCodigo, departamento, secaoCodigo, secao, grupoCodigo, grupo, subgrupoCodigo, subgrupo, familia, papelMercadologico, precoTabela, cmvUnit, fornecedorCodigo, compradorCodigo, compradorNome, embalagemCompra, tipoEmbalagemCompra, linha, sistematica, abc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(sku) DO UPDATE SET
                  codigoProdutoRms=excluded.codigoProdutoRms,
                  digitoProdutoRms=excluded.digitoProdutoRms,
                  descricao=excluded.descricao,
                  categoria=excluded.categoria,
                  departamentoCodigo=excluded.departamentoCodigo,
                  departamento=excluded.departamento,
                  secaoCodigo=excluded.secaoCodigo,
                  secao=excluded.secao,
                  grupoCodigo=excluded.grupoCodigo,
                  grupo=excluded.grupo,
                  subgrupoCodigo=excluded.subgrupoCodigo,
                  subgrupo=excluded.subgrupo,
                  familia=excluded.familia,
                  papelMercadologico=excluded.papelMercadologico,
                  precoTabela=excluded.precoTabela,
                  cmvUnit=excluded.cmvUnit,
                  fornecedorCodigo=excluded.fornecedorCodigo,
                  compradorCodigo=excluded.compradorCodigo,
                  compradorNome=excluded.compradorNome,
                  embalagemCompra=excluded.embalagemCompra,
                  tipoEmbalagemCompra=excluded.tipoEmbalagemCompra,
                  linha=excluded.linha,
                  sistematica=excluded.sistematica,
                  abc=excluded.abc
            """, (sku, codigo_rms, digito, descricao, categoria_nome, depto_cod, depto_nome, secao_cod, secao_nome, grupo_cod, grupo_nome, subgrupo_cod, subgrupo_nome, familia_nome, "Rotina", preco, cmv, forn_code, comprador_codigo, comprador_nome, embalagem_compra, tipo_embalagem_compra, linha, sist_text, abc_text))
            
        sqlite_conn.commit()
        print("Produtos carregados com sucesso no SQLite!")

        sqlite_cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS subgrupo_preco_faixa (
                departamentoCodigo TEXT NOT NULL,
                secaoCodigo TEXT NOT NULL,
                grupoCodigo TEXT NOT NULL,
                subgrupoCodigo TEXT NOT NULL,
                preco_min REAL NOT NULL,
                preco_max REAL NOT NULL,
                n_sku INTEGER NOT NULL,
                PRIMARY KEY (departamentoCodigo, secaoCodigo, grupoCodigo, subgrupoCodigo)
            )
            """
        )
        ensure_column(sqlite_cursor, "produtos", "precoMinSubgrupo", "REAL")
        ensure_column(sqlite_cursor, "produtos", "precoMaxSubgrupo", "REAL")
        sqlite_cursor.execute("DELETE FROM subgrupo_preco_faixa")
        sqlite_cursor.execute(
            """
            INSERT INTO subgrupo_preco_faixa
            SELECT
              CAST(CAST(departamentoCodigo AS INTEGER) AS TEXT),
              CAST(CAST(secaoCodigo AS INTEGER) AS TEXT),
              CAST(CAST(grupoCodigo AS INTEGER) AS TEXT),
              CAST(CAST(subgrupoCodigo AS INTEGER) AS TEXT),
              MIN(precoTabela),
              MAX(precoTabela),
              COUNT(*)
            FROM produtos
            WHERE precoTabela IS NOT NULL AND precoTabela > 0
            GROUP BY 1, 2, 3, 4
            """
        )
        sqlite_cursor.execute(
            """
            UPDATE produtos
               SET precoMinSubgrupo = (
                     SELECT f.preco_min FROM subgrupo_preco_faixa f
                      WHERE f.departamentoCodigo = CAST(CAST(produtos.departamentoCodigo AS INTEGER) AS TEXT)
                        AND f.secaoCodigo = CAST(CAST(produtos.secaoCodigo AS INTEGER) AS TEXT)
                        AND f.grupoCodigo = CAST(CAST(produtos.grupoCodigo AS INTEGER) AS TEXT)
                        AND f.subgrupoCodigo = CAST(CAST(produtos.subgrupoCodigo AS INTEGER) AS TEXT)
                   ),
                   precoMaxSubgrupo = (
                     SELECT f.preco_max FROM subgrupo_preco_faixa f
                      WHERE f.departamentoCodigo = CAST(CAST(produtos.departamentoCodigo AS INTEGER) AS TEXT)
                        AND f.secaoCodigo = CAST(CAST(produtos.secaoCodigo AS INTEGER) AS TEXT)
                        AND f.grupoCodigo = CAST(CAST(produtos.grupoCodigo AS INTEGER) AS TEXT)
                        AND f.subgrupoCodigo = CAST(CAST(produtos.subgrupoCodigo AS INTEGER) AS TEXT)
                   )
            """
        )
        sqlite_conn.commit()
        print("Faixa de concorrencia (min/max GIT_PRC_VEN_1 no subgrupo) atualizada.")

        # STEP 2.5: Sync Product Blockages (AA2CESTQ)
        print("\n--- 2.5. Carregando Bloqueios de Produtos por Loja ---")
        try:
            oracle_cursor.execute("""
                SELECT GET_COD_PRODUTO, GET_COD_LOCAL, GET_BLOQUEIO
                FROM RMS.AA2CESTQ
                WHERE GET_BLOQUEIO IN (1, 2, 3, 4)
                  AND GET_COD_PRODUTO IS NOT NULL
            """)
            blockages = oracle_cursor.fetchall()
            print(f"Total de bloqueios encontrados no Oracle: {len(blockages)}")
            
            sqlite_cursor.execute("DELETE FROM produtos_lojas_bloqueios")
            
            sqlite_data = []
            for sku_num, local_num, bloq in blockages:
                sku_str = str(sku_num)
                loja_id = f"{local_num:02d}"
                sqlite_data.append((sku_str, loja_id, int(bloq)))
                
            sqlite_cursor.executemany("""
                INSERT OR REPLACE INTO produtos_lojas_bloqueios (sku, lojaId, bloqueio)
                VALUES (?, ?, ?)
            """, sqlite_data)
            sqlite_conn.commit()
            print("Bloqueios de produtos por loja carregados com sucesso no SQLite!")
        except Exception as eb:
            print(f"Erro ao carregar bloqueios de produtos por loja: {eb}", file=sys.stderr)
        
        # STEP 3: perdas agenda 520 — atomo dia x loja x SKU
        print("\n--- 3. Perdas agenda 520 ---")
        print("Use rms/scripts/apply_portal_perdas_520.py (total diario por produto).")

        # STEP 4: venda diaria AGG_VDA_PROD + estoque AA2CESTQ
        # Nao usar VEND_MES (CPF). Nao apagar vendas daqui.
        print("\n--- 4. Estoque e venda diaria ---")
        print("Use rms/scripts/apply_portal_estoque_venda_diaria.py (nao VEND_MES).")
            
    finally:
        oracle_conn.close()
        sqlite_conn.close()
        print("\nSincronização concluída!")

if __name__ == '__main__':
    main()
