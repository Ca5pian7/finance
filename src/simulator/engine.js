import { createRng } from "./random.js";

function bounded(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pctMove(base, pct) {
  return Number((base * (1 + pct)).toFixed(4));
}

function pushHeadline(state, headline, impact = 0) {
  state.headlines.unshift({
    id: `${state.tick}-${state.headlines.length + 1}`,
    tick: state.tick,
    time: state.time,
    headline,
    sentimentImpact: impact
  });
  state.headlines = state.headlines.slice(0, 100);
}

function asPct(value) {
  return Number((value * 100).toFixed(2));
}

export function placeOrder(state, order) {
  const book = state.orderBooks[order.companyId];
  if (!book) throw new Error("Unknown company");
  if (!["buy", "sell"].includes(order.side)) throw new Error("Invalid side");
  if (order.quantity <= 0 || order.price <= 0) throw new Error("Invalid order values");
  if (!state.stocks[order.companyId].listed) throw new Error("Security delisted");
  if (state.stocks[order.companyId].halted) throw new Error("Trading halted");
  book[order.side].push({
    id: `${state.tick}-${book[order.side].length + 1}-${order.side}`,
    traderId: order.traderId ?? "system",
    side: order.side,
    price: Number(order.price),
    quantity: Number(order.quantity),
    timestamp: Date.now()
  });
  return matchOrderBook(state, order.companyId);
}

export function matchOrderBook(state, companyId) {
  const book = state.orderBooks[companyId];
  const stock = state.stocks[companyId];
  const trades = [];

  book.buy.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
  book.sell.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);

  while (stock.listed && book.buy.length && book.sell.length && book.buy[0].price >= book.sell[0].price) {
    const bid = book.buy[0];
    const ask = book.sell[0];
    const quantity = Math.min(bid.quantity, ask.quantity);
    const rawPrice = (bid.price + ask.price) / 2;

    const breakerLimit = 0.1;
    const maxUp = stock.lastPrice * (1 + breakerLimit);
    const maxDown = stock.lastPrice * (1 - breakerLimit);
    const tradePrice = bounded(rawPrice, maxDown, maxUp);

    bid.quantity -= quantity;
    ask.quantity -= quantity;

    if (bid.quantity <= 0) book.buy.shift();
    if (ask.quantity <= 0) book.sell.shift();

    stock.lastPrice = Number(tradePrice.toFixed(4));
    stock.volume += quantity;
    stock.marketCap = Number((stock.lastPrice * stock.sharesOutstanding).toFixed(2));

    trades.push({
      companyId,
      quantity,
      price: stock.lastPrice,
      buyTraderId: bid.traderId,
      sellTraderId: ask.traderId
    });
  }

  return trades;
}

function updateMacro(state, rng) {
  const oilShock = (state.commodities.OIL.price - 80) / 80;
  const supplyShock = state.supplyChains.pressure * 0.004;
  const policyShock = state.policyPressure * 0.002;
  state.macro.inflation = bounded(
    state.macro.inflation + (rng() - 0.5) * 0.002 + oilShock * 0.0015 + supplyShock + policyShock,
    0.005,
    0.18
  );
  state.macro.unemployment = bounded(
    state.macro.unemployment + (state.macro.rate - 0.03) * 0.02 + state.geopolitics.tension * 0.002 + (rng() - 0.5) * 0.001,
    0.02,
    0.25
  );
  state.macro.gdpGrowth = bounded(0.03 - state.macro.inflation * 0.15 - state.macro.unemployment * 0.25 + (rng() - 0.5) * 0.004, -0.09, 0.08);
  state.macro.rate = bounded(state.macro.rate + (state.macro.inflation - 0.025) * 0.3, 0, 0.15);
}

function updateCommodities(state, rng) {
  for (const key of Object.keys(state.commodities)) {
    const drift = (rng() - 0.5) * 0.03 + state.supplyChains.pressure * 0.01 + state.geopolitics.tension * 0.01;
    state.commodities[key].price = Number(Math.max(5, pctMove(state.commodities[key].price, drift)).toFixed(2));
  }
}

