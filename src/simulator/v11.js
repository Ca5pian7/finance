import { COMMODITIES, COUNTRIES } from "./constants.js";

function bounded(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function asNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cityTemplate(country, index) {
  return {
    id: `${country.toLowerCase()}-city-${index + 1}`,
    country,
    name: `${country} Metro ${index + 1}`,
    population: 1_250_000 + index * 180_000,
    gdp: 75_000_000_000 + index * 4_500_000_000,
    happiness: 0.61,
    crime: 0.22,
    pollution: 0.36,
    infrastructure: 0.58,
    housingDemand: 0.54,
    traffic: 0.46,
    industries: ["AI", "Energy", "Logistics"].slice(0, 2 + (index % 2)),
    tourism: 0.42,
    education: 0.57,
    aiAutomationLevel: 0.33,
    employment: 0.94,
    electricityUsage: 0.48,
    internetInfrastructure: 0.63
  };
}

function countryTemplate(country) {
  return {
    name: country,
    economy: 0.55,
    military: 0.52,
    politicalStability: 0.62,
    tradeRelations: 0.58,
    inflation: 0.024,
    debt: 0.74,
    taxes: 0.22,
    naturalResources: 0.56,
    currency: `${country}-X`,
    stockMarket: 0.57,
    exports: 0.51,
    imports: 0.48,
    aiDevelopmentLevel: 0.46
  };
}

function createEconomyLayer() {
  return {
    macroCycle: "expansion",
    centralBankPolicy: {
      targetInflation: 0.025,
      policyRateBias: 0
    },
    sectorDemand: Object.fromEntries(Object.keys(COMMODITIES).map((key) => [key, 1])),
    labor: {
      participation: 0.63,
      unemployment: 0.051,
      automationShock: 0.08
    },
    debtLiquidity: {
      debtStress: 0.22,
      liquidityStress: 0.19
    },
    housing: {
      index: 100,
      affordability: 0.57
    },
    regime: "stable",
    recessionRisk: 0.18,
    bubbleRisk: 0.22
  };
}

function createActorsLayer() {
  return {
    populationCohorts: [
      { id: "working-class", incomeBand: "low-mid", ideology: 0.1, riskProfile: 0.3, sentiment: 0.58, spendingPropensity: 0.67, investingPropensity: 0.21 },
      { id: "professionals", incomeBand: "mid-high", ideology: -0.05, riskProfile: 0.45, sentiment: 0.6, spendingPropensity: 0.62, investingPropensity: 0.35 },
      { id: "capital-owners", incomeBand: "high", ideology: -0.1, riskProfile: 0.62, sentiment: 0.63, spendingPropensity: 0.48, investingPropensity: 0.58 }
    ],
    sentimentPropagation: 0.52,
    socialMood: 0.04,
    influencerHeat: 0.3,
    governments: {},
    corporations: {},
    criminals: {
      cybercrimePressure: 0.18,
      launderingPressure: 0.14
    },
    funds: {
      hedgeAggression: 0.42,
      retailRiskOn: 0.49
    }
  };
}

function createMarketsLayer() {
  return {
    orderFlowDepth: 0.62,
    volatilityControl: {
      circuitBreakerTrips: 0,
      shortStress: 0.21,
      bankruptcyWatch: []
    },
    indexFamilies: {
      GLOBAL100: { benchmarkFlow: 0 },
      GLOBAL50: { benchmarkFlow: 0 },
      GLOBAL_ALL: { benchmarkFlow: 0 },
      NASDAQ100: { benchmarkFlow: 0 }
    },
    currency: {
      fxVolatility: 0.19
    },
    realEstate: {
      commercialIndex: 100,
      residentialIndex: 100
    },
    blackMarket: {
      activity: 0.16,
      enforcementPressure: 0.48
    },
    auctions: {
      listings: [],
      settled: [],
      brokerFeesCollected: 0,
      flaggedFraudAttempts: 0
    }
  };
}

function createWorldLayer() {
  const cities = COUNTRIES.flatMap((country) => [cityTemplate(country, 0), cityTemplate(country, 1)]);
  return {
    cities,
    countries: Object.fromEntries(COUNTRIES.map((country) => [country, countryTemplate(country)])),
    resources: Object.fromEntries(Object.keys(COMMODITIES).map((key) => [key, { scarcity: 0.3, extraction: 0.52 }])),
    logistics: {
      ports: COUNTRIES.map((country) => ({ id: `port-${country.toLowerCase()}`, country, throughput: 0.62, congestion: 0.18 })),
      routes: [
        { id: "route-pacific", from: "Taiwan", to: "USA", mode: "shipping", capacity: 1, disruption: 0.04, tariff: 0.03, sanctionRisk: 0.08 },
        { id: "route-europe-energy", from: "UAE", to: "Germany", mode: "shipping", capacity: 1, disruption: 0.05, tariff: 0.025, sanctionRisk: 0.09 },
        { id: "route-asia-rail", from: "China", to: "India", mode: "rail", capacity: 1, disruption: 0.03, tariff: 0.02, sanctionRisk: 0.04 }
      ],
      chokepoints: [
        { id: "strait-alpha", severity: 0.21 },
        { id: "canal-beta", severity: 0.17 }
      ]
    },
    governance: {
      alliances: [],
      sanctions: [],
      globalPolicyPulse: 0.09
    }
  };
}

function createEventsLayer() {
  return {
    contractVersion: "v11.0",
    queue: [],
    history: [],
    newsFeed: [],
    socialSignals: {
      hype: 0.28,
      panic: 0.2,
      fakeNewsRisk: 0.19
    },
    disasterEngine: {
      baseProbability: 0.006,
      intensity: 0.34,
      active: []
    }
  };
}

export function createV11DomainState() {
  return {
    version: "v11",
    world: createWorldLayer(),
    economy: createEconomyLayer(),
    actors: createActorsLayer(),
    markets: createMarketsLayer(),
    events: createEventsLayer(),
    multiplayer: {
      sharedWorldState: true,
      antiManipulationFlags: [],
      alliances: [],
      cartels: [],
      leaderboards: {
        richestPlayers: [],
        topCities: [],
        topCompanies: [],
        topCountriesByGdp: []
      }
    },
    ops: {
      apiVersion: "v11",
      performanceBudgets: {
        maxTickMs: 150,
        maxSnapshotMs: 80
      },
      replayValidation: {
        deterministicChecks: 0,
        lastValidatedTick: 0
      }
    }
  };
}

export function ensureV11State(state) {
  state.v11 = state.v11 ?? createV11DomainState();
  const defaults = createV11DomainState();
  state.v11.world = state.v11.world ?? defaults.world;
  state.v11.economy = state.v11.economy ?? defaults.economy;
  state.v11.actors = state.v11.actors ?? defaults.actors;
  state.v11.markets = state.v11.markets ?? defaults.markets;
  state.v11.events = state.v11.events ?? defaults.events;
  state.v11.multiplayer = state.v11.multiplayer ?? defaults.multiplayer;
  state.v11.ops = state.v11.ops ?? defaults.ops;
  state.v11.events.queue = Array.isArray(state.v11.events.queue) ? state.v11.events.queue : [];
  state.v11.events.history = Array.isArray(state.v11.events.history) ? state.v11.events.history : [];
  state.v11.events.newsFeed = Array.isArray(state.v11.events.newsFeed) ? state.v11.events.newsFeed : [];
  state.v11.events.disasterEngine = state.v11.events.disasterEngine ?? defaults.events.disasterEngine;
  state.v11.markets.auctions = state.v11.markets.auctions ?? defaults.markets.auctions;
  state.v11.markets.auctions.listings = Array.isArray(state.v11.markets.auctions.listings) ? state.v11.markets.auctions.listings : [];
  state.v11.markets.auctions.settled = Array.isArray(state.v11.markets.auctions.settled) ? state.v11.markets.auctions.settled : [];
  state.v11.markets.volatilityControl = state.v11.markets.volatilityControl ?? defaults.markets.volatilityControl;
  state.v11.markets.volatilityControl.bankruptcyWatch = Array.isArray(state.v11.markets.volatilityControl.bankruptcyWatch)
    ? state.v11.markets.volatilityControl.bankruptcyWatch
    : [];
  state.v11.world.cities = Array.isArray(state.v11.world.cities) ? state.v11.world.cities : defaults.world.cities;
  state.v11.world.logistics = state.v11.world.logistics ?? defaults.world.logistics;
  state.v11.world.governance = state.v11.world.governance ?? defaults.world.governance;
  state.v11.actors.populationCohorts = Array.isArray(state.v11.actors.populationCohorts)
    ? state.v11.actors.populationCohorts
    : defaults.actors.populationCohorts;
  state.v11.multiplayer.antiManipulationFlags = Array.isArray(state.v11.multiplayer.antiManipulationFlags)
    ? state.v11.multiplayer.antiManipulationFlags
    : [];
}

export function normalizeV11Event(state, event = {}) {
  const type = String(event.type ?? "UNKNOWN").toUpperCase();
  return {
    id: String(event.id ?? `${state.tick}-${type}-${state.v11.events.history.length + state.v11.events.queue.length + 1}`),
    tick: state.tick,
    time: state.time,
    type,
    scope: String(event.scope ?? "global"),
    severity: bounded(asNumber(event.severity, 0.5), 0, 1),
    source: String(event.source ?? "system"),
    payload: clone(event.payload ?? event)
  };
}

function pushNews(state, headline, marketImpact = 0) {
  state.v11.events.newsFeed.unshift({
    id: `news-${state.tick}-${state.v11.events.newsFeed.length + 1}`,
    tick: state.tick,
    time: state.time,
    headline,
    marketImpact: Number(marketImpact.toFixed(4))
  });
  state.v11.events.newsFeed = state.v11.events.newsFeed.slice(0, 160);
}

function applyV11EventImpact(state, event) {
  const derived = [];
  switch (event.type) {
    case "WAR":
      state.v11.world.governance.globalPolicyPulse = bounded(state.v11.world.governance.globalPolicyPulse + 0.08, 0, 1);
      state.v11.economy.recessionRisk = bounded(state.v11.economy.recessionRisk + 0.09, 0, 1);
      state.v11.events.socialSignals.panic = bounded(state.v11.events.socialSignals.panic + 0.1, 0, 1);
      state.v11.world.logistics.routes.forEach((route) => {
        route.disruption = bounded(route.disruption + 0.09, 0, 1);
      });
      pushNews(state, "V11 event bus: conflict shock ripples through logistics, policy, and market panic", -0.06);
      derived.push({ type: "PANIC", source: "event-bus", severity: bounded(event.severity + 0.1, 0, 1), scope: "markets" });
      break;
    case "SANCTION":
      state.v11.world.governance.sanctions.unshift({
        tick: state.tick,
        country: String(event.payload.country ?? event.payload.target ?? "Unknown"),
        severity: event.severity
      });
      state.v11.world.governance.sanctions = state.v11.world.governance.sanctions.slice(0, 80);
      state.v11.world.logistics.routes.forEach((route) => {
        route.tariff = bounded(asNumber(route.tariff, 0.03) + 0.01, 0, 0.25);
      });
      state.v11.economy.debtLiquidity.liquidityStress = bounded(state.v11.economy.debtLiquidity.liquidityStress + 0.03, 0, 1);
      pushNews(state, "V11 event bus: sanctions tighten trade lanes and liquidity conditions", -0.03);
      break;
    case "RATE_HIKE":
      state.v11.economy.centralBankPolicy.policyRateBias = bounded(state.v11.economy.centralBankPolicy.policyRateBias + 0.04, -0.2, 0.2);
      state.v11.economy.labor.unemployment = bounded(state.v11.economy.labor.unemployment + 0.002, 0.01, 0.3);
      state.v11.economy.housing.affordability = bounded(state.v11.economy.housing.affordability - 0.015, 0, 1);
      pushNews(state, "V11 event bus: tighter rates pressure labor and housing affordability", -0.02);
      break;
    case "SUPPLY_SHOCK":
      state.v11.economy.sectorDemand.OIL = bounded(asNumber(state.v11.economy.sectorDemand.OIL, 1) + 0.09, 0.5, 1.9);
      state.v11.world.resources.OIL.scarcity = bounded(asNumber(state.v11.world.resources.OIL.scarcity, 0.3) + 0.08, 0, 1);
      state.v11.world.logistics.routes.forEach((route) => {
        route.capacity = bounded(asNumber(route.capacity, 1) - 0.04, 0.4, 1.2);
      });
      pushNews(state, "V11 event bus: supply shock constrains route capacity and resource availability", -0.04);
      break;
    case "PANIC":
      state.v11.events.socialSignals.panic = bounded(state.v11.events.socialSignals.panic + 0.07, 0, 1);
      state.v11.markets.volatilityControl.shortStress = bounded(state.v11.markets.volatilityControl.shortStress + 0.05, 0, 1);
      state.v11.markets.orderFlowDepth = bounded(state.v11.markets.orderFlowDepth - 0.03, 0.2, 1);
      break;
    case "TAX_CHANGE": {
      const country = String(event.payload.country ?? "USA");
      const value = bounded(asNumber(event.payload.taxes, 0.22), 0.05, 0.65);
      if (state.v11.world.countries[country]) {
        state.v11.world.countries[country].taxes = value;
      }
      state.v11.world.governance.globalPolicyPulse = bounded(state.v11.world.governance.globalPolicyPulse + 0.02, 0, 1);
      pushNews(state, `V11 event bus: tax policy updated in ${country}`, -0.01);
      break;
    }
    case "DISASTER":
      state.v11.events.disasterEngine.active.unshift({
        tick: state.tick,
        type: String(event.payload.kind ?? "black-swan"),
        intensity: event.severity
      });
      state.v11.events.disasterEngine.active = state.v11.events.disasterEngine.active.slice(0, 40);
      state.v11.world.logistics.routes.forEach((route) => {
        route.disruption = bounded(route.disruption + 0.12 * event.severity, 0, 1);
      });
      state.v11.economy.recessionRisk = bounded(state.v11.economy.recessionRisk + 0.06 * event.severity, 0, 1);
      pushNews(state, "V11 event bus: black swan disruption triggers recovery protocols", -0.05);
      break;
    case "AI_BREAKTHROUGH":
      state.v11.world.cities.forEach((city) => {
        city.aiAutomationLevel = bounded(city.aiAutomationLevel + 0.01, 0, 1);
        city.employment = bounded(city.employment - 0.002, 0.5, 1);
      });
      state.v11.economy.labor.automationShock = bounded(state.v11.economy.labor.automationShock + 0.02, 0, 1);
      state.v11.events.socialSignals.hype = bounded(state.v11.events.socialSignals.hype + 0.06, 0, 1);
      pushNews(state, "V11 event bus: AI breakthrough boosts productivity while lifting automation shock", 0.03);
      break;
    default:
      break;
  }
  return derived;
}

export function processV11EventBus(state, events = []) {
  ensureV11State(state);
  for (const event of events) {
    state.v11.events.queue.push(normalizeV11Event(state, event));
  }
  while (state.v11.events.queue.length) {
    const next = state.v11.events.queue.shift();
    const derived = applyV11EventImpact(state, next);
    state.v11.events.history.unshift(next);
    state.v11.events.history = state.v11.events.history.slice(0, 400);
    for (const emitted of derived) {
      state.v11.events.queue.push(normalizeV11Event(state, emitted));
    }
  }
}

function updateV11Economy(state, rng) {
  const economy = state.v11.economy;
  const inflation = asNumber(state.macro?.inflation, 0.024);
  const unemployment = asNumber(state.macro?.unemployment, 0.05);
  const stress = bounded((inflation - 0.025) * 5 + (unemployment - 0.05) * 2 + state.v11.events.socialSignals.panic * 0.4, 0, 1);
  economy.debtLiquidity.debtStress = bounded(economy.debtLiquidity.debtStress * 0.985 + stress * 0.03 + (rng() - 0.5) * 0.01, 0.02, 1);
  economy.debtLiquidity.liquidityStress = bounded(economy.debtLiquidity.liquidityStress * 0.986 + stress * 0.025 + (rng() - 0.5) * 0.01, 0.02, 1);
  economy.labor.unemployment = bounded(unemployment + economy.labor.automationShock * 0.004 + (rng() - 0.5) * 0.0015, 0.01, 0.3);
  economy.recessionRisk = bounded(economy.recessionRisk * 0.992 + stress * 0.02, 0, 1);
  economy.bubbleRisk = bounded(economy.bubbleRisk * 0.99 + Math.max(0, state.sentiment) * 0.01, 0, 1);
  economy.housing.index = Number(Math.max(40, economy.housing.index * (1 + (0.002 - economy.debtLiquidity.liquidityStress * 0.0025) + (rng() - 0.5) * 0.0015)).toFixed(3));
  economy.regime = economy.recessionRisk > 0.48 ? "risk-off" : economy.bubbleRisk > 0.52 ? "risk-on" : "stable";
  economy.macroCycle = economy.regime === "risk-off" ? "contraction" : "expansion";
}

function updateCitiesAndCountries(state, rng) {
  const social = state.v11.events.socialSignals;
  for (const city of state.v11.world.cities) {
    city.happiness = bounded(city.happiness + (state.sentiment * 0.01) - social.panic * 0.01 + (rng() - 0.5) * 0.01, 0, 1);
    city.traffic = bounded(city.traffic + city.population / 500_000_000 - city.infrastructure * 0.006 + (rng() - 0.5) * 0.01, 0, 1);
    city.pollution = bounded(city.pollution + city.electricityUsage * 0.004 - city.aiAutomationLevel * 0.002 + (rng() - 0.5) * 0.007, 0, 1);
    city.housingDemand = bounded(city.housingDemand + (city.employment - 0.9) * 0.02 + (rng() - 0.5) * 0.01, 0, 1);
    city.gdp = Math.max(1_000_000, Number((city.gdp * (1 + 0.0008 + state.macro.gdpGrowth * 0.02 - state.macro.inflation * 0.01)).toFixed(2)));
    city.population = Math.max(50_000, Math.round(city.population * (1 + (city.happiness - 0.5) * 0.0008 - city.pollution * 0.0005)));
  }
  for (const [country, profile] of Object.entries(state.v11.world.countries)) {
    profile.inflation = bounded(asNumber(state.macro.inflation, profile.inflation) + (rng() - 0.5) * 0.002, 0.005, 0.2);
    profile.politicalStability = bounded(profile.politicalStability - state.geopolitics.tension * 0.003 + (rng() - 0.5) * 0.006, 0, 1);
    profile.tradeRelations = bounded(profile.tradeRelations - state.v11.world.logistics.routes.reduce((sum, route) => sum + asNumber(route.disruption, 0), 0) * 0.0009, 0, 1);
    profile.stockMarket = bounded(profile.stockMarket + state.sentiment * 0.01 + (rng() - 0.5) * 0.01, 0, 1);
    profile.aiDevelopmentLevel = bounded(profile.aiDevelopmentLevel + 0.0008 + state.v11.events.socialSignals.hype * 0.001, 0, 1);
    profile.debt = bounded(profile.debt + state.v11.economy.debtLiquidity.debtStress * 0.0015, 0, 2);
    profile.exports = bounded(profile.exports + (profile.tradeRelations - 0.5) * 0.005, 0, 1);
    profile.imports = bounded(profile.imports + (profile.tradeRelations - 0.5) * 0.004, 0, 1);
    profile.taxes = bounded(profile.taxes + (rng() - 0.5) * 0.001, 0.05, 0.65);
    if (!state.governments?.[country]) continue;
    state.governments[country].taxRate = Number(profile.taxes.toFixed(4));
    state.governments[country].stability = Number(profile.politicalStability.toFixed(4));
  }
}

function updatePopulationCohorts(state, rng) {
  for (const cohort of state.v11.actors.populationCohorts) {
    cohort.sentiment = bounded(
      cohort.sentiment + state.sentiment * 0.01 - state.v11.events.socialSignals.panic * 0.01 + state.v11.events.socialSignals.hype * 0.008 + (rng() - 0.5) * 0.01,
      0,
      1
    );
    cohort.spendingPropensity = bounded(cohort.spendingPropensity + (cohort.sentiment - 0.5) * 0.01 + (rng() - 0.5) * 0.008, 0, 1);
    cohort.investingPropensity = bounded(
      cohort.investingPropensity + (cohort.sentiment - 0.5) * 0.015 - state.v11.events.socialSignals.panic * 0.01 + (rng() - 0.5) * 0.008,
      0,
      1
    );
  }
  const avgSentiment = state.v11.actors.populationCohorts.reduce((sum, cohort) => sum + cohort.sentiment, 0) /
    Math.max(1, state.v11.actors.populationCohorts.length);
  state.v11.actors.socialMood = Number((avgSentiment * 2 - 1).toFixed(4));
  state.v11.actors.sentimentPropagation = bounded(state.v11.actors.sentimentPropagation * 0.99 + avgSentiment * 0.01, 0, 1);
}

function updateAuctions(state, rng) {
  const auctions = state.v11.markets.auctions;
  const active = [];
  for (const listing of auctions.listings) {
    const remainingTicks = Math.max(0, Number(listing.endsAtTick) - state.tick);
    const bidChance = bounded(0.28 + listing.speculation * 0.25 + (rng() - 0.5) * 0.2, 0.05, 0.9);
    if (rng() < bidChance && remainingTicks > 0) {
      const nextBid = Math.max(listing.reservePrice, Number((listing.currentBid * (1 + 0.008 + rng() * 0.03)).toFixed(2)));
      listing.currentBid = nextBid;
      listing.bidCount += 1;
      listing.fraudRisk = bounded(listing.fraudRisk + (rng() < 0.08 ? 0.08 : -0.01), 0, 1);
    }
    if (remainingTicks === 0) {
      const commission = Number((listing.currentBid * listing.commissionRate).toFixed(2));
      const fee = Number((listing.currentBid * listing.auctionFeeRate).toFixed(2));
      auctions.brokerFeesCollected = Number((auctions.brokerFeesCollected + commission + fee).toFixed(2));
      if (listing.fraudRisk >= 0.8) auctions.flaggedFraudAttempts += 1;
      auctions.settled.unshift({
        ...listing,
        settledTick: state.tick,
        settlementValue: listing.currentBid,
        commission,
        fee
      });
      continue;
    }
    active.push(listing);
  }
  auctions.listings = active.slice(0, 200);
  auctions.settled = auctions.settled.slice(0, 200);
}

function maybeTriggerDisaster(state, rng) {
  if (state.tick % 24 !== 0) return;
  const engine = state.v11.events.disasterEngine;
  const probability = bounded(engine.baseProbability + engine.intensity * 0.004 + state.v11.world.governance.globalPolicyPulse * 0.001, 0, 0.08);
  if (rng() >= probability) return;
  const kinds = ["pandemic", "cyber-attack", "mega-earthquake", "food-crisis", "bank-collapse"];
  const kind = kinds[Math.floor(rng() * kinds.length)] ?? "black-swan";
  processV11EventBus(state, [{ type: "DISASTER", source: "disaster-engine", severity: bounded(engine.intensity + rng() * 0.2, 0.2, 1), payload: { kind } }]);
}

export function runV11SystemsTick(state, rng) {
  ensureV11State(state);
  updateV11Economy(state, rng);
  updateCitiesAndCountries(state, rng);
  updatePopulationCohorts(state, rng);
  updateAuctions(state, rng);
  maybeTriggerDisaster(state, rng);
  state.v11.events.socialSignals.hype = bounded(state.v11.events.socialSignals.hype * 0.993 + Math.max(0, state.sentiment) * 0.01, 0, 1);
  state.v11.events.socialSignals.panic = bounded(state.v11.events.socialSignals.panic * 0.992 + Math.max(0, -state.sentiment) * 0.01, 0, 1);
  state.v11.markets.orderFlowDepth = bounded(state.v11.markets.orderFlowDepth * 0.995 + (state.v11.actors.sentimentPropagation - 0.5) * 0.01, 0.15, 1);
  state.v11.ops.replayValidation.deterministicChecks += 1;
  state.v11.ops.replayValidation.lastValidatedTick = state.tick;
}

export const V11_SCOPE_TRACKS = Object.freeze([
  {
    id: "engine",
    name: "Engine Track",
    scope: "Unified event bus, deterministic loop upgrades, and cross-module ripple consistency",
    acceptanceGates: ["event-contract-active", "event-replay-deterministic", "cross-system-ripple-tests-green"]
  },
  {
    id: "economy",
    name: "Economy Track",
    scope: "Layered macro, labor, debt/liquidity, commodity, and regime simulation",
    acceptanceGates: ["macro-layer-integrated", "stress-regimes-covered", "bounded-indicators-enforced"]
  },
  {
    id: "world",
    name: "World Track",
    scope: "City/country schemas, logistics graph, resources, and governance",
    acceptanceGates: ["city-country-schema-complete", "logistics-ripple-linked", "checkpoint-compatible"]
  },
  {
    id: "corporations",
    name: "Corporations Track",
    scope: "Lifecycle expansion across R&D, products, influence, M&A, IPO, and reputation loops",
    acceptanceGates: ["lifecycle-metrics-live", "corporate-actions-deterministic", "market-impact-wired"]
  },
  {
    id: "multiplayer",
    name: "Multiplayer Track",
    scope: "Shared world scaffolding, anti-manipulation controls, alliances/cartels, and rankings",
    acceptanceGates: ["shared-state-model-available", "guardrails-active", "leaderboards-published"]
  },
  {
    id: "ui",
    name: "UI Track",
    scope: "Modular dashboards for world/macro/markets/companies/trade/risk/geopolitics/ops",
    acceptanceGates: ["dashboard-modules-specified", "live-map-and-heatmap-feeds-exposed", "high-frequency-alert-stream-ready"]
  }
]);

export const V11_VERTICAL_SLICES = Object.freeze([
  {
    id: "slice-1",
    name: "Policy Shock Cascade",
    includes: ["governance action", "event bus", "macro/market response", "news/social response", "dashboard payload"],
    releaseGate: "deterministic-e2e-pass"
  },
  {
    id: "slice-2",
    name: "Global Logistics Disruption",
    includes: ["route disruption", "resource pricing", "city/country impacts", "auction/market reactions"],
    releaseGate: "checkpoint-replay-pass"
  },
  {
    id: "slice-3",
    name: "Corporate Expansion & Capital Markets",
    includes: ["corporate action", "IPO/ETF/auction flows", "index-relative flows", "leaderboard updates"],
    releaseGate: "production-safe-metrics-pass"
  }
]);

export function getV11ProgramScope() {
  return {
    version: "v11",
    rolloutModel: "vertical-slices",
    tracks: clone(V11_SCOPE_TRACKS),
    verticalSlices: clone(V11_VERTICAL_SLICES)
  };
}

export function getV11EventContract() {
  return {
    version: "v11.0",
    requiredFields: ["id", "tick", "time", "type", "scope", "severity", "source", "payload"],
    severityRange: [0, 1],
    supportedTypes: ["WAR", "SANCTION", "RATE_HIKE", "SUPPLY_SHOCK", "PANIC", "TAX_CHANGE", "DISASTER", "AI_BREAKTHROUGH"]
  };
}
