function bounded(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreFromRange(value, min, max) {
  if (!Number.isFinite(value)) return 50;
  return bounded(((value - min) / Math.max(0.0001, max - min)) * 100, 0, 100);
}

function severityWeight(severity) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function routeRegionKey(country) {
  switch (country) {
    case "Taiwan":
      return "TAIWAN_CHIPS";
    case "UAE":
      return "MIDDLE_EAST_OIL";
    case "China":
      return "CHINA_MANUFACTURING";
    case "India":
      return "INDIA_SERVICES";
    case "USA":
      return "USA_FINANCE_AI";
    default:
      return null;
  }
}

export function getDayMovePct(stock = {}) {
  const lastPrice = Number(stock.lastPrice ?? stock.candles?.at(-1)?.close ?? 0);
  const openPrice = Number(stock.dayOpenPrice ?? stock.candles?.at(0)?.open ?? lastPrice ?? 0);
  if (!openPrice) return 0;
  return (lastPrice - openPrice) / openPrice;
}

export function ensureAnalyticsState(state) {
  state.leaderboards = state.leaderboards ?? {};
  if (!Array.isArray(state.leaderboards.companies)) state.leaderboards.companies = [];
  if (!Array.isArray(state.leaderboards.richest)) state.leaderboards.richest = [];
  if (!Array.isArray(state.leaderboards.sectors)) state.leaderboards.sectors = [];
  if (!Array.isArray(state.leaderboards.countries)) state.leaderboards.countries = [];

  state.analytics = state.analytics ?? {};
  if (!Array.isArray(state.analytics.alerts)) state.analytics.alerts = [];
  state.analytics.supplyRisk = state.analytics.supplyRisk ?? { routes: [], regions: [], summary: {} };
  state.analytics.market = state.analytics.market ?? {};

  state.player = state.player ?? {};
  if (!state.player.holdings) state.player.holdings = {};
  if (!state.player.positions) state.player.positions = {};
  if (!Array.isArray(state.player.trades)) state.player.trades = [];
  state.player.analytics = state.player.analytics ?? {
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalPnl: 0,
    positionsCount: 0,
    grossExposure: 0,
    longExposure: 0,
    shortExposure: 0,
    turnover: 0,
    winRate: 0,
    cashUtilization: 0,
    exposureBySector: [],
    exposureByCountry: [],
    positions: [],
    topPosition: null,
    worstPosition: null
  };
}

export function recordPlayerTradeSettlement(state, { companyId, side, quantity, price }) {
  ensureAnalyticsState(state);

  const fillQty = Math.max(0, Number(quantity ?? 0));
  const fillPrice = Math.max(0, Number(price ?? 0));
  if (!fillQty || !fillPrice) return;

  const position = state.player.positions[companyId] ?? {
    shares: 0,
    avgEntryPrice: 0,
    realizedPnl: 0,
    wins: 0,
    losses: 0,
    closedTrades: 0,
    tradedVolume: 0,
    totalBoughtNotional: 0,
    totalSoldNotional: 0
  };

  const delta = side === "buy" ? fillQty : -fillQty;
  const prevShares = Number(position.shares ?? 0);
  const prevAvg = Number(position.avgEntryPrice ?? 0);
  const nextShares = prevShares + delta;
  const sameDirection = prevShares === 0 || Math.sign(prevShares) === Math.sign(delta);
  let realizedPnlDelta = 0;

  if (sameDirection) {
    const nextAbsShares = Math.abs(nextShares);
    const weightedCost = Math.abs(prevShares) * prevAvg + fillQty * fillPrice;
    position.avgEntryPrice = nextAbsShares > 0 ? round(weightedCost / nextAbsShares, 4) : 0;
  } else {
    const closedShares = Math.min(Math.abs(prevShares), fillQty);
    realizedPnlDelta = prevShares > 0 ? (fillPrice - prevAvg) * closedShares : (prevAvg - fillPrice) * closedShares;
    position.realizedPnl = round(Number(position.realizedPnl ?? 0) + realizedPnlDelta);
    if (closedShares > 0) {
      position.closedTrades = Number(position.closedTrades ?? 0) + 1;
      if (realizedPnlDelta > 0) position.wins = Number(position.wins ?? 0) + 1;
      if (realizedPnlDelta < 0) position.losses = Number(position.losses ?? 0) + 1;
    }
    if (Math.abs(delta) < Math.abs(prevShares)) {
      position.avgEntryPrice = prevAvg;
    } else if (Math.abs(delta) === Math.abs(prevShares)) {
      position.avgEntryPrice = 0;
    } else {
      position.avgEntryPrice = round(fillPrice, 4);
    }
  }

  position.shares = nextShares;
  position.lastTradePrice = round(fillPrice, 4);
  position.lastTradeTick = state.tick;
  position.tradedVolume = Number(position.tradedVolume ?? 0) + fillQty;
  if (side === "buy") position.totalBoughtNotional = round(Number(position.totalBoughtNotional ?? 0) + fillQty * fillPrice);
  else position.totalSoldNotional = round(Number(position.totalSoldNotional ?? 0) + fillQty * fillPrice);

  state.player.positions[companyId] = position;
  state.player.trades = [
    ...state.player.trades,
    {
      tick: state.tick,
      time: state.time,
      companyId,
      side,
      quantity: fillQty,
      price: round(fillPrice, 4),
      notional: round(fillQty * fillPrice),
      realizedPnlDelta: round(realizedPnlDelta),
      sharesAfter: nextShares,
      avgEntryPriceAfter: round(position.avgEntryPrice ?? 0, 4)
    }
  ].slice(-200);
}

export function refreshPlayerAnalytics(state) {
  ensureAnalyticsState(state);

  const positions = [];
  const sectorExposure = new Map();
  const countryExposure = new Map();
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let longExposure = 0;
  let shortExposure = 0;
  let turnover = 0;
  let wins = 0;
  let losses = 0;

  for (const [companyId, storedPosition] of Object.entries(state.player.positions ?? {})) {
    const position = storedPosition ?? {};
    const stock = state.stocks?.[companyId];
    const company = state.companies?.[companyId];
    realizedPnl += Number(position.realizedPnl ?? 0);
    wins += Number(position.wins ?? 0);
    losses += Number(position.losses ?? 0);
    turnover += Number(position.totalBoughtNotional ?? 0) + Number(position.totalSoldNotional ?? 0);

    const shares = Number(position.shares ?? 0);
    if (!stock || !company || !shares) continue;

    const lastPrice = Number(stock.lastPrice ?? 0);
    const avgEntryPrice = Number(position.avgEntryPrice ?? 0);
    const marketValue = shares * lastPrice;
    const exposure = Math.abs(marketValue);
    const unrealized =
      shares >= 0 ? (lastPrice - avgEntryPrice) * shares : (avgEntryPrice - lastPrice) * Math.abs(shares);

    unrealizedPnl += unrealized;
    if (shares >= 0) longExposure += exposure;
    else shortExposure += exposure;

    const row = {
      companyId,
      companyName: company.name,
      ticker: stock.ticker,
      sector: company.sector,
      country: company.country,
      shares,
      avgEntryPrice: round(avgEntryPrice, 4),
      lastPrice: round(lastPrice, 4),
      marketValue: round(marketValue),
      exposure: round(exposure),
      realizedPnl: round(position.realizedPnl ?? 0),
      unrealizedPnl: round(unrealized),
      direction: shares >= 0 ? "long" : "short"
    };
    positions.push(row);

    sectorExposure.set(company.sector, round((sectorExposure.get(company.sector) ?? 0) + exposure));
    countryExposure.set(company.country, round((countryExposure.get(company.country) ?? 0) + exposure));
  }

  const grossExposure = longExposure + shortExposure;
  const totalPnl = realizedPnl + unrealizedPnl;
  const totalClosed = wins + losses;
  const netWorthBase = Math.max(1, Number(state.player.netWorth ?? Number(state.player.cash ?? 0) + grossExposure));
  const serializeExposure = (entries) =>
    entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, exposure]) => ({
        name,
        exposure: round(exposure),
        exposurePct: round((exposure / Math.max(1, grossExposure)) * 100, 2)
      }));

  const sortedPositions = positions.sort((a, b) => b.exposure - a.exposure);
  const bestPosition = positions.length ? positions.slice().sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)[0] : null;
  const worstPosition = positions.length ? positions.slice().sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)[0] : null;

  state.player.analytics = {
    realizedPnl: round(realizedPnl),
    unrealizedPnl: round(unrealizedPnl),
    totalPnl: round(totalPnl),
    positionsCount: positions.length,
    grossExposure: round(grossExposure),
    longExposure: round(longExposure),
    shortExposure: round(shortExposure),
    turnover: round(turnover),
    winRate: totalClosed ? round((wins / totalClosed) * 100, 2) : 0,
    cashUtilization: round((grossExposure / netWorthBase) * 100, 2),
    exposureBySector: serializeExposure([...sectorExposure.entries()]),
    exposureByCountry: serializeExposure([...countryExposure.entries()]),
    positions: sortedPositions.slice(0, 12),
    topPosition: bestPosition,
    worstPosition
  };
}

