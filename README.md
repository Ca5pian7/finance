# World Finance Simulator (V10 Foundation)

This repository now contains an executable V10 foundation for a realistic global economy and stock market simulation.

## Implemented Scope

- Deterministic tick-based simulation loop
- Company creation system (sector/country/business model + core KPIs)
- Market microstructure
  - Buy/sell order books
  - Matching engine
  - Price updates, market cap, volume, PE ratio, short interest, dividend yield
  - Circuit-breaker-style clamping, halt flags, listing/delisting lifecycle
- Macro + supply shock coupling
  - GDP growth, inflation, unemployment, policy rate
  - Commodity prices (oil, silicon, food, copper)
- Geopolitics + policy simulation
  - Wars, sanctions, trade agreements, cyber shocks, conflicts/treaties
  - Government policy pressure and country-level regulatory drift
- News/sentiment engine (headline generation from events)
- Supply chain + regional pressure model
- AI population model (consumers, investors, CEOs, workers, politicians, influencers)
- Funds/index layer (institutional/hedge/retail liquidity + GLOBAL100 index)
- Corporate mergers with delisting outcomes and leaderboard progression
- Persistence + offline progression
  - Checkpoint save/load
  - Fast-forward ticks when needed
- Realtime dashboard delivery
  - HTTP API
  - SSE stream for live state updates
  - Futuristic glass-style multi-view dashboard (Markets / Companies / World)
  - Larger candlestick chart view with cleaner market layout
  - Stock trade form supporting both limit and market orders
- Automated tests for determinism, matching behavior, bounded indicators, event coupling, and mergers

## Project Structure

```text
package.json
src/
  cli/simulate.js
  server/index.js
  simulator/
    constants.js
    engine.js
    persistence.js
    random.js
    state.js
  web/index.html
tests/
  simulator.test.js
```

## Run

### Requirements

- Node.js 20+

### Start the realtime simulator server

```bash
cd /home/runner/work/finance/finance
npm start
```

Then open:

- `http://localhost:3000` for the live dashboard
- `http://localhost:3000/api/state` for snapshot JSON
- `http://localhost:3000/api/stream` for SSE stream

### Run tests

```bash
cd /home/runner/work/finance/finance
npm test
```

### Run CLI simulation sample

```bash
cd /home/runner/work/finance/finance
npm run simulate
```

## API Endpoints

- `GET /api/state` — current snapshot
- `GET /api/stream` — realtime event stream (SSE)
- `POST /api/company` — create company
- `POST /api/order` — place order
- `POST /api/tick` — run one tick with optional events
- `POST /api/fast-forward` — run multiple ticks quickly
- `POST /api/action` — execute strategic actions (product launch, market manipulation, acquisitions, VC raise, factories, logistics, policy influence, monopolies, economic war)

Example event payload for `/api/tick`:

```json
{
  "events": [
    { "type": "SUPPLY_SHOCK" },
    { "type": "RATE_HIKE" },
    { "type": "AI_BREAKTHROUGH", "companyName": "Aether Dynamics" }
  ]
}
```

## Notes

This release upgrades the simulator to a broader V10-style foundation while keeping a single-node deterministic architecture.  
Advanced layers (distributed services, multiplayer shard sync, full derivatives/options engine, and deep strategy UI workflows) remain future expansions.
