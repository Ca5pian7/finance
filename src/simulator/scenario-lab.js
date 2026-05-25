import { runTick } from "./engine.js";

function bounded(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function ensureScenarioLabState(state) {
  state.scenarioLab = state.scenarioLab ?? {};
  if (!Array.isArray(state.scenarioLab.history)) state.scenarioLab.history = [];
}

function getLargestCompany(state) {
  let selected = null;
  for (const [companyId, company] of Object.entries(state.companies ?? {})) {
    const stock = state.stocks?.[companyId];
    if (!stock?.listed) continue;
    const marketCap = Number(stock.marketCap ?? company?.valuation ?? 0);
    if (!selected || marketCap > selected.marketCap || (marketCap === selected.marketCap && companyId < selected.companyId)) {
      selected = {
        companyId,
        companyName: company?.name ?? companyId,
        marketCap
      };
    }
  }
  return selected;
}

function getScenarioContext(state) {
  const leader = getLargestCompany(state);
  return {
    leaderCompanyId: leader?.companyId ?? null,
    leaderCompanyName: leader?.companyName ?? "A market leader"
  };
}

const SCENARIO_BLUEPRINTS = [
  {
    id: "AI_SUPERCYCLE",
    name: "AI Supercycle",
    theme: "growth",
    description: "Acceleration scenario with AI breakthroughs, new launches, and trade cooperation.",
    defaultTicks: 6,
    maxTicks: 18,
    timeline: [
      (ctx) => [{ type: "AI_BREAKTHROUGH", companyId: ctx.leaderCompanyId, companyName: ctx.leaderCompanyName }],
      () => [{ type: "PRODUCT_LAUNCH" }, { type: "TRADE_AGREEMENT", name: "Digital Infrastructure Accord" }],
      () => [{ type: "TRADE_AGREEMENT", name: "Semiconductor Access Deal" }]
    ]
  },
  {
    id: "SUPPLY_CHAIN_CRUNCH",
    name: "Supply Chain Crunch",
    theme: "risk",
    description: "Stress test with supply shocks, sanctions, and conflict flare-ups.",
    defaultTicks: 5,
    maxTicks: 14,
    timeline: [
      () => [{ type: "SUPPLY_SHOCK" }, { type: "SANCTION", country: "China" }],
      () => [{ type: "WAR", region: "Pacific Corridor" }],
      () => [{ type: "CYBER_ATTACK" }, { type: "SUPPLY_SHOCK" }]
    ]
  },
  {
    id: "POLICY_TIGHTENING",
    name: "Policy Tightening Cycle",
    theme: "macro",
    description: "Monetary and regulatory tightening sequence for resilience testing.",
    defaultTicks: 7,
    maxTicks: 20,
    timeline: [
      () => [{ type: "RATE_HIKE" }, { type: "SANCTION", country: "Major economy" }],
      () => [{ type: "RATE_HIKE" }, { type: "CYBER_ATTACK" }],
      () => [{ type: "SCANDAL", companyName: "Systemically Important Firm" }]
    ]
  },
  {
    id: "PEACE_DIVIDEND",
    name: "Peace Dividend",
    theme: "stability",
    description: "Risk-off unwind where diplomacy and agreements improve macro stability.",
    defaultTicks: 5,
    maxTicks: 16,
    timeline: [
      () => [{ type: "TRADE_AGREEMENT", name: "Global Logistics Restoration Pact" }],
      () => [{ type: "TRADE_AGREEMENT", name: "Energy Corridor Reopening" }],
      () => [{ type: "AI_BREAKTHROUGH", companyName: "Open Research Alliance" }]
    ]
  }
];

const BLUEPRINT_BY_ID = new Map(SCENARIO_BLUEPRINTS.map((scenario) => [scenario.id, scenario]));

function materializeEvents(factory, context, intensity) {
  const baseEvents = Array.isArray(factory) ? factory : factory(context);
  const events = [];
  const repeats = Math.max(1, Math.min(3, Math.round(intensity)));
  for (const event of baseEvents) {
    const copies = event.type === "TRADE_AGREEMENT" || event.type === "RATE_HIKE" ? 1 : repeats;
    for (let i = 0; i < copies; i += 1) events.push({ ...event });
  }
  return events;
}

function summarizeStep(state, index, events) {
  return {
    step: index + 1,
    tick: state.tick,
    eventCount: events.length,
    eventTypes: [...new Set(events.map((event) => event.type))],
    marketRegime: state.marketRegime,
    sentiment: round(state.sentiment, 4),
    inflation: round(state.macro?.inflation, 4),
    policyRate: round(state.macro?.rate, 4),
    supplyPressure: round(state.supplyChains?.pressure, 4),
    tension: round(state.geopolitics?.tension, 4)
  };
}

export function listScenarioBlueprints() {
  return SCENARIO_BLUEPRINTS.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    theme: scenario.theme,
    description: scenario.description,
    defaultTicks: scenario.defaultTicks,
    maxTicks: scenario.maxTicks
  }));
}

