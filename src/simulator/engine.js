import { createRng } from "./random.js";
import { calculatePeRatio } from "./state.js";

const STOCK_DAY_TICKS = 300;
const SIM_MS_PER_TICK = Math.round((24 * 60 * 60 * 1000) / STOCK_DAY_TICKS);
const TARGET_INFLATION = 0.025;
const NEUTRAL_RATE = 0.03;
const MARKET_MAKER_BUY_ID = "market-maker-buy";
const MARKET_MAKER_SELL_ID = "market-maker-sell";
const STOCK_DAY_INTERVAL_MINUTES = 1440;
const NASDAQ_SECTORS = new Set(["AI", "Cloud Computing", "Semiconductor", "Robotics", "EV", "Social Media", "Gaming", "Crypto", "Space"]);

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

function resolveMarketRegime(state, rng) {
  const score =
    state.sentiment * 1.3 +
    state.macro.gdpGrowth * 6 -
    state.macro.inflation * 4.2 -
    state.macro.unemployment * 2.2 -
    state.geopolitics.tension * 1.7 -
    state.supplyChains.pressure * 1.5 +
    (rng() - 0.5) * 0.34;
  if (score >= 0.24) return "rally";
  if (score <= -0.24) return "down";
  return "stable";
}

function touchDayRange(stock, price) {
  const p = Number(price ?? stock.lastPrice ?? 0);
  if (!Number.isFinite(stock.dayOpenPrice) || stock.dayOpenPrice <= 0) stock.dayOpenPrice = Math.max(0.1, Number(stock.lastPrice ?? 0.1));
  if (!Number.isFinite(stock.dayHigh) || stock.dayHigh <= 0) stock.dayHigh = stock.dayOpenPrice;
  if (!Number.isFinite(stock.dayLow) || stock.dayLow <= 0) stock.dayLow = stock.dayOpenPrice;
  stock.dayHigh = Number(Math.max(stock.dayHigh, p).toFixed(4));
  stock.dayLow = Number(Math.max(0.1, Math.min(stock.dayLow, p)).toFixed(4));
}

function resetStockDayRange(stock) {
  const anchor = Math.max(0.1, Number(stock.lastPrice ?? stock.dayOpenPrice ?? 0.1));
  stock.dayOpenPrice = Number(anchor.toFixed(4));
  stock.dayHigh = Number(anchor.toFixed(4));
  stock.dayLow = Number(anchor.toFixed(4));
}

function applyStockNewsMomentum(state, event, momentumDelta) {
  const byId = event.companyId && state.stocks[event.companyId] ? [event.companyId] : [];
  const byName = event.companyName
    ? Object.entries(state.companies)
        .filter(([, company]) => company.name === event.companyName)
        .map(([companyId]) => companyId)
    : [];
  const companyIds = [...new Set([...byId, ...byName])];
  for (const companyId of companyIds) {
    const stock = state.stocks[companyId];
    if (!stock) continue;
    stock.newsMomentum = bounded((stock.newsMomentum ?? 0) + momentumDelta, -1, 1);
  }
}

function applyBarrierClamp(stock, candidatePrice, directionBias = 0) {
  const basePrice = Math.max(0.1, Number(stock.lastPrice ?? 0.1));
  const support = Math.max(0.1, Number(stock.support ?? basePrice * 0.96));
  const resistance = Math.max(support + 0.0001, Number(stock.resistance ?? basePrice * 1.04));
  const supportStrength = bounded(Number(stock.supportStrength ?? 0.72), 0.2, 0.98);
  const resistanceStrength = bounded(Number(stock.resistanceStrength ?? 0.72), 0.2, 0.98);
  const candidate = Math.max(0.1, Number(candidatePrice ?? basePrice));
  const movingDown = candidate < basePrice;
  const movingUp = candidate > basePrice;

  if (movingDown) {
    const pressureGain = Math.max(0, -directionBias) * 2.2 + Math.max(0, (support - candidate) / Math.max(0.0001, support)) * 8;
    const decay = 0.55 + supportStrength * 0.2;
    stock.supportBreakPressure = bounded((stock.supportBreakPressure ?? 0) * 0.92 + pressureGain, 0, 16);
    const breakNeed = 3.8 + supportStrength * 6.5;
    if (candidate < support && stock.supportBreakPressure < breakNeed) {
      const damping = bounded(0.68 + supportStrength * 0.26, 0.7, 0.94);
      const held = support - (support - candidate) * (1 - damping);
      stock.supportStrength = bounded(supportStrength + 0.02, 0.2, 0.98);
      return Number(Math.max(0.1, held).toFixed(4));
    }
    if (candidate < support && stock.supportBreakPressure >= breakNeed) {
      stock.supportStrength = bounded(supportStrength - 0.05, 0.2, 0.98);
      stock.supportBreakPressure = Math.max(0, stock.supportBreakPressure - decay);
    } else {
      stock.supportBreakPressure = Math.max(0, stock.supportBreakPressure - decay);
      stock.supportStrength = bounded(supportStrength + 0.002, 0.2, 0.98);
    }
  }

  if (movingUp) {
    const pressureGain = Math.max(0, directionBias) * 2.2 + Math.max(0, (candidate - resistance) / Math.max(0.0001, resistance)) * 8;
    const decay = 0.55 + resistanceStrength * 0.2;
    stock.resistanceBreakPressure = bounded((stock.resistanceBreakPressure ?? 0) * 0.92 + pressureGain, 0, 16);
    const breakNeed = 3.8 + resistanceStrength * 6.5;
    if (candidate > resistance && stock.resistanceBreakPressure < breakNeed) {
      const damping = bounded(0.68 + resistanceStrength * 0.26, 0.7, 0.94);
      const held = resistance + (candidate - resistance) * (1 - damping);
      stock.resistanceStrength = bounded(resistanceStrength + 0.02, 0.2, 0.98);
      return Number(Math.max(0.1, held).toFixed(4));
    }
    if (candidate > resistance && stock.resistanceBreakPressure >= breakNeed) {
      stock.resistanceStrength = bounded(resistanceStrength - 0.05, 0.2, 0.98);
      stock.resistanceBreakPressure = Math.max(0, stock.resistanceBreakPressure - decay);
    } else {
      stock.resistanceBreakPressure = Math.max(0, stock.resistanceBreakPressure - decay);
      stock.resistanceStrength = bounded(resistanceStrength + 0.002, 0.2, 0.98);
    }
  }

  if (!movingDown) {
    stock.supportBreakPressure = Math.max(0, (stock.supportBreakPressure ?? 0) - 0.35);
    stock.supportStrength = bounded((stock.supportStrength ?? supportStrength) + 0.002, 0.2, 0.98);
  }
  if (!movingUp) {
    stock.resistanceBreakPressure = Math.max(0, (stock.resistanceBreakPressure ?? 0) - 0.35);
    stock.resistanceStrength = bounded((stock.resistanceStrength ?? resistanceStrength) + 0.002, 0.2, 0.98);
  }

  return Number(Math.max(0.1, candidate).toFixed(4));
}

