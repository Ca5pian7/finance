import { ACADEMY_LESSONS } from "./academy-lessons.js";

const STRATEGY_PLAYBOOKS = [
  {
    id: "momentum-breakout",
    name: "Momentum Breakout",
    style: "trend",
    riskLevel: "medium",
    description: "Targets acceleration names with rising buy pressure and expanding day range.",
    entryRules: ["Day move above +1.2%", "Buy pressure above 0.58", "Stability above 0.42"],
    exitRules: ["Take profit at +2.2R", "Hard stop at -1R", "Time stop at horizon end"],
    sizingModel: "volatility-adjusted"
  },
  {
    id: "mean-reversion-dip",
    name: "Mean Reversion Dip",
    style: "reversion",
    riskLevel: "medium",
    description: "Buys controlled pullbacks when demand improves into support.",
    entryRules: ["Day move below -0.9%", "Buy pressure exceeds sell pressure", "Support distance below 2.4%"],
    exitRules: ["Scale out into day open", "Stop below support extension", "Abort during high systemic stress"],
    sizingModel: "support-distance"
  },
  {
    id: "quality-compounder",
    name: "Quality Compounder",
    style: "fundamental",
    riskLevel: "low",
    description: "Overweights high stability and quality profiles with strong margin structure.",
    entryRules: ["Stability above 0.66", "Positive growth and margin", "Risk score regime below caution"],
    exitRules: ["Trim when momentum collapses", "Rotate if macro turns hostile", "Rebalance weekly"],
    sizingModel: "risk-budget"
  },
  {
    id: "volatility-carry",
    name: "Volatility Carry",
    style: "market-neutral",
    riskLevel: "high",
    description: "Harvests spread between extreme panic and stable leaders while capping tail risk.",
    entryRules: ["Dispersion above threshold", "At least one stable and one risky candidate", "Liquidity depth available"],
    exitRules: ["Converge at target spread", "Cut if spread widens beyond guardrail", "Reduce leverage during macro shocks"],
    sizingModel: "pair-risk"
  },
  {
    id: "event-drive-news",
    name: "Event Drive News",
    style: "event",
    riskLevel: "high",
    description: "Responds to geopolitical, macro, and supply headlines with sector-aware tilts.",
    entryRules: ["Fresh headline impact score above threshold", "Sector elasticity map confirms edge", "Systemic alert severity managed"],
    exitRules: ["Close when headline half-life decays", "Lock gains on adverse reversal", "Neutralize before regime flips"],
    sizingModel: "headline-confidence"
  },
  {
    id: "float-squeeze",
    name: "Float Squeeze",
    style: "flow",
    riskLevel: "high",
    description: "Screens for tight public float and fast pressure shifts that trigger outsized moves.",
    entryRules: ["Float control ratio elevated", "Buy pressure impulse rising", "Short interest supportive"],
    exitRules: ["Scale exits into acceleration", "Protect on failed continuation", "Never hold through structural break"],
    sizingModel: "float-sensitive"
  },
  {
    id: "sector-rotation",
    name: "Sector Rotation",
    style: "allocation",
    riskLevel: "medium",
    description: "Rotates capital into leading sectors and out of deteriorating groups.",
    entryRules: ["Sector composite rank top quartile", "Country breadth confirms", "Regime not deeply bearish"],
    exitRules: ["Drop below rank threshold", "Relative momentum rollover", "Systemic risk breach"],
    sizingModel: "rank-weighted"
  },
  {
    id: "liquidity-defense",
    name: "Liquidity Defense",
    style: "defensive",
    riskLevel: "low",
    description: "Prioritizes resilient names while macro and financial stress rises.",
    entryRules: ["Banking/credit stress elevated", "Stability and quality screens pass", "Downside beta controlled"],
    exitRules: ["Stress normalization", "Opportunity cost threshold", "Trailing stop breach"],
    sizingModel: "stress-aware"
  },
  {
    id: "nasdaq-trend",
    name: "NASDAQ Trend Rider",
    style: "index",
    riskLevel: "medium",
    description: "Aligns stock selection with NASDAQ100 trend strength and breadth.",
    entryRules: ["NASDAQ100 trend positive", "Breadth above 55%", "Candidate momentum confirms"],
    exitRules: ["Index trend breakdown", "Breadth collapse", "Risk cap hit"],
    sizingModel: "index-confirmed"
  },
  {
    id: "support-defense",
    name: "Support Defense",
    style: "technical",
    riskLevel: "medium",
    description: "Trades near support with strict invalidation and controlled rebound targets.",
    entryRules: ["Price near support", "Support strength above 0.6", "Buy pressure recovering"],
    exitRules: ["Breakdown below support", "Target at mid-range/resistance", "Time stop"],
    sizingModel: "distance-to-support"
  },
  {
    id: "resistance-break",
    name: "Resistance Break Continuation",
    style: "technical",
    riskLevel: "high",
    description: "Captures continuation after validated resistance breaks with pressure confirmation.",
    entryRules: ["Price closes above resistance", "Resistance break pressure exceeded", "Volume expansion"],
    exitRules: ["Failure back below breakout", "Partial at +1.5R", "Trail remainder"],
    sizingModel: "breakout-vol"
  },
  {
    id: "balanced-blend",
    name: "Balanced Multi-Factor Blend",
    style: "multi-factor",
    riskLevel: "medium",
    description: "Combines quality, momentum, valuation sanity, and risk controls for broad robustness.",
    entryRules: ["Composite score above threshold", "Risk score acceptable", "Macro filter passed"],
    exitRules: ["Composite decay", "Macro violation", "Portfolio drawdown rule"],
    sizingModel: "factor-budget"
  }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function avg(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + safeNumber(v), 0) / values.length;
}