export function runScenarioPlaybook(state, { scenarioId, intensity = 1, ticks } = {}) {
  ensureScenarioLabState(state);
  const blueprint = BLUEPRINT_BY_ID.get(String(scenarioId ?? "").toUpperCase());
  if (!blueprint) throw new Error("Unknown scenario");

  const normalizedIntensity = bounded(Number(intensity ?? 1), 0.5, 3);
  const requestedTicks = Number.isFinite(Number(ticks)) ? Number(ticks) : blueprint.defaultTicks;
  const ticksToRun = Math.max(1, Math.min(blueprint.maxTicks, Math.round(requestedTicks)));
  const context = getScenarioContext(state);
  const startTick = state.tick;
  const before = {
    sentiment: Number(state.sentiment ?? 0),
    inflation: Number(state.macro?.inflation ?? 0),
    policyRate: Number(state.macro?.rate ?? 0),
    tension: Number(state.geopolitics?.tension ?? 0),
    supplyPressure: Number(state.supplyChains?.pressure ?? 0)
  };

  const stepSummaries = [];
  const typeCounts = {};
  for (let i = 0; i < ticksToRun; i += 1) {
    const phaseFactory = blueprint.timeline[i % blueprint.timeline.length];
    const events = materializeEvents(phaseFactory, context, normalizedIntensity);
    for (const event of events) typeCounts[event.type] = Number(typeCounts[event.type] ?? 0) + 1;
    runTick(state, { events });
    stepSummaries.push(summarizeStep(state, i, events));
  }

  const after = {
    sentiment: Number(state.sentiment ?? 0),
    inflation: Number(state.macro?.inflation ?? 0),
    policyRate: Number(state.macro?.rate ?? 0),
    tension: Number(state.geopolitics?.tension ?? 0),
    supplyPressure: Number(state.supplyChains?.pressure ?? 0)
  };

  const run = {
    scenarioId: blueprint.id,
    scenarioName: blueprint.name,
    theme: blueprint.theme,
    startTick,
    endTick: state.tick,
    ticksExecuted: ticksToRun,
    intensity: round(normalizedIntensity, 2),
    eventTypeCounts: typeCounts,
    before: {
      sentiment: round(before.sentiment, 4),
      inflation: round(before.inflation, 4),
      policyRate: round(before.policyRate, 4),
      tension: round(before.tension, 4),
      supplyPressure: round(before.supplyPressure, 4)
    },
    after: {
      sentiment: round(after.sentiment, 4),
      inflation: round(after.inflation, 4),
      policyRate: round(after.policyRate, 4),
      tension: round(after.tension, 4),
      supplyPressure: round(after.supplyPressure, 4)
    },
    deltas: {
      sentiment: round(after.sentiment - before.sentiment, 4),
      inflation: round(after.inflation - before.inflation, 4),
      policyRate: round(after.policyRate - before.policyRate, 4),
      tension: round(after.tension - before.tension, 4),
      supplyPressure: round(after.supplyPressure - before.supplyPressure, 4)
    },
    steps: stepSummaries
  };

  state.scenarioLab.history.unshift(run);
  state.scenarioLab.history = state.scenarioLab.history.slice(0, 40);
  state.scenarioLab.lastRun = run;
  return run;
}
