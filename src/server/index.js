import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { computeCompanyIntel, refreshMarketAnalytics, refreshPlayerAnalytics } from "../simulator/analytics.js";
import { createCompany, createInitialState, createSeedCompanies, upsertCompany } from "../simulator/state.js";
import { executeMerger, executeStrategicAction, placeOrder, runTick, squareOffPosition } from "../simulator/engine.js";
import { fastForward, loadCheckpoint, saveCheckpoint } from "../simulator/persistence.js";
import { listScenarioBlueprints, runScenarioPlaybook } from "../simulator/scenario-lab.js";
import { buildMissionBoard, getAcademySnapshot, getInsightsBundle, listStrategyPlaybooks, runStrategyBacktest } from "../simulator/insights.js";
import {
  getProgramEnvironmentBlueprint,
  getProgramFeatureContractById,
  getProgramHealth,
  getProgramMilestones,
  getProgramNoCoursesPolicy,
  getProgramOverview,
  getProgramV11Scope,
  getProgramPhaseBoard,
  listProgramReleaseCheckpoints,
  listProgramRunbooks,
  listProgramFeatureContracts,
  listProgramModules
} from "../simulator/mega-program.js";
import { ensureV11State, getV11EventContract } from "../simulator/v11.js";

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.resolve(process.cwd(), "src/web");
const ADMIN_BEARER_TOKEN = String(process.env.ADMIN_BEARER_TOKEN ?? "").trim();
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000));
const RATE_LIMIT_MAX = Math.max(10, Number(process.env.RATE_LIMIT_MAX ?? 240));
const LOG_LEVEL = String(process.env.LOG_LEVEL ?? "info").toLowerCase();
const appRoutes = new Set([
  "/",
  "/trading",
  "/trade-flow",
  "/markets",
  "/company",
  "/control",
  "/economy",
  "/portfolio",
  "/strategy-lab",
  "/academy",
  "/program"
]);

const state = loadCheckpoint() ?? createInitialState({ seed: 7 });
if (!Object.keys(state.companies).length) createSeedCompanies(state, 16);
ensureV11State(state);
refreshPlayerAnalytics(state);
refreshMarketAnalytics(state);

const streamClients = new Set();
const requestCounters = {
  requests: 0,
  rateLimited: 0,
  errors: 0,
  startedAt: Date.now()
};
const requestRateWindowByIp = new Map();
const featureStatusOverrides = new Map();

function shouldLog(level) {
  const weights = { debug: 10, info: 20, warn: 30, error: 40 };
  return (weights[level] ?? 999) >= (weights[LOG_LEVEL] ?? 20);
}

function log(level, message, details = {}) {
  if (!shouldLog(level)) return;
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...details
    })
  );
}

setInterval(() => {
  runTick(state);
  if (state.tick % 10 === 0) saveCheckpoint(state);
  broadcast();
}, 1000);

function broadcast() {
  const payload = `data: ${JSON.stringify(getSnapshot())}\n\n`;
  for (const res of streamClients) res.write(payload);
}

