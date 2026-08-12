import Database from "better-sqlite3";
import { join } from "path";

const dbPath = join(process.cwd(), "db", "portal.db");

// Instancia a base de dados local SQLite em modo somente leitura para segurança
export const db = new Database(dbPath);