function applyEvent(state, event) {
  state.events.push({ ...event, tick: state.tick, time: state.time });
  state.geopolitics.events.unshift({ ...event, tick: state.tick, time: state.time });
  state.geopolitics.events = state.geopolitics.events.slice(0, 100);
  switch (event.type) {
    case "SUPPLY_SHOCK":
      state.sentiment -= 0.05;
      state.supplyChains.pressure = bounded(state.supplyChains.pressure + 0.08, 0, 1);
      state.commodities.OIL.price = Number((state.commodities.OIL.price * 1.08).toFixed(2));
      pushHeadline(state, "Global supply disruption raises logistics and energy costs", -0.05);
      break;
    case "AI_BREAKTHROUGH":
      state.sentiment += 0.04;
      pushHeadline(state, `${event.companyName} announces major AI breakthrough`, 0.04);
      break;
    case "RATE_HIKE":
      state.macro.rate = bounded(state.macro.rate + 0.005, 0, 0.15);
      state.sentiment -= 0.02;
      pushHeadline(state, "Central banks raise rates to curb inflation", -0.02);
      break;
    case "WAR":
      state.geopolitics.tension = bounded(state.geopolitics.tension + 0.12, 0, 1);
      state.supplyChains.pressure = bounded(state.supplyChains.pressure + 0.1, 0, 1);
      state.sentiment -= 0.08;
      state.geopolitics.activeConflicts.unshift(event.region ?? "Unknown theater");
      state.geopolitics.activeConflicts = [...new Set(state.geopolitics.activeConflicts)].slice(0, 8);
      pushHeadline(state, `Conflict escalation in ${event.region ?? "a strategic region"} shocks global markets`, -0.08);
      break;
    case "SANCTION":
      state.geopolitics.tension = bounded(state.geopolitics.tension + 0.05, 0, 1);
      state.policyPressure = bounded(state.policyPressure + 0.07, 0, 1);
      state.sentiment -= 0.04;
      pushHeadline(state, `${event.country ?? "Major economy"} faces new sanctions`, -0.04);
      break;
    case "TRADE_AGREEMENT":
      state.geopolitics.tension = bounded(state.geopolitics.tension - 0.06, 0, 1);
      state.supplyChains.pressure = bounded(state.supplyChains.pressure - 0.07, 0, 1);
      state.sentiment += 0.04;
      state.geopolitics.treaties.unshift(event.name ?? "New strategic trade pact");
      state.geopolitics.treaties = state.geopolitics.treaties.slice(0, 20);
      pushHeadline(state, `${event.name ?? "Trade agreement"} improves global commerce outlook`, 0.04);
      break;
    case "SCANDAL":
      state.sentiment -= 0.03;
      if (event.companyId && state.companies[event.companyId]) {
        state.companies[event.companyId].reputation = bounded(state.companies[event.companyId].reputation - 0.12, 0, 1);
      }
      pushHeadline(state, `${event.companyName ?? "A major company"} faces scandal allegations`, -0.03);
      break;
    case "PRODUCT_LAUNCH":
      state.sentiment += 0.03;
      if (event.companyId && state.companies[event.companyId]) {
        state.companies[event.companyId].innovation = bounded(state.companies[event.companyId].innovation + 0.08, 0, 1);
      }
      pushHeadline(state, `${event.companyName ?? "A market leader"} launches a breakthrough product`, 0.03);
      break;
    case "LAYOFFS":
      state.sentiment -= 0.025;
      state.macro.unemployment = bounded(state.macro.unemployment + 0.003, 0.02, 0.25);
      pushHeadline(state, `${event.companyName ?? "A major employer"} announces layoffs`, -0.025);
      break;
    case "CYBER_ATTACK":
      state.policyPressure = bounded(state.policyPressure + 0.05, 0, 1);
      state.geopolitics.tension = bounded(state.geopolitics.tension + 0.04, 0, 1);
      state.sentiment -= 0.03;
      pushHeadline(state, "Critical infrastructure cyber attack disrupts commerce", -0.03);
      break;
    case "MERGER":
      state.sentiment += 0.02;
      pushHeadline(state, `${event.buyerName ?? "Major firm"} acquires ${event.targetName ?? "competitor"}`, 0.02);
      break;
    default:
      break;
  }
}

