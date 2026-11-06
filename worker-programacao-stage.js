const ATLAS_API_ORIGIN = "https://portaldofornecedor.intelider.com.br";

const SCHEMA = `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'consulta', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_stores (user_id INTEGER NOT NULL, store_id TEXT NOT NULL, PRIMARY KEY (user_id, store_id));
CREATE TABLE IF NOT EXISTS permissions (user_id INTEGER NOT NULL, module TEXT NOT NULL, action TEXT NOT NULL, PRIMARY KEY (user_id, module, action));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS arquivo_b_edits (user_id INTEGER NOT NULL, store_id TEXT NOT NULL, reference_date TEXT NOT NULL, sku TEXT NOT NULL, calculated REAL NOT NULL, edited REAL NOT NULL, justification TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (store_id, reference_date, sku));
CREATE TABLE IF NOT EXISTS arquivo_b_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, store_id TEXT NOT NULL, reference_date TEXT NOT NULL, sku TEXT NOT NULL, previous REAL NOT NULL, next REAL NOT NULL, justification TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS arquivo_b_program_groups (group_id INTEGER PRIMARY KEY, order_weekday INTEGER NOT NULL, cdam_weekday INTEGER NOT NULL, delivery_weekday INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS arquivo_b_store_program_groups (store_id TEXT PRIMARY KEY, group_id INTEGER NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT, updated_by INTEGER NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS arquivo_b_program_sections (group_id INTEGER NOT NULL, section_code TEXT NOT NULL, section_name TEXT NOT NULL, updated_by INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (group_id, section_code));
CREATE TABLE IF NOT EXISTS arquivo_b_program_history (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id TEXT, group_id INTEGER, section_code TEXT, action TEXT NOT NULL, previous_value TEXT, next_value TEXT, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);`;

async function init(env) { await env.atlas_acessos.exec(SCHEMA); await env.atlas_acessos.batch([[1, 1, 1, 2], [2, 2, 2, 3], [3, 3, 3, 4], [4, 4, 4, 5], [5, 5, 5, 1], [6, 6, 6, 2], [7, 4, 4, 5], [8, 4, 4, 5]].map(([groupId, orderWeekday, cdamWeekday, deliveryWeekday]) => env.atlas_acessos.prepare("INSERT OR IGNORE INTO arquivo_b_program_groups (group_id,order_weekday,cdam_weekday,delivery_weekday,updated_at) VALUES (?,?,?,?,?)").bind(groupId, orderWeekday, cdamWeekday, deliveryWeekday, new Date().toISOString()))); }
async function hash(value) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function json(data, status = 200) { return Response.json(data, { status, headers: { "cache-control": "no-store" } }); }
async function session(request, env) { const token = request.headers.get("cookie")?.match(/(?:^|; )atlas_session=([^;]+)/)?.[1]; if (!token) return null; return env.atlas_acessos.prepare("SELECT u.id,u.username,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1").bind(token, new Date().toISOString()).first(); }
function admin(user) { return user && ["admin", "administrador"].includes(user.role); }
async function allowed(env, user, storeId, module, action) { const row = await env.atlas_acessos.prepare("SELECT 1 FROM user_stores s JOIN permissions p ON p.user_id=s.user_id WHERE s.user_id=? AND s.store_id=? AND p.module=? AND p.action=?").bind(user.id, storeId, module, action).first(); return Boolean(row); }
async function body(request) { try { return await request.json(); } catch { return {}; } }

