(function installArquivoBView() {
  const nav = document.querySelector(".sidebar nav");
  const main = document.querySelector("main.main-content");
  if (!nav || !main || document.querySelector('[data-view="arquivoB"]')) return;

  const item = document.createElement("button");
  item.className = "nav-item";
  item.dataset.view = "arquivoB";
  item.dataset.icon = "▣";
  item.textContent = "▣  Arquivo B — Reposição de lojas";
  nav.appendChild(item);

  const section = document.createElement("section");
  section.id = "arquivoB";
  section.className = "view";
  section.innerHTML = `
    <div class="intro-row">
      <div>
        <div class="eyebrow">Novo cálculo · RMS → Atlas</div>
        <h2>Arquivo B — Reposição de lojas</h2>
        <p class="muted">A árvore calcula; o usuário revisa somente o que precisa ser alterado.</p>
      </div>
      <div class="as-of">Modo <strong>Shadow mode</strong></div>
    </div>
    <div class="arquivo-b-toolbar">
      <label>Loja<select id="arquivo-b-store"><option value="04">Loja 04</option><option value="02">Loja 02</option></select></label>
      <label>Data<input id="arquivo-b-date" type="date" value="2026-10-17"></label>
      <button class="secondary-button" id="arquivo-b-export" type="button">Exportar planilha</button>
    </div>
    <div class="notice">
      <span class="notice-icon">i</span>
      <span><strong>Regra principal</strong><br>A falta de um SKU no CDAM reduz o atendimento, mas nunca apaga a venda do subgrupo.</span>
    </div>
    <div class="metric-grid" id="arquivo-b-metrics"></div>
    <div class="panel">
      <div class="panel-head"><div><h3>Planilha do cálculo</h3><p class="muted">A última coluna é a sugestão de pedido.</p></div><span class="tag">RMS · edição auditável</span></div>
      <div class="arquivo-b-summary-filters" id="arquivo-b-summary-filters"><label>Departamento<select id="arquivo-b-filter-department"><option value="">Todos</option></select></label><label>Seção<select id="arquivo-b-filter-section"><option value="">Todos</option></select></label><label>Grupo<select id="arquivo-b-filter-group"><option value="">Todos</option></select></label><label>Subgrupo<select id="arquivo-b-filter-subgroup"><option value="">Todos</option></select></label></div>
      <div class="arquivo-b-table-wrap"><table class="arquivo-b-table arquivo-b-spreadsheet"><thead><tr><th>Produto / SKU</th><th>Departamento</th><th>Seção</th><th>Grupo</th><th>Subgrupo</th><th>Top Star</th><th>ABC</th><th>Demanda</th><th>Estoque</th><th>Estoque padrão</th><th>Reposição</th><th>Capacidade depósito</th><th>CDAM</th><th>Cx/palete</th><th>Necessidade</th><th>Pedido calculado</th><th>Situação</th><th>Sugestão de pedido</th></tr></thead><tbody id="arquivo-b-rows"></tbody></table></div>
    </div>
    <div class="panel" id="arquivo-b-detail-panel">
      <div class="panel-head"><div><h3>Como o cálculo chegou aqui</h3><p class="muted" id="arquivo-b-detail-subtitle">Selecione uma linha para ver a memória de cálculo.</p></div><span class="tag">Auditável</span></div>
      <div id="arquivo-b-detail" class="arquivo-b-detail-empty">Selecione um produto acima.</div>
    </div>`;
  main.appendChild(section);

  const params = {
    weights: [0.1, 0.2, 0.15, 0.25, 0.3],
    coverage: { A: 20, B: 15, C: 15, D: 15 },
    safetyFactor: { A: 1, B: 0.5, C: 0, D: 0 },
    leadTime: { "01": 0, "10": 0, unknown: 0 },
    safetyStock: true,
    criticalDays: 3,
    excessMultiplier: 1.5,
    palletThreshold: 0.60,
    layerThreshold: 0.9,
    boxThreshold: 0,
  };

  // Snapshot demonstrativo: o adaptador RMS deverá entregar exatamente este contrato.
  let rmsSnapshot = [
    { sku: "1141066", description: "Margarina Delícia 500g", group: "Mercearia", subgroup: "Margarina 500g", topStar: true, abc: "B", system: "01", windows: [[8, 0, 0], [10, 0, 0], [9, 1, 0], [11, 0, 0], [12, 0, 0]], stock: 6, standardStock: 18, replenishment: 0.7, capacity: 24, cdam: 0, unitsPerBox: 12, boxesPerLayer: 6, layersPerPallet: 8, packaging: "UN" },
    { sku: "1157175", description: "Margarina Primor 500g", group: "Mercearia", subgroup: "Margarina 500g", topStar: false, abc: "C", system: "01", windows: [[5, 0, 0], [6, 0, 0], [7, 0, 0], [6, 0, 0], [8, 0, 0]], stock: 10, standardStock: 12, replenishment: 0.7, capacity: 30, cdam: 1967, unitsPerBox: 12, boxesPerLayer: 6, layersPerPallet: 8, packaging: "UN" },
    { sku: "43982", description: "Queijo Frimesa fatiar", group: "Perecíveis", subgroup: "Queijos fatiados", topStar: true, abc: "A", system: "01", windows: [[14, 1, 0], [15, 1, 0], [16, 1, 1], [18, 1, 0], [20, 1, 0]], stock: 2, standardStock: 20, replenishment: 0.8, capacity: 25, cdam: 32, unitsPerBox: 16, boxesPerLayer: 20, layersPerPallet: 4, packaging: "KG", boxWeight: 16 },
    { sku: "2675099", description: "Manteiga Tourinho 500g", group: "Perecíveis", subgroup: "Manteigas 500g", topStar: false, abc: "A", system: "01", windows: [[20, 0, 0], [21, 0, 0], [22, 0, 0], [24, 0, 0], [26, 0, 0]], stock: 40, standardStock: 45, replenishment: 0.7, capacity: 80, cdam: 2116, unitsPerBox: 12, boxesPerLayer: 6, layersPerPallet: 8, packaging: "UN" },
  ];

  let sourceLabel = "Snapshot demonstrativo";
  const money = (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const normalizeHeader = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const parseCsv = (text) => {
    const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha.");
    const parseLine = (line) => {
      const values = [];
      let value = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
        else if (char === '"') quoted = !quoted;
        else if ((char === "," || char === ";" || char === "\t") && !quoted) { values.push(value.trim()); value = ""; }
        else value += char;
      }
      values.push(value.trim());
      return values;
    };
    const headers = parseLine(lines[0]).map(normalizeHeader);
    return lines.slice(1).map((line) => {
      const values = parseLine(line);
      return headers.reduce((row, header, index) => { row[header] = values[index] || ""; return row; }, {});
    });
  };
  const csvValue = (row, aliases, fallback = "") => {
    for (const alias of aliases) { const value = row[normalizeHeader(alias)]; if (value !== undefined && value !== "") return value; }
    return fallback;
  };
  const csvNumber = (row, aliases, fallback = 0) => {
    const raw = String(csvValue(row, aliases, "")).replace(/\./g, "").replace(",", ".");
    return raw === "" ? fallback : safeNumber(raw);
  };
  const csvBoolean = (row, aliases) => ["1", "sim", "s", "true", "x", "top star", "topstar"].includes(String(csvValue(row, aliases, "")).trim().toLowerCase());
  const snapshotFromCsv = (text) => {
    const rows = parseCsv(text);
    const required = ["sku", "descricao", "subgrupo", "estoque_loja", "estoque_padrao", "percentual_reposicao", "capacidade_deposito", "estoque_cdam", "unidades_por_caixa"];
    const missing = required.filter((field) => !Object.keys(rows[0]).includes(normalizeHeader(field)));
    if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}`);
    return rows.map((row, index) => {
      const sku = csvValue(row, ["sku", "codigo", "codigo_produto"]);
      if (!sku) throw new Error(`Linha ${index + 2}: SKU vazio.`);
      const windowNames = [["venda_m12", "vendas_m12"], ["venda_m11", "vendas_m11"], ["venda_90d", "vendas_90d"], ["venda_30d", "vendas_30d"], ["venda_mes", "vendas_mes"]];
      const windows = windowNames.map(([sales]) => [csvNumber(row, [sales]), csvNumber(row, [`consumo_${sales.replace("venda_", "")}`]), csvNumber(row, [`transformacao_${sales.replace("venda_", "")}`, `transferencia_${sales.replace("venda_", "")}`])]);
      return { sku, description: csvValue(row, ["descricao", "produto"]), department: csvValue(row, ["departamento", "department"], "Sem departamento"), section: csvValue(row, ["secao", "seção", "section"], "Sem seção"), group: csvValue(row, ["grupo"]), subgroup: csvValue(row, ["subgrupo"]), topStar: csvBoolean(row, ["top_star", "topstar"]), abc: csvValue(row, ["abc", "classe"], "C").toUpperCase(), system: csvValue(row, ["sistematica", "sistema"], "01"), windows, stock: csvNumber(row, ["estoque_loja", "estoque"]), standardStock: csvNumber(row, ["estoque_padrao"]), replenishment: csvNumber(row, ["percentual_reposicao", "reposicao"]), capacity: csvNumber(row, ["capacidade_deposito", "capacidade_loja"]), cdam: csvNumber(row, ["estoque_cdam", "cdam"]), unitsPerBox: csvNumber(row, ["unidades_por_caixa", "volume_caixa", "und_cx"]), boxesPerLayer: csvNumber(row, ["caixas_por_camada"]), layersPerPallet: csvNumber(row, ["camadas_por_palete"]), packaging: csvValue(row, ["embalagem"], "UN").toUpperCase(), boxWeight: csvNumber(row, ["peso_caixa_kg", "peso_caixa"]) };
    });
  };
  const weightedDemand = (windows) => {
    const values = windows.map((window) => {
      if (!window || window.every((value) => value == null)) return null;
      return window.reduce((total, value) => total + safeNumber(value), 0);
    });
    const filled = values.map((value, index) => value == null ? null : { value, weight: params.weights[index] }).filter(Boolean);
    const demand = filled.length ? filled.reduce((total, item) => total + item.value * item.weight, 0) / filled.reduce((total, item) => total + item.weight, 0) : 0;
    const peak = filled.length ? Math.max(...filled.map((item) => item.value)) : 0;
    return { demand, peak, variability: demand > 0 ? Math.round((peak / demand) * 10) / 10 : 0 };
  };
  const roundBoxes = (fractional, sku) => {
    const W = safeNumber(sku.boxesPerLayer);
    const Y = W * safeNumber(sku.layersPerPallet);
    if (!fractional || fractional <= 0) return { pallets: 0, layers: 0, loose: 0, suggestion: 0 };
    if (!Y) return { pallets: 0, layers: 0, loose: Math.ceil(fractional), suggestion: Math.ceil(fractional) };
    const palletPart = fractional / Y;
    const fractionOfPallet = palletPart - Math.floor(palletPart);
    const forceClosedPallet = Boolean(sku.topStar && fractional > 0);
    const pallets = forceClosedPallet ? Math.ceil(palletPart) : Math.floor(palletPart) + (fractionOfPallet > 0 && fractionOfPallet > params.palletThreshold ? 1 : 0);
    const remainder = Math.max(0, fractional - pallets * Y);
    const layerPart = W ? remainder / W : 0;
    const layers = Math.floor(layerPart) + (layerPart - Math.floor(layerPart) >= params.layerThreshold ? 1 : 0);
    const looseFraction = Math.max(0, fractional - pallets * Y - layers * W);
    const loose = Math.floor(looseFraction) + (looseFraction - Math.floor(looseFraction) > 0 && looseFraction - Math.floor(looseFraction) >= params.boxThreshold ? 1 : 0);
    return { pallets, layers, loose, suggestion: pallets * Y + layers * W + loose };
  };
  const calculateRow = (sku) => {
    const demand = weightedDemand(sku.windows);
    const coverage = params.coverage[sku.abc] || params.coverage.C;
    const lead = params.leadTime[sku.system] ?? params.leadTime.unknown;
    const days = coverage + lead;
    const safety = params.safetyStock ? (params.safetyFactor[sku.abc] || 0) * Math.max(0, demand.peak - demand.demand) * days : 0;
    const reorderPoint = sku.standardStock * safeNumber(sku.replenishment);
    const standardTarget = safeNumber(sku.stock) <= reorderPoint ? safeNumber(sku.standardStock) : 0;
    const target = Math.max(standardTarget, demand.demand * days + safety);
    const needUnits = Math.max(0, target - safeNumber(sku.stock));
    const unitsPerBox = sku.packaging === "KG" ? safeNumber(sku.boxWeight) : safeNumber(sku.unitsPerBox);
    const fractionalBoxes = unitsPerBox > 0 ? needUnits / unitsPerBox : 0;
    const rounded = roundBoxes(fractionalBoxes, sku);
    const palletBoxes = safeNumber(sku.boxesPerLayer) * safeNumber(sku.layersPerPallet);
    const closedPalletRule = palletBoxes > 0 && (sku.topStar ? fractionalBoxes > 0 : fractionalBoxes / palletBoxes > params.palletThreshold);
    const capacityBoxes = Math.max(0, Math.floor((safeNumber(sku.capacity) - safeNumber(sku.stock)) / Math.max(1, unitsPerBox)));
    const capacityClosedPallets = palletBoxes > 0 ? Math.floor(capacityBoxes / palletBoxes) * palletBoxes : capacityBoxes;
    const capacityLimited = closedPalletRule && capacityClosedPallets > 0
      ? Math.min(rounded.suggestion, capacityClosedPallets)
      : Math.min(rounded.suggestion, capacityBoxes);
    const cdamBoxes = sku.system === "01" ? Math.floor(safeNumber(sku.cdam) / Math.max(1, unitsPerBox)) : capacityLimited;
    const cdamClosedPallets = palletBoxes > 0 ? Math.floor(cdamBoxes / palletBoxes) * palletBoxes : cdamBoxes;
    const cdamLimited = closedPalletRule && cdamClosedPallets > 0
      ? Math.min(capacityLimited, cdamClosedPallets)
      : Math.min(capacityLimited, cdamBoxes);
    const sent = Math.max(0, cdamLimited);
    const shortage = Math.max(0, rounded.suggestion - sent);
    const palletDataMissing = Boolean(sku.topStar && fractionalBoxes > 0 && palletBoxes <= 0);
    const capacityBlocksPallet = closedPalletRule && capacityBoxes > 0 && capacityClosedPallets === 0;
    const palletBlockedByCdam = closedPalletRule && cdamBoxes > 0 && cdamClosedPallets === 0;
    const situation = demand.demand <= 0 ? "Sem demanda" : sku.packaging === "KG" && !sku.boxWeight ? "Cadastrar peso KG" : palletDataMissing ? "Cadastrar composição do palete" : capacityBlocksPallet ? "Capacidade menor que 1 palete" : sent === 0 && rounded.suggestion > 0 ? "Sem estoque no CDAM" : palletBlockedByCdam ? "CDAM não fecha palete" : shortage > 0 ? "Atendimento parcial" : sent === 0 ? "Sem necessidade" : "OK";
    return { ...sku, department: sku.department || "Sem departamento", section: sku.section || "Sem seção", group: sku.group || "Sem grupo", subgroup: sku.subgroup || "Sem subgrupo", demand, coverage, lead, days, safety, reorderPoint, target, needUnits, unitsPerBox, fractionalBoxes, rounded, palletBoxes, closedPalletRule, capacityBoxes, capacityClosedPallets, palletDataMissing, capacityBlocksPallet, palletBlockedByCdam, sent, shortage, situation, edited: sent, substitute: null };
  };
  const calculate = () => {
    const rows = rmsSnapshot.map(calculateRow);
    rows.forEach((row) => {
      if (!row.shortage) return;
      const donors = rows.filter((candidate) => candidate.subgroup === row.subgroup && candidate.sku !== row.sku && candidate.cdam > 0).sort((a, b) => b.cdam - a.cdam);
      row.substitute = donors[0] ? { sku: donors[0].sku, description: donors[0].description, cdam: donors[0].cdam } : null;
    });
    return rows;
  };

  let rows = [];
  let metricFilter = "all";
  const filters = { department: "", section: "", group: "", subgroup: "" };
  const metrics = section.querySelector("#arquivo-b-metrics");
  const table = section.querySelector("#arquivo-b-rows");
  const detail = section.querySelector("#arquivo-b-detail");
  const detailSubtitle = section.querySelector("#arquivo-b-detail-subtitle");
  const subgroupSummary = { innerHTML: "" };
  const filterFields = { department: "department", section: "section", group: "group", subgroup: "subgroup" };
  const filterSelects = Object.fromEntries(Object.keys(filterFields).map((field) => [field, section.querySelector(`#arquivo-b-filter-${field}`)]));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const exportSpreadsheet = () => {
    const rowsToExport = filteredRows();
    if (!rowsToExport.length) { window.alert("Não há linhas calculadas para exportar nesta seleção."); return; }
    const columns = ["loja", "data", "sku", "descricao", "departamento", "secao", "grupo", "subgrupo", "top_star", "abc", "sistema", "estoque_loja", "estoque_padrao", "percentual_reposicao", "capacidade_deposito", "estoque_cdam", "unidades_por_caixa", "caixas_por_camada", "camadas_por_palete", "caixas_por_palete", "demanda_calculada", "pico_demanda", "variabilidade", "ponto_reposicao", "meta_estoque", "necessidade", "pedido_calculado", "pedido_final", "situacao", "sugestao_pedido"];
    const values = rowsToExport.map((row) => [storeSelect.value, dateInput.value, row.sku, row.description, row.department, row.section, row.group, row.subgroup, row.topStar ? "SIM" : "NAO", row.abc, row.system, row.stock, row.standardStock, row.replenishment, row.capacity, row.cdam, row.unitsPerBox, row.boxesPerLayer, row.layersPerPallet, row.palletBoxes, row.demand.demand, row.demand.peak, row.demand.variability, row.reorderPoint, row.target, row.needUnits, row.sent, row.edited, row.situation, row.edited].map(csvCell).join(";"));
    const blob = new Blob(["\uFEFF", [columns.map(csvCell).join(";"), ...values].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `arquivo-b_${storeSelect.value || "loja"}_${dateInput.value || "data"}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const filteredRows = () => {
    const selected = rows.filter((row) => Object.entries(filters).every(([level, value]) => !value || String(row[filterFields[level]] || "") === value));
    if (metricFilter === "alerts") return selected.filter((row) => row.situation !== "OK");
    if (metricFilter === "topStars") return selected.filter((row) => row.topStar);
    if (metricFilter === "shortage") return selected.filter((row) => row.shortage > 0);
    return selected;
  };
  const refreshFilterValues = () => {
    Object.entries(filterFields).forEach(([level, field]) => {
      const values = [...new Set(rows.map((row) => String(row[field] || `Sem ${level}`)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      if (!values.includes(filters[level])) filters[level] = "";
      filterSelects[level].innerHTML = `<option value="">Todos</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
      filterSelects[level].value = filters[level];
    });
  };
  const render = () => {
    refreshFilterValues();
    const baseVisible = rows.filter((row) => Object.entries(filters).every(([level, value]) => !value || String(row[filterFields[level]] || "") === value));
    const visible = filteredRows();
    metrics.innerHTML = `<button class="metric-card arquivo-b-metric ${metricFilter === "all" ? "active" : ""}" data-metric-filter="all" type="button"><span>SKUs exibidos</span><strong>${baseVisible.length}</strong><small>${sourceLabel}</small></button><button class="metric-card arquivo-b-metric ${metricFilter === "alerts" ? "active" : ""}" data-metric-filter="alerts" type="button"><span>Alertas</span><strong>${baseVisible.filter((row) => row.situation !== "OK").length}</strong><small>Exigem revisão</small></button><button class="metric-card arquivo-b-metric ${metricFilter === "topStars" ? "active" : ""}" data-metric-filter="topStars" type="button"><span>Top Stars</span><strong>${baseVisible.filter((row) => row.topStar).length}</strong><small>Verificação diária</small></button><button class="metric-card arquivo-b-metric ${metricFilter === "shortage" ? "active" : ""}" data-metric-filter="shortage" type="button"><span>Faltas de CDAM</span><strong>${baseVisible.reduce((total, row) => total + row.shortage, 0).toFixed(0)}</strong><small>Demanda preservada</small></button>`;
    metrics.querySelectorAll("[data-metric-filter]").forEach((button) => button.addEventListener("click", () => { metricFilter = button.dataset.metricFilter; render(); }));
    const bySubgroup = new Map();
    visible.forEach((row) => { const key = row.subgroup || "Sem subgrupo"; if (!bySubgroup.has(key)) bySubgroup.set(key, []); bySubgroup.get(key).push(row); });
    subgroupSummary.innerHTML = [...bySubgroup.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([subgroup, items]) => {
      const requested = items.filter((row) => safeNumber(row.edited) > 0);
      const notRequested = items.filter((row) => safeNumber(row.edited) <= 0);
      const list = (listItems) => listItems.length ? listItems.map((row) => `<li><strong>${escapeHtml(row.description)}</strong><span>${money(row.edited)} cx${row.edited !== row.sent ? ` · sugestão ${money(row.sent)} cx` : ""}</span></li>`).join("") : "<li class=\"arquivo-b-empty\">Nenhum SKU</li>";
      return `<article class="arquivo-b-subgroup"><div class="arquivo-b-subgroup-head"><strong>${escapeHtml(subgroup)}</strong><span>${items.length} SKU(s)</span></div><div class="arquivo-b-subgroup-columns"><section class="arquivo-b-requested"><h4>Pedido <b>${requested.length}</b> · ${money(requested.reduce((total, row) => total + safeNumber(row.edited), 0))} cx</h4><ul>${list(requested)}</ul></section><section class="arquivo-b-not-requested"><h4>Não pedido <b>${notRequested.length}</b></h4><ul>${list(notRequested)}</ul></section></div></article>`;
    }).join("") || `<p class="muted">Nenhum SKU calculado.</p>`;
    table.innerHTML = visible.map((row) => `<tr data-sku="${row.sku}"><td><strong>${escapeHtml(row.description)}</strong><small>${escapeHtml(row.sku)} <button class="text-button arquivo-b-view" data-sku="${row.sku}" type="button">Ver cálculo</button></small></td><td>${escapeHtml(row.department)}</td><td>${escapeHtml(row.section)}</td><td>${escapeHtml(row.group)}</td><td>${escapeHtml(row.subgroup)}</td><td>${row.topStar ? "⭐" : "—"}</td><td>${escapeHtml(row.abc)}</td><td>${money(row.demand.demand)}</td><td>${money(row.stock)}</td><td>${money(row.standardStock)}</td><td>${money(row.replenishment * 100)}%</td><td>${money(row.capacity)}</td><td>${money(row.cdam)}</td><td>${money(row.palletBoxes)}</td><td>${money(row.needUnits)}</td><td>${money(row.sent)}</td><td><span class="arquivo-b-status">${escapeHtml(row.situation)}</span>${row.substitute ? `<small>Substituto: ${escapeHtml(row.substitute.description)}</small>` : ""}</td><td><input class="arquivo-b-quantity" data-sku="${row.sku}" type="number" min="0" value="${row.edited}" aria-label="Sugestão de pedido para ${escapeHtml(row.description)}"></td></tr>`).join("");
    table.querySelectorAll(".arquivo-b-quantity").forEach((input) => input.addEventListener("change", () => { const row = rows.find((candidate) => candidate.sku === input.dataset.sku); if (row) row.edited = Math.max(0, Number(input.value) || 0); }));
    table.querySelectorAll(".arquivo-b-view").forEach((button) => button.addEventListener("click", () => showDetail(rows.find((row) => row.sku === button.dataset.sku))));
  };
  const showDetail = (row) => {
    if (!row) return;
    detailSubtitle.textContent = `${row.description} · ${row.sku}`;
    detail.innerHTML = `<div class="arquivo-b-detail-grid"><div><small>Demanda provável</small><strong>${money(row.demand.demand)} un/dia</strong></div><div><small>Pico</small><strong>${money(row.demand.peak)} un/dia</strong></div><div><small>Variabilidade</small><strong>${money(row.demand.variability)}</strong></div><div><small>Estoque padrão</small><strong>${money(row.standardStock)}</strong></div><div><small>Ponto reposição</small><strong>${money(row.reorderPoint)}</strong></div><div><small>Meta</small><strong>${money(row.target)}</strong></div><div><small>Necessidade</small><strong>${money(row.needUnits)} un</strong></div><div><small>Sugestão</small><strong>${money(row.rounded.suggestion)} cx</strong></div><div><small>Palete</small><strong>${row.palletBoxes ? `${money(row.palletBoxes)} cx${row.topStar ? " · Top Star forçado" : ""}` : "Não informado"}</strong></div><div><small>Envio possível</small><strong>${money(row.sent)} cx</strong></div></div><p class="muted">${row.shortage > 0 ? `A demanda foi preservada. O CDAM/capacidade cortou ${money(row.shortage)} caixa(s).` : "Não houve corte de atendimento."}${row.palletDataMissing ? " Top Star sem composição de palete informada." : ""}${row.capacityBlocksPallet ? " A capacidade não comporta um palete completo." : ""}${row.palletBlockedByCdam ? " O CDAM não possui caixas suficientes para fechar um palete." : ""}${row.substitute ? ` Subgrupo com alternativa: ${row.substitute.description}.` : ""}</p>`;
  };
  section.querySelector("#arquivo-b-export").addEventListener("click", exportSpreadsheet);
  Object.keys(filterFields).forEach((level) => filterSelects[level].addEventListener("change", () => { filters[level] = filterSelects[level].value; render(); }));
  rows = calculate();
  render();
})();