function updateCompany(state, companyId, rng) {
  const company = state.companies[companyId];
  const stock = state.stocks[companyId];
  if (!stock.listed) return;

  const inflationDrag = state.macro.inflation * 0.35;
  const demand = bounded(0.03 + state.sentiment * 0.4 - state.macro.unemployment * 0.2 + (rng() - 0.5) * 0.05, -0.2, 0.25);
  const supplyPenalty = company.supplyRisk * ((state.commodities.OIL.price - 80) / 80 + state.supplyChains.pressure) * 0.4;
  const rdBoost = company.rdBudget * 0.2 + company.aiCapability * 0.06;
  const taxPenalty = (state.macro.rate + state.policyPressure) * 0.02;

  company.kpis.growth = bounded(demand + rdBoost - inflationDrag - supplyPenalty - taxPenalty, -0.35, 0.45);
  company.kpis.revenue = Number((company.kpis.revenue * (1 + company.kpis.growth * 0.05)).toFixed(2));
  company.kpis.profitMargin = bounded(company.kpis.profitMargin + rdBoost * 0.01 - inflationDrag * 0.08 - supplyPenalty * 0.08, -0.2, 0.6);
  company.innovation = bounded(company.innovation + rdBoost * 0.02 + (rng() - 0.5) * 0.03, 0, 1);
  company.reputation = bounded(company.reputation + (rng() - 0.5) * 0.04 + state.sentiment * 0.02, 0, 1);
  company.aiCapability = bounded(company.aiCapability + company.rdBudget * 0.008, 0, 1);
  company.valuation = Number(Math.max(1_000_000, company.valuation * (1 + company.kpis.growth * 0.03 + company.kpis.profitMargin * 0.01)).toFixed(2));

  const fundamentalReturn = company.kpis.growth * 0.12 + company.kpis.profitMargin * 0.03 + (company.innovation - 0.5) * 0.05;
  const macroReturn = state.sentiment * 0.08 - state.macro.rate * 0.2 - state.macro.inflation * 0.1;
  const random = (rng() - 0.5) * 0.02;
  const nextPrice = Math.max(0.1, stock.lastPrice * (1 + fundamentalReturn + macroReturn + random));

  const maxMove = 0.1;
  const clamped = bounded(nextPrice, stock.lastPrice * (1 - maxMove), stock.lastPrice * (1 + maxMove));
  stock.halted = Math.abs((clamped - stock.lastPrice) / stock.lastPrice) >= 0.0999;
  stock.lastPrice = Number(clamped.toFixed(4));
  stock.marketCap = Number((stock.lastPrice * stock.sharesOutstanding).toFixed(2));
  stock.peRatio = Number((Math.max(1, stock.marketCap / Math.max(1, company.kpis.revenue * company.kpis.profitMargin))).toFixed(2));
  stock.shortInterest = bounded(stock.shortInterest + (rng() - 0.5) * 0.01 + (state.sentiment < 0 ? 0.003 : -0.002), 0, 0.5);
  stock.dividendYield = bounded(0.005 + company.kpis.profitMargin * 0.06 - company.kpis.growth * 0.02, 0, 0.09);

  if (company.valuation < 300_000_000 || company.kpis.profitMargin < -0.15) {
    stock.listed = false;
    stock.halted = true;
    stock.delistedTick = state.tick;
    pushHeadline(state, `${company.name} was delisted after severe financial deterioration`, -0.04);
  }
}

function updatePopulation(state, rng) {
  const unemploymentStress = bounded(state.macro.unemployment * 1.2 + state.macro.inflation * 0.5, 0, 1);
  state.population.unemploymentStress = unemploymentStress;
  state.population.consumerConfidence = bounded(
    state.population.consumerConfidence + state.sentiment * 0.01 - unemploymentStress * 0.005 + (rng() - 0.5) * 0.01,
    0,
    1
  );
  for (const agent of state.population.agents) {
    agent.emotion = bounded(agent.emotion + state.sentiment * 0.05 + (rng() - 0.5) * 0.08, -1, 1);
    const wealthDrift = 1 + state.macro.gdpGrowth * agent.spendingBias - state.macro.inflation * 0.3 + agent.emotion * 0.01;
    agent.wealth = Math.max(200, Math.round(agent.wealth * bounded(wealthDrift, 0.9, 1.12)));
  }
  const wealth = state.population.agents.map((a) => a.wealth).sort((a, b) => a - b);
  const p10 = wealth[Math.floor(wealth.length * 0.1)] ?? 1;
  const p90 = wealth[Math.floor(wealth.length * 0.9)] ?? 1;
  state.population.inequalityIndex = bounded((p90 - p10) / Math.max(1, p90), 0, 1);
}

