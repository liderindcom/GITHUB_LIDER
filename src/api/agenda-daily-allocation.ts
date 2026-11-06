/**
 * Regras puras compartilhadas pela tela e pela validação da API.
 *
 * A alocação diária não cria uma loja fictícia: ela reaproveita uma rota real
 * do fornecedor (ou a melhor rota real disponível para uma carteira que ainda
 * não tenha rota própria). Assim, a equipe nunca aparece como "Livre" em um
 * dia operacional sem que exista uma loja de referência para o trabalho.
 */

export type AgendaPolicyRecord = Record<string, unknown> & {
  agenda_weekdays?: unknown;
  working_weekdays?: unknown;
  recurring_holidays?: unknown;
  movable_holidays?: unknown;
  work_periods?: unknown;
  periods_by_weekday?: unknown;
  clusters?: unknown;
  exclusive_period_groups?: unknown;
  metropolitan_cities?: unknown;
};

export type DailyRouteCandidate = {
  portfolio: number;
  routeKey: string;
  storeIds: string[];
  geografia?: "CAPITAL_METROPOLITANA" | "INTERIOR" | "MISTA" | null;
};

export function dailyAllocationKey(portfolio: number, day: number) {
  return `${portfolio}::ALOCACAO_DIARIA_D${String(day).padStart(2, "0")}`;
}

export function parseDailyAllocationKey(routeKey: string) {
  const match = String(routeKey).match(/^(\d+)::ALOCACAO_DIARIA_D(\d{2})$/);
  if (!match) return null;
  return { portfolio: Number(match[1]), day: Number(match[2]) };
}

export function operationalDaysForPolicy(periodo: string, policy: AgendaPolicyRecord) {
  const [year = 0, month = 0] = String(periodo).split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return [];
  const weekdays = new Set(
    (Array.isArray(policy["agenda_weekdays"])
      ? policy["agenda_weekdays"]
      : policy["working_weekdays"]) as number[] | undefined,
  );
  if (!weekdays.size) [1, 2, 3, 4, 5].forEach((day) => weekdays.add(day));
  const recurringHolidays = new Set(
    Array.isArray(policy["recurring_holidays"]) ? policy["recurring_holidays"].map(String) : [],
  );
  const movableHolidays = new Set(
    Array.isArray(policy["movable_holidays"]) ? policy["movable_holidays"].map(String) : [],
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => index + 1).filter((day) => {
    const date = new Date(year, month - 1, day);
    const iso = `${periodo}-${String(day).padStart(2, "0")}`;
    return (
      weekdays.has(date.getDay()) &&
      !recurringHolidays.has(iso.slice(5)) &&
      !movableHolidays.has(iso)
    );
  });
}

export function periodsForPolicyDate(periodo: string, day: number, policy: AgendaPolicyRecord) {
  const workPeriods = Array.isArray(policy["work_periods"])
    ? (policy["work_periods"] as Array<Record<string, unknown>>)
        .map((period) => ({
          id: String(period["id"] ?? ""),
          rotulo: String(period["rotulo"] ?? period["id"] ?? ""),
          minutos: Number(period["minutos"] ?? 0) || undefined,
        }))
        .filter((period) => period.id)
    : [
        { id: "MANHA", rotulo: "08h–12h", minutos: 240 },
        { id: "TARDE", rotulo: "14h–18h", minutos: 240 },
      ];
  const periodsByWeekday = (policy["periods_by_weekday"] ?? {}) as Record<string, unknown>;
  const [year = 0, month = 0] = String(periodo).split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  const configured = Array.isArray(periodsByWeekday[String(weekday)])
    ? (periodsByWeekday[String(weekday)] as unknown[]).map(String)
    : workPeriods.map((period) => period.id);
  const filtered = workPeriods.filter((period) => configured.includes(period.id));
  return filtered.length ? filtered : workPeriods;
}

function priorityOf(row: Record<string, unknown>) {
  const level = String(row["nivel"] ?? "N4_BASICO");
  const rank: Record<string, number> = {
    N1_CRITICO: 0,
    N2_ALTO: 1,
    N3_MEDIO: 2,
    N4_BASICO: 3,
  };
  return [
    rank[level] ?? 9,
    -Number(row["unidades_periodo"] ?? 0),
    -Number(row["skus_ativos"] ?? 0),
    String(row["loja_id"] ?? ""),
  ] as const;
}

function compareRows(a: Record<string, unknown>, b: Record<string, unknown>) {
  const left = priorityOf(a);
  const right = priorityOf(b);
  return (
    left[0] - right[0] ||
    left[1] - right[1] ||
    left[2] - right[2] ||
    left[3].localeCompare(right[3], undefined, { numeric: true })
  );
}

function cityKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function geographyForCity(
  value: unknown,
  metropolitanCities: Set<string>,
): "CAPITAL_METROPOLITANA" | "INTERIOR" | null {
  const city = cityKey(value);
  if (!city) return null;
  return metropolitanCities.has(city) ? "CAPITAL_METROPOLITANA" : "INTERIOR";
}

function geographyForPortfolio(
  value: Record<string, unknown> | Map<number, string> | undefined,
  portfolio: number,
) {
  const raw = value instanceof Map ? value.get(portfolio) : value?.[String(portfolio)];
  const normalized = String(raw ?? "")
    .trim()
    .toUpperCase();
  return normalized === "CAPITAL_METROPOLITANA" || normalized === "INTERIOR" ? normalized : null;
}

/**
 * Escolhe uma rota real para cada carteira. Carteiras sem uma rota própria
 * recebem uma rota existente, em rodízio; o cluster inteiro continua sendo
 * indivisível, portanto nunca se cria uma combinação de lojas que não exista.
 */
export function deriveDailyRouteCandidates(
  rows: Array<Record<string, unknown>>,
  allocations: Array<Record<string, unknown>>,
  policy: AgendaPolicyRecord,
  laneCount: number,
  portfolioGeography?: Record<string, unknown> | Map<number, string>,
) {
  const allocationByStore = new Map(allocations.map((row) => [String(row["loja_id"] ?? ""), row]));
  const clusterByStore = new Map<string, string>();
  const groups = [
    ...(Array.isArray(policy["clusters"]) ? policy["clusters"] : []),
    ...(Array.isArray(policy["exclusive_period_groups"]) ? policy["exclusive_period_groups"] : []),
  ] as Array<Record<string, unknown>>;
  for (const group of groups) {
    const id = String(group["id"] ?? "");
    if (!id) continue;
    for (const storeId of Array.isArray(group["lojas"]) ? group["lojas"] : []) {
      if (!clusterByStore.has(String(storeId))) clusterByStore.set(String(storeId), id);
    }
  }
  const metropolitanCities = new Set(
    (Array.isArray(policy["metropolitan_cities"])
      ? policy["metropolitan_cities"]
      : ["BELEM", "ANANINDEUA", "ICOARACI"]
    )
      .map(cityKey)
      .filter(Boolean),
  );
  const routeRows = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const storeId = String(row["loja_id"] ?? "");
    const allocation = allocationByStore.get(storeId);
    if (allocations.length && !allocation) continue;
    const portfolio = Number(allocation?.["carteira_promotor"] ?? row["carteira_promotor"] ?? 1);
    const routeId = String(
      clusterByStore.get(storeId) ?? allocation?.["cluster"] ?? row["cluster"] ?? `LOJA_${storeId}`,
    );
    const routeKey = `${portfolio}::${routeId}`;
    const current = routeRows.get(routeKey) ?? [];
    current.push({ ...row, ...(allocation ?? {}) });
    routeRows.set(routeKey, current);
  }
  const routes = [...routeRows.entries()]
    .map(([routeKey, route]) => ({
      routeKey,
      portfolio: Number(routeKey.split("::", 1)[0] || 1),
      rows: [...route].sort(compareRows),
      geografia: (() => {
        const values = new Set(
          route.map((row) => geographyForCity(row["cidade"], metropolitanCities)).filter(Boolean),
        );
        if (values.size > 1) return "MISTA" as const;
        return ([...values][0] ?? null) as "CAPITAL_METROPOLITANA" | "INTERIOR" | null;
      })(),
    }))
    .sort(
      (a, b) =>
        compareRows(a.rows[0] ?? {}, b.rows[0] ?? {}) ||
        a.routeKey.localeCompare(b.routeKey, undefined, { numeric: true }),
    );
  const byPortfolio = new Map<number, typeof routes>();
  for (const route of routes) {
    const current = byPortfolio.get(route.portfolio) ?? [];
    current.push(route);
    byPortfolio.set(route.portfolio, current);
  }
  const result = new Map<number, DailyRouteCandidate>();
  const count = Math.max(0, Math.floor(Number(laneCount) || 0));
  for (let portfolio = 1; portfolio <= count; portfolio += 1) {
    const own = byPortfolio.get(portfolio) ?? [];
    const expectedGeography = geographyForPortfolio(portfolioGeography, portfolio);
    const compatible = (route: (typeof routes)[number]) =>
      !expectedGeography || route.geografia === expectedGeography;
    const compatibleOwn = own.filter(compatible);
    const compatibleRoutes = routes.filter(compatible);
    const pool = compatibleOwn.length ? compatibleOwn : compatibleRoutes;
    if (!pool.length) continue;
    const route = pool[(portfolio - 1) % pool.length];
    if (!route) continue;
    result.set(portfolio, {
      portfolio,
      routeKey: route.routeKey,
      geografia: route.geografia,
      storeIds: [
        ...new Set(route.rows.map((row) => String(row["loja_id"] ?? "")).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    });
  }
  return result;
}
