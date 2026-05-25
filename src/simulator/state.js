import { COMMODITIES, COUNTRIES, COUNTRY_PROFILES, DEFAULT_MACRO, SECTORS, SUPPLY_REGIONS } from "./constants.js";
import { createRng, pick } from "./random.js";

export function calculatePeRatio({ marketCap, revenue, profitMargin }) {
  const earnings = Number(revenue) * Number(profitMargin);
  if (!Number.isFinite(earnings) || Math.abs(earnings) < 0.0001) return null;
  const peRatio = Number(marketCap) / earnings;
  return Number.isFinite(peRatio) ? Number(peRatio.toFixed(2)) : null;
}

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
    marketRegime: "stable",
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
      institutionalAUM: 3_200_000_000_000,
      hedgeAUM: 1_200_000_000_000,
      retailLiquidity: 900_000_000_000,
      aiBotAggression: 0.42
    },
    indexes: {
      GLOBAL100: { value: 1000, changePct: 0, members: [] },
      GLOBAL50: { value: 1000, changePct: 0, members: [] },
      GLOBAL_ALL: { value: 1000, changePct: 0, members: [] },
      NASDAQ100: { value: 1000, changePct: 0, members: [], candles: [] }
    },
    leaderboards: {
      companies: [],
      richest: [],
      sectors: [],
      countries: []
    },
    player: {
      role: "startup founder",
      cash: 50_000_000_000,
      netWorth: 50_000_000_000,
      influence: 0.1,
      rank: 0,
      companyIds: [],
      activeCompanyId: null,
      holdings: {},
      positions: {},
      trades: [],
      analytics: {
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0,
        positionsCount: 0,
        grossExposure: 0,
        longExposure: 0,
        shortExposure: 0,
        turnover: 0,
        winRate: 0,
        cashUtilization: 0,
        exposureBySector: [],
        exposureByCountry: [],
        positions: [],
        topPosition: null,
        worstPosition: null
      }
    },
    companies: {},
    stocks: {},
    orderBooks: {},
    headlines: [],
    events: [],
    scenarioLab: {
      history: [],
      lastRun: null
    },
    checkpoints: [],
    analytics: {
      alerts: [],
      supplyRisk: {
        routes: [],
        regions: [],
        summary: {}
      },
      market: {}
    }
  };
}

const FEATURED_COMPANY_CATALOG = [
  { name: "SpaceX", country: "USA", sector: "Space", businessModel: "Hardware", initialValuation: 180_000_000_000 },
  { name: "Cisco", country: "USA", sector: "Cloud Computing", businessModel: "B2B", initialValuation: 220_000_000_000 },
  { name: "T Group", country: "UAE", sector: "Logistics", businessModel: "Hybrid", initialValuation: 95_000_000_000 },
  { name: "Celestia", country: "USA", sector: "AI", businessModel: "SaaS", initialValuation: 42_000_000_000 },
  { name: "Neon Grid", country: "Japan", sector: "Semiconductor", businessModel: "Hardware", initialValuation: 28_000_000_000 },
  { name: "Black Nova", country: "Germany", sector: "Defense", businessModel: "B2B", initialValuation: 33_000_000_000 }
];

export function createSeedCompanies(state, count = 12) {
  const rng = createRng(state.seed);
  for (let i = 0; i < count; i += 1) {
    const featured = FEATURED_COMPANY_CATALOG[i];
    const company = createCompany({
      id: `seed-${i + 1}`,
      name: featured?.name ?? `${pick(rng, ["Neo", "Quantum", "Prime", "Atlas", "Nova"])}${pick(rng, ["Core", "Wave", "Mind", "Chip", "Grid"])} ${i + 1}`,
      country: featured?.country ?? pick(rng, COUNTRIES),
      sector: featured?.sector ?? pick(rng, SECTORS),
      businessModel: featured?.businessModel ?? pick(rng, ["B2B", "B2C", "SaaS", "Hardware", "Hybrid"]),
      initialValuation: featured?.initialValuation ?? 2_000_000_000 + Math.floor(rng() * 4_000_000_000)
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
  rdBudget = 0.12,
  principalStakePct = 62
}) {
  const sharesOutstanding = 100_000_000;
  const initialPrice = Number((initialValuation / sharesOutstanding).toFixed(2));
  const principalHolder = createPrincipalHolderName(name, id);
  const boundedPrincipalStakePct = Math.min(90, Math.max(10, Number(principalStakePct)));
  const publicFloatPct = Number((100 - boundedPrincipalStakePct).toFixed(4));
  const principalShares = Math.round((sharesOutstanding * boundedPrincipalStakePct) / 100);
  const publicFloatShares = Math.max(1, sharesOutstanding - principalShares);
  const initialRevenue = initialValuation * 0.18;
  const initialProfitMargin = 0.14;

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
      revenue: initialRevenue,
      profitMargin: initialProfitMargin,
      growth: 0.03,
      debtRatio: 0.22
    },
    ownership: {
      principalHolder,
      principalStakePct: boundedPrincipalStakePct,
      publicFloatPct,
      principalShares,
      publicFloatShares
    },
    stock: {
      ticker: createTicker(name, id),
      sharesOutstanding,
      publicFloatShares,
      lastPrice: initialPrice,
      marketCap: initialValuation,
      peRatio: calculatePeRatio({ marketCap: initialValuation, revenue: initialRevenue, profitMargin: initialProfitMargin }),
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
      dayOpenPrice: initialPrice,
      dayHigh: initialPrice,
      dayLow: initialPrice,
      support: initialPrice * 0.96,
      resistance: initialPrice * 1.04,
      supportStrength: 0.72,
      resistanceStrength: 0.72,
      supportBreakPressure: 0,
      resistanceBreakPressure: 0,
      newsMomentum: 0,
      movementProfile: createMovementProfile({ id, name, sector, businessModel }),
      candles: []
    }
  };
}

