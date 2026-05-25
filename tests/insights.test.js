import test from "node:test";
import assert from "node:assert/strict";
import { createCompany, createInitialState, upsertCompany } from "../src/simulator/state.js";
import { runTick } from "../src/simulator/engine.js";
import { buildMissionBoard, getAcademyCatalog, getAcademySnapshot, listStrategyPlaybooks, runStrategyBacktest } from "../src/simulator/insights.js";

function toSnapshot(state) {
  return {
    tick: state.tick,
    macro: state.macro,
    sentiment: state.sentiment,
    marketRegime: state.marketRegime,
    geopolitics: state.geopolitics,
    supplyChains: state.supplyChains,
    financialSystem: state.financialSystem,
    indexes: state.indexes,
    headlines: state.headlines,
    alerts: state.analytics?.alerts ?? [],
    leaderboards: state.leaderboards,
    player: state.player,
    stocks: Object.entries(state.stocks).map(([companyId, stock]) => ({
      companyId,
      companyName: state.companies[companyId]?.name ?? companyId,
      ticker: stock.ticker,
      lastPrice: stock.lastPrice,
      dayOpenPrice: stock.dayOpenPrice,
      stability: stock.stability,
      buyPressure: stock.buyPressure,
      sellPressure: stock.sellPressure,
      shortInterest: stock.shortInterest,
      supportStrength: stock.supportStrength,
      resistanceStrength: stock.resistanceStrength,
      candles: stock.candles
    }))
  };
}

test("strategy playbooks are listed with expected structure", () => {
  const playbooks = listStrategyPlaybooks();
  assert.ok(Array.isArray(playbooks));
  assert.ok(playbooks.length >= 10);
  assert.ok(playbooks.some((p) => p.id === "momentum-breakout"));
  assert.ok(playbooks.every((p) => p.name && p.style && p.riskLevel));
});

test("strategy backtest ranks candidates and builds capital curve", () => {
  const state = createInitialState({ seed: 501 });
  for (let i = 0; i < 10; i += 1) {
    upsertCompany(
      state,
      createCompany({
        id: `bt-${i}`,
        name: `Backtest ${i}`,
        country: "USA",
        sector: i % 2 ? "AI" : "Cloud Computing",
        businessModel: "SaaS",
        initialValuation: 1_000_000_000 + i * 200_000_000
      })
    );
  }
  for (let i = 0; i < 30; i += 1) runTick(state);

  const result = runStrategyBacktest(toSnapshot(state), {
    playbookId: "balanced-blend",
    horizonTicks: 90,
    capital: 25_000_000
  });

  assert.equal(result.playbook.id, "balanced-blend");
  assert.ok(result.evaluatedCount >= 10);
  assert.ok(Array.isArray(result.topCandidates));
  assert.ok(result.topCandidates.length >= 5);
  assert.ok(Array.isArray(result.capitalCurve.curve));
  assert.ok(result.capitalCurve.curve.length >= 1);
  assert.ok(Number.isFinite(result.stats.winProbabilityPct));
});

test("mission board generates prioritized missions", () => {
  const state = createInitialState({ seed: 502 });
  for (let i = 0; i < 8; i += 1) {
    upsertCompany(
      state,
      createCompany({ id: `ms-${i}`, name: `Mission ${i}`, country: "USA", sector: "AI", businessModel: "SaaS" })
    );
  }
  for (let i = 0; i < 12; i += 1) runTick(state);

  const board = buildMissionBoard(toSnapshot(state), { limit: 10 });

  assert.ok(board.summary);
  assert.ok(Array.isArray(board.missions));
  assert.ok(board.missions.length >= 8);
  assert.ok(board.missions.every((m) => Number.isFinite(m.priority)));
  assert.ok(board.missions.every((m) => m.setup?.entry && m.setup?.stop && m.setup?.target));
});

test("academy catalog and snapshot expose large content", () => {
  const state = createInitialState({ seed: 503 });
  upsertCompany(state, createCompany({ id: "ac-1", name: "Academy One", country: "USA", sector: "AI", businessModel: "SaaS" }));
  for (let i = 0; i < 8; i += 1) runTick(state);

  const catalog = getAcademyCatalog();
  const snapshot = getAcademySnapshot(toSnapshot(state));

  assert.ok(catalog.tracks.length >= 8);
  assert.ok(catalog.lessons.length >= 200);
  assert.ok(snapshot.totalLessons >= 200);
  assert.ok(snapshot.summary.estimatedMasteryPct >= 0 && snapshot.summary.estimatedMasteryPct <= 100);
  assert.ok(snapshot.featuredLessons.length >= 10);
});
