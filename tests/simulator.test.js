import test from "node:test";
import assert from "node:assert/strict";
import { executeMerger, executeStrategicAction, placeOrder, runTick } from "../src/simulator/engine.js";
import { createCompany, createInitialState, upsertCompany } from "../src/simulator/state.js";

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

  for (let i = 0; i < 149; i += 1) runTick(state);
  assert.equal(state.marketSession.phase, "night");

  for (let i = 0; i < 150; i += 1) runTick(state);
  assert.equal(state.marketSession.dayNumber, 2);
  assert.ok(state.stocks.m1.stability >= 0.1 && state.stocks.m1.stability <= 0.98);
  assert.ok(state.stocks.m1.buyPressure >= 0.05 && state.stocks.m1.buyPressure <= 0.95);
});