function createPrincipalHolderName(name, fallback) {
  const cleaned = String(name ?? "").trim();
  if (cleaned) {
    const firstWord = cleaned.split(/\s+/)[0];
    return `${firstWord} Founder`;
  }
  return `${fallback} Founder`;
}

export function createTicker(name, fallback) {
  const raw = name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
  return raw.length >= 2 ? raw : fallback.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
}

export function upsertCompany(state, company) {
  const nextCompany = structuredClone(company);
  nextCompany.name = createUniqueCompanyName(state, nextCompany.id, nextCompany.name);
  nextCompany.stock.ticker = createUniqueTicker(state, nextCompany.id, nextCompany.stock.ticker);
  if (!nextCompany.stock.movementProfile) {
    nextCompany.stock.movementProfile = createMovementProfile({
      id: nextCompany.id,
      name: nextCompany.name,
      sector: nextCompany.sector,
      businessModel: nextCompany.businessModel
    });
  }

  state.companies[nextCompany.id] = nextCompany;
  state.stocks[nextCompany.id] = structuredClone(nextCompany.stock);
  state.orderBooks[company.id] = { buy: [], sell: [] };
}

function createUniqueCompanyName(state, companyId, requestedName) {
  const base = String(requestedName ?? companyId).trim() || companyId;
  const existing = new Set(
    Object.entries(state.companies)
      .filter(([id]) => id !== companyId)
      .map(([, c]) => String(c.name ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!existing.has(base.toLowerCase())) return base;
  let suffix = 2;
  let candidate = `${base} ${suffix}`;
  while (existing.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base} ${suffix}`;
  }
  return candidate;
}

function createUniqueTicker(state, companyId, requestedTicker) {
  const cleanRequested = String(requestedTicker ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  const base = cleanRequested.length >= 2 ? cleanRequested.slice(0, 5) : `S${String(companyId).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`.slice(0, 5);
  const existing = new Set(
    Object.entries(state.stocks)
      .filter(([id]) => id !== companyId)
      .map(([, stock]) => String(stock.ticker ?? "").toUpperCase())
      .filter(Boolean)
  );
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (suffix < 46656) {
    const suffixCode = suffix.toString(36).toUpperCase();
    const ticker = `${base.slice(0, Math.max(2, 5 - suffixCode.length))}${suffixCode}`;
    if (!existing.has(ticker)) return ticker;
    suffix += 1;
  }
  return `${base.slice(0, 3)}${Date.now().toString(36).toUpperCase().slice(-2)}`;
}

function hashString(input) {
  let hash = 0;
  for (const char of String(input ?? "")) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function createMovementProfile({ id, name, sector, businessModel }) {
  const seed = hashString(`${id}:${name}:${sector}:${businessModel}`);
  const normalized = (seed % 1000) / 1000;
  const sectorBias = {
    AI: 1.2,
    Crypto: 1.35,
    Semiconductor: 1.15,
    Energy: 1.05,
    Banking: 0.9,
    Pharma: 0.92,
    Utilities: 0.85
  };
  const baseVolatility = 0.78 + normalized * 0.74;
  const volatility = Number((baseVolatility * (sectorBias[sector] ?? 1)).toFixed(3));
  const momentumSensitivity = Number((0.75 + ((seed >> 5) % 1000) / 1000 * 0.7).toFixed(3));
  const style = volatility >= 1.25 ? "aggressive" : volatility <= 0.95 ? "defensive" : "balanced";
  return { volatility: Math.min(1.8, Math.max(0.65, volatility)), momentumSensitivity, style };
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
    participantCount: 25_000_000,
    agents,
    unemploymentStress: 0.05,
    consumerConfidence: 0.62,
    inequalityIndex: 0.41
  };
}
