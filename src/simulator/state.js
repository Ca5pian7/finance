import { COMMODITIES, COUNTRIES, COUNTRY_PROFILES, DEFAULT_MACRO, SECTORS, SUPPLY_REGIONS } from "./constants.js";
import { createRng, pick } from "./random.js";

export function createInitialState({ seed = 42 } = {}) {
  const governments = Object.fromEntries(
    COUNTRIES.map((country) => [
      country,
      {
        taxRate: COUNTRY_PROFILES[country]?.taxRate ?? 0.22,
        subsidy: COUNTRY_PROFILES[country]?.subsidy ?? 0.03,
        regulation: 0.5,
        stability: 0.7,
        sanctions: [],
        alliances: []
      }
    ])
  );

  return {
    seed,
    tick: 0,
    time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    marketSession: {
      ticksPerDay: 300,
      phase: "day",
      dayNumber: 1
    },
    macro: { ...DEFAULT_MACRO },
    sentiment: 0,
    policyPressure: 0,
    governments,
    commodities: Object.fromEntries(
      Object.entries(COMMODITIES).map(([key, v]) => [key, { price: v.basePrice }])
    ),
    supplyChains: {
      pressure: 0.2,
      regions: Object.fromEntries(Object.entries(SUPPLY_REGIONS).map(([k, v]) => [k, { ...v, disruption: 0 }])),
      routes: [
        { id: "pacific-tech", from: "Taiwan", to: "USA", delay: 0.05, capacity: 1, active: true },
        { id: "oil-bridge", from: "UAE", to: "Germany", delay: 0.04, capacity: 1, active: true },
        { id: "manufacturing-flow", from: "China", to: "Brazil", delay: 0.06, capacity: 1, active: true }
      ]
    },
    geopolitics: {
      tension: 0.15,
      activeConflicts: [],
      treaties: [],
      events: []
    },
    population: createPopulation(seed),
    funds: {
      institutionalAUM: 2_400_000_000_000,
      hedgeAUM: 850_000_000_000,
      retailLiquidity: 450_000_000_000,
      aiBotAggression: 0.35
    },
    indexes: {
      GLOBAL100: { value: 1000, changePct: 0, members: [] }
    },
    leaderboards: {
      companies: [],
      richest: []
    },
    player: {
      role: "startup founder",
      cash: 50_000_000_000,
      netWorth: 50_000_000_000,
      influence: 0.1,
      rank: 0
    },
    companies: {},
    stocks: {},
    orderBooks: {},
    headlines: [],
    events: [],
    checkpoints: []
  };
}

export function createSeedCompanies(state, count = 8) {
  const rng = createRng(state.seed);
  for (let i = 0; i < count; i += 1) {
    const company = createCompany({
      id: `seed-${i + 1}`,
      name: `${pick(rng, ["Neo", "Quantum", "Prime", "Atlas", "Nova"])}${pick(rng, ["Core", "Wave", "Mind", "Chip", "Grid"])} ${i + 1}`,
      country: pick(rng, COUNTRIES),
      sector: pick(rng, SECTORS),
      businessModel: pick(rng, ["B2B", "B2C", "SaaS", "Hardware", "Hybrid"]),
      initialValuation: 2_000_000_000 + Math.floor(rng() * 4_000_000_000)
    });
    upsertCompany(state, company);
  }
}

export function createCompany({
  id,
  name,
  country,
  sector,
  businessModel,
  initialValuation = 1_000_000_000,
  employees = 5000,
  rdBudget = 0.12
}) {
  const sharesOutstanding = 100_000_000;
  const initialPrice = Number((initialValuation / sharesOutstanding).toFixed(2));

  return {
    id,
    name,
    country,
    sector,
    businessModel,
    valuation: initialValuation,
    employees,
    rdBudget,
    innovation: 0.5,
    reputation: 0.5,
    aiCapability: 0.5,
    marketDominance: 0.1,
    politicalInfluence: 0.1,
    supplyRisk: 0.2,
    carbonEmissions: Math.round(employees * 0.6),
    kpis: {
      revenue: initialValuation * 0.18,
      profitMargin: 0.14,
      growth: 0.03,
      debtRatio: 0.22
    },
    stock: {
      ticker: createTicker(name, id),
      sharesOutstanding,
      lastPrice: initialPrice,
      marketCap: initialValuation,
      peRatio: 18,
      shortInterest: 0.03,
      dividendYield: 0.01,
      listed: true,
      ipoTick: 0,
      delistedTick: null,
      volume: 0,
      halted: false,
      stability: 0.7,
      buyPressure: 0.5,
      sellPressure: 0.5,
      candles: []
    }
  };
}

export function createTicker(name, fallback) {
  const raw = name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
  return raw.length >= 2 ? raw : fallback.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
}

export function upsertCompany(state, company) {
  state.companies[company.id] = structuredClone(company);
  state.stocks[company.id] = structuredClone(company.stock);
  state.orderBooks[company.id] = { buy: [], sell: [] };
}

function createPopulation(seed) {
  const rng = createRng(seed * 17 + 3);
  const types = [
    { kind: "consumer", risk: 0.2, wealth: 20_000 },
    { kind: "investor", risk: 0.55, wealth: 120_000 },
    { kind: "ceo", risk: 0.65, wealth: 8_000_000 },
    { kind: "politician", risk: 0.35, wealth: 700_000 },
    { kind: "influencer", risk: 0.6, wealth: 300_000 },
    { kind: "worker", risk: 0.25, wealth: 35_000 }
  ];

  const agents = [];
  for (let i = 0; i < 120; i += 1) {
    const t = pick(rng, types);
    agents.push({
      id: `p-${i + 1}`,
      type: t.kind,
      riskTolerance: Number((t.risk + (rng() - 0.5) * 0.2).toFixed(3)),
      wealth: Math.max(1_000, Math.round(t.wealth * (0.7 + rng() * 0.9))),
      emotion: 0,
      ideology: Number((rng() * 2 - 1).toFixed(3)),
      spendingBias: Number((0.4 + rng() * 0.6).toFixed(3))
    });
  }

  return {
    participantCount: 10_000_000,
    agents,
    unemploymentStress: 0.05,
    consumerConfidence: 0.62,
    inequalityIndex: 0.41
  };
}