function stddev(values) {
  if (!Array.isArray(values) || values.length <= 1) return 0;
  const mean = avg(values);
  const variance = avg(values.map((v) => (safeNumber(v) - mean) ** 2));
  return Math.sqrt(variance);
}

function getDayMovePct(stock) {
  const last = safeNumber(stock?.lastPrice, 0);
  const open = safeNumber(stock?.dayOpenPrice, last);
  if (!open) return 0;
  return (last - open) / open;
}

function getVolatilityScore(stock) {
  const closes = (stock?.candles ?? []).slice(-60).map((c) => safeNumber(c?.close));
  if (closes.length < 2) return 0.1;
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return clamp(stddev(returns) * 25, 0.02, 1.5);
}

function getMarketStress(state) {
  const inflation = safeNumber(state?.macro?.inflation, 0.03);
  const unemployment = safeNumber(state?.macro?.unemployment, 0.05);
  const tension = safeNumber(state?.geopolitics?.tension, 0.15);
  const pressure = safeNumber(state?.supplyChains?.pressure, 0.2);
  const bankingStress = safeNumber(state?.financialSystem?.bankingStress ?? state?.financial?.bankingStress, 0.2);
  return clamp(inflation * 1.4 + unemployment * 0.9 + tension * 1.1 + pressure + bankingStress * 1.2, 0, 2.5);
}

function computeOpportunityScore(state, stock) {
  const move = getDayMovePct(stock);
  const stability = clamp(safeNumber(stock?.stability, 0.5), 0, 1);
  const buyPressure = clamp(safeNumber(stock?.buyPressure, 0.5), 0, 1);
  const sellPressure = clamp(safeNumber(stock?.sellPressure, 0.5), 0, 1);
  const volatility = getVolatilityScore(stock);
  const pressureEdge = buyPressure - sellPressure;
  const marketStress = getMarketStress(state);
  const stressPenalty = clamp(marketStress * 0.2, 0, 0.4);
  const raw = pressureEdge * 36 + move * 420 + stability * 18 - volatility * 9 - stressPenalty * 28;
  return clamp(raw, -100, 100);
}

function computeRiskScore(state, stock) {
  const stability = clamp(safeNumber(stock?.stability, 0.5), 0, 1);
  const volatility = getVolatilityScore(stock);
  const stress = getMarketStress(state);
  const supportStrength = clamp(safeNumber(stock?.supportStrength, 0.7), 0, 1);
  const resistanceStrength = clamp(safeNumber(stock?.resistanceStrength, 0.7), 0, 1);
  const directionalImbalance = Math.abs(safeNumber(stock?.buyPressure, 0.5) - safeNumber(stock?.sellPressure, 0.5));
  const fragility = (1 - stability) * 38 + volatility * 26 + stress * 15 + (1 - Math.min(supportStrength, resistanceStrength)) * 18 + directionalImbalance * 8;
  return clamp(fragility, 0, 100);
}

function selectStocks(state, companyIds = []) {
  const all = Array.isArray(state?.stocks) ? state.stocks.slice() : [];
  if (!companyIds?.length) return all;
  const wanted = new Set(companyIds.map((id) => String(id)));
  return all.filter((s) => wanted.has(String(s.companyId)));
}