function getSnapshot() {
  const overview = getProgramOverview();
  return {
    tick: state.tick,
    time: state.time,
    marketSession: state.marketSession,
    macro: state.macro,
    sentiment: state.sentiment,
    policyPressure: state.policyPressure,
    marketRegime: state.marketRegime,
    headlines: state.headlines.slice(0, 10),
    geopolitics: state.geopolitics,
    supplyChains: state.supplyChains,
    funds: state.funds,
    financialSystem: state.financialSystem ?? {},
    indexes: state.indexes,
    leaderboards: state.leaderboards,
    player: state.player,
    alerts: state.analytics?.alerts ?? [],
    analytics: state.analytics ?? {},
    scenarioLab: {
      lastRun: state.scenarioLab?.lastRun ?? null,
      recentRuns: state.scenarioLab?.history?.slice(0, 8) ?? []
    },
    stocks: Object.entries(state.stocks).map(([companyId, stock]) => ({
      companyId,
      companyName: state.companies[companyId]?.name ?? companyId,
      ticker: stock.ticker,
      lastPrice: stock.lastPrice,
      marketCap: stock.marketCap,
      peRatio: stock.peRatio,
      shortInterest: stock.shortInterest,
      dividendYield: stock.dividendYield,
      volume: stock.volume,
      stability: stock.stability,
      buyPressure: stock.buyPressure,
      sellPressure: stock.sellPressure,
      dayOpenPrice: stock.dayOpenPrice,
      dayHigh: stock.dayHigh,
      dayLow: stock.dayLow,
      support: stock.support,
      resistance: stock.resistance,
      supportStrength: stock.supportStrength,
      resistanceStrength: stock.resistanceStrength,
      supportBreakPressure: stock.supportBreakPressure,
      resistanceBreakPressure: stock.resistanceBreakPressure,
      publicFloatShares: stock.publicFloatShares,
      sharesOutstanding: stock.sharesOutstanding,
      candles: stock.candles.slice(-600),
      buyDepth: state.orderBooks[companyId]?.buy?.length ?? 0,
      sellDepth: state.orderBooks[companyId]?.sell?.length ?? 0
    })),
    companies: Object.values(state.companies).map((c) => ({
      id: c.id,
      name: c.name,
      country: c.country,
      sector: c.sector,
      valuation: c.valuation,
      employees: c.employees,
      revenue: c.kpis.revenue,
      growth: c.kpis.growth,
      profitMargin: c.kpis.profitMargin,
      debtRatio: c.kpis.debtRatio,
      innovation: c.innovation,
      reputation: c.reputation,
      aiCapability: c.aiCapability,
      marketDominance: c.marketDominance,
      politicalInfluence: c.politicalInfluence,
      supplyRisk: c.supplyRisk,
      rdBudget: c.rdBudget,
      carbonEmissions: c.carbonEmissions,
      businessModel: c.businessModel,
      intelligence: computeCompanyIntel(state, c.id),
      principalHolder: c.ownership?.principalHolder ?? null,
      principalStakePct: c.ownership?.principalStakePct ?? null,
      publicFloatPct: c.ownership?.publicFloatPct ?? null,
      principalShares: c.ownership?.principalShares ?? null,
      publicFloatShares: c.ownership?.publicFloatShares ?? null
    })),
    commodities: Object.fromEntries(
      Object.entries(state.commodities).map(([k, v]) => [k, { price: v.price }])
    ),
    governments: Object.fromEntries(
      Object.entries(state.governments ?? {}).map(([country, g]) => [
        country,
        { taxRate: g.taxRate, subsidy: g.subsidy, regulation: g.regulation, stability: g.stability }
      ])
    ),
    population: {
      count: state.population.participantCount ?? state.population.agents.length,
      consumerConfidence: state.population.consumerConfidence,
      unemploymentStress: state.population.unemploymentStress,
      inequalityIndex: state.population.inequalityIndex,
      topRichest: state.leaderboards.richest.slice(0, 25)
    },
    financial: {
      bankingStress: state.financialSystem?.bankingStress ?? 0,
      housingIndex: state.financialSystem?.housingIndex ?? 100,
      sovereignDebtToGdp: state.financialSystem?.sovereignDebtToGdp ?? 0,
      privateCreditStress: state.financialSystem?.privateCreditStress ?? 0,
      ventureCapitalDryPowder: state.financialSystem?.ventureCapitalDryPowder ?? 0,
      ipoPipeline: state.financialSystem?.ipoPipeline ?? [],
      etfs: state.financialSystem?.etfs ?? [],
      hedgeFunds: state.financialSystem?.hedgeFunds ?? [],
      stats: state.financialSystem?.stats ?? {}
    },
    program: {
      version: overview.version ?? "v11",
      rolloutModel: overview.rolloutModel ?? "vertical-slices",
      totalModules: overview.totalModules,
      totalFeatures: overview.totalFeatures,
      phaseBreakdown: overview.phaseBreakdown,
      statusBreakdown: overview.statusBreakdown,
      noCoursesPolicy: overview.noCoursesPolicy,
      v11Tracks: overview.v11Tracks ?? [],
      v11VerticalSlices: overview.v11VerticalSlices ?? []
    },
    v11: state.v11
  };
}

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  if (forwarded) return forwarded;
  return req.socket?.remoteAddress ?? "unknown";
}

