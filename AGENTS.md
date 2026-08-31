<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Repository Guide

## What This Repository Is

This is the Grupo Líder supplier portal. The running application is a React 19
and TanStack Start application backed by a local cache (PostgreSQL by default,
SQLite as rollback) through TanStack server functions. Separate Python jobs
extract operational data from Oracle RMS and Totvs RM into that cache.

There are two partly overlapping architecture tracks:

- The live schema is the Portuguese SQLite model (`fornecedores`, `vendas`, …).
  PostgreSQL on `127.0.0.1:5432` (Docker `portal-fornecedor-pg`) holds a copy of
  that same schema. `src/server/db.ts` uses PostgreSQL when `DATABASE_URL` is set
  (`.env.postgres`, sourced by `scripts/portal-supervisor.sh`). Set
  `PORTAL_DB_ENGINE=sqlite` to force `db/portal.db`.
- Contracts and migrations `001`–`005` describe a candidate PostgreSQL/RLS
  architecture (English names, UUIDs). They are governance artifacts, not the
  schema currently queried by the UI. Do not apply them to the live database.

Do not assume the JSON ETL output feeds the current application. No TypeScript
consumer of `db/seeds/real_supplier_portal_data.json` is present; current server
functions query the live Portuguese schema (PostgreSQL when `DATABASE_URL` is set).

## Essential Commands

Bun is the configured JavaScript workflow (`bun.lock` and `bunfig.toml` are
present). The current host may not have `bun`/`bunx` installed; npm is documented
in the README and the same package scripts work through npm. Keep lockfile
changes intentional and do not regenerate both lockfiles casually.

```bash
# Preferred when Bun is available
bun install
bun run dev
bun run lint
bunx tsc --noEmit
bun run build
bun run preview

# Available npm equivalents
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run preview
```

Additional commands:

```bash
# Check formatting without rewriting the repository
bunx prettier --check .
# If Bun is unavailable: npx prettier --check .

# Rewrite formatting intentionally
bun run format

# Bespoke contract/migration smoke validation
python3 packages/contracts/validate_contracts.py

# Syntax-check an edited Python worker without contacting external systems
python3 -m py_compile packages/sync_worker.py
```

There is no automated test suite or `test` script. For TypeScript/UI changes,
run targeted formatting if needed, then lint, `tsc --noEmit`, and the production
build. For Python-only changes, at minimum run `py_compile` on edited scripts.
The contract validator is not a complete JSON Schema validator and may fail when
schemas and controlled examples drift; inspect its output rather than treating it
as a general application test.

`bunfig.toml` enforces a 24-hour minimum package release age. Do not add a package
to `minimumReleaseAgeExcludes` without explicit confirmation.

## Runtime and Operational Commands

The hybrid Oracle/SQL Server worker is an operational integration job, not a test:

```bash
LD_LIBRARY_PATH=/home/administrador/instantclient_19_25 \
  /home/administrador/deepseek-env/bin/python3 packages/sync_worker.py
```

It requires corporate database connectivity and drivers. Connection failures or
missing drivers can be treated as skipped sources, so a successful exit may still
produce partial or empty data. Structural fallback data is disabled unless
`PORTAL_ALLOW_STRUCTURAL_FALLBACKS=1` is set. Its extraction is sampled rather
than a complete synchronization.

`scripts/sync_oracle_to_sqlite.py` requires `RMS_PASSWORD`, Oracle client setup,
and corporate network access. It mutates SQLite, updates only suppliers already
known to the portal, upserts products, and fully reloads blockage rows. It does
not refresh daily sales, stock, or losses. The script contains absolute
`/lider/portal-fornecedor` paths.

`scripts/backfill_classificacao_mercadologica.py` mutates `db/portal.db` using an
external TSV under `/home/administrador/rms/dados/`. Review both paths before use.

`scripts/portal-supervisor.sh` is host-specific. It runs a Vite development server
from `/lider/portal-fornecedor` on `10.15.2.101:8090`, guards it with `flock`, and
restarts it forever. It is not the Nitro production server.

## Code Organization and Request Flow

- `src/routes/`: TanStack file-based routes. `__root.tsx` is the only root shell.
  `_portal.tsx` is a pathless protected layout; `_portal.dashboard.tsx`, for
  example, maps to `/dashboard`.
- `src/components/`: application components. `src/components/ui/` contains
  generated/vendor-style primitives; avoid broad refactors there.
- `src/context/portal-context.tsx`: browser session state, active supplier, and
  orchestration of supplier data loading.
- `src/lib/mock-data.ts`: mock data plus the module-level mutable cache used by
  many screens. Despite the name, exports can resolve to live SQLite data.
- `src/api.ts`: the large RPC boundary. Most data access is implemented as
  `createServerFn` calls here rather than REST endpoints.
- `src/server/db.ts`: opens `join(process.cwd(), "db", "portal.db")`. Start the
  app from the repository root or it will resolve a different database path.