function getPlayerHoldingShares(state, companyId) {
  return Number(state.player?.holdings?.[companyId] ?? 0);
}

function getStakePctForShares(stock, shares) {
  const outstanding = Math.max(1, Number(stock?.sharesOutstanding ?? 0));
  return bounded((Number(shares) / outstanding) * 100, 0, 100);
}

function getPublicFloatShares(stock) {
  const configuredFloat = Number(stock?.publicFloatShares ?? 0);
  if (Number.isFinite(configuredFloat) && configuredFloat > 0) return configuredFloat;
  return Math.max(1, Number(stock?.sharesOutstanding ?? 0));
}

function syncStockDerivedMetrics(stock, company) {
  stock.marketCap = Number((stock.lastPrice * stock.sharesOutstanding).toFixed(2));
  stock.peRatio = calculatePeRatio({
    marketCap: stock.marketCap,
    revenue: company?.kpis?.revenue,
    profitMargin: company?.kpis?.profitMargin
  });
}

function ensureMovementProfile(stock) {
  if (stock?.movementProfile && Number.isFinite(stock.movementProfile.volatility) && Number.isFinite(stock.movementProfile.momentumSensitivity)) {
    return stock.movementProfile;
  }
  stock.movementProfile = { volatility: 1, momentumSensitivity: 1, style: "balanced" };
  return stock.movementProfile;
}

function seedMarketLiquidity(state, companyId) {
  const book = state.orderBooks[companyId];
  const stock = state.stocks[companyId];
  if (!book || !stock) return;

  book.buy = book.buy.filter((order) => order.traderId !== MARKET_MAKER_BUY_ID);
  book.sell = book.sell.filter((order) => order.traderId !== MARKET_MAKER_SELL_ID);

  const publicFloatShares = getPublicFloatShares(stock);
  const totalLiquidity = Math.max(2_000, Math.round(publicFloatShares * 0.015));
  const perLevel = Math.max(500, Math.round(totalLiquidity / 3));
  const basePrice = Math.max(0.1, Number(stock.lastPrice ?? 0.1));
  const spreads = [0.004, 0.009, 0.016];

  spreads.forEach((spread, index) => {
    const levelQty = Math.max(100, Math.round(perLevel * (1 - index * 0.18)));
    book.buy.push({
      id: `${state.tick}-mm-buy-${index + 1}-${companyId}`,
      traderId: MARKET_MAKER_BUY_ID,
      side: "buy",
      price: Number((basePrice * (1 - spread)).toFixed(4)),
      orderType: "limit",
      quantity: levelQty,
      timestamp: Date.now() + index
    });
    book.sell.push({
      id: `${state.tick}-mm-sell-${index + 1}-${companyId}`,
      traderId: MARKET_MAKER_SELL_ID,
      side: "sell",
      price: Number((basePrice * (1 + spread)).toFixed(4)),
      orderType: "limit",
      quantity: levelQty,
      timestamp: Date.now() + index
    });
  });
}

function settlePlayerTrade(state, companyId, side, quantity, price) {
  if (!state.player) return;
  if (!state.player.holdings) state.player.holdings = {};
  const notional = quantity * price;
  const prevShares = getPlayerHoldingShares(state, companyId);
  const nextShares = side === "buy" ? prevShares + quantity : prevShares - quantity;

  if (side === "buy") {
    state.player.cash = Number((state.player.cash - notional).toFixed(2));
  } else {
    state.player.cash = Number((state.player.cash + notional).toFixed(2));
  }

  if (nextShares === 0) delete state.player.holdings[companyId];
  else state.player.holdings[companyId] = nextShares;
}