function isRateLimited(req) {
  if (!req.url?.startsWith("/api/")) return false;
  if (req.url.startsWith("/api/stream")) return false;
  const now = Date.now();
  const clientIp = getClientIp(req);
  const bucket = requestRateWindowByIp.get(clientIp) ?? { start: now, count: 0 };
  if (now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  requestRateWindowByIp.set(clientIp, bucket);
  return bucket.count > RATE_LIMIT_MAX;
}

function requireAdminAuth(req) {
  if (!req.url?.startsWith("/api/admin/")) return true;
  if (!ADMIN_BEARER_TOKEN) return true;
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return token && token === ADMIN_BEARER_TOKEN;
}

function normalizeFeatureStatus(status) {
  const normalized = String(status ?? "").toLowerCase();
  return ["planned", "in-progress", "review", "complete", "blocked"].includes(normalized) ? normalized : null;
}

function applyFeatureOverride(contract) {
  if (!contract) return null;
  const override = featureStatusOverrides.get(contract.featureId);
  if (!override) return contract;
  return { ...contract, ...override, overrideUpdatedAt: override.updatedAt };
}

function listRuntimeProgramFeatures(filters = {}) {
  return listProgramFeatureContracts(filters).map((feature) => applyFeatureOverride(feature));
}

function getRuntimeProgramOverview() {
  const base = getProgramOverview();
  const statuses = { planned: 0, "in-progress": 0, review: 0, complete: 0, blocked: 0 };
  listRuntimeProgramFeatures({ limit: 500 }).forEach((feature) => {
    statuses[feature.status] = (statuses[feature.status] ?? 0) + 1;
  });
  return { ...base, statusBreakdown: statuses };
}

function serveStatic(req, res, pathname = "/") {
  const file = appRoutes.has(pathname) ? "index.html" : pathname.slice(1);
  const target = path.join(publicDir, file);
  if (!target.startsWith(publicDir) || !fs.existsSync(target)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(target);
  const type = ext === ".js" ? "application/javascript" : "text/html";
  res.writeHead(200, { "Content-Type": type });
  res.end(fs.readFileSync(target));
}

const server = http.createServer(async (req, res) => {
  const requestId = String(req.headers["x-request-id"] ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  requestCounters.requests += 1;
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (isRateLimited(req)) {
      requestCounters.rateLimited += 1;
      return sendJson(res, 429, { error: "Rate limit exceeded", requestId, retryAfterMs: RATE_LIMIT_WINDOW_MS });
    }
    if (!requireAdminAuth(req)) {
      log("warn", "unauthorized admin request", { requestId, method: req.method, path: url.pathname });
      return sendJson(res, 401, { error: "Unauthorized admin request", requestId });
    }

    if (url.pathname === "/api/program/overview" && req.method === "GET") {
      return sendJson(res, 200, getRuntimeProgramOverview());
    }

    if (url.pathname === "/api/program/modules" && req.method === "GET") {
      return sendJson(res, 200, { modules: listProgramModules() });
    }

    if (url.pathname === "/api/program/features" && req.method === "GET") {
      const features = listRuntimeProgramFeatures({
        moduleId: url.searchParams.get("module") ?? undefined,
        phase: url.searchParams.get("phase") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        batch: url.searchParams.get("batch") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 240)
      });
      return sendJson(res, 200, { features, count: features.length });
    }

    if (url.pathname === "/api/program/feature-contract" && req.method === "GET") {
      const featureId = url.searchParams.get("featureId");
      const contract = applyFeatureOverride(getProgramFeatureContractById(featureId));
      if (!contract) return sendJson(res, 404, { error: "Unknown feature contract", requestId });
      return sendJson(res, 200, contract);
    }

    if (url.pathname === "/api/program/milestones" && req.method === "GET") {
      return sendJson(res, 200, { milestones: getProgramMilestones() });
    }

    if (url.pathname === "/api/program/phase-board" && req.method === "GET") {
      return sendJson(res, 200, { phases: getProgramPhaseBoard() });
    }

    if (url.pathname === "/api/program/runbooks" && req.method === "GET") {
      const runbooks = listProgramRunbooks({
        moduleId: url.searchParams.get("module") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 120)
      });
      return sendJson(res, 200, { runbooks, count: runbooks.length });
    }

    if (url.pathname === "/api/program/release-checkpoints" && req.method === "GET") {
      return sendJson(res, 200, { checkpoints: listProgramReleaseCheckpoints() });
    }

    if (url.pathname === "/api/program/environment" && req.method === "GET") {
      return sendJson(res, 200, getProgramEnvironmentBlueprint());
    }

    if (url.pathname === "/api/program/no-courses-policy" && req.method === "GET") {
      return sendJson(res, 200, getProgramNoCoursesPolicy());
    }

    if (url.pathname === "/api/program/health" && req.method === "GET") {
      return sendJson(
        res,
        200,
        getProgramHealth({
          requestCount: requestCounters.requests,
          streamClientCount: streamClients.size,
          uptimeMs: Date.now() - requestCounters.startedAt,
          rateLimitedCount: requestCounters.rateLimited,
          errorCount: requestCounters.errors
        })
      );
    }

    if (url.pathname === "/api/program/v11-scope" && req.method === "GET") {
      return sendJson(res, 200, getProgramV11Scope());
    }

    if (url.pathname === "/api/v11/event-contract" && req.method === "GET") {
      return sendJson(res, 200, getV11EventContract());
    }

    if (url.pathname === "/api/v11/state" && req.method === "GET") {
      ensureV11State(state);
      return sendJson(res, 200, state.v11);
    }

    if (url.pathname === "/api/admin/program/feature-status" && req.method === "POST") {
      const body = await readBody(req);
      const featureId = String(body.featureId ?? "");
      const existing = getProgramFeatureContractById(featureId);
      if (!existing) return sendJson(res, 404, { error: "Unknown feature contract", requestId });
      const status = normalizeFeatureStatus(body.status);
      if (!status) return sendJson(res, 400, { error: "Invalid status value", requestId });
      const notes = String(body.notes ?? "").slice(0, 500);
      featureStatusOverrides.set(featureId, {
        status,
        notes,
        updatedAt: new Date().toISOString()
      });
      const updated = applyFeatureOverride(existing);
      log("info", "feature status updated", { requestId, featureId, status });
      return sendJson(res, 200, updated);
    }

    if (url.pathname === "/api/state" && req.method === "GET") return sendJson(res, 200, getSnapshot());

    if (url.pathname === "/api/stream" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write(`data: ${JSON.stringify(getSnapshot())}\n\n`);
      streamClients.add(res);
      req.on("close", () => streamClients.delete(res));
      return;
    }

    if (url.pathname === "/api/alerts" && req.method === "GET") {
      return sendJson(res, 200, state.analytics?.alerts ?? []);
    }

    if (url.pathname === "/api/scenarios" && req.method === "GET") {
      return sendJson(res, 200, {
        scenarios: listScenarioBlueprints(),
        lastRun: state.scenarioLab?.lastRun ?? null,
        history: state.scenarioLab?.history?.slice(0, 10) ?? []
      });
    }

    if (url.pathname === "/api/scenario/run" && req.method === "POST") {
      const body = await readBody(req);
      const run = runScenarioPlaybook(state, {
        scenarioId: body.scenarioId ?? body.id,
        intensity: body.intensity,
        ticks: body.ticks
      });
      return sendJson(res, 200, { run, snapshot: getSnapshot() });
    }

    if (url.pathname === "/api/player/analytics" && req.method === "GET") {
      return sendJson(res, 200, { player: state.player, analytics: state.player?.analytics ?? {} });
    }

    if (url.pathname === "/api/rankings/sectors" && req.method === "GET") {
      return sendJson(res, 200, state.leaderboards?.sectors ?? []);
    }

    if (url.pathname === "/api/rankings/countries" && req.method === "GET") {
      return sendJson(res, 200, state.leaderboards?.countries ?? []);
    }

    if (url.pathname === "/api/supply-risk" && req.method === "GET") {
      return sendJson(res, 200, state.analytics?.supplyRisk ?? { routes: [], regions: [], summary: {} });
    }

    if (url.pathname === "/api/financial-system" && req.method === "GET") {
      return sendJson(res, 200, state.financialSystem ?? {});
    }

    if (url.pathname === "/api/insights" && req.method === "GET") {
      return sendJson(res, 200, getInsightsBundle(getSnapshot()));
    }

    if (url.pathname === "/api/insights/mission-board" && req.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 12);
      return sendJson(res, 200, buildMissionBoard(getSnapshot(), { limit }));
    }

    if (url.pathname === "/api/insights/strategy-playbooks" && req.method === "GET") {
      return sendJson(res, 200, { playbooks: listStrategyPlaybooks() });
    }

    if (url.pathname === "/api/insights/backtest" && req.method === "POST") {
      const body = await readBody(req);
      const result = runStrategyBacktest(getSnapshot(), body);
      return sendJson(res, 200, result);
    }

    if (url.pathname === "/api/insights/academy" && req.method === "GET") {
      return sendJson(res, 200, getAcademySnapshot(getSnapshot()));
    }

    if (url.pathname === "/api/company/intelligence" && req.method === "GET") {
      const companyId = url.searchParams.get("companyId");
      if (!companyId || !state.companies[companyId]) return sendJson(res, 404, { error: "Unknown company" });
      return sendJson(res, 200, computeCompanyIntel(state, companyId));
    }

    if (url.pathname === "/api/company" && req.method === "POST") {
      const body = await readBody(req);
      const id = `usr-${Date.now()}`;
      const company = createCompany({
        id,
        name: body.name ?? `NewCo ${state.tick}`,
        country: body.country ?? "USA",
        sector: body.sector ?? "AI",
        businessModel: body.businessModel ?? "SaaS",
        initialValuation: Number(body.initialValuation ?? 500_000_000),
        employees: Number(body.employees ?? 500),
        rdBudget: Number(body.rdBudget ?? 0.12)
      });
      const playerOwned = body.playerOwned === true || body.ownerType === "player";
      if (playerOwned) {
        const sharesOutstanding = Math.max(1, Number(company.stock?.sharesOutstanding ?? 100_000_000));
        const principalStakePct = clamp(Number(body.principalStakePct ?? 67), 10, 95);
        const principalShares = Math.round((sharesOutstanding * principalStakePct) / 100);
        const publicFloatShares = Math.max(1, sharesOutstanding - principalShares);
        company.ownership = {
          principalHolder: "You",
          principalStakePct: Number(principalStakePct.toFixed(4)),
          publicFloatPct: Number((100 - principalStakePct).toFixed(4)),
          principalShares,
          publicFloatShares
        };
        company.stock.publicFloatShares = publicFloatShares;
      }
      upsertCompany(state, company);
      if (playerOwned) {
        state.player.companyIds = Array.isArray(state.player.companyIds) ? state.player.companyIds : [];
        if (!state.player.companyIds.includes(company.id)) state.player.companyIds.push(company.id);
        state.player.activeCompanyId = company.id;
        state.player.holdings = state.player.holdings ?? {};
        const founderShares = Number(company.ownership?.principalShares ?? 0);
        if (founderShares > 0) {
          state.player.holdings[company.id] = founderShares;
          state.player.positions = state.player.positions ?? {};
          state.player.positions[company.id] = {
            shares: founderShares,
            avgEntryPrice: Number(company.stock?.lastPrice ?? 0),
            realizedPnl: Number(state.player.positions[company.id]?.realizedPnl ?? 0),
            wins: Number(state.player.positions[company.id]?.wins ?? 0),
            losses: Number(state.player.positions[company.id]?.losses ?? 0),
            closedTrades: Number(state.player.positions[company.id]?.closedTrades ?? 0),
            tradedVolume: Number(state.player.positions[company.id]?.tradedVolume ?? 0),
            totalBoughtNotional: Number(state.player.positions[company.id]?.totalBoughtNotional ?? 0),
            totalSoldNotional: Number(state.player.positions[company.id]?.totalSoldNotional ?? 0)
          };
        }
      }
      refreshPlayerAnalytics(state);
      refreshMarketAnalytics(state);
      return sendJson(res, 201, company);
    }

    if (url.pathname === "/api/order" && req.method === "POST") {
      const body = await readBody(req);
      const trades = placeOrder(state, body);
      return sendJson(res, 201, { trades, player: state.player, alerts: state.analytics?.alerts ?? [] });
    }

    if (url.pathname === "/api/order/square-off" && req.method === "POST") {
      const body = await readBody(req);
      const trades = squareOffPosition(state, { companyId: body.companyId, traderId: body.traderId ?? "player" });
      return sendJson(res, 200, { trades, player: state.player, alerts: state.analytics?.alerts ?? [] });
    }

    if (url.pathname === "/api/stock/control" && req.method === "POST") {
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const stock = state.stocks[companyId];
      if (!stock || !state.companies[companyId]) return sendJson(res, 404, { error: "Unknown company" });

      if (body.stability !== undefined) {
        stock.stability = Number(clamp(Number(body.stability), 0.2, 0.98).toFixed(3));
      }
      if (body.supportStrength !== undefined) {
        stock.supportStrength = Number(clamp(Number(body.supportStrength), 0.2, 0.98).toFixed(3));
      }
      if (body.resistanceStrength !== undefined) {
        stock.resistanceStrength = Number(clamp(Number(body.resistanceStrength), 0.2, 0.98).toFixed(3));
      }

      let support = Number(stock.support ?? stock.lastPrice * 0.96);
      let resistance = Number(stock.resistance ?? stock.lastPrice * 1.04);
      if (body.support !== undefined) support = Math.max(0.0001, Number(body.support));
      if (body.resistance !== undefined) resistance = Math.max(0.0002, Number(body.resistance));
      if (!Number.isFinite(support)) support = Number(stock.support ?? stock.lastPrice * 0.96);
      if (!Number.isFinite(resistance)) resistance = Number(stock.resistance ?? stock.lastPrice * 1.04);
      if (resistance <= support) resistance = support + 0.0001;
      stock.support = Number(support.toFixed(4));
      stock.resistance = Number(resistance.toFixed(4));

      refreshMarketAnalytics(state);
      return sendJson(res, 200, {
        companyId,
        stability: stock.stability,
        support: stock.support,
        resistance: stock.resistance,
        supportStrength: stock.supportStrength,
        resistanceStrength: stock.resistanceStrength
      });
    }

    if (url.pathname === "/api/tick" && req.method === "POST") {
      const body = await readBody(req);
      runTick(state, { events: body.events ?? [] });
      return sendJson(res, 200, getSnapshot());
    }

    if (url.pathname === "/api/event" && req.method === "POST") {
      const body = await readBody(req);
      const events = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [];
      runTick(state, { events });
      return sendJson(res, 200, getSnapshot());
    }

    if (url.pathname === "/api/merge" && req.method === "POST") {
      const body = await readBody(req);
      const outcome = executeMerger(state, { buyerId: body.buyerId, targetId: body.targetId });
      return sendJson(res, 200, outcome);
    }

    if (url.pathname === "/api/action" && req.method === "POST") {
      const body = await readBody(req);
      const outcome = executeStrategicAction(state, body);
      return sendJson(res, 200, outcome);
    }

    if (url.pathname === "/api/rankings" && req.method === "GET") {
      return sendJson(res, 200, state.leaderboards);
    }

    if (url.pathname === "/api/fast-forward" && req.method === "POST") {
      const body = await readBody(req);
      fastForward(state, Number(body.ticks ?? 60));
      return sendJson(res, 200, getSnapshot());
    }

    return serveStatic(req, res, url.pathname);
  } catch (error) {
    requestCounters.errors += 1;
    log("error", "request failed", { message: error.message, stack: error.stack, method: req.method, path: req.url });
    return sendJson(res, 400, { error: error.message });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`World Finance Simulator MVP server running on http://localhost:${PORT}`);
});