function updateFundsAndIndexes(state, rng) {
  const stocks = Object.values(state.stocks).filter((s) => s.listed);
  if (!stocks.length) return;

  const avgMove = stocks.reduce((sum, s) => sum + (s.candles.at(-1)?.close ?? s.lastPrice), 0) / stocks.length;
  const prevValue = state.indexes.GLOBAL100.value;
  const target = bounded(avgMove * 90, 650, 3600);
  state.indexes.GLOBAL100.value = Number((prevValue + (target - prevValue) * 0.08).toFixed(2));
  state.indexes.GLOBAL100.changePct = Number((((state.indexes.GLOBAL100.value - prevValue) / Math.max(1, prevValue)) * 100).toFixed(2));
  state.indexes.GLOBAL100.members = stocks
    .slice()
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10)
    .map((s) => s.ticker);

  const macroSignal = state.sentiment - state.macro.inflation - state.geopolitics.tension * 0.5;
  state.funds.institutionalAUM = Math.max(50_000_000_000, Math.round(state.funds.institutionalAUM * (1 + macroSignal * 0.003 + (rng() - 0.5) * 0.002)));
  state.funds.hedgeAUM = Math.max(20_000_000_000, Math.round(state.funds.hedgeAUM * (1 + macroSignal * 0.005 + state.funds.aiBotAggression * 0.001)));
  state.funds.retailLiquidity = Math.max(
    10_000_000_000,
    Math.round(state.funds.retailLiquidity * (1 + state.population.consumerConfidence * 0.002 - state.macro.rate * 0.003 + (rng() - 0.5) * 0.002))
  );
  state.funds.aiBotAggression = bounded(state.funds.aiBotAggression + (rng() - 0.5) * 0.02 + state.sentiment * 0.01, 0.1, 0.95);
}

function updateLeaderboards(state) {
  state.leaderboards.companies = Object.values(state.companies)
    .map((company) => ({
      id: company.id,
      name: company.name,
      valuation: company.valuation,
      country: company.country,
      sector: company.sector
    }))
    .sort((a, b) => b.valuation - a.valuation)
    .slice(0, 10);

  state.leaderboards.richest = state.population.agents
    .map((agent) => ({ id: agent.id, type: agent.type, wealth: agent.wealth }))
    .sort((a, b) => b.wealth - a.wealth)
    .slice(0, 10);

  const listedWorth = Object.values(state.stocks)
    .filter((s) => s.listed)
    .reduce((sum, s) => sum + s.marketCap * 0.000001, 0);
  state.player.netWorth = Math.max(500_000, Math.round(5_000_000 + listedWorth * (0.002 + state.player.influence * 0.001)));
  state.player.rank = state.leaderboards.richest.findIndex((agent) => agent.wealth <= state.player.netWorth) + 1;
}

function requireCompany(state, companyId) {
  const company = state.companies[companyId];
  if (!company) throw new Error("Unknown company");
  return company;
}

export function executeMerger(state, { buyerId, targetId }) {
  const buyer = state.companies[buyerId];
  const target = state.companies[targetId];
  if (!buyer || !target || buyerId === targetId) throw new Error("Invalid merger participants");
  const targetStock = state.stocks[targetId];
  if (!targetStock?.listed) throw new Error("Target is not listed");

  buyer.valuation = Number((buyer.valuation + target.valuation * 0.9).toFixed(2));
  buyer.employees += Math.round(target.employees * 0.75);
  buyer.marketDominance = bounded(buyer.marketDominance + 0.08, 0, 1);
  buyer.politicalInfluence = bounded(buyer.politicalInfluence + 0.05, 0, 1);
  buyer.kpis.revenue = Number((buyer.kpis.revenue + target.kpis.revenue * 0.85).toFixed(2));
  targetStock.listed = false;
  targetStock.halted = true;
  targetStock.delistedTick = state.tick;
  delete state.orderBooks[targetId];
  state.geopolitics.tension = bounded(state.geopolitics.tension + 0.01, 0, 1);
  applyEvent(state, { type: "MERGER", buyerName: buyer.name, targetName: target.name });
  return { buyerId, targetId, buyerValuation: buyer.valuation, targetDelisted: true };
}