export function placeOrder(state, order) {
  const book = state.orderBooks[order.companyId];
  if (!book) throw new Error("Unknown company");
  if (!["buy", "sell"].includes(order.side)) throw new Error("Invalid side");
  const quantity = Number(order.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid order quantity");
  const stock = state.stocks[order.companyId];
  if (quantity > stock.sharesOutstanding) throw new Error("Order exceeds available company shares");
  const orderType = order.orderType === "market" ? "market" : "limit";
  let price = Number(order.price);
  if (orderType === "market") {
    const aggressive = order.side === "buy" ? 1.5 : 0.5;
    price = Number(Math.max(0.0001, stock.lastPrice * aggressive).toFixed(4));
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid order price");
  if (order.traderId === "player") {
    const estimatedNotional = quantity * price;
    const currentShares = getPlayerHoldingShares(state, order.companyId);
    const publicFloatShares = getPublicFloatShares(stock);
    if (order.side === "buy" && estimatedNotional > (state.player?.cash ?? 0)) {
      throw new Error("Insufficient cash balance");
    }
    if (order.side === "buy" && currentShares + quantity > publicFloatShares) {
      throw new Error("Insufficient public float available");
    }
    if (order.side === "sell") {
      const nextShares = currentShares - quantity;
      const existingShortShares = Math.max(0, -currentShares);
      const nextShortShares = Math.max(0, -nextShares);
      const additionalShortShares = Math.max(0, nextShortShares - existingShortShares);
      const borrowedByMarket = Math.max(0, Math.round((stock.shortInterest ?? 0) * (stock.sharesOutstanding ?? 0)));
      const availableBorrow = Math.max(0, publicFloatShares - borrowedByMarket - existingShortShares);
      if (additionalShortShares > availableBorrow) {
        throw new Error("Insufficient borrow availability to short");
      }
    }
    const oppositeSide = order.side === "buy" ? "sell" : "buy";
    if (!book[oppositeSide].length) seedMarketLiquidity(state, order.companyId);
  }
  book[order.side].push({
    id: `${state.tick}-${book[order.side].length + 1}-${order.side}`,
    traderId: order.traderId ?? "system",
    side: order.side,
    price,
    orderType,
    quantity,
    timestamp: Date.now()
  });
  return matchOrderBook(state, order.companyId);
}

export function matchOrderBook(state, companyId) {
  const book = state.orderBooks[companyId];
  const stock = state.stocks[companyId];
  const company = state.companies[companyId];
  const trades = [];

  book.buy.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
  book.sell.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);

  while (book.buy.length && book.sell.length && book.buy[0].price >= book.sell[0].price) {
    const bid = book.buy[0];
    const ask = book.sell[0];
    const quantity = Math.min(bid.quantity, ask.quantity);
    const rawPrice = (bid.price + ask.price) / 2;
    const tradeNotional = quantity * rawPrice;
    const participation = bounded(quantity / Math.max(1, stock.sharesOutstanding), 0, 1);
    const liquidityReference = Math.max(1, (stock.marketCap ?? 0) * 0.0009);
    const notionalParticipation = bounded(tradeNotional / liquidityReference, 0, 1);
    const tradeScale = bounded(Math.pow(tradeNotional / Math.max(1, stock.marketCap * 0.0002), 0.62), 0.08, 1.15);
    const participationCore = Math.pow(participation, 0.6) * 0.05;
    const notionalCore = Math.pow(notionalParticipation, 0.65) * 0.022;
    const impactPct = Math.min(0.042, (participationCore + notionalCore) * tradeScale);
    const buyInitiated = bid.timestamp >= ask.timestamp;
    const impactedPrice = rawPrice * (1 + (buyInitiated ? impactPct : -impactPct));

    const newsMagnitude = Math.abs(stock.newsMomentum ?? 0);
    const breakerLimit = bounded(0.05 + newsMagnitude * 0.1, 0.05, 0.16);
    const maxUp = stock.lastPrice * (1 + breakerLimit);
    const maxDown = stock.lastPrice * (1 - breakerLimit);
    const directionBias = buyInitiated ? 1 : -1;
    const barrierAdjusted = applyBarrierClamp(stock, impactedPrice, directionBias);
    const tradePrice = bounded(barrierAdjusted, maxDown, maxUp);

    bid.quantity -= quantity;
    ask.quantity -= quantity;

    if (bid.quantity <= 0) book.buy.shift();
    if (ask.quantity <= 0) book.sell.shift();

    stock.lastPrice = Number(tradePrice.toFixed(4));
    touchDayRange(stock, stock.lastPrice);
    stock.volume += quantity;
    syncStockDerivedMetrics(stock, company);
    if (company) {
      const valuationSensitivity = bounded(
        tradeNotional / Math.max(1, company.valuation * 0.02),
        0,
        1
      );
      const valuationTradeScale = bounded(tradeNotional / Math.max(1, company.valuation * 0.0015), 0, 1);
      const valuationBlend = bounded(0.0001 + participation * 0.03 + valuationSensitivity * 0.022 + valuationTradeScale * 0.018, 0.0001, 0.06);
      company.valuation = Number((company.valuation * (1 - valuationBlend) + stock.marketCap * valuationBlend).toFixed(2));
    }

    trades.push({
      companyId,
      quantity,
      price: stock.lastPrice,
      buyTraderId: bid.traderId,
      sellTraderId: ask.traderId
    });

    if (bid.traderId === "player") settlePlayerTrade(state, companyId, "buy", quantity, stock.lastPrice);
    if (ask.traderId === "player") settlePlayerTrade(state, companyId, "sell", quantity, stock.lastPrice);
  }

  return trades;
}

function updateMacro(state, rng) {
  const oilShock = (state.commodities.OIL.price - 80) / 80;
  const supplyShock = state.supplyChains.pressure * 0.003;
  const policyShock = state.policyPressure * 0.0015;
  const inflationGap = state.macro.inflation - TARGET_INFLATION;
  state.macro.inflation = bounded(
    state.macro.inflation + (rng() - 0.5) * 0.0024 + oilShock * 0.0018 + supplyShock + policyShock - inflationGap * 0.08,
    0.005,
    0.18
  );
  const rateGap = state.macro.rate - NEUTRAL_RATE;
  state.macro.unemployment = bounded(
    state.macro.unemployment +
      rateGap * 0.012 +
      state.geopolitics.tension * 0.0018 -
      state.sentiment * 0.0008 +
      (rng() - 0.5) * 0.0012,
    0.02,
    0.25
  );
  state.macro.gdpGrowth = bounded(
    0.03 -
      state.macro.inflation * 0.14 -
      state.macro.unemployment * 0.22 +
      state.sentiment * 0.01 +
      (rng() - 0.5) * 0.005,
    -0.09,
    0.08
  );
  const policyTarget =
    NEUTRAL_RATE +
    (state.macro.inflation - TARGET_INFLATION) * 1.2 +
    (0.055 - state.macro.unemployment) * 0.35 +
    state.policyPressure * 0.01;
  state.macro.rate = bounded(state.macro.rate + (policyTarget - state.macro.rate) * 0.16 + (rng() - 0.5) * 0.0006, 0, 0.15);
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
      applyStockNewsMomentum(state, event, 0.75);
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
      applyStockNewsMomentum(state, event, -0.55);
      pushHeadline(state, `${event.companyName ?? "A major company"} faces scandal allegations`, -0.03);
      break;
    case "PRODUCT_LAUNCH":
      state.sentiment += 0.03;
      if (event.companyId && state.companies[event.companyId]) {
        state.companies[event.companyId].innovation = bounded(state.companies[event.companyId].innovation + 0.08, 0, 1);
      }
      applyStockNewsMomentum(state, event, 0.6);
      pushHeadline(state, `${event.companyName ?? "A market leader"} launches a breakthrough product`, 0.03);
      break;
    case "LAYOFFS":
      state.sentiment -= 0.025;
      state.macro.unemployment = bounded(state.macro.unemployment + 0.003, 0.02, 0.25);
      applyStockNewsMomentum(state, event, -0.35);
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
  const movementProfile = ensureMovementProfile(stock);
  const crowd = simulateCrowdFlow(state, company, stock, rng);

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

  const intrinsicPrice = Math.max(0.1, company.valuation / stock.sharesOutstanding);
  const valuationGap = (intrinsicPrice - stock.lastPrice) / Math.max(0.1, stock.lastPrice);
  const recentCandles = stock.candles.slice(-40);
  const rangeHigh = recentCandles.length ? Math.max(...recentCandles.map((c) => c.high)) : stock.lastPrice;
  const rangeLow = recentCandles.length ? Math.min(...recentCandles.map((c) => c.low)) : stock.lastPrice;
  const previousSupport = Number(stock.support ?? stock.lastPrice * 0.96);
  const previousResistance = Number(stock.resistance ?? stock.lastPrice * 1.04);
  const support = bounded(previousSupport * 0.84 + rangeLow * 0.16, 0.1, rangeHigh);
  const resistance = Math.max(support + 0.0001, previousResistance * 0.84 + rangeHigh * 0.16);
  stock.support = Number(support.toFixed(4));
  stock.resistance = Number(resistance.toFixed(4));
  stock.newsMomentum = Number((stock.newsMomentum ?? 0).toFixed(4));
  const fundamentalReturn =
    company.kpis.growth * 0.042 +
    company.kpis.profitMargin * 0.018 +
    (company.innovation - 0.5) * 0.02 +
    (company.reputation - 0.5) * 0.012;
  const macroReturn =
    state.sentiment * 0.028 -
    state.macro.rate * 0.05 -
    state.macro.inflation * 0.045 -
    state.geopolitics.tension * 0.013 -
    state.supplyChains.pressure * 0.01;
  const meanReversion = valuationGap * 0.07;
  const crowdReturn = crowd.pressureGap * 0.028 * movementProfile.momentumSensitivity;
  const supportDistance = (stock.lastPrice - support) / Math.max(0.0001, stock.lastPrice);
  const resistanceDistance = (resistance - stock.lastPrice) / Math.max(0.0001, stock.lastPrice);
  const supportBounce = supportDistance < 0.02 ? (0.02 - supportDistance) * 0.28 : 0;
  const resistanceDrag = resistanceDistance < 0.02 ? (0.02 - resistanceDistance) * 0.22 : 0;
  const downsidePressure =
    Math.max(0, state.macro.inflation - TARGET_INFLATION) * 0.35 +
    state.supplyChains.pressure * 0.08 +
    state.geopolitics.tension * 0.06 +
    Math.max(0, -company.kpis.growth) * 0.18;
  const newsReturn = (stock.newsMomentum ?? 0) * 0.03;
  const random = (rng() - 0.5) * 0.007;
  const baseReturn = fundamentalReturn + macroReturn + meanReversion + crowdReturn + supportBounce - resistanceDrag - downsidePressure * 0.018 + newsReturn + random;
  const newsMagnitude = Math.abs(stock.newsMomentum ?? 0);
  const regime = state.marketRegime ?? "stable";
  const regimeVolatilityMultiplier = regime === "rally" ? 1.02 : regime === "down" ? 1.12 : 0.86;
  const maxMove = bounded(
    0.006 +
      (1 - stock.stability) * 0.017 +
      Math.abs(crowd.pressureGap) * 0.007 +
      state.geopolitics.tension * 0.006 +
      state.supplyChains.pressure * 0.004 +
      newsMagnitude * 0.015,
    0.004,
    0.04
  );
  const weightedMaxMove = bounded(maxMove * movementProfile.volatility * regimeVolatilityMultiplier, 0.0024, 0.052);
  const nextPrice = Math.max(0.1, stock.lastPrice * (1 + bounded(baseReturn, -weightedMaxMove * 1.5, weightedMaxMove * 1.5)));
  let clamped = bounded(nextPrice, stock.lastPrice * (1 - weightedMaxMove), stock.lastPrice * (1 + weightedMaxMove));
  clamped = applyBarrierClamp(stock, clamped, crowd.pressureGap + (stock.newsMomentum ?? 0));
  const dayAnchor = Math.max(0.1, Number(stock.dayOpenPrice ?? stock.lastPrice ?? 0.1));
  const upCap = bounded(0.1 + Math.max(0, stock.newsMomentum ?? 0) * 0.24, 0.1, 0.36);
  const downCap = bounded(0.1 + Math.max(0, -(stock.newsMomentum ?? 0)) * 0.2, 0.1, 0.3);
  const dayUpper = dayAnchor * (1 + upCap);
  const dayLower = dayAnchor * (1 - downCap);
  clamped = bounded(clamped, dayLower, dayUpper);
  stock.halted = false;
  stock.lastPrice = Number(clamped.toFixed(4));
  touchDayRange(stock, stock.lastPrice);
  syncStockDerivedMetrics(stock, company);
  company.valuation = Number((company.valuation * 0.6 + stock.marketCap * 0.4).toFixed(2));
  stock.shortInterest = bounded(stock.shortInterest + (rng() - 0.5) * 0.006 + (state.sentiment < 0 ? 0.0025 : -0.0018), 0, 0.5);
  stock.dividendYield = bounded(0.005 + company.kpis.profitMargin * 0.06 - company.kpis.growth * 0.02, 0, 0.09);
  stock.newsMomentum = Number((stock.newsMomentum * 0.92).toFixed(4));
  stock.listed = true;
  stock.delistedTick = null;
}

function simulateCrowdFlow(state, company, stock, rng) {
  const participants = state.population.participantCount ?? 10_000_000;
  const companyCount = Math.max(1, Object.keys(state.companies).length);
  const regimeShift = state.marketRegime === "rally" ? 0.06 : state.marketRegime === "down" ? -0.06 : 0;
  const sentimentBias = bounded(
    0.5 + state.sentiment * 0.18 + (company.reputation - 0.5) * 0.1 - state.geopolitics.tension * 0.06 + regimeShift,
    0.2,
    0.8
  );
  const buyPressure = bounded(sentimentBias + (rng() - 0.5) * 0.1, 0.05, 0.95);
  const sellPressure = bounded(1 - buyPressure + (rng() - 0.5) * 0.08, 0.05, 0.95);
  const pressureGap = buyPressure - sellPressure;
  const activeRatio = bounded(
    0.006 + state.funds.aiBotAggression * 0.002 + Math.abs(state.sentiment) * 0.002 + rng() * 0.0015,
    0.001,
    0.02
  );
  const activeParticipants = Math.round(participants * activeRatio);
  const flowVolume = Math.max(100, Math.round((activeParticipants / companyCount) * (0.6 + rng() * 0.8)));

  stock.volume = Math.max(0, Math.round(stock.volume * 0.92 + flowVolume));
  stock.buyPressure = Number(buyPressure.toFixed(3));
  stock.sellPressure = Number(sellPressure.toFixed(3));
  stock.stability = Number(
    bounded(
      0.42 +
        company.reputation * 0.22 +
        (1 - Math.abs(pressureGap)) * 0.26 +
        (1 - state.geopolitics.tension) * 0.09 -
        state.supplyChains.pressure * 0.08,
      0.2,
      0.98
    ).toFixed(3)
  );

  return { pressureGap };
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

  const sortedByCap = Object.entries(state.stocks)
    .filter(([, stock]) => stock.listed)
    .map(([companyId, stock]) => ({ ...stock, companyId }))
    .sort((a, b) => b.marketCap - a.marketCap);
  const top50 = sortedByCap.slice(0, 50);
  const top100 = sortedByCap.slice(0, 100);
  const nasdaqUniverse = sortedByCap.filter((stock) => NASDAQ_SECTORS.has(state.companies[stock.companyId]?.sector));
  const nasdaq100 = (nasdaqUniverse.length ? nasdaqUniverse : sortedByCap).slice(0, 100);
  const allMarketCapNow = stocks.reduce((sum, s) => sum + Math.max(1, Number(s.marketCap ?? 0)), 0);
  const top50MarketCapNow = top50.reduce((sum, s) => sum + Math.max(1, Number(s.marketCap ?? 0)), 0);
  const topMarketCapNow = top100.reduce((sum, s) => sum + Math.max(1, Number(s.marketCap ?? 0)), 0);
  const nasdaqMarketCapNow = nasdaq100.reduce((sum, s) => sum + Math.max(1, Number(s.marketCap ?? 0)), 0);

  if (!Number.isFinite(state.indexes.GLOBAL_ALL?.baseMarketCap) || state.indexes.GLOBAL_ALL.baseMarketCap <= 0) {
    state.indexes.GLOBAL_ALL.baseMarketCap = allMarketCapNow;
  }
  if (!Number.isFinite(state.indexes.GLOBAL100?.baseMarketCap) || state.indexes.GLOBAL100.baseMarketCap <= 0) {
    state.indexes.GLOBAL100.baseMarketCap = topMarketCapNow;
  }
  if (!Number.isFinite(state.indexes.GLOBAL50?.baseMarketCap) || state.indexes.GLOBAL50.baseMarketCap <= 0) {
    state.indexes.GLOBAL50.baseMarketCap = top50MarketCapNow;
  }
  if (!Number.isFinite(state.indexes.NASDAQ100?.baseMarketCap) || state.indexes.NASDAQ100.baseMarketCap <= 0) {
    state.indexes.NASDAQ100.baseMarketCap = nasdaqMarketCapNow;
  }

  const allPrev = Number(state.indexes.GLOBAL_ALL?.value ?? 1000);
  const allTarget = 1000 * (allMarketCapNow / Math.max(1, state.indexes.GLOBAL_ALL.baseMarketCap));
  state.indexes.GLOBAL_ALL.value = Number((allPrev + (allTarget - allPrev) * 0.12).toFixed(2));
  state.indexes.GLOBAL_ALL.changePct = Number((((state.indexes.GLOBAL_ALL.value - allPrev) / Math.max(1, allPrev)) * 100).toFixed(2));
  state.indexes.GLOBAL_ALL.members = sortedByCap.map((s) => s.ticker);
  state.indexes.GLOBAL_ALL.weights = sortedByCap.map((s) => ({
    ticker: s.ticker,
    weightPct: Number(((Math.max(1, Number(s.marketCap ?? 0)) / Math.max(1, allMarketCapNow)) * 100).toFixed(4))
  }));

  const topPrev = Number(state.indexes.GLOBAL100?.value ?? 1000);
  const topTarget = 1000 * (topMarketCapNow / Math.max(1, state.indexes.GLOBAL100.baseMarketCap));
  state.indexes.GLOBAL100.value = Number((topPrev + (topTarget - topPrev) * 0.12).toFixed(2));
  state.indexes.GLOBAL100.changePct = Number((((state.indexes.GLOBAL100.value - topPrev) / Math.max(1, topPrev)) * 100).toFixed(2));
  state.indexes.GLOBAL100.members = top100.map((s) => s.ticker);
  state.indexes.GLOBAL100.weights = top100.map((s) => ({
    ticker: s.ticker,
    weightPct: Number(((Math.max(1, Number(s.marketCap ?? 0)) / Math.max(1, topMarketCapNow)) * 100).toFixed(4))
  }));

  const top50Prev = Number(state.indexes.GLOBAL50?.value ?? 1000);
  const top50Target = 1000 * (top50MarketCapNow / Math.max(1, state.indexes.GLOBAL50.baseMarketCap));
  state.indexes.GLOBAL50.value = Number((top50Prev + (top50Target - top50Prev) * 0.12).toFixed(2));
  state.indexes.GLOBAL50.changePct = Number((((state.indexes.GLOBAL50.value - top50Prev) / Math.max(1, top50Prev)) * 100).toFixed(2));
  state.indexes.GLOBAL50.members = top50.map((s) => s.ticker);
  state.indexes.GLOBAL50.weights = top50.map((s) => ({
    ticker: s.ticker,
    weightPct: Number(((Math.max(1, Number(s.marketCap ?? 0)) / Math.max(1, top50MarketCapNow)) * 100).toFixed(4))
  }));

  const nasdaqPrev = Number(state.indexes.NASDAQ100?.value ?? 1000);
  const nasdaqTarget = 1000 * (nasdaqMarketCapNow / Math.max(1, state.indexes.NASDAQ100.baseMarketCap));
  state.indexes.NASDAQ100.value = Number((nasdaqPrev + (nasdaqTarget - nasdaqPrev) * 0.12).toFixed(2));
  state.indexes.NASDAQ100.changePct = Number((((state.indexes.NASDAQ100.value - nasdaqPrev) / Math.max(1, nasdaqPrev)) * 100).toFixed(2));
  state.indexes.NASDAQ100.members = nasdaq100.map((s) => s.ticker);
  state.indexes.NASDAQ100.weights = nasdaq100.map((s) => ({
    ticker: s.ticker,
    weightPct: Number(((Math.max(1, Number(s.marketCap ?? 0)) / Math.max(1, nasdaqMarketCapNow)) * 100).toFixed(4))
  }));
  const nasdaqRange = Math.max(0.0001, Math.abs(state.indexes.NASDAQ100.value - nasdaqPrev));
  const nasdaqWick = nasdaqRange * (0.25 + rng() * 0.6);
  const nasdaqOpen = Number(nasdaqPrev.toFixed(2));
  const nasdaqClose = Number(state.indexes.NASDAQ100.value.toFixed(2));
  const nasdaqHigh = Number((Math.max(nasdaqOpen, nasdaqClose) + nasdaqWick).toFixed(2));
  const nasdaqLow = Number(Math.max(1, Math.min(nasdaqOpen, nasdaqClose) - nasdaqWick).toFixed(2));
  state.indexes.NASDAQ100.candles = [
    ...(state.indexes.NASDAQ100.candles ?? []),
    { tick: state.tick, time: state.time, open: nasdaqOpen, high: nasdaqHigh, low: nasdaqLow, close: nasdaqClose, volume: nasdaqMarketCapNow }
  ].slice(-600);

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

  const holdings = state.player?.holdings ?? {};
  const holdingsValue = Object.entries(holdings).reduce((sum, [companyId, qty]) => {
    const stock = state.stocks[companyId];
    if (!stock || !stock.listed) return sum;
    return sum + Number(qty) * stock.lastPrice;
  }, 0);
  state.player.netWorth = Math.max(500_000, Math.round((state.player.cash ?? 0) + holdingsValue));

  const billionaireFloor = 1_000_000_000;
  const founderEntries = Object.values(state.companies).map((company) => {
    const stock = state.stocks[company.id];
    const founderStakePct = Number(company.ownership?.principalStakePct ?? 0);
    const founderNetWorth = Number((company.valuation * (founderStakePct / 100)).toFixed(2));
    return {
      id: `founder-${company.id}`,
      name: company.ownership?.principalHolder ?? `${company.name} Founder`,
      type: "founder",
      companyId: company.id,
      companyName: company.name,
      stakePct: founderStakePct,
      wealth: founderNetWorth,
      netWorth: founderNetWorth
    };
  });

  let playerCompanyStake = null;
  for (const [companyId, qty] of Object.entries(holdings)) {
    if (qty <= 0) continue;
    const stock = state.stocks[companyId];
    if (!stock) continue;
    const stakePct = getStakePctForShares(stock, qty);
    if (!playerCompanyStake || stakePct > playerCompanyStake.stakePct) {
      playerCompanyStake = {
        companyId,
        companyName: state.companies[companyId]?.name ?? companyId,
        stakePct: Number(stakePct.toFixed(4))
      };
    }
  }

  const playerEntry = {
    id: "player",
    name: "You",
    type: "player",
    companyId: playerCompanyStake?.companyId ?? null,
    companyName: playerCompanyStake?.companyName ?? null,
    stakePct: playerCompanyStake?.stakePct ?? 0,
    wealth: state.player.netWorth,
    netWorth: state.player.netWorth
  };

  const richestPool = [...founderEntries, playerEntry]
    .filter((entry) => entry.netWorth >= billionaireFloor)
    .sort((a, b) => b.netWorth - a.netWorth);

  state.leaderboards.richest = richestPool.slice(0, 25);
  state.player.rank = richestPool.filter((entry) => entry.netWorth > state.player.netWorth).length + 1;
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

  buyer.valuation = Number((buyer.valuation + target.valuation * 0.9).toFixed(2));
  buyer.employees += Math.round(target.employees * 0.75);
  buyer.marketDominance = bounded(buyer.marketDominance + 0.08, 0, 1);
  buyer.politicalInfluence = bounded(buyer.politicalInfluence + 0.05, 0, 1);
  buyer.kpis.revenue = Number((buyer.kpis.revenue + target.kpis.revenue * 0.85).toFixed(2));
  const buyerStock = state.stocks[buyerId];
  if (buyerStock) syncStockDerivedMetrics(buyerStock, buyer);
  const targetStock = state.stocks[targetId];
  if (targetStock) {
    targetStock.listed = true;
    targetStock.halted = false;
    targetStock.delistedTick = null;
  }
  state.geopolitics.tension = bounded(state.geopolitics.tension + 0.01, 0, 1);
  applyEvent(state, { type: "MERGER", buyerName: buyer.name, targetName: target.name });
  return { buyerId, targetId, buyerValuation: buyer.valuation, targetDelisted: false };
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
      const direction = payload.direction === "dump" ? "dump" : "pump";
      const move = direction === "pump" ? 0.02 * intensity : -0.025 * intensity;
      stock.newsMomentum = bounded((stock.newsMomentum ?? 0) + (direction === "pump" ? 0.35 : -0.4), -1, 1);
      const manipulated = Math.max(0.1, stock.lastPrice * (1 + move));
      stock.lastPrice = Number(applyBarrierClamp(stock, manipulated, direction === "pump" ? 1 : -1).toFixed(4));
      touchDayRange(stock, stock.lastPrice);
      syncStockDerivedMetrics(stock, company);
      company.valuation = Number((company.valuation * 0.75 + stock.marketCap * 0.25).toFixed(2));
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

function snapshotCandle(state, companyId, open, rng) {
  const stock = state.stocks[companyId];
  const close = stock.lastPrice;
  const spread = Math.max(0.0001, Math.abs(close - open));
  const wick = spread * (0.35 + rng() * 0.65);
  const high = Number((Math.max(open, close) + wick).toFixed(4));
  const low = Number(Math.max(0.0001, Math.min(open, close) - wick).toFixed(4));
  stock.candles.push({ tick: state.tick, time: state.time, open, high, low, close, volume: stock.volume });
  stock.candles = stock.candles.slice(-600);
}

export function runTick(state, { events = [] } = {}) {
  if (!state.player) {
    state.player = { role: "startup founder", cash: 50_000_000_000, netWorth: 50_000_000_000, influence: 0.1, rank: 0, holdings: {} };
  }
  if (!Number.isFinite(state.player?.cash)) state.player.cash = 50_000_000_000;
  if (!Number.isFinite(state.player?.netWorth)) state.player.netWorth = state.player.cash;
  if (!state.player?.holdings) state.player.holdings = {};
  if (!state.indexes?.GLOBAL100) {
    state.indexes = state.indexes ?? {};
    state.indexes.GLOBAL100 = { value: 1000, changePct: 0, members: [] };
  }
  if (!state.indexes?.GLOBAL50) {
    state.indexes = state.indexes ?? {};
    state.indexes.GLOBAL50 = { value: 1000, changePct: 0, members: [] };
  }
  if (!state.indexes?.GLOBAL_ALL) {
    state.indexes = state.indexes ?? {};
    state.indexes.GLOBAL_ALL = { value: 1000, changePct: 0, members: [] };
  }
  if (!state.indexes?.NASDAQ100) {
    state.indexes = state.indexes ?? {};
    state.indexes.NASDAQ100 = { value: 1000, changePct: 0, members: [], candles: [] };
  }
  if (!["rally", "down", "stable"].includes(state.marketRegime)) state.marketRegime = "stable";
  state.tick += 1;
  const ticksPerDay = state.marketSession?.ticksPerDay ?? STOCK_DAY_TICKS;
  state.time = new Date(new Date(state.time).getTime() + SIM_MS_PER_TICK).toISOString();
  const dayProgress = ((state.tick - 1) % ticksPerDay) / ticksPerDay;
  const isNewDayTick = (state.tick - 1) % ticksPerDay === 0;
  state.marketSession = {
    ticksPerDay,
    phase: dayProgress < 0.5 ? "day" : "night",
    dayNumber: Math.floor((state.tick - 1) / ticksPerDay) + 1
  };
  const rng = createRng(state.seed + state.tick);

  for (const event of events) applyEvent(state, event);
  updateCommodities(state, rng);
  updateMacro(state, rng);
  state.marketRegime = resolveMarketRegime(state, rng);
  state.policyPressure = bounded(state.policyPressure * 0.97, 0, 1);
  state.supplyChains.pressure = bounded(state.supplyChains.pressure * 0.985, 0, 1);
  state.geopolitics.tension = bounded(state.geopolitics.tension * 0.992, 0, 1);
  applyGovernmentDrift(state, rng);

  for (const companyId of Object.keys(state.companies)) {
    if (!state.orderBooks[companyId]) state.orderBooks[companyId] = { buy: [], sell: [] };
    if (!state.stocks[companyId]) continue;
    const stock = state.stocks[companyId];
    if (!Number.isFinite(stock.supportStrength)) stock.supportStrength = 0.72;
    if (!Number.isFinite(stock.resistanceStrength)) stock.resistanceStrength = 0.72;
    if (!Number.isFinite(stock.supportBreakPressure)) stock.supportBreakPressure = 0;
    if (!Number.isFinite(stock.resistanceBreakPressure)) stock.resistanceBreakPressure = 0;
    if (!Number.isFinite(stock.newsMomentum)) stock.newsMomentum = 0;
    if (!Number.isFinite(stock.dayOpenPrice) || stock.dayOpenPrice <= 0) resetStockDayRange(stock);
    if (isNewDayTick) resetStockDayRange(stock);
    const open = state.stocks[companyId].lastPrice;
    updateCompany(state, companyId, rng);
    seedMarketLiquidity(state, companyId);
    matchOrderBook(state, companyId);
    snapshotCandle(state, companyId, open, rng);
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
      `Index ${state.indexes.GLOBAL100.value.toFixed(2)} (${state.indexes.GLOBAL100.changePct.toFixed(2)}%) | Global-All ${
        state.indexes.GLOBAL_ALL.value.toFixed(2)
      } (${state.indexes.GLOBAL_ALL.changePct.toFixed(2)}%) | NASDAQ100 ${state.indexes.NASDAQ100.value.toFixed(2)} (${state.indexes.NASDAQ100.changePct.toFixed(
        2
      )}%) | ${String(state.marketRegime).toUpperCase()} regime | Supply pressure ${asPct(
        state.supplyChains.pressure
      )}% | Geopolitical tension ${asPct(state.geopolitics.tension)}%`,
      0
    );
  }
  if (state.tick % ticksPerDay === 0) {
    pushHeadline(
      state,
      `Market day ${state.marketSession.dayNumber} (${STOCK_DAY_INTERVAL_MINUTES} simulated minutes) closed. Next session opens with updated global sentiment.`,
      0
    );
  }

  return state;
}
