import test from "node:test";
import assert from "node:assert/strict";
import { computeCompanyIntel, refreshMarketAnalytics, refreshPlayerAnalytics } from "../src/simulator/analytics.js";
import { executeMerger, executeStrategicAction, placeOrder, runTick, squareOffPosition } from "../src/simulator/engine.js";
import { calculatePeRatio, createCompany, createInitialState, upsertCompany } from "../src/simulator/state.js";

test("simulation is deterministic for same seed and event sequence", () => {
  const a = createInitialState({ seed: 123 });
  const b = createInitialState({ seed: 123 });

  upsertCompany(a, createCompany({ id: "c1", name: "Alpha Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));
  upsertCompany(b, createCompany({ id: "c1", name: "Alpha Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));

  for (let i = 0; i < 40; i += 1) {
    const events = i % 10 === 0 ? [{ type: "RATE_HIKE" }] : [];
    runTick(a, { events });
    runTick(b, { events });
  }

  assert.equal(a.stocks.c1.lastPrice, b.stocks.c1.lastPrice);
  assert.equal(a.macro.inflation, b.macro.inflation);
  assert.equal(a.headlines.length, b.headlines.length);
});

test("order matching executes when bid meets ask", () => {
  const state = createInitialState({ seed: 1 });
  upsertCompany(state, createCompany({ id: "c1", name: "Beta Motors", country: "USA", sector: "EV", businessModel: "Hardware" }));

  placeOrder(state, { companyId: "c1", side: "buy", price: 12, quantity: 100, traderId: "buyer" });
  const trades = placeOrder(state, { companyId: "c1", side: "sell", price: 11, quantity: 60, traderId: "seller" });

  assert.equal(trades.length, 1);
  assert.equal(trades[0].quantity, 60);
  assert.equal(state.stocks.c1.volume, 60);
});

test("market order executes using best available liquidity", () => {
  const state = createInitialState({ seed: 2 });
  upsertCompany(state, createCompany({ id: "c1", name: "Market One", country: "USA", sector: "AI", businessModel: "SaaS" }));

  placeOrder(state, { companyId: "c1", side: "sell", orderType: "limit", price: 10.5, quantity: 40, traderId: "maker" });
  const trades = placeOrder(state, { companyId: "c1", side: "buy", orderType: "market", quantity: 40, traderId: "taker" });

  assert.equal(trades.length, 1);
  assert.equal(trades[0].quantity, 40);
  assert.ok(trades[0].price > 0);
});

test("prices and macro indicators remain bounded across ticks", () => {
  const state = createInitialState({ seed: 77 });
  upsertCompany(state, createCompany({ id: "c1", name: "Gamma Chip", country: "Taiwan", sector: "Semiconductor", businessModel: "B2B" }));

  let maxMovePct = 0;
  for (let i = 0; i < 200; i += 1) {
    const before = state.stocks.c1.lastPrice;
    runTick(state);
    const after = state.stocks.c1.lastPrice;
    maxMovePct = Math.max(maxMovePct, Math.abs((after - before) / before));
  }

  assert.ok(state.stocks.c1.lastPrice > 0);
  assert.ok(state.macro.inflation >= 0.005 && state.macro.inflation <= 0.18);
  assert.ok(state.macro.unemployment >= 0.02 && state.macro.unemployment <= 0.25);
  assert.ok(state.macro.rate >= 0 && state.macro.rate <= 0.15);
  assert.ok(maxMovePct <= 0.051);
});

test("geopolitical and supply events affect system pressures", () => {
  const state = createInitialState({ seed: 13 });
  upsertCompany(state, createCompany({ id: "c1", name: "Delta Logistics", country: "USA", sector: "Logistics", businessModel: "B2B" }));

  runTick(state, { events: [{ type: "WAR", region: "Middle East" }, { type: "SANCTION", country: "China" }] });

  assert.ok(state.geopolitics.tension > 0.15);
  assert.ok(state.supplyChains.pressure > 0.2);
  assert.ok(state.headlines.some((h) => /Conflict escalation|sanctions/i.test(h.headline)));
});

test("merger keeps target listed and boosts buyer valuation", () => {
  const state = createInitialState({ seed: 21 });
  upsertCompany(state, createCompany({ id: "buyer", name: "Omni Core", country: "USA", sector: "AI", businessModel: "SaaS", initialValuation: 2_000_000_000 }));
  upsertCompany(state, createCompany({ id: "target", name: "Nano Grid", country: "Japan", sector: "Semiconductor", businessModel: "Hardware", initialValuation: 900_000_000 }));

  const before = state.companies.buyer.valuation;
  const result = executeMerger(state, { buyerId: "buyer", targetId: "target" });

  assert.equal(result.targetDelisted, false);
  assert.equal(state.stocks.target.listed, true);
  assert.ok(state.companies.buyer.valuation > before);
});

test("strategic action can raise venture capital and improve company capacity", () => {
  const state = createInitialState({ seed: 22 });
  upsertCompany(
    state,
    createCompany({ id: "vc", name: "Helio Labs", country: "USA", sector: "AI", businessModel: "SaaS", initialValuation: 1_000_000_000 })
  );
  const beforeValuation = state.companies.vc.valuation;
  const beforeBudget = state.companies.vc.rdBudget;

  const result = executeStrategicAction(state, { actionType: "RAISE_VENTURE_CAPITAL", companyId: "vc", amount: 300_000_000, intensity: 1.5 });

  assert.equal(result.status, "ok");
  assert.ok(state.companies.vc.valuation > beforeValuation);
  assert.ok(state.companies.vc.rdBudget > beforeBudget);
});

test("strategic action can trigger economic war conditions", () => {
  const state = createInitialState({ seed: 31 });
  upsertCompany(state, createCompany({ id: "w1", name: "Trade Apex", country: "USA", sector: "Logistics", businessModel: "B2B" }));
  const beforeTension = state.geopolitics.tension;

  const result = executeStrategicAction(state, {
    actionType: "TRIGGER_ECONOMIC_WAR",
    companyId: "w1",
    region: "Pacific Corridor",
    country: "China"
  });

  assert.equal(result.status, "ok");
  assert.ok(state.geopolitics.tension > beforeTension);
  assert.ok(state.geopolitics.activeConflicts.includes("Pacific Corridor"));
  assert.ok(state.headlines.some((h) => /Economic war escalates|Conflict escalation/i.test(h.headline)));
});

test("market session advances with day/night cycle and 10M participant population", () => {
  const state = createInitialState({ seed: 9 });
  upsertCompany(state, createCompany({ id: "m1", name: "Session Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));

  assert.equal(state.population.participantCount, 10_000_000);
  runTick(state);
  assert.equal(state.marketSession.phase, "day");
  assert.equal(state.marketSession.dayNumber, 1);

  for (let i = 0; i < 150; i += 1) runTick(state);
  assert.equal(state.marketSession.phase, "night");

  for (let i = 0; i < 150; i += 1) runTick(state);
  assert.equal(state.marketSession.dayNumber, 2);
  assert.ok(state.stocks.m1.stability >= 0.1 && state.stocks.m1.stability <= 0.98);
  assert.ok(state.stocks.m1.buyPressure >= 0.05 && state.stocks.m1.buyPressure <= 0.95);
});

test("inflation and policy rate can move both up and down over time", () => {
  const state = createInitialState({ seed: 55 });
  upsertCompany(state, createCompany({ id: "mx", name: "Macro Flex", country: "USA", sector: "Banking", businessModel: "B2B" }));

  let prevInflation = state.macro.inflation;
  let prevRate = state.macro.rate;
  let inflationUp = 0;
  let inflationDown = 0;
  let rateUp = 0;
  let rateDown = 0;

  for (let i = 0; i < 500; i += 1) {
    runTick(state);
    if (state.macro.inflation > prevInflation) inflationUp += 1;
    else if (state.macro.inflation < prevInflation) inflationDown += 1;
    if (state.macro.rate > prevRate) rateUp += 1;
    else if (state.macro.rate < prevRate) rateDown += 1;
    prevInflation = state.macro.inflation;
    prevRate = state.macro.rate;
  }

  assert.ok(inflationUp > 0 && inflationDown > 0);
  assert.ok(rateUp > 0 && rateDown > 0);
});

test("player buy and sell orders update cash and holdings", () => {
  const state = createInitialState({ seed: 88 });
  upsertCompany(state, createCompany({ id: "px", name: "Player Exchange", country: "USA", sector: "AI", businessModel: "SaaS" }));

  const startCash = state.player.cash;
  placeOrder(state, { companyId: "px", side: "sell", orderType: "limit", price: 10, quantity: 100, traderId: "maker-sell" });
  const buyTrades = placeOrder(state, { companyId: "px", side: "buy", orderType: "limit", price: 12, quantity: 40, traderId: "player" });
  assert.equal(buyTrades.length, 1);
  assert.equal(state.player.holdings.px, 40);
  assert.ok(state.player.cash < startCash);

  const afterBuyCash = state.player.cash;
  placeOrder(state, { companyId: "px", side: "buy", orderType: "limit", price: 9.5, quantity: 30, traderId: "maker-buy" });
  const sellTrades = placeOrder(state, { companyId: "px", side: "sell", orderType: "limit", price: 9, quantity: 10, traderId: "player" });
  assert.equal(sellTrades.length, 1);
  assert.equal(state.player.holdings.px, 30);
  assert.ok(state.player.cash > afterBuyCash);
});

test("player can short sell shares and buy them back", () => {
  const state = createInitialState({ seed: 93 });
  upsertCompany(state, createCompany({ id: "sh", name: "Short Horizon", country: "USA", sector: "AI", businessModel: "SaaS" }));

  const startCash = state.player.cash;
  placeOrder(state, { companyId: "sh", side: "buy", orderType: "limit", price: 10, quantity: 100, traderId: "maker-buy" });
  const shortTrades = placeOrder(state, { companyId: "sh", side: "sell", orderType: "limit", price: 9.8, quantity: 40, traderId: "player" });
  assert.equal(shortTrades.length, 1);
  assert.equal(state.player.holdings.sh, -40);
  assert.ok(state.player.cash > startCash);

  const afterShortCash = state.player.cash;
  placeOrder(state, { companyId: "sh", side: "sell", orderType: "limit", price: 10.2, quantity: 100, traderId: "maker-sell" });
  const coverTrades = placeOrder(state, { companyId: "sh", side: "buy", orderType: "limit", price: 10.4, quantity: 25, traderId: "player" });
  assert.equal(coverTrades.length, 1);
  assert.equal(state.player.holdings.sh, -15);
  assert.ok(state.player.cash < afterShortCash);
});

test("square off closes selected player position", () => {
  const state = createInitialState({ seed: 95 });
  upsertCompany(state, createCompany({ id: "sq", name: "Square Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));

  placeOrder(state, { companyId: "sq", side: "sell", orderType: "limit", price: 10, quantity: 120, traderId: "maker-sell" });
  placeOrder(state, { companyId: "sq", side: "buy", orderType: "market", quantity: 120, traderId: "player" });
  assert.equal(state.player.holdings.sq, 120);

  const trades = squareOffPosition(state, { companyId: "sq" });
  assert.ok(trades.length >= 1);
  assert.equal(state.player.holdings.sq ?? 0, 0);
});

test("run tick repairs missing stock share metadata for legacy checkpoints", () => {
  const state = createInitialState({ seed: 96 });
  upsertCompany(state, createCompany({ id: "lg", name: "Legacy Holdings", country: "USA", sector: "AI", businessModel: "SaaS" }));

  delete state.stocks.lg.sharesOutstanding;
  delete state.stocks.lg.publicFloatShares;
  state.companies.lg.ownership = {};

  runTick(state);

  assert.ok(state.stocks.lg.sharesOutstanding >= 1);
  assert.ok(state.stocks.lg.publicFloatShares >= 1);
  assert.equal(
    state.companies.lg.ownership.principalShares + state.companies.lg.ownership.publicFloatShares,
    state.stocks.lg.sharesOutstanding
  );
});

test("player orders enforce cash and position constraints", () => {
  const state = createInitialState({ seed: 89 });
  upsertCompany(state, createCompany({ id: "cx", name: "Constraint Co", country: "USA", sector: "AI", businessModel: "SaaS" }));

  state.player.cash = 100;
  assert.throws(
    () => placeOrder(state, { companyId: "cx", side: "buy", orderType: "limit", price: 10, quantity: 20, traderId: "player" }),
    /Insufficient cash balance/
  );

  assert.throws(
    () => placeOrder(state, { companyId: "cx", side: "sell", orderType: "limit", price: 10, quantity: 38_000_001, traderId: "player" }),
    /Insufficient borrow availability to short/
  );
});

test("p/e ratio is derived from earnings and refreshes with price moves", () => {
  const state = createInitialState({ seed: 94 });
  const company = createCompany({ id: "pe", name: "Price Earnings", country: "USA", sector: "AI", businessModel: "SaaS" });
  upsertCompany(state, company);

  assert.equal(
    state.stocks.pe.peRatio,
    calculatePeRatio({
      marketCap: state.stocks.pe.marketCap,
      revenue: state.companies.pe.kpis.revenue,
      profitMargin: state.companies.pe.kpis.profitMargin
    })
  );

  executeStrategicAction(state, { actionType: "MANIPULATE_MARKET", companyId: "pe", direction: "pump", intensity: 2 });

  assert.equal(
    state.stocks.pe.peRatio,
    calculatePeRatio({
      marketCap: state.stocks.pe.marketCap,
      revenue: state.companies.pe.kpis.revenue,
      profitMargin: state.companies.pe.kpis.profitMargin
    })
  );
});

test("new listings expose public float for immediate player trading", () => {
  const state = createInitialState({ seed: 92 });
  upsertCompany(state, createCompany({ id: "flt", name: "Float Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));

  assert.equal(state.companies.flt.ownership.principalStakePct, 62);
  assert.equal(state.companies.flt.ownership.publicFloatPct, 38);
  assert.equal(state.stocks.flt.publicFloatShares, 38_000_000);

  const startCash = state.player.cash;
  const buyTrades = placeOrder(state, { companyId: "flt", side: "buy", orderType: "market", quantity: 100, traderId: "player" });
  assert.ok(buyTrades.length >= 1);
  assert.equal(state.player.holdings.flt, 100);
  assert.ok(state.player.cash < startCash);

  const afterBuyCash = state.player.cash;
  const sellTrades = placeOrder(state, { companyId: "flt", side: "sell", orderType: "market", quantity: 40, traderId: "player" });
  assert.ok(sellTrades.length >= 1);
  assert.equal(state.player.holdings.flt, 60);
  assert.ok(state.player.cash > afterBuyCash);
});

test("player analytics track realized and unrealized pnl after fills", () => {
  const state = createInitialState({ seed: 101 });
  upsertCompany(state, createCompany({ id: "pa", name: "PnL Atlas", country: "USA", sector: "AI", businessModel: "SaaS" }));

  placeOrder(state, { companyId: "pa", side: "sell", orderType: "limit", price: 10, quantity: 100, traderId: "maker-sell" });
  placeOrder(state, { companyId: "pa", side: "buy", orderType: "limit", price: 11, quantity: 100, traderId: "player" });

  state.stocks.pa.lastPrice = 12;
  refreshPlayerAnalytics(state);
  assert.ok(state.player.analytics.unrealizedPnl > 0);
  assert.equal(state.player.analytics.positionsCount, 1);

  placeOrder(state, { companyId: "pa", side: "buy", orderType: "limit", price: 12.4, quantity: 100, traderId: "maker-buy" });
  placeOrder(state, { companyId: "pa", side: "sell", orderType: "limit", price: 12, quantity: 40, traderId: "player" });

  assert.ok(state.player.analytics.realizedPnl > 0);
  assert.ok(state.player.trades.length >= 2);
  assert.equal(state.player.positions.pa.shares, 60);
});

test("market analytics produce sector, country, supply, and alert summaries", () => {
  const state = createInitialState({ seed: 102 });
  upsertCompany(state, createCompany({ id: "us-ai", name: "Vector Cloud", country: "USA", sector: "AI", businessModel: "SaaS" }));
  upsertCompany(state, createCompany({ id: "jp-chip", name: "Pixel Foundry", country: "Japan", sector: "Semiconductor", businessModel: "Hardware" }));

  state.macro.inflation = 0.082;
  state.geopolitics.tension = 0.61;
  state.supplyChains.pressure = 0.67;
  state.stocks["us-ai"].dayOpenPrice = 10;
  state.stocks["us-ai"].lastPrice = 10.8;
  refreshMarketAnalytics(state);

  assert.ok(state.leaderboards.sectors.length >= 2);
  assert.ok(state.leaderboards.countries.length >= 2);
  assert.ok(state.analytics.supplyRisk.routes.length >= 1);
  assert.ok(state.analytics.alerts.some((alert) => alert.category === "macro"));
  assert.ok(state.analytics.alerts.some((alert) => ["logistics", "volatility"].includes(alert.category)));
});

test("company intelligence scorecard exposes composite scores and signals", () => {
  const state = createInitialState({ seed: 103 });
  upsertCompany(state, createCompany({ id: "ci", name: "Insight Dynamics", country: "USA", sector: "AI", businessModel: "SaaS" }));
  state.stocks.ci.dayOpenPrice = 10;
  state.stocks.ci.lastPrice = 10.7;
  state.stocks.ci.buyPressure = 0.68;
  state.stocks.ci.sellPressure = 0.31;

  const intel = computeCompanyIntel(state, "ci");

  assert.ok(intel.compositeScore >= 0 && intel.compositeScore <= 100);
  assert.ok(intel.riskScore >= 0 && intel.riskScore <= 100);
  assert.ok(Array.isArray(intel.signals));
  assert.ok(intel.signals.length >= 1);
});

test("trade size affects execution impact and company valuation", () => {
  const small = createInitialState({ seed: 91 });
  const large = createInitialState({ seed: 91 });
  upsertCompany(small, createCompany({ id: "imp", name: "Impact Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));
  upsertCompany(large, createCompany({ id: "imp", name: "Impact Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));

  placeOrder(small, { companyId: "imp", side: "sell", orderType: "limit", price: 10, quantity: 5_000_000, traderId: "maker" });
  placeOrder(large, { companyId: "imp", side: "sell", orderType: "limit", price: 10, quantity: 5_000_000, traderId: "maker" });

  const smallBefore = small.companies.imp.valuation;
  const largeBefore = large.companies.imp.valuation;
  placeOrder(small, { companyId: "imp", side: "buy", orderType: "limit", price: 10.2, quantity: 1_000, traderId: "player" });
  placeOrder(large, { companyId: "imp", side: "buy", orderType: "limit", price: 10.2, quantity: 5_000_000, traderId: "player" });

  assert.ok(large.stocks.imp.lastPrice > small.stocks.imp.lastPrice);
  assert.ok(large.companies.imp.valuation - largeBefore > small.companies.imp.valuation - smallBefore);
});

test("very small orders do not create outsized valuation jumps", () => {
  const state = createInitialState({ seed: 111 });
  upsertCompany(
    state,
    createCompany({ id: "sml", name: "Small Impact Labs", country: "USA", sector: "AI", businessModel: "SaaS", initialValuation: 3_000_000_000 })
  );
  const before = state.companies.sml.valuation;
  placeOrder(state, { companyId: "sml", side: "sell", orderType: "limit", price: 10, quantity: 100_000, traderId: "maker-sell" });
  placeOrder(state, { companyId: "sml", side: "buy", orderType: "limit", price: 10.05, quantity: 10, traderId: "player" });
  const movePct = Math.abs((state.companies.sml.valuation - before) / before);
  assert.ok(movePct < 0.001);
});

test("upsert enforces unique company names and tickers", () => {
  const state = createInitialState({ seed: 112 });
  upsertCompany(state, createCompany({ id: "u1", name: "Nova Core", country: "USA", sector: "AI", businessModel: "SaaS" }));
  upsertCompany(state, createCompany({ id: "u2", name: "Nova Core", country: "USA", sector: "AI", businessModel: "SaaS" }));

  assert.notEqual(state.companies.u1.name, state.companies.u2.name);
  assert.notEqual(state.stocks.u1.ticker, state.stocks.u2.ticker);
});

test("richest leaderboard includes billionaires with company stake", () => {
  const state = createInitialState({ seed: 90 });
  upsertCompany(state, createCompany({ id: "rx", name: "Rank Labs", country: "USA", sector: "AI", businessModel: "SaaS" }));

  runTick(state);

  assert.ok(state.leaderboards.richest.length >= 1 && state.leaderboards.richest.length <= 25);
  assert.ok(state.leaderboards.richest.every((entry) => Number.isFinite(entry.netWorth ?? entry.wealth)));
  assert.ok(state.leaderboards.richest.every((entry) => Number(entry.netWorth ?? entry.wealth) >= 1_000_000_000));
  assert.ok(state.leaderboards.richest.every((entry) => Number.isFinite(Number(entry.stakePct ?? 0))));
  assert.ok(state.leaderboards.richest.some((entry) => entry.id === "player"));
});

test("daily stock move remains bounded without strong news shocks", () => {
  const state = createInitialState({ seed: 101 });
  upsertCompany(state, createCompany({ id: "d1", name: "Daily Bound", country: "USA", sector: "AI", businessModel: "SaaS" }));

  const ticksPerDay = state.marketSession.ticksPerDay;
  for (let i = 0; i < ticksPerDay; i += 1) runTick(state);

  const stock = state.stocks.d1;
  const dayOpen = stock.dayOpenPrice;
  const upMove = (stock.dayHigh - dayOpen) / Math.max(0.1, dayOpen);
  const downMove = (dayOpen - stock.dayLow) / Math.max(0.1, dayOpen);
  assert.ok(upMove <= 0.4);
  assert.ok(downMove <= 0.4);
});

test("global all index tracks all listed stocks with valuation weighting", () => {
  const state = createInitialState({ seed: 102 });
  upsertCompany(
    state,
    createCompany({ id: "big", name: "Big Cap", country: "USA", sector: "AI", businessModel: "SaaS", initialValuation: 5_000_000_000 })
  );
  upsertCompany(
    state,
    createCompany({ id: "small", name: "Small Cap", country: "USA", sector: "AI", businessModel: "SaaS", initialValuation: 800_000_000 })
  );

  runTick(state);

  assert.ok(state.indexes.GLOBAL_ALL);
  assert.ok(state.indexes.GLOBAL_ALL.value > 0);
  assert.equal(state.indexes.GLOBAL_ALL.members.length, 2);
  assert.ok(state.indexes.GLOBAL_ALL.members.includes(state.stocks.big.ticker));
  assert.ok(state.indexes.GLOBAL_ALL.members.includes(state.stocks.small.ticker));
});

test("global 50 index is available and market-cap weighted", () => {
  const state = createInitialState({ seed: 113 });
  for (let i = 0; i < 60; i += 1) {
    upsertCompany(
      state,
      createCompany({
        id: `g50-${i}`,
        name: `Global Fifty ${i}`,
        country: "USA",
        sector: i % 2 === 0 ? "AI" : "Banking",
        businessModel: "SaaS",
        initialValuation: 1_000_000_000 + i * 30_000_000
      })
    );
  }

  runTick(state);

  assert.ok(state.indexes.GLOBAL50);
  assert.equal(state.indexes.GLOBAL50.members.length, 50);
  assert.ok(Array.isArray(state.indexes.GLOBAL50.weights));
  assert.equal(state.indexes.GLOBAL50.weights.length, 50);
  const weightSum = state.indexes.GLOBAL50.weights.reduce((sum, entry) => sum + Number(entry.weightPct ?? 0), 0);
  assert.ok(weightSum > 99.9 && weightSum < 100.1);
});

test("nasdaq100 index is available with chart candles", () => {
  const state = createInitialState({ seed: 114 });
  for (let i = 0; i < 30; i += 1) {
    upsertCompany(
      state,
      createCompany({
        id: `ndx-${i}`,
        name: `Nasdaq Candidate ${i}`,
        country: "USA",
        sector: i % 3 === 0 ? "AI" : i % 3 === 1 ? "Cloud Computing" : "Semiconductor",
        businessModel: "SaaS",
        initialValuation: 2_000_000_000 + i * 50_000_000
      })
    );
  }

  for (let i = 0; i < 8; i += 1) runTick(state);

  assert.ok(state.indexes.NASDAQ100);
  assert.ok(state.indexes.NASDAQ100.value > 0);
  assert.ok(state.indexes.NASDAQ100.members.length > 0);
  assert.ok(Array.isArray(state.indexes.NASDAQ100.candles));
  assert.ok(state.indexes.NASDAQ100.candles.length >= 1);
  assert.ok(Number.isFinite(state.indexes.NASDAQ100.candles.at(-1).close));
});