export function executeStrategicAction(state, payload = {}) {
  const actionType = payload.actionType;
  const intensity = bounded(Number(payload.intensity ?? 1), 0.5, 5);

  switch (actionType) {
    case "LAUNCH_PRODUCT": {
      const company = requireCompany(state, payload.companyId);
      applyEvent(state, { type: "PRODUCT_LAUNCH", companyId: company.id, companyName: company.name });
      company.innovation = bounded(company.innovation + 0.03 * intensity, 0, 1);
      return { actionType, companyId: company.id, status: "ok" };
    }
    case "MANIPULATE_MARKET": {
      const company = requireCompany(state, payload.companyId);
      const stock = state.stocks[company.id];
      if (!stock?.listed) throw new Error("Security not listed");
      const direction = payload.direction === "dump" ? "dump" : "pump";
      const move = direction === "pump" ? 0.02 * intensity : -0.025 * intensity;
      stock.lastPrice = Number(Math.max(0.1, stock.lastPrice * (1 + move)).toFixed(4));
      stock.marketCap = Number((stock.lastPrice * stock.sharesOutstanding).toFixed(2));
      stock.shortInterest = bounded(stock.shortInterest + (direction === "pump" ? -0.015 : 0.03), 0, 0.5);
      state.sentiment = bounded(state.sentiment + (direction === "pump" ? 0.01 : -0.02), -1, 1);
      pushHeadline(
        state,
        `${company.name} is at the center of a suspected ${direction === "pump" ? "pump" : "dump"} market manipulation wave`,
        direction === "pump" ? 0.01 : -0.02
      );
      return { actionType, companyId: company.id, direction, status: "ok" };
    }
    case "RAISE_VENTURE_CAPITAL": {
      const company = requireCompany(state, payload.companyId);
      const raiseAmount = Math.max(10_000_000, Number(payload.amount ?? 250_000_000));
      company.valuation = Number((company.valuation + raiseAmount).toFixed(2));
      company.rdBudget = bounded(company.rdBudget + 0.01 * intensity, 0.01, 0.5);
      company.aiCapability = bounded(company.aiCapability + 0.01 * intensity, 0, 1);
      pushHeadline(state, `${company.name} raises ${Math.round(raiseAmount / 1_000_000)}M in venture capital`, 0.025);
      return { actionType, companyId: company.id, raiseAmount, status: "ok" };
    }
    case "BUILD_FACTORY": {
      const company = requireCompany(state, payload.companyId);
      const workers = Math.max(100, Math.round(600 * intensity));
      company.employees += workers;
      company.supplyRisk = bounded(company.supplyRisk - 0.03 * intensity, 0, 1);
      company.carbonEmissions += Math.round(workers * 0.5);
      pushHeadline(state, `${company.name} opens new smart factories to scale output`, 0.018);
      return { actionType, companyId: company.id, workersAdded: workers, status: "ok" };
    }
    case "MANAGE_LOGISTICS": {
      const company = requireCompany(state, payload.companyId);
      company.supplyRisk = bounded(company.supplyRisk - 0.07 * intensity, 0, 1);
      state.supplyChains.pressure = bounded(state.supplyChains.pressure - 0.05 * intensity, 0, 1);
      pushHeadline(state, `${company.name} upgrades logistics networks and eases supply pressure`, 0.022);
      return { actionType, companyId: company.id, status: "ok" };
    }
    case "INFLUENCE_GOVERNMENT": {
      const company = requireCompany(state, payload.companyId);
      const country = payload.country ?? company.country;
      const government = state.governments[country];
      if (!government) throw new Error("Unknown government");
      government.subsidy = bounded(government.subsidy + 0.008 * intensity, 0, 0.2);
      government.regulation = bounded(government.regulation - 0.01 * intensity, 0, 1);
      company.politicalInfluence = bounded(company.politicalInfluence + 0.05 * intensity, 0, 1);
      state.policyPressure = bounded(state.policyPressure + 0.03 * intensity, 0, 1);
      pushHeadline(state, `${company.name} gains policy influence in ${country}`, 0.01);
      return { actionType, companyId: company.id, country, status: "ok" };
    }
    case "CREATE_MONOPOLY": {
      const company = requireCompany(state, payload.companyId);
      company.marketDominance = bounded(company.marketDominance + 0.15 * intensity, 0, 1);
      company.reputation = bounded(company.reputation - 0.02 * intensity, 0, 1);
      state.geopolitics.tension = bounded(state.geopolitics.tension + 0.015 * intensity, 0, 1);
      state.sentiment = bounded(state.sentiment - 0.01 * intensity, -1, 1);
      pushHeadline(state, `${company.name} is accused of monopolistic market capture`, -0.015);
      return { actionType, companyId: company.id, status: "ok" };
    }
    case "TRIGGER_ECONOMIC_WAR": {
      const region = payload.region ?? "Global Trade Routes";
      const country = payload.country ?? "Major economy";
      applyEvent(state, { type: "WAR", region });
      applyEvent(state, { type: "SANCTION", country });
      pushHeadline(state, "Economic war escalates with retaliatory sanctions and supply blockades", -0.06);
      return { actionType, region, country, status: "ok" };
    }
    case "ACQUIRE_COMPETITOR":
      return executeMerger(state, { buyerId: payload.buyerId, targetId: payload.targetId });
    default:
      throw new Error("Unknown strategic action");
  }
}

