# World Finance Simulator (MVP)

This repository now contains an executable MVP for a realistic global economy and stock market simulation.

## Implemented Scope

- Deterministic tick-based simulation loop
- Company creation system (sector/country/business model + core KPIs)
- Market microstructure MVP
  - Buy/sell order books
  - Matching engine
  - Price updates, market cap, volume, PE ratio
  - Circuit-breaker-style clamping and halt flags
- Macro + supply shock coupling
  - GDP growth, inflation, unemployment, policy rate
  - Commodity prices (oil, silicon, food, copper)
- News/sentiment engine (headline generation from events)
- Persistence + offline progression
  - Checkpoint save/load
  - Fast-forward ticks when needed
- Realtime dashboard delivery
  - HTTP API
  - SSE stream for live state updates
  - Minimal dark-themed browser dashboard
- Automated tests for determinism, matching behavior, and bounded indicators

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

This is a foundation release that implements the MVP loop and system coupling.  
Advanced layers (distributed microservices, Kafka streams, multiplayer shard sync, deep AI populations, derivatives markets, geopolitical diplomacy trees, and extended world systems) are intentionally deferred to future iterations.