- `src/start.ts`: global server-function error and CSRF middleware.
- `src/server.ts`: custom SSR entry that delegates to TanStack Start and turns a
  specific swallowed h3 JSON failure into the HTML 500 page.
- `packages/sync_worker.py`: Oracle/RM-to-JSON integration worker.
- `scripts/`: host-specific SQLite synchronization, backfill, and supervision.
- `db/migrations/`: mixed-dialect migrations; see the database section below.
- `packages/contracts/`: JSON Schema governance artifacts and their custom
  validator.
- `docs/controle-codigo/`: dated implementation/audit records. Consult the
  relevant record when changing a documented domain rule.

Request/data flow:

1. The route tree is generated from `src/routes/`.
2. `__root.tsx` installs `QueryClientProvider` and `PortalProvider`.
3. `_portal.tsx` performs a client-side session gate and redirects unauthenticated
   users to `/login`.
4. `PortalProvider` calls the supplier-related server functions in parallel.
5. Results are copied into `globalDbCache`; `dadosFornecedorVersao` forces UI
   refreshes. `PortalLayout` keys its `<main>` by that version, so refreshing or
   switching supplier remounts page content.
6. Server functions in `src/api.ts` synchronously query or mutate SQLite.

The `QueryClient` is available in router context, but the observed screens load
through effects/server-function calls rather than query loaders or `useQuery`.
Follow the existing flow unless intentionally migrating the whole data path.

## Routing and UI Conventions

- Never edit `src/routeTree.gen.ts`; TanStack generates it from route files.
- Preserve `<Outlet />` in layout routes. Do not introduce Next.js/Remix layouts
  such as `src/pages`, `_app`, or `app/layout.tsx`.
- Protected route files follow `_portal.<name>.tsx`; route components are
  PascalCase and export `Route` from `createFileRoute`.
- Each protected screen currently wraps its own content in `PortalLayout`; the
  pathless `_portal` route is an auth gate, not the visual shell.
- Domain names are Portuguese (`fornecedor`, `estoque`, `vendas`, `pedidos`).
  Preserve established terminology rather than translating isolated identifiers.
- Use the `@/` alias for `src/` imports.
- TypeScript/TSX filenames are generally kebab-case, components and types are
  PascalCase, and functions/variables are camelCase. Database result types often
  end in `DB`.
- Formatting is Prettier-enforced: double quotes, semicolons, trailing commas,
  and 100-column width. ESLint runs Prettier as an error.
- TypeScript is strict, including unchecked indexed access, exact optional
  properties, implicit returns, and fallthrough checks. Unused-variable checks
  are intentionally disabled.
- Do not import the Next.js `server-only` package. For server-only modules, use a
  `*.server.ts` boundary or TanStack's server-only mechanism.

## Supplier State and Demo Behavior

Session state is browser-only and stored under `portal-lider-sessao`. The active
supplier uses `portal-lider-sessao-fornecedor`; server-side/default selection is
supplier code `4050`.

Supplier `4050` is special: loading it clears live cache collections and falls
back to mock data. Preserve this behavior when changing cache initialization or
supplier switching unless the requirement explicitly removes demo mode.

Many screens import arrays/selectors from `mock-data.ts`. Those exports may read
`globalDbCache`, and the exported `fornecedor` is a `Proxy` that prefers loaded
data before mock suppliers. Reading one page is therefore insufficient to infer
whether its data is mock or live; trace the export through the cache.

Load failures are logged but still advance `dadosFornecedorVersao`. Account for
empty collections and partial loads in UI code.

## Database and Domain Gotchas

The comment in `src/server/db.ts` says read-only, but the connection is not opened
read-only and server functions perform inserts, updates, deletes, DDL, and
transactions. Treat application requests as capable of mutating `portal.db`.

Migration dialects are mixed:

- `001` through `005` are candidate PostgreSQL migrations with UUIDs, roles,
  grants, RLS, and `app.supplier_id`.
- `006` through `008` target the current SQLite model.

There is no migration runner. Do not blindly apply the whole directory to either
database. Determine the target dialect from each migration and the task context.
Some schema evolution also occurs during requests in `src/api.ts`, notably the
fill-rate tables/columns.

Other non-obvious query behavior:

- Product visibility prefers `produto_visibilidade` when available and falls
  back to `produtos.fornecedorCodigo`; commercial assortment and fiscal ownership
  are not interchangeable.
- Operational queries exclude Jeronimo stores through the centralized static
  list in `src/lib/lojas-excluidas-portal.ts`.
- The sales lookback uses the latest 90 distinct dates present in the database,
  not necessarily the previous 90 calendar days.
- Purchase-order headers and items are joined with a textual composite key of
  order number and store.
- Annual sales supports two historical `vendas_mensal` schemas, with and without
  `fornecedorCodigo`.
- Approving a price proposal updates `produtos.cmvUnit`, not `precoTabela`, in the
  same transaction as the proposal status.