function applyGovernmentDrift(state, rng) {
  for (const government of Object.values(state.governments ?? {})) {
    government.regulation = bounded(government.regulation + (rng() - 0.5) * 0.03 + state.policyPressure * 0.01, 0, 1);
    government.stability = bounded(government.stability - state.geopolitics.tension * 0.004 + (rng() - 0.5) * 0.01, 0, 1);
  }
}

function snapshotCandle(state, companyId, open) {
  const stock = state.stocks[companyId];
  const close = stock.lastPrice;
  const high = Math.max(open, close);
  const low = Math.min(open, close);
  stock.candles.push({ tick: state.tick, open, high, low, close, volume: stock.volume });
  stock.candles = stock.candles.slice(-300);
}

export function runTick(state, { events = [] } = {}) {
  state.tick += 1;
  state.time = new Date(new Date(state.time).getTime() + 60_000).toISOString();
  const rng = createRng(state.seed + state.tick);

  for (const event of events) applyEvent(state, event);
  updateCommodities(state, rng);
  updateMacro(state, rng);
  state.policyPressure = bounded(state.policyPressure * 0.97, 0, 1);
  state.supplyChains.pressure = bounded(state.supplyChains.pressure * 0.985, 0, 1);
  state.geopolitics.tension = bounded(state.geopolitics.tension * 0.992, 0, 1);
  applyGovernmentDrift(state, rng);

  for (const companyId of Object.keys(state.companies)) {
    if (!state.orderBooks[companyId]) state.orderBooks[companyId] = { buy: [], sell: [] };
    const open = state.stocks[companyId].lastPrice;
    updateCompany(state, companyId, rng);
    matchOrderBook(state, companyId);
    snapshotCandle(state, companyId, open);
  }

  updatePopulation(state, rng);
  updateFundsAndIndexes(state, rng);
  updateLeaderboards(state);
  state.sentiment = bounded(state.sentiment + (rng() - 0.5) * 0.015, -1, 1);

  if (state.tick % 60 === 0) {
    pushHeadline(
      state,
      `Macro update: GDP ${(state.macro.gdpGrowth * 100).toFixed(2)}%, inflation ${(state.macro.inflation * 100).toFixed(2)}%, unemployment ${(state.macro.unemployment * 100).toFixed(2)}%`,
      0
    );
  }
  if (state.tick % 45 === 0) {
    pushHeadline(
      state,
      `Index ${state.indexes.GLOBAL100.value.toFixed(2)} (${state.indexes.GLOBAL100.changePct.toFixed(2)}%) | Supply pressure ${asPct(
        state.supplyChains.pressure
      )}% | Geopolitical tension ${asPct(state.geopolitics.tension)}%`,
      0
    );
  }

  return state;
}
