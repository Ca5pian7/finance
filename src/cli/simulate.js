import { createInitialState, createSeedCompanies } from "../simulator/state.js";
import { runTick } from "../simulator/engine.js";

const state = createInitialState({ seed: 99 });
createSeedCompanies(state, 8);

for (let i = 0; i < 120; i += 1) {
  runTick(state, {
    events: i % 30 === 0 ? [{ type: "SUPPLY_SHOCK" }] : []
  });
}

const top = Object.values(state.stocks)
  .sort((a, b) => b.marketCap - a.marketCap)
  .slice(0, 3)
  .map((s) => ({ ticker: s.ticker, marketCap: s.marketCap, price: s.lastPrice }));

// eslint-disable-next-line no-console
console.log(JSON.stringify({ tick: state.tick, macro: state.macro, top }, null, 2));
