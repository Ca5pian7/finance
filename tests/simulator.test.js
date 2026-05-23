import test from "node:test";
import assert from "node:assert/strict";
import { placeOrder, runTick } from "../src/simulator/engine.js";
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

test("prices and macro indicators remain bounded across ticks", () => {
  const state = createInitialState({ seed: 77 });
  upsertCompany(state, createCompany({ id: "c1", name: "Gamma Chip", country: "Taiwan", sector: "Semiconductor", businessModel: "B2B" }));

  for (let i = 0; i < 200; i += 1) runTick(state);

  assert.ok(state.stocks.c1.lastPrice > 0);
  assert.ok(state.macro.inflation >= 0.005 && state.macro.inflation <= 0.18);
  assert.ok(state.macro.unemployment >= 0.02 && state.macro.unemployment <= 0.25);
  assert.ok(state.macro.rate >= 0 && state.macro.rate <= 0.15);
});