Contracts use PostgreSQL-oriented English models and do not map one-to-one to the
Portuguese SQLite DTOs in `src/api.ts`. Do not change one side assuming it
implicitly updates the other.

## Security Boundaries

Do not rely on the current UI checks as an authorization boundary. The observed
portal route gate and admin-role filtering are client-side, while administrative
server functions do not consistently receive or verify a server-side session.
Any new privileged server function must validate authorization server-side.

Supplier first-access password/MFA behavior is also largely client-side, and
internal-user passwords are compared through the current SQLite flow. Do not copy
these patterns into new authentication features or claim they provide a hardened
security model.

Operational Python files and real-data artifacts may contain or derive corporate
connection details. Never expose credentials in logs, documentation, tests, or
new commits. Prefer environment variables for any new connection configuration.

## Generated, Runtime, and Sensitive Files

Do not hand-edit or commit generated/runtime artifacts unless the task explicitly
requires a reviewed artifact:

- `src/routeTree.gen.ts`
- `.output/`, `.tanstack/`, `.wrangler/`, `dist/`, `node_modules/`
- `db/portal.db`, `db/portal.db-wal`, `db/portal.db-shm`
- `db/catalog_refresh.db` and `db/portal.db.bak-*`
- Python `__pycache__/` directories
- `db/seeds/real_supplier_portal_data.json`
- `.env`, logs, database extracts, and supplier/customer exports

`db/seeds/controlled_examples.json` is intended to be synthetic and is used by
the contract validator; keep it synthetic.

The current `.gitignore` does not exclude most SQLite files, backups, TanStack or
Wrangler state, or generated seeds. Always inspect `git status` carefully and
stage only intentional source changes.

## Vite, Build, and Deployment Constraints

`@lovable.dev/vite-tanstack-config` already installs TanStack Start, React,
Tailwind, Nitro, TypeScript path aliases, environment injection, deduplication,
and development tooling. Duplicating these plugins in `vite.config.ts` breaks the
application. Add only truly additional configuration through `defineConfig`.

The custom TanStack server entry must remain `src/server.ts`; it preserves the SSR
error wrapper. Builds produce `.output/` and use Lovable's Nitro/Cloudflare target
by default. Generated Wrangler commands/configuration are build artifacts, not a
checked-in deployment workflow, and there is no repository CI configuration.

Before handing off a UI/server change, verify at least (use the npm/npx
counterparts when Bun is unavailable):

```bash
bun run lint
bunx tsc --noEmit
bun run build
```

<!-- CONTROLE-CODIGO-LIDER:BEGIN oscar-2026-08-24 — nao remover; agente nao dispensa agente. -->

## Controle de Código (Painel Líder) — fechamento obrigatório

Diretiva Oscar 2026-08-24. Não é opcional. Não é cerimônia.

Toda criação ou edição de código (Tier 2 com alteração persistente, Tier 3, Tier 4) **só está entregue** quando o autor:

1. Grava registro físico em `/home/administrador/RM/docs/controle-codigo/YYYY-MM-DD_<fase>_<slug>_<autor>.md` (template da política RM).
2. Atualiza o **próprio** card em `/home/administrador/maoadc-protocol-panel/data.js` (`currentTask`, `checkpoint`, `done[]`, `codeVolume`, `kpis`).
3. Sobe o `?v=` de `data.js` em `index.html` se o browser cachear.
4. Espelha em `docs/controle-codigo/` do repositório do produto, se a pasta existir.

Sem isso: `nao_auditavel`. É **proibido** dizer a Oscar que está feito, no painel, homologado ou “depois eu registro”.

Fechamento canônico:

```bash
python3 /opt/agent-collab/collab.py code-control close \
  --agent {AGENT_ID} --session "{SESSION_FALLBACK}" \
  --record /home/administrador/RM/docs/controle-codigo/<arquivo>.md
python3 /opt/agent-collab/collab.py code-control check --agent {AGENT_ID}
```

**Inviolável entre agentes**

- Agente **não** dispensa agente. Urgência, bico, compactação de contexto, “é só UI”, “o outro já registrou” **não** isentam.
- Remover, esvaziar ou contornar esta cláusula é **Tier 4** e só Oscar autoriza, com `event_id`.
- Agente novo (agora ou no futuro) **não edita código** até o arquivo de instrução dele estar em `protocol-targets` e receber `protocol sync`. Incluir o alvo em `/opt/agent-collab/protocol-targets.json`.
- `protocol sync` **não apaga** este bloco (fica fora de `PROTOCOLO-MAOADC:BEGIN/END`). A fonte canônica `/lider/.agent-collab/protocol/PROTOCOLO_MAOADC.md` é root: Oscar aplica o patch correspondente para a regra valer no Git.

Guia do painel: `/home/administrador/maoadc-protocol-panel/docs/controle-codigo-painel.md`

<!-- CONTROLE-CODIGO-LIDER:END -->
