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

export function placeOrder(state, order) {
  const book = state.orderBooks[order.companyId];
  if (!book) throw new Error("Unknown company");
  if (!["buy", "sell"].includes(order.side)) throw new Error("Invalid side");
  if (order.quantity <= 0 || order.price <= 0) throw new Error("Invalid order values");
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

  while (book.buy.length && book.sell.length && book.buy[0].price >= book.sell[0].price) {
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
  state.macro.inflation = bounded(state.macro.inflation + (rng() - 0.5) * 0.002 + oilShock * 0.0015, 0.005, 0.18);
  state.macro.unemployment = bounded(
    state.macro.unemployment + (state.macro.rate - 0.03) * 0.02 + (rng() - 0.5) * 0.001,
    0.02,
    0.25
  );
  state.macro.gdpGrowth = bounded(0.03 - state.macro.inflation * 0.15 - state.macro.unemployment * 0.25 + (rng() - 0.5) * 0.004, -0.09, 0.08);
  state.macro.rate = bounded(state.macro.rate + (state.macro.inflation - 0.025) * 0.3, 0, 0.15);
}

function updateCommodities(state, rng) {
  for (const key of Object.keys(state.commodities)) {
    const drift = (rng() - 0.5) * 0.03;
    state.commodities[key].price = Number(Math.max(5, pctMove(state.commodities[key].price, drift)).toFixed(2));
  }
}

function applyEvent(state, event) {
  state.events.push({ ...event, tick: state.tick, time: state.time });
  switch (event.type) {
    case "SUPPLY_SHOCK":
      state.sentiment -= 0.05;
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
    default:
      break;
  }
}

function updateCompany(state, companyId, rng) {
  const company = state.companies[companyId];
  const stock = state.stocks[companyId];

  const inflationDrag = state.macro.inflation * 0.35;
  const demand = bounded(0.03 + state.sentiment * 0.4 - state.macro.unemployment * 0.2 + (rng() - 0.5) * 0.05, -0.2, 0.25);
  const supplyPenalty = company.supplyRisk * ((state.commodities.OIL.price - 80) / 80) * 0.4;
  const rdBoost = company.rdBudget * 0.2 + company.aiCapability * 0.06;

  company.kpis.growth = bounded(demand + rdBoost - inflationDrag - supplyPenalty, -0.35, 0.45);
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

  for (const companyId of Object.keys(state.companies)) {
    const open = state.stocks[companyId].lastPrice;
    updateCompany(state, companyId, rng);
    matchOrderBook(state, companyId);
    snapshotCandle(state, companyId, open);
  }

  state.sentiment = bounded(state.sentiment + (rng() - 0.5) * 0.015, -1, 1);

  if (state.tick % 60 === 0) {
    pushHeadline(
      state,
      `Macro update: GDP ${(state.macro.gdpGrowth * 100).toFixed(2)}%, inflation ${(state.macro.inflation * 100).toFixed(2)}%, unemployment ${(state.macro.unemployment * 100).toFixed(2)}%`,
      0
    );
  }

  return state;
}
