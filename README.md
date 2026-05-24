# World Finance Simulator (V10 Foundation)

This repository now contains an executable V10 foundation for a realistic global economy and stock market simulation.

## Implemented Scope

- Deterministic tick-based simulation loop
- Company creation system (sector/country/business model + core KPIs)
  - Automatic unique company naming/ticker normalization on listing
- Market microstructure
  - Buy/sell order books
  - Founder/public-float ownership split so new listings are tradeable
  - Built-in market maker liquidity so buy and sell orders can fill immediately
  - Matching engine
  - Price updates, market cap, volume, PE ratio, short interest, dividend yield
  - Day-based price effect display with 5M/15M/1H/1D chart intervals
  - Crowd-pressure/stability dynamics with 10,000,000 simulated participants
  - Stronger support/resistance with gradual break pressure (time-to-break behavior)
  - Stabilized daily move profile (typical ~7–10% range, with larger news-driven one-day spikes possible)
  - Continuous listing model (no delisting/halt shutdown state)
- Macro + supply shock coupling
  - GDP growth, inflation, unemployment, policy rate
  - Commodity prices (oil, silicon, food, copper)
- Geopolitics + policy simulation
  - Wars, sanctions, trade agreements, cyber shocks, conflicts/treaties
  - Government policy pressure and country-level regulatory drift
- News/sentiment engine (headline generation from events)
- Supply chain + regional pressure model
- AI population model (consumers, investors, CEOs, workers, politicians, influencers)
- Funds/index layer (institutional/hedge/retail liquidity + valuation-weighted GLOBAL100 and GLOBAL ALL indexes)
  - Added valuation-weighted GLOBAL50 index and per-index constituent weight snapshots
  - Added valuation-weighted NASDAQ100 index with candle history for dashboard charting
- Corporate mergers with delisting outcomes and leaderboard progression
- Persistence + offline progression
  - Checkpoint save/load
  - Fast-forward ticks when needed
- Realtime dashboard delivery
  - HTTP API
  - SSE stream for live state updates
  - TradingView-style dashboard with larger chart and cleaner market layout
  - Top live news ticker (wars, mergers, sanctions, macro headlines)
  - Side stock list with per-stock mini graph plus stability/pressure stats
  - Chart mode toggle to view either individual stocks or NASDAQ100 graph
  - Day/night market session cycle where 1 stock day = 5 real minutes
  - Stock trade form supporting both limit and market orders
  - Wallet cash updates immediately after player trades
  - Real-time alert toasts for macro, volatility, and route-risk events
  - Portfolio intelligence card with realized/unrealized P&L, exposure, and win-rate stats
  - Market leadership panels for sector/country rankings plus live alert tape
  - Company intelligence scorecards with composite scoring and catalyst/risk signals
  - Supply-chain heat map, route diagnostics, and player trade tape on the economy page
- Analytics layer
  - Player trade ledger with cost-basis, realized P&L, unrealized P&L, turnover, and exposure breakdowns
  - Sector and country leaderboards with composite leadership scores
  - Supply risk scoring for regions and trade routes
  - Alert engine for macro stress, logistics disruption, news shocks, and high-volatility moves
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
- `GET /api/alerts` — current high-priority alert list
- `GET /api/player/analytics` — player holdings, trade tape, and portfolio analytics
- `GET /api/rankings/sectors` — sector leadership table
- `GET /api/rankings/countries` — country leadership table
- `GET /api/supply-risk` — supply region heat-map and route diagnostics
- `GET /api/company/intelligence?companyId=<id>` — derived company scorecard and signals
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
