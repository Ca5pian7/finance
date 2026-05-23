import { COMMODITIES, COUNTRIES, DEFAULT_MACRO, SECTORS } from "./constants.js";
import { createRng, pick } from "./random.js";

export function createInitialState({ seed = 42 } = {}) {
  return {
    seed,
    tick: 0,
    time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    macro: { ...DEFAULT_MACRO },
    sentiment: 0,
    commodities: Object.fromEntries(
      Object.entries(COMMODITIES).map(([key, v]) => [key, { price: v.basePrice }])
    ),
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
      volume: 0,
      halted: false,
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