function summarizeRegime(state) {
  const sentiment = safeNumber(state?.sentiment, 0);
  const stress = getMarketStress(state);
  const regime = String(state?.marketRegime ?? "stable").toLowerCase();
  const bullish = sentiment > 0.04 && stress < 0.9;
  const bearish = sentiment < -0.04 || stress > 1.3 || regime === "down";
  if (bullish) return "bullish";
  if (bearish) return "defensive";
  return "balanced";
}

export function listStrategyPlaybooks() {
  return STRATEGY_PLAYBOOKS.map((playbook) => ({ ...playbook }));
}

function evaluatePlaybookOnStock(state, playbook, stock, horizonTicks) {
  const opportunity = computeOpportunityScore(state, stock);
  const risk = computeRiskScore(state, stock);
  const volatility = getVolatilityScore(stock);
  const baseMove = getDayMovePct(stock);
  const regime = summarizeRegime(state);

  let styleTilt = 0;
  if (playbook.style === "trend") styleTilt += opportunity * 0.22;
  if (playbook.style === "reversion") styleTilt += -baseMove * 160 + (opportunity > 0 ? 8 : -8);
  if (playbook.style === "fundamental") styleTilt += (safeNumber(stock?.stability, 0.5) - volatility * 0.18) * 30;
  if (playbook.style === "market-neutral") styleTilt += (Math.abs(opportunity) > 25 ? 10 : -6) - risk * 0.08;
  if (playbook.style === "event") styleTilt += (state?.headlines?.length ?? 0) * 0.6 - risk * 0.06;
  if (playbook.style === "flow") styleTilt += safeNumber(stock?.shortInterest, 0.03) * 220 + opportunity * 0.14;
  if (playbook.style === "allocation") styleTilt += (state?.leaderboards?.sectors?.length ?? 0) * 0.3 + opportunity * 0.08;
  if (playbook.style === "defensive") styleTilt += (1 - volatility) * 18 - risk * 0.09;
  if (playbook.style === "index") styleTilt += safeNumber(state?.indexes?.NASDAQ100?.changePct, 0) * 0.7 + opportunity * 0.12;
  if (playbook.style === "technical") styleTilt += opportunity * 0.17 + (safeNumber(stock?.supportStrength, 0.7) + safeNumber(stock?.resistanceStrength, 0.7)) * 8;
  if (playbook.style === "multi-factor") styleTilt += opportunity * 0.12 - risk * 0.05 + safeNumber(stock?.stability, 0.5) * 12;

  if (regime === "bullish") styleTilt += 4;
  if (regime === "defensive") styleTilt -= 5;

  const horizonBoost = clamp(horizonTicks / 90, 0.4, 2.4);
  const expectancyPct = clamp((styleTilt + opportunity * 0.1 - risk * 0.05) * 0.06 * horizonBoost, -0.4, 0.6);
  const drawdownPct = clamp((risk * 0.004 + volatility * 0.07) * (0.7 + horizonBoost * 0.3), 0.01, 0.55);
  const confidence = clamp(100 - risk + Math.max(0, opportunity) * 0.35 - volatility * 8, 5, 98);

  return {
    companyId: stock.companyId,
    ticker: stock.ticker,
    companyName: stock.companyName,
    lastPrice: safeNumber(stock.lastPrice),
    opportunityScore: Number(opportunity.toFixed(2)),
    riskScore: Number(risk.toFixed(2)),
    volatilityScore: Number(volatility.toFixed(4)),
    expectedReturnPct: Number((expectancyPct * 100).toFixed(2)),
    expectedDrawdownPct: Number((drawdownPct * 100).toFixed(2)),
    confidencePct: Number(confidence.toFixed(2)),
    horizonTicks
  };
}

function rankBacktestRows(rows) {
  return rows
    .map((row) => ({
      ...row,
      score: Number((row.expectedReturnPct * 1.35 - row.expectedDrawdownPct * 0.85 + row.confidencePct * 0.45).toFixed(2))
    }))
    .sort((a, b) => b.score - a.score);
}