async function atlasApi(request, env, url) {
  await init(env);
  if (url.pathname === "/api/atlas/auth/bootstrap" && request.method === "POST") {
    const count = await env.atlas_acessos.prepare("SELECT COUNT(*) AS count FROM users").first();
    if (Number(count?.count) !== 0) return json({ error: "Cadastro inicial já realizado." }, 409);
    const data = await body(request); if (!data.username || !data.name || !data.password) return json({ error: "Informe usuário, nome e senha." }, 400);
    await env.atlas_acessos.prepare("INSERT INTO users (username,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)").bind(String(data.username).trim().toLowerCase(), String(data.name).trim(), data.email || null, await hash(String(data.password)), "administrador", new Date().toISOString()).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/atlas/auth/login" && request.method === "POST") {
    const data = await body(request); const user = await env.atlas_acessos.prepare("SELECT * FROM users WHERE username=? AND active=1").bind(String(data.username || "").trim().toLowerCase()).first();
    if (!user || user.password_hash !== await hash(String(data.password || ""))) return json({ error: "Usuário ou senha inválidos." }, 401);
    const token = crypto.randomUUID(); await env.atlas_acessos.prepare("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)").bind(token, user.id, new Date(Date.now() + 12 * 3600000).toISOString()).run();
    return new Response(JSON.stringify({ ok: true, user: { username: user.username, name: user.name, role: user.role } }), { headers: { "content-type": "application/json", "set-cookie": `atlas_session=${token}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`, "cache-control": "no-store" } });
  }
  if (url.pathname === "/api/atlas/auth/logout" && request.method === "POST") return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": "atlas_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" } });
  const user = await session(request, env);
  if (url.pathname === "/api/atlas/auth/me" && request.method === "GET") { if (user) return json({ user }); const count = await env.atlas_acessos.prepare("SELECT COUNT(*) AS count FROM users").first(); return json({ user: null, bootstrap: Number(count?.count) === 0 }, 401); }
  if (url.pathname === "/api/atlas/admin/users") {
    if (!admin(user)) return json({ error: "Acesso administrativo exigido." }, 403);
    if (request.method === "GET") return json({ users: await env.atlas_acessos.prepare("SELECT id,username,name,email,role,active,created_at FROM users ORDER BY name").all().then((result) => result.results) });
    if (request.method === "POST") { const data = await body(request); const username = String(data.username || "").trim().toLowerCase(); if (!username || !data.name) return json({ error: "Informe usuário e nome." }, 400); const passwordHash = data.password ? await hash(String(data.password)) : null; const old = await env.atlas_acessos.prepare("SELECT id,password_hash,created_at FROM users WHERE username=?").bind(username).first(); const id = old?.id || null; if (old) await env.atlas_acessos.prepare("UPDATE users SET name=?,email=?,role=?,active=?" + (passwordHash ? ",password_hash=?" : "") + " WHERE id=?").bind(String(data.name), data.email || null, String(data.role || "consulta"), data.active === false ? 0 : 1, ...(passwordHash ? [passwordHash] : []), id).run(); else await env.atlas_acessos.prepare("INSERT INTO users (username,name,email,password_hash,role,active,created_at) VALUES (?,?,?,?,?,?,?)").bind(username, String(data.name), data.email || null, passwordHash || await hash(crypto.randomUUID()), String(data.role || "consulta"), data.active === false ? 0 : 1, new Date().toISOString()).run(); const current = old || await env.atlas_acessos.prepare("SELECT id FROM users WHERE username=?").bind(username).first(); await env.atlas_acessos.batch([env.atlas_acessos.prepare("DELETE FROM user_stores WHERE user_id=?").bind(current.id), env.atlas_acessos.prepare("DELETE FROM permissions WHERE user_id=?").bind(current.id), ...((Array.isArray(data.stores) ? data.stores : []).map((store) => env.atlas_acessos.prepare("INSERT INTO user_stores (user_id,store_id) VALUES (?,?)").bind(current.id, String(store)))), ...((Array.isArray(data.permissions) ? data.permissions : []).map((permission) => { const [module, action] = String(permission).split(":"); return env.atlas_acessos.prepare("INSERT INTO permissions (user_id,module,action) VALUES (?,?,?)").bind(current.id, module, action); }))]); return json({ ok: true }); }
  }
  if (url.pathname === "/api/atlas/admin/arquivo-b/programacao") {
    if (!admin(user)) return json({ error: "Acesso administrativo exigido." }, 403);
    if (request.method === "GET") {
      const [groups, stores, sections] = await Promise.all([
        env.atlas_acessos.prepare("SELECT group_id,order_weekday,cdam_weekday,delivery_weekday,active,updated_at FROM arquivo_b_program_groups ORDER BY group_id").all(),
        env.atlas_acessos.prepare("SELECT store_id,group_id,valid_from,valid_to,updated_at FROM arquivo_b_store_program_groups ORDER BY store_id").all(),
        env.atlas_acessos.prepare("SELECT group_id,section_code,section_name,updated_at FROM arquivo_b_program_sections ORDER BY group_id,CAST(section_code AS INTEGER)").all(),
      ]);
      return json({ groups: groups.results, stores: stores.results, sections: sections.results });
    }
    if (request.method === "POST") {
      const data = await body(request); const sectionCode = String(data.sectionCode || "").trim(); const sectionName = String(data.sectionName || "").trim(); const storeId = String(data.storeId || "").trim(); const groupId = Number(data.groupId); const validFrom = String(data.validFrom || new Date().toISOString().slice(0, 10)); const validTo = data.validTo ? String(data.validTo) : null;
      if (sectionCode || sectionName) {
        if (!Number.isInteger(groupId) || groupId < 1 || groupId > 8 || !sectionCode || !sectionName) return json({ error: "Informe grupo, código e nome da seção." }, 400);
        const oldSection = await env.atlas_acessos.prepare("SELECT section_name FROM arquivo_b_program_sections WHERE group_id=? AND section_code=?").bind(groupId, sectionCode).first(); const now = new Date().toISOString();
        await env.atlas_acessos.batch([
          env.atlas_acessos.prepare("INSERT INTO arquivo_b_program_sections (group_id,section_code,section_name,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(group_id,section_code) DO UPDATE SET section_name=excluded.section_name,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(groupId, sectionCode, sectionName, user.id, now),
          env.atlas_acessos.prepare("INSERT INTO arquivo_b_program_history (group_id,section_code,action,previous_value,next_value,user_id,created_at) VALUES (?,?,?,?,?, ?,?)").bind(groupId, sectionCode, "group_section", oldSection ? JSON.stringify(oldSection) : null, JSON.stringify({ sectionCode, sectionName }), user.id, now),
        ]);
        return json({ ok: true });
      }
      if (!storeId || !Number.isInteger(groupId) || groupId < 1 || groupId > 8) return json({ error: "Informe a loja e um grupo de programação entre 1 e 8." }, 400);
      const now = new Date().toISOString(); const old = await env.atlas_acessos.prepare("SELECT group_id,valid_from,valid_to FROM arquivo_b_store_program_groups WHERE store_id=?").bind(storeId).first();
      await env.atlas_acessos.batch([
        env.atlas_acessos.prepare("INSERT INTO arquivo_b_store_program_groups (store_id,group_id,valid_from,valid_to,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(store_id) DO UPDATE SET group_id=excluded.group_id,valid_from=excluded.valid_from,valid_to=excluded.valid_to,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(storeId, groupId, validFrom, validTo, user.id, now),
        env.atlas_acessos.prepare("INSERT INTO arquivo_b_program_history (store_id,group_id,action,previous_value,next_value,user_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(storeId, groupId, "store_group", old ? JSON.stringify(old) : null, JSON.stringify({ groupId, validFrom, validTo }), user.id, now),
      ]);
      return json({ ok: true });
    }
  }
  if (url.pathname === "/api/atlas/arquivo-b/context" && request.method === "GET") { if (!user) return json({ error: "Faça login no Atlas." }, 401); const stores = await env.atlas_acessos.prepare("SELECT s.store_id FROM user_stores s JOIN permissions p ON p.user_id=s.user_id WHERE s.user_id=? AND p.module='arquivo_b' AND p.action='editar' ORDER BY s.store_id").bind(user.id).all(); const programacao = (await env.atlas_acessos.prepare("SELECT m.store_id,m.group_id,m.valid_from,m.valid_to,g.order_weekday,g.cdam_weekday,g.delivery_weekday FROM arquivo_b_store_program_groups m JOIN arquivo_b_program_groups g ON g.group_id=m.group_id WHERE m.store_id IN (SELECT store_id FROM user_stores WHERE user_id=?) AND g.active=1 ORDER BY m.store_id").bind(user.id).all()).results; const sections = (await env.atlas_acessos.prepare("SELECT group_id,section_code,section_name FROM arquivo_b_program_sections ORDER BY group_id,CAST(section_code AS INTEGER)").all()).results; return json({ user, stores: stores.results.map((item) => item.store_id), programacao, sections }); }
  if (url.pathname === "/api/atlas/arquivo-b/edicoes") { if (!user) return json({ error: "Faça login no Atlas." }, 401); const storeId = url.searchParams.get("storeId") || url.searchParams.get("lojaId") || ""; const date = url.searchParams.get("date") || url.searchParams.get("data") || ""; if (!(await allowed(env, user, storeId, "arquivo_b", request.method === "POST" ? "editar" : "consultar")) && !(await allowed(env, user, storeId, "arquivo_b", "editar"))) return json({ error: "Loja não autorizada." }, 403); if (request.method === "GET") return json((await env.atlas_acessos.prepare("SELECT sku,calculated,edited,justification,updated_at FROM arquivo_b_edits WHERE store_id=? AND reference_date=?").bind(storeId, date).all()).results); if (request.method === "POST") { const data = await body(request); const sku = String(data.sku || ""); const next = Number(data.edited); const justification = String(data.justification || "").trim(); if (!sku || !justification || !Number.isFinite(next) || next < 0) return json({ error: "SKU, quantidade e justificativa são obrigatórios." }, 400); const old = await env.atlas_acessos.prepare("SELECT edited FROM arquivo_b_edits WHERE store_id=? AND reference_date=? AND sku=?").bind(storeId, date, sku).first(); const now = new Date().toISOString(); await env.atlas_acessos.batch([env.atlas_acessos.prepare("INSERT INTO arquivo_b_history (user_id,store_id,reference_date,sku,previous,next,justification,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(user.id, storeId, date, sku, Number(old?.edited ?? data.calculated ?? 0), next, justification, now), env.atlas_acessos.prepare("INSERT INTO arquivo_b_edits (user_id,store_id,reference_date,sku,calculated,edited,justification,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(store_id,reference_date,sku) DO UPDATE SET user_id=excluded.user_id,calculated=excluded.calculated,edited=excluded.edited,justification=excluded.justification,updated_at=excluded.updated_at").bind(user.id, storeId, date, sku, Number(data.calculated || 0), next, justification, now)]); return json({ ok: true }); }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ service: "atlas-site", status: "ok" }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname.startsWith("/api/atlas/")) {
      const native = await atlasApi(request, env, url);
      if (native) return native;
      const upstream = new URL(url.pathname + url.search, ATLAS_API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set("accept", "application/json");
      headers.delete("host");
      const response = await fetch(upstream, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      });
      return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
    }
    return env.ASSETS.fetch(request);
  },
};
