# World Finance Simulator (V10 Foundation)

This repository now contains an executable V10 foundation for a realistic global economy and stock market simulation.

## Implemented Scope

- Deterministic tick-based simulation loop
- Company creation system (sector/country/business model + core KPIs)
  - Automatic unique company naming/ticker normalization on listing
  - Optional player-owned company creation with configurable founder stake
- Market microstructure
  - Buy/sell order books
  - Founder/public-float ownership split so new listings are tradeable
  - Built-in market maker liquidity so buy and sell orders can fill immediately
  - Matching engine
  - Price updates, market cap, volume, PE ratio, short interest, dividend yield
  - Day-based price effect display with 5M/15M/1H/1D chart intervals
  - Crowd-pressure/stability dynamics with 25,000,000 simulated participants
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
- Financial-system layer
  - Banking stress, private credit stress, sovereign debt-to-GDP, housing index, VC dry powder
  - IPO pipeline queue with automatic listing execution during favorable windows
  - ETF registry with sector/country/index benchmark flows and market-coupled momentum effects
  - Hedge fund telemetry (strategy, AUM, leverage, gross exposure, rolling PnL)
- Corporate mergers with delisting outcomes and leaderboard progression
- Competitive strategy layer upgrades
  - Price-war action against specific competitors
  - Global operations expansion action for market growth
- Persistence + offline progression
  - Checkpoint save/load
  - Fast-forward ticks when needed
- Realtime dashboard delivery
  - HTTP API
  - SSE stream for live state updates
  - TradingView-style dashboard with larger chart and cleaner market layout
  - Expanded page layout with dedicated Trade Flow and Stock Control tabs
  - Added dedicated Strategy Lab page for mission board + backtest diagnostics
  - Added dedicated Academy page with large structured lesson catalog and featured learning paths
  - Top live news ticker (wars, mergers, sanctions, macro headlines)
  - Side stock list with per-stock mini graph plus stability/pressure stats
  - Chart mode toggle to view either individual stocks or NASDAQ100 graph
  - Day/night market session cycle where 1 stock day = 5 real minutes
  - Stock trade form supporting both limit and market orders
  - Trade-assistant panel explaining buy/sell/square-off mechanics with live position-impact previews
  - Smart trade tools with quick quantity presets, max-buy helper, close-size helper, and one-click limit-at-market prefill
  - Optional keyboard shortcuts for faster execution (buy, sell, square-off, max-buy helper)
  - Persistent watchlist panel (local browser storage) with focus/remove controls and watchlist highlights in stock list
  - Scrollable right-side trading controls so company creation/actions remain reachable on smaller viewports
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
- Scenario lab
  - Built-in scenario presets (AI supercycle, supply chain crunch, policy tightening, peace dividend)
  - One-call multi-tick scenario execution with run summaries and macro deltas
  - Scenario run history for replay/debug workflows
- Automated tests for determinism, matching behavior, bounded indicators, event coupling, and mergers
- Mega Program expansion layer
  - 10-module feature contract system with 120+ scoped features
  - No-courses policy guardrails for expansion backlog
  - Environment blueprint for dev/staging/prod runtime, config, secrets, logging, and deployment model
  - Program milestones and contract explorer APIs
  - Program operations dashboard page for realtime contract browsing
  - API hardening with optional admin bearer-token guard and in-memory rate limiting

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
- `GET /api/scenarios` — available scenario presets plus recent scenario runs
- `GET /api/rankings/sectors` — sector leadership table
- `GET /api/rankings/countries` — country leadership table
- `GET /api/supply-risk` — supply region heat-map and route diagnostics
- `GET /api/financial-system` — banking/credit/housing/ETF/IPO/hedge-fund system snapshot
- `GET /api/company/intelligence?companyId=<id>` — derived company scorecard and signals
- `GET /api/insights` — combined insights payload (mission board, strategy playbooks, academy snapshot)
- `GET /api/insights/mission-board?limit=<n>` — prioritized mission board with executable setup diagnostics
- `GET /api/insights/strategy-playbooks` — available strategy playbooks for lab backtests
- `POST /api/insights/backtest` — run deterministic strategy backtest (`playbookId`, `horizonTicks`, `capital`, optional `companyIds`)
- `GET /api/insights/academy` — academy tracks, featured lessons, and mastery snapshot
- `GET /api/program/overview` — mega program module + feature summary
- `GET /api/program/modules` — module catalog with feature counts
- `GET /api/program/features?module=<id>&phase=<phase>&status=<status>&batch=<n>&category=<name>&search=<text>&limit=<n>` — feature contracts filtered query
- `GET /api/program/feature-contract?featureId=<id>` — detailed feature contract lookup
- `GET /api/program/milestones` — phase gates and module coverage
- `GET /api/program/phase-board` — phase-level module/status distribution for backlog governance
- `GET /api/program/runbooks?module=<id>&limit=<n>` — operational runbooks for module execution and incident response
- `GET /api/program/release-checkpoints` — release checkpoint requirements by phase
- `GET /api/program/environment` — environment/runtime/config/secrets/logging/deployment blueprint
- `GET /api/program/no-courses-policy` — no-courses expansion rule metadata
- `GET /api/program/health` — program ops telemetry snapshot
- `POST /api/admin/program/feature-status` — update feature status override (requires bearer token when `ADMIN_BEARER_TOKEN` is configured)
- `POST /api/company` — create company (supports playerOwned/principalStakePct)
- `POST /api/order` — place order
- `POST /api/stock/control` — tune stock stability/support/resistance (plus strength parameters)
- `POST /api/scenario/run` — execute a scenario playbook (`scenarioId`, optional `intensity`, optional `ticks`)
- `POST /api/tick` — run one tick with optional events
- `POST /api/fast-forward` — run multiple ticks quickly
- `POST /api/action` — execute strategic actions (product launch, market manipulation, acquisitions, VC raise, factories, logistics, policy influence, monopolies, price wars, global expansion, economic war, IPO filing, ETF launch, share buybacks)

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