function buildSectorAndCountryRankings(state, field) {
  const groups = new Map();

  for (const [companyId, company] of Object.entries(state.companies ?? {})) {
    const stock = state.stocks?.[companyId];
    if (!stock?.listed) continue;
    const key = String(company[field] ?? "Unknown");
    const group = groups.get(key) ?? {
      key,
      members: 0,
      marketCap: 0,
      dayMoves: [],
      peRatios: [],
      growthRates: [],
      stability: [],
      supplyRisk: [],
      pressureBias: [],
      leader: null
    };

    const marketCap = Number(stock.marketCap ?? 0);
    const move = getDayMovePct(stock);
    group.members += 1;
    group.marketCap += marketCap;
    group.dayMoves.push(move);
    if (Number.isFinite(stock.peRatio)) group.peRatios.push(Number(stock.peRatio));
    group.growthRates.push(Number(company.kpis?.growth ?? 0));
    group.stability.push(Number(stock.stability ?? 0));
    group.supplyRisk.push(Number(company.supplyRisk ?? 0));
    group.pressureBias.push(Number(stock.buyPressure ?? 0.5) - Number(stock.sellPressure ?? 0.5));
    if (!group.leader || marketCap > group.leader.marketCap) {
      group.leader = {
        companyId,
        ticker: stock.ticker,
        companyName: company.name,
        marketCap: round(marketCap)
      };
    }
    groups.set(key, group);
  }

  const rows = [...groups.values()];
  const maxMarketCap = Math.max(1, ...rows.map((row) => row.marketCap));
  return rows
    .map((row) => {
      const avgMovePct = average(row.dayMoves);
      const avgGrowthPct = average(row.growthRates);
      const avgStability = average(row.stability);
      const avgSupplyRisk = average(row.supplyRisk);
      const pressureBias = average(row.pressureBias);
      const marketCapScore = scoreFromRange(row.marketCap, 0, maxMarketCap);
      const momentumScore = scoreFromRange(avgMovePct, -0.06, 0.06);
      const growthScore = scoreFromRange(avgGrowthPct, -0.04, 0.12);
      const stabilityScore = bounded(avgStability * 100, 0, 100);
      const resilienceScore = bounded((1 - avgSupplyRisk) * 100, 0, 100);
      const compositeScore = round(
        marketCapScore * 0.34 + momentumScore * 0.2 + growthScore * 0.18 + stabilityScore * 0.16 + resilienceScore * 0.12,
        2
      );
      return {
        name: row.key,
        members: row.members,
        marketCap: round(row.marketCap),
        avgMovePct: round(avgMovePct * 100, 2),
        avgGrowthPct: round(avgGrowthPct * 100, 2),
        avgPeRatio: row.peRatios.length ? round(average(row.peRatios), 2) : null,
        avgStabilityPct: round(avgStability * 100, 2),
        avgSupplyRiskPct: round(avgSupplyRisk * 100, 2),
        pressureBiasPct: round(pressureBias * 100, 2),
        compositeScore,
        leader: row.leader
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore || b.marketCap - a.marketCap)
    .slice(0, 12);
}

function computeSupplyRisk(state) {
  const regions = Object.entries(state.supplyChains?.regions ?? {}).map(([regionId, region]) => {
    const vulnerability = bounded(
      Number(region.disruption ?? 0) * 0.6 +
        Number(region.sensitivity ?? 0.5) * 0.25 +
        Number(state.supplyChains?.pressure ?? 0) * 0.35 +
        Number(state.geopolitics?.tension ?? 0) * 0.2,
      0,
      1
    );
    return {
      regionId,
      resource: region.resource,
      disruptionPct: round(Number(region.disruption ?? 0) * 100, 2),
      sensitivityPct: round(Number(region.sensitivity ?? 0) * 100, 2),
      vulnerabilityPct: round(vulnerability * 100, 2),
      severity: vulnerability >= 0.75 ? "critical" : vulnerability >= 0.55 ? "high" : vulnerability >= 0.35 ? "medium" : "low"
    };
  });

  const routes = (state.supplyChains?.routes ?? []).map((route) => {
    const fromRegion = routeRegionKey(route.from);
    const toRegion = routeRegionKey(route.to);
    const fromDisruption = Number(state.supplyChains?.regions?.[fromRegion]?.disruption ?? 0);
    const toDisruption = Number(state.supplyChains?.regions?.[toRegion]?.disruption ?? 0);
    const fromStability = Number(state.governments?.[route.from]?.stability ?? 0.65);
    const toStability = Number(state.governments?.[route.to]?.stability ?? 0.65);
    const vulnerability = bounded(
      Number(state.supplyChains?.pressure ?? 0) * 0.34 +
        Number(state.geopolitics?.tension ?? 0) * 0.34 +
        ((fromDisruption + toDisruption) / 2) * 0.24 +
        (1 - Number(route.capacity ?? 1)) * 0.22 +
        Number(route.delay ?? 0) * 1.45 +
        (1 - ((fromStability + toStability) / 2)) * 0.18,
      0,
      1
    );
    return {
      id: route.id,
      from: route.from,
      to: route.to,
      active: route.active !== false,
      delayPct: round(Number(route.delay ?? 0) * 100, 2),
      capacityPct: round(Number(route.capacity ?? 1) * 100, 2),
      vulnerabilityPct: round(vulnerability * 100, 2),
      status: vulnerability >= 0.78 ? "critical" : vulnerability >= 0.58 ? "stressed" : vulnerability >= 0.36 ? "watch" : "healthy"
    };
  });

  const hottestRoute = routes.slice().sort((a, b) => b.vulnerabilityPct - a.vulnerabilityPct)[0] ?? null;
  const hottestRegion = regions.slice().sort((a, b) => b.vulnerabilityPct - a.vulnerabilityPct)[0] ?? null;

  return {
    regions: regions.sort((a, b) => b.vulnerabilityPct - a.vulnerabilityPct),
    routes: routes.sort((a, b) => b.vulnerabilityPct - a.vulnerabilityPct),
    summary: {
      hottestRoute,
      hottestRegion,
      pressurePct: round(Number(state.supplyChains?.pressure ?? 0) * 100, 2)
    }
  };
}

function computeAlerts(state, supplyRisk) {
  const alerts = [];
  const pushAlert = (alert) => alerts.push({ tick: state.tick, time: state.time, ...alert });

  if ((state.macro?.inflation ?? 0) >= 0.07) {
    pushAlert({
      id: `inflation-${state.tick}`,
      severity: (state.macro?.inflation ?? 0) >= 0.1 ? "critical" : "high",
      category: "macro",
      title: "Inflation spike",
      detail: `Inflation is running at ${round((state.macro?.inflation ?? 0) * 100, 2)}%, squeezing growth-sensitive assets.`
    });
  }
  if ((state.geopolitics?.tension ?? 0) >= 0.45) {
    pushAlert({
      id: `geo-${state.tick}`,
      severity: (state.geopolitics?.tension ?? 0) >= 0.7 ? "critical" : "high",
      category: "geopolitics",
      title: "Geopolitical stress building",
      detail: `Global tension reached ${round((state.geopolitics?.tension ?? 0) * 100, 2)}% with ${state.geopolitics?.activeConflicts?.length ?? 0} active conflict zone(s).`
    });
  }
  if ((state.supplyChains?.pressure ?? 0) >= 0.5) {
    pushAlert({
      id: `supply-${state.tick}`,
      severity: (state.supplyChains?.pressure ?? 0) >= 0.72 ? "critical" : "medium",
      category: "supply-chain",
      title: "Supply chain under pressure",
      detail: `Aggregate supply pressure is ${round((state.supplyChains?.pressure ?? 0) * 100, 2)}%, raising execution and inventory risk.`
    });
  }

  for (const route of (supplyRisk?.routes ?? []).slice(0, 3)) {
    if (route.vulnerabilityPct < 58) continue;
    pushAlert({
      id: `route-${route.id}-${state.tick}`,
      severity: route.vulnerabilityPct >= 78 ? "critical" : "high",
      category: "logistics",
      title: `${route.from} → ${route.to} route ${route.status}`,
      detail: `Route vulnerability is ${route.vulnerabilityPct}% with ${route.delayPct}% delay and ${route.capacityPct}% available capacity.`
    });
  }

  const stressedStocks = Object.entries(state.stocks ?? {})
    .filter(([, stock]) => stock?.listed)
    .map(([companyId, stock]) => ({ companyId, stock, move: Math.abs(getDayMovePct(stock)) }))
    .filter((entry) => entry.move >= 0.05)
    .sort((a, b) => b.move - a.move)
    .slice(0, 3);

  for (const { companyId, stock, move } of stressedStocks) {
    pushAlert({
      id: `vol-${companyId}-${state.tick}`,
      severity: move >= 0.11 ? "critical" : move >= 0.08 ? "high" : "medium",
      category: "volatility",
      title: `${stock.ticker} volatility alert`,
      detail: `${stock.ticker} moved ${round(move * 100, 2)}% during the session with buy pressure ${round(Number(stock.buyPressure ?? 0.5) * 100, 1)}%.`
    });
  }

  for (const headline of (state.headlines ?? []).slice(0, 4)) {
    const impact = Math.abs(Number(headline.sentimentImpact ?? 0));
    if (impact < 0.04) continue;
    pushAlert({
      id: `headline-${headline.id}`,
      severity: impact >= 0.08 ? "high" : "medium",
      category: "news",
      title: "High-impact headline",
      detail: headline.headline
    });
  }

  return alerts
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.tick - a.tick)
    .slice(0, 20);
}

export function computeCompanyIntel(state, companyId) {
  const company = state.companies?.[companyId];
  const stock = state.stocks?.[companyId];
  if (!company || !stock) return null;

  const government = state.governments?.[company.country];
  const move = getDayMovePct(stock);
  const pressureBias = Number(stock.buyPressure ?? 0.5) - Number(stock.sellPressure ?? 0.5);
  const qualityScore = round(
    bounded(
      Number(company.kpis?.profitMargin ?? 0) * 180 +
        Number(company.kpis?.growth ?? 0) * 260 +
        Number(company.innovation ?? 0) * 22 +
        Number(company.reputation ?? 0) * 16 +
        Number(company.aiCapability ?? 0) * 16,
      0,
      100
    ),
    2
  );
  const momentumScore = round(
    bounded(scoreFromRange(move, -0.08, 0.08) * 0.6 + scoreFromRange(pressureBias, -0.4, 0.4) * 0.25 + scoreFromRange(Number(stock.newsMomentum ?? 0), -1, 1) * 0.15, 0, 100),
    2
  );
  const resilienceScore = round(
    bounded(
      Number(stock.stability ?? 0) * 35 +
        (1 - Number(company.kpis?.debtRatio ?? 0)) * 22 +
        (1 - Number(company.supplyRisk ?? 0)) * 25 +
        Number(government?.stability ?? 0.65) * 18,
      0,
      100
    ),
    2
  );
  const valuationScore = round(
    bounded(
      scoreFromRange(32 - Math.min(32, Math.abs(Number(stock.peRatio ?? 18) - 18)), 0, 32) * 0.7 +
        scoreFromRange(Number(stock.dividendYield ?? 0), 0, 0.06) * 0.3,
      0,
      100
    ),
    2
  );
  const riskScore = round(
    bounded(
      Number(company.supplyRisk ?? 0) * 32 +
        Number(company.kpis?.debtRatio ?? 0) * 20 +
        Number(state.geopolitics?.tension ?? 0) * 18 +
        Number(stock.shortInterest ?? 0) * 24 +
        (1 - Number(stock.stability ?? 0.5)) * 20,
      0,
      100
    ),
    2
  );
  const compositeScore = round(qualityScore * 0.34 + momentumScore * 0.22 + resilienceScore * 0.24 + valuationScore * 0.2, 2);
  const signals = [];
  if (qualityScore >= 70) signals.push("Strong quality profile with healthy growth and margins.");
  if (momentumScore >= 65) signals.push("Positive price momentum and order flow are supporting the tape.");
  if (resilienceScore >= 70) signals.push("Operational resilience remains high relative to the current macro backdrop.");
  if (riskScore >= 60) signals.push("Risk is elevated from leverage, short interest, or supply exposure.");
  if (move <= -0.04 && pressureBias > 0) signals.push("Dip-buying conditions are appearing despite the drawdown.");
  if (!signals.length) signals.push("Balanced profile with no single dominant catalyst right now.");

  return {
    compositeScore,
    qualityScore,
    momentumScore,
    resilienceScore,
    valuationScore,
    riskScore,
    riskLevel: riskScore >= 70 ? "High" : riskScore >= 45 ? "Moderate" : "Low",
    dayMovePct: round(move * 100, 2),
    pressureBiasPct: round(pressureBias * 100, 2),
    signals: signals.slice(0, 3)
  };
}

export function refreshMarketAnalytics(state) {
  ensureAnalyticsState(state);
  state.leaderboards.sectors = buildSectorAndCountryRankings(state, "sector");
  state.leaderboards.countries = buildSectorAndCountryRankings(state, "country");
  state.analytics.supplyRisk = computeSupplyRisk(state);
  state.analytics.alerts = computeAlerts(state, state.analytics.supplyRisk);

  const listedStocks = Object.values(state.stocks ?? {}).filter((stock) => stock?.listed);
  const advancers = listedStocks.filter((stock) => getDayMovePct(stock) >= 0).length;
  const decliners = Math.max(0, listedStocks.length - advancers);
  const averageMovePct = listedStocks.length ? average(listedStocks.map((stock) => getDayMovePct(stock))) * 100 : 0;
  state.analytics.market = {
    advancers,
    decliners,
    averageMovePct: round(averageMovePct, 2),
    alertCount: state.analytics.alerts.length
  };
}