function simulateCapitalCurve(rows, capital) {
  let value = safeNumber(capital, 1_000_000);
  const curve = [];
  rows.slice(0, 10).forEach((row, index) => {
    const positionBudget = value * clamp(row.confidencePct / 400, 0.08, 0.24);
    const pnl = positionBudget * (row.expectedReturnPct / 100);
    value += pnl;
    curve.push({
      step: index + 1,
      ticker: row.ticker,
      allocation: Number(positionBudget.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      equity: Number(value.toFixed(2))
    });
  });
  return {
    startingCapital: Number(capital.toFixed(2)),
    endingCapital: Number(value.toFixed(2)),
    totalReturnPct: Number((((value - capital) / Math.max(1, capital)) * 100).toFixed(2)),
    curve
  };
}

export function runStrategyBacktest(state, request = {}) {
  const playbookId = String(request.playbookId ?? "momentum-breakout");
  const horizonTicks = clamp(Math.round(safeNumber(request.horizonTicks, 60)), 5, 720);
  const capital = clamp(safeNumber(request.capital, 10_000_000), 10_000, 5_000_000_000_000);
  const selectedIds = Array.isArray(request.companyIds) ? request.companyIds.map((id) => String(id)) : [];

  const playbook = STRATEGY_PLAYBOOKS.find((item) => item.id === playbookId);
  if (!playbook) throw new Error(`Unknown strategy playbook: ${playbookId}`);

  const stocks = selectStocks(state, selectedIds);
  if (!stocks.length) throw new Error("No stocks available for backtest");

  const evaluated = stocks.map((stock) => evaluatePlaybookOnStock(state, playbook, stock, horizonTicks));
  const ranked = rankBacktestRows(evaluated);
  const top = ranked.slice(0, 20);
  const worst = ranked.slice(-5).reverse();
  const stats = {
    avgReturnPct: Number(avg(top.map((row) => row.expectedReturnPct)).toFixed(2)),
    avgDrawdownPct: Number(avg(top.map((row) => row.expectedDrawdownPct)).toFixed(2)),
    avgConfidencePct: Number(avg(top.map((row) => row.confidencePct)).toFixed(2)),
    winProbabilityPct: Number(clamp(50 + avg(top.map((row) => row.score)) * 0.25, 5, 95).toFixed(2)),
    volatilityDispersion: Number(stddev(top.map((row) => row.expectedReturnPct)).toFixed(2))
  };

  const capitalCurve = simulateCapitalCurve(top, capital);

  return {
    requestedAt: new Date().toISOString(),
    playbook: { ...playbook },
    horizonTicks,
    evaluatedCount: ranked.length,
    regime: summarizeRegime(state),
    marketStress: Number(getMarketStress(state).toFixed(3)),
    stats,
    topCandidates: top,
    riskTail: worst,
    capitalCurve
  };
}

export function buildMissionBoard(state, options = {}) {
  const limit = clamp(Math.round(safeNumber(options.limit, 12)), 3, 40);
  const stocks = selectStocks(state).slice();
  const sortedByOpportunity = stocks
    .map((stock) => ({
      stock,
      opportunity: computeOpportunityScore(state, stock),
      risk: computeRiskScore(state, stock),
      dayMove: getDayMovePct(stock)
    }))
    .sort((a, b) => b.opportunity - a.opportunity);

  const alerts = Array.isArray(state?.alerts) ? state.alerts : [];
  const macro = state?.macro ?? {};
  const regime = summarizeRegime(state);

  const missions = [];

  sortedByOpportunity.slice(0, limit).forEach((entry, index) => {
    const { stock, opportunity, risk, dayMove } = entry;
    const missionType =
      opportunity >= 35 ? "momentum" : opportunity >= 12 ? "continuation" : opportunity <= -20 ? "mean-reversion" : "watch";

    const riskBudgetPct = clamp(8 + (60 - risk) * 0.18, 2, 22);
    const holdTicks = clamp(20 + Math.round((Math.abs(opportunity) + 15) * 0.9), 12, 220);

    missions.push({
      id: `mission-${state?.tick ?? 0}-${index + 1}-${stock.companyId}`,
      type: missionType,
      priority: clamp(Math.round(Math.abs(opportunity) + (100 - risk) * 0.4), 1, 100),
      companyId: stock.companyId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      thesis: `${stock.ticker} setup: opportunity ${opportunity.toFixed(1)} with risk ${risk.toFixed(1)} in ${regime} regime.`,
      setup: {
        entry: `Watch around $${safeNumber(stock.lastPrice).toFixed(4)} with pressure confirmation.`,
        stop: `Risk-off if move exceeds ${Math.max(1, risk * 0.08).toFixed(2)}% against thesis.`,
        target: `Primary objective ${Math.max(0.6, Math.abs(opportunity) * 0.08).toFixed(2)}% expected edge.`
      },
      constraints: {
        riskBudgetPct: Number(riskBudgetPct.toFixed(2)),
        holdTicks,
        maxSlippagePct: Number((0.08 + getVolatilityScore(stock) * 0.9).toFixed(2))
      },
      diagnostics: {
        dayMovePct: Number((dayMove * 100).toFixed(2)),
        opportunityScore: Number(opportunity.toFixed(2)),
        riskScore: Number(risk.toFixed(2)),
        stability: Number(safeNumber(stock.stability, 0.5).toFixed(3)),
        buyPressure: Number(safeNumber(stock.buyPressure, 0.5).toFixed(3)),
        sellPressure: Number(safeNumber(stock.sellPressure, 0.5).toFixed(3))
      }
    });
  });

  return {
    summary: {
      generatedAt: new Date().toISOString(),
      regime,
      stress: Number(getMarketStress(state).toFixed(3)),
      inflationPct: Number((safeNumber(macro.inflation) * 100).toFixed(2)),
      unemploymentPct: Number((safeNumber(macro.unemployment) * 100).toFixed(2)),
      headlineCount: Array.isArray(state?.headlines) ? state.headlines.length : 0,
      alertCount: alerts.length,
      criticalAlerts: alerts.filter((alert) => String(alert?.severity).toLowerCase() === "critical").length
    },
    missions
  };
}

function tracksFromLessons() {
  const grouped = new Map();
  for (const lesson of ACADEMY_LESSONS) {
    if (!grouped.has(lesson.trackId)) {
      grouped.set(lesson.trackId, {
        id: lesson.trackId,
        name: String(lesson.trackId)
          .replaceAll("-", " ")
          .replace(/\b\w/g, (m) => m.toUpperCase()),
        lessons: 0,
        totalMinutes: 0,
        avgWeight: 0,
        tags: new Set()
      });
    }
    const track = grouped.get(lesson.trackId);
    track.lessons += 1;
    track.totalMinutes += safeNumber(lesson.estimatedMinutes, 0);
    track.avgWeight += safeNumber(lesson.scoreWeight, 0);
    for (const tag of lesson.tags ?? []) track.tags.add(tag);
  }

  return Array.from(grouped.values()).map((track) => ({
    id: track.id,
    name: track.name,
    lessonCount: track.lessons,
    estimatedHours: Number((track.totalMinutes / 60).toFixed(1)),
    averageScoreWeight: Number((track.avgWeight / Math.max(1, track.lessons)).toFixed(2)),
    tags: Array.from(track.tags)
  }));
}

export function getAcademyCatalog() {
  return {
    generatedAt: new Date().toISOString(),
    tracks: tracksFromLessons(),
    lessons: ACADEMY_LESSONS.map((lesson) => ({ ...lesson }))
  };
}

export function getAcademySnapshot(state) {
  const catalog = getAcademyCatalog();
  const player = state?.player ?? {};
  const influence = safeNumber(player.influence, 0);
  const rank = safeNumber(player.rank, 0);
  const netWorth = safeNumber(player.netWorth, 0);
  const analytics = player.analytics ?? {};

  const estimatedMastery = clamp(
    influence * 45 +
      clamp(netWorth / 1_000_000_000_000, 0, 1) * 20 +
      clamp(safeNumber(analytics.winRate, 0) / 100, 0, 1) * 20 +
      clamp(safeNumber(analytics.positionsCount, 0) / 20, 0, 1) * 15,
    0,
    100
  );

  const suggestedTrackIds = catalog.tracks
    .slice()
    .sort((a, b) => b.averageScoreWeight - a.averageScoreWeight)
    .slice(0, 3)
    .map((track) => track.id);

  const lessonFocus = catalog.lessons
    .filter((lesson) => suggestedTrackIds.includes(lesson.trackId))
    .sort((a, b) => b.scoreWeight - a.scoreWeight)
    .slice(0, 15);

  return {
    summary: {
      estimatedMasteryPct: Number(estimatedMastery.toFixed(2)),
      currentRank: rank,
      netWorth,
      influence,
      suggestedTrackIds
    },
    tracks: catalog.tracks,
    featuredLessons: lessonFocus,
    totalLessons: catalog.lessons.length
  };
}

export function getInsightsBundle(state) {
  return {
    generatedAt: new Date().toISOString(),
    missionBoard: buildMissionBoard(state, { limit: 12 }),
    strategyPlaybooks: listStrategyPlaybooks(),
    academy: getAcademySnapshot(state)
  };
}
