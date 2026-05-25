const PROGRAM_MODULES = [
  {
    id: "trading",
    name: "Trading",
    objective: "Execution quality, order intelligence, and multi-style trading workflows.",
    uiPages: ["trading", "trade-flow", "markets"],
    apiPrefix: "/api/order",
    dataEntities: ["orders", "fills", "executionMetrics"],
    features: [
      "Adaptive order routing",
      "Smart limit laddering",
      "Slippage budget controls",
      "Session-aware execution windows",
      "Liquidity sweep detector",
      "Spread compression monitor",
      "Execution replay timeline",
      "Position heat controls",
      "Trade intent tagging",
      "Auto scale-out plans",
      "Entry checklist templates",
      "Execution anomaly alerts"
    ]
  },
  {
    id: "risk",
    name: "Risk",
    objective: "Proactive risk controls and stress-aware guardrails.",
    uiPages: ["markets", "portfolio", "control"],
    apiPrefix: "/api/risk",
    dataEntities: ["riskBudgets", "limits", "stressSignals"],
    features: [
      "Dynamic VaR envelope",
      "Drawdown circuit breakers",
      "Concentration risk caps",
      "Sector exposure throttles",
      "Country exposure throttles",
      "Leverage stress tracker",
      "Gap risk warning model",
      "Volatility clustering alerts",
      "Stop quality diagnostics",
      "Tail event rehearsal packs",
      "Risk budget rebalancer",
      "Risk score explainability"
    ]
  },
  {
    id: "portfolio",
    name: "Portfolio",
    objective: "Allocation controls, holdings intelligence, and portfolio automation.",
    uiPages: ["portfolio", "trading", "markets"],
    apiPrefix: "/api/portfolio",
    dataEntities: ["allocations", "positions", "rebalancePlans"],
    features: [
      "Goal-based allocation presets",
      "Net/gross exposure ladder",
      "Cash efficiency optimizer",
      "Tax lot grouping simulation",
      "Portfolio drift alerts",
      "Auto rebalance schedules",
      "Hedge overlay planner",
      "Benchmark-relative tracking",
      "Position conviction registry",
      "Cost basis diagnostics",
      "Turnover impact forecasts",
      "Portfolio what-if matrix"
    ]
  },
  {
    id: "analytics",
    name: "Analytics",
    objective: "Cross-market analytics, diagnostics, and explainable scoring.",
    uiPages: ["markets", "economy", "portfolio"],
    apiPrefix: "/api/analytics",
    dataEntities: ["scores", "factors", "diagnostics"],
    features: [
      "Factor attribution engine",
      "Signal decay monitor",
      "Regime classifier upgrades",
      "Breadth health indices",
      "Liquidity quality scoring",
      "Narrative impact scoring",
      "Forward scenario analytics",
      "Cross-asset correlation deck",
      "Alpha source breakdown",
      "Explainable ranking outputs",
      "Outlier scanner",
      "Performance variance map"
    ]
  },
  {
    id: "news-sentiment",
    name: "News & Sentiment",
    objective: "Headline intelligence, sentiment state tracking, and event reaction controls.",
    uiPages: ["trading", "markets", "economy"],
    apiPrefix: "/api/news",
    dataEntities: ["headlines", "sentimentStates", "eventImpacts"],
    features: [
      "Headline confidence scoring",
      "Narrative cluster detection",
      "Sentiment regime transitions",
      "Event half-life estimation",
      "Shock propagation graph",
      "Contradictory narrative detector",
      "Headline-to-sector mapper",
      "Crowd mood pulse",
      "Rumor risk tags",
      "False breakout narrative filter",
      "Sentiment momentum panel",
      "Event playbook suggestions"
    ]
  },
  {
    id: "macro-policy",
    name: "Macro Policy",
    objective: "Policy-aware macro simulation with structured intervention workflows.",
    uiPages: ["economy", "markets", "strategy-lab"],
    apiPrefix: "/api/macro",
    dataEntities: ["policyActions", "macroSeries", "interventionOutcomes"],
    features: [
      "Rate path simulation bands",
      "Fiscal impulse planner",
      "Trade barrier scenarios",
      "Commodity shock interventions",
      "Policy lag tracker",
      "Inflation persistence monitor",
      "Labor stress index",
      "Sovereign stress simulator",
      "Cross-country policy matrix",
      "Regulatory drift tracker",
      "Policy confidence score",
      "Macro stabilization dashboard"
    ]
  },
  {
    id: "scenario-lab",
    name: "Scenario Lab",
    objective: "Deterministic multi-stage scenario orchestration and diagnostics.",
    uiPages: ["strategy-lab", "economy", "markets"],
    apiPrefix: "/api/scenario",
    dataEntities: ["scenarioRuns", "scenarioTemplates", "replayArtifacts"],
    features: [
      "Multi-stage scenario chains",
      "Branching trigger conditions",
      "Scenario baseline snapshots",
      "Recovery trajectory scoring",
      "Scenario stress heatmaps",
      "Replay with checkpoint pins",
      "Batch scenario runner",
      "Scenario benchmark packs",
      "Scenario drift detection",
      "Path dependency analyzer",
      "Cross-scenario compare view",
      "Scenario acceptance gates"
    ]
  },
  {
    id: "api-security",
    name: "API & Security",
    objective: "Service hardening, policy controls, and safer API operations.",
    uiPages: ["program"],
    apiPrefix: "/api",
    dataEntities: ["authPolicies", "rateLimits", "auditLogs"],
    features: [
      "Bearer token admin guard",
      "Request rate limiter",
      "Input schema sanitization",
      "Per-route error envelopes",
      "Security policy endpoint",
      "Audit event registry",
      "Replay-attack resistant ids",
      "Malformed payload quarantine",
      "Sensitive route hardening",
      "Access telemetry counters",
      "Operational security checklist",
      "Incident readiness guide"
    ]
  },
  {
    id: "realtime-ui",
    name: "Realtime UI",
    objective: "High-density realtime interfaces for market and program operations.",
    uiPages: ["trading", "markets", "economy", "portfolio", "program"],
    apiPrefix: "/api/stream",
    dataEntities: ["uiPanels", "viewModels", "liveWidgets"],
    features: [
      "Program operations page",
      "Realtime metric badges",
      "Feature backlog explorer",
      "Milestone progress board",
      "Environment blueprint panel",
      "SSE status telemetry strip",
      "Filterable contract table",
      "Module progress heatcards",
      "Risk and ops cross-links",
      "Compact mobile fallback views",
      "Realtime endpoint health cards",
      "Program query UX helpers"
    ]
  },
  {
    id: "ops-admin",
    name: "Ops & Admin",
    objective: "Operational controls, observability, and release governance.",
    uiPages: ["program"],
    apiPrefix: "/api/admin",
    dataEntities: ["milestones", "releaseChecks", "opsMetrics"],
    features: [
      "Phase gate registry",
      "Release readiness score",
      "Rollback-safe checkpoint policy",
      "Environment parity checks",
      "SLO indicator card",
      "Error budget monitor",
      "Operational incident logs",
      "Admin feature status updates",
      "Milestone approval workflow",
      "Deployment topology metadata",
      "Runtime compatibility matrix",
      "Ops review digest"
    ]
  }
];

const PHASES = ["phase-1", "phase-2", "phase-3", "phase-4", "phase-5"];
const STATUSES = ["planned", "in-progress", "review", "complete", "blocked"];
const NO_COURSES_PATTERN = /\b(academy|course|lesson|curriculum|syllabus|tutorial)\b/i;

const ENVIRONMENT_BLUEPRINT = {
  target: "dev/staging/prod",
  runtime: {
    node: ">=20",
    http: "node:http",
    moduleSystem: "ESM",
    tickLoop: "1s realtime deterministic simulation"
  },
  configStrategy: {
    sourceOfTruth: "Environment variables with safe defaults",
    precedence: ["process.env", "application defaults"],
    requiredInProduction: ["ADMIN_BEARER_TOKEN"],
    optional: ["PORT", "RATE_LIMIT_WINDOW_MS", "RATE_LIMIT_MAX", "LOG_LEVEL"]
  },
  secretsHandling: {
    approach: "Token-only secret handling via environment variables",
    persistence: "No secret persistence in checkpoints",
    masking: "Never return token values in API responses"
  },
  logging: {
    format: "JSON-like structured log events",
    levels: ["debug", "info", "warn", "error"],
    fields: ["timestamp", "level", "message", "requestId", "path", "method"]
  },
  deployment: {
    model: "Single-node stateless HTTP/SSE server + checkpoint persistence",
    topology: ["dev-local", "staging-single-node", "prod-single-node"],
    rollback: "Checkpoint restore + redeploy previous build"
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeSlug(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function hasCourseLanguage(content) {
  return NO_COURSES_PATTERN.test(String(content ?? ""));
}

function getPhaseForFeature(index) {
  return PHASES[index % PHASES.length];
}

function buildAcceptanceCriteria(module, featureName, phase, featureId) {
  return [
    `API contract for ${featureId} returns deterministic output for equivalent snapshots.`,
    `${module.name} UI surfaces (${module.uiPages.join(", ")}) expose the ${featureName.toLowerCase()} state.`,
    `Data model updates for ${featureName.toLowerCase()} are persisted or recomputed safely each tick.`,
    `Validation checks enforce no-course policy language and route-safe payload handling.`,
    `${phase} gate includes regression checks and no unresolved critical security findings.`
  ];
}

function buildFeatureContracts() {
  const contracts = [];
  PROGRAM_MODULES.forEach((module) => {
    module.features.forEach((featureName, featureIndex) => {
      const featureId = `${module.id}-f${String(featureIndex + 1).padStart(2, "0")}`;
      const phase = getPhaseForFeature(featureIndex);
      const routePath = `${module.apiPrefix}/${sanitizeSlug(featureName)}`;
      const contract = {
        featureId,
        moduleId: module.id,
        moduleName: module.name,
        title: featureName,
        phase,
        status: "planned",
        apiSpec: {
          method: "GET",
          path: routePath,
          requestSchema: {
            type: "object",
            properties: {
              tick: { type: "number" },
              companyId: { type: "string" },
              filters: { type: "object" }
            }
          },
          responseSchema: {
            type: "object",
            properties: {
              featureId: { type: "string" },
              moduleId: { type: "string" },
              status: { type: "string" },
              diagnostics: { type: "object" }
            }
          }
        },
        uiImpact: {
          pages: module.uiPages,
          widgets: [
            `${module.id}-summary-card`,
            `${module.id}-trend-widget`,
            `${module.id}-status-pill`
          ],
          realtime: true
        },
        dataModelChanges: {
          entities: module.dataEntities,
          derivedMetrics: [
            `${sanitizeSlug(featureName)}-score`,
            `${sanitizeSlug(featureName)}-confidence`,
            `${sanitizeSlug(featureName)}-latency`
          ],
          checkpointImpact: "non-breaking additive fields"
        },
        acceptanceCriteria: buildAcceptanceCriteria(module, featureName, phase, featureId)
      };
      if (hasCourseLanguage(`${contract.title} ${contract.moduleName}`)) {
        throw new Error(`No-courses policy violation in feature contract: ${contract.featureId}`);
      }
      contracts.push(contract);
    });
  });
  return contracts;
}

export const PROGRAM_FEATURE_CONTRACTS = Object.freeze(buildFeatureContracts());

export function listProgramModules() {
  return PROGRAM_MODULES.map((module) => ({
    id: module.id,
    name: module.name,
    objective: module.objective,
    apiPrefix: module.apiPrefix,
    uiPages: module.uiPages.slice(),
    dataEntities: module.dataEntities.slice(),
    featureCount: module.features.length
  }));
}

export function listProgramFeatureContracts({ moduleId, phase, status, limit = 200, search } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit || 200)));
  const searchText = String(search ?? "").trim().toLowerCase();
  const expectedModule = moduleId ? String(moduleId) : null;
  const expectedPhase = phase ? String(phase).toLowerCase() : null;
  const expectedStatus = status ? String(status).toLowerCase() : null;

  return PROGRAM_FEATURE_CONTRACTS.filter((contract) => {
    if (expectedModule && contract.moduleId !== expectedModule) return false;
    if (expectedPhase && contract.phase !== expectedPhase) return false;
    if (expectedStatus && contract.status !== expectedStatus) return false;
    if (!searchText) return true;
    return (
      contract.title.toLowerCase().includes(searchText) ||
      contract.moduleName.toLowerCase().includes(searchText) ||
      contract.featureId.toLowerCase().includes(searchText)
    );
  })
    .slice(0, normalizedLimit)
    .map((contract) => clone(contract));
}

export function getProgramFeatureContractById(featureId) {
  const id = String(featureId ?? "");
  const contract = PROGRAM_FEATURE_CONTRACTS.find((item) => item.featureId === id);
  return contract ? clone(contract) : null;
}

export function getProgramMilestones() {
  return [
    {
      id: "phase-1",
      name: "Phase 1 · Foundations",
      focus: "Contract model, environment blueprint, policy rules, and API baseline.",
      moduleIds: ["api-security", "ops-admin", "realtime-ui", "trading", "risk"],
      gates: ["No-courses policy active", "Program APIs available", "Baseline tests green"]
    },
    {
      id: "phase-2",
      name: "Phase 2 · Core Engine Expansion",
      focus: "Backend expansion for trading/risk/portfolio and deterministic analytics.",
      moduleIds: ["trading", "risk", "portfolio", "analytics"],
      gates: ["Deterministic outputs preserved", "Snapshot compatibility retained", "Regression tests expanded"]
    },
    {
      id: "phase-3",
      name: "Phase 3 · Macro + Scenario",
      focus: "Macro policy controls, scenario orchestration, and stress diagnostics.",
      moduleIds: ["macro-policy", "scenario-lab", "news-sentiment"],
      gates: ["Scenario replay stable", "Macro diagnostics visible", "Event response validated"]
    },
    {
      id: "phase-4",
      name: "Phase 4 · Realtime UI + Ops",
      focus: "Realtime dashboards, status boards, and milestone governance workflows.",
      moduleIds: ["realtime-ui", "ops-admin", "analytics", "portfolio"],
      gates: ["Program UI responsive", "Health metrics visible", "Operational checklists complete"]
    },
    {
      id: "phase-5",
      name: "Phase 5 · Hardening + Release",
      focus: "Security hardening, performance guardrails, and release readiness validation.",
      moduleIds: ["api-security", "ops-admin", "risk", "trading", "portfolio"],
      gates: ["Rate limit + auth policies active", "Error budget acceptable", "Release checklist approved"]
    }
  ].map((milestone) => clone(milestone));
}

export function getProgramNoCoursesPolicy() {
  return {
    enabled: true,
    description: "Academy/course/lesson features are excluded from this expansion backlog.",
    blockedTerms: ["academy", "course", "lesson", "curriculum", "syllabus", "tutorial"]
  };
}

export function getProgramEnvironmentBlueprint() {
  return clone(ENVIRONMENT_BLUEPRINT);
}

export function getProgramOverview() {
  const modules = listProgramModules();
  const phaseBreakdown = Object.fromEntries(PHASES.map((phase) => [phase, 0]));
  const statusBreakdown = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const moduleBreakdown = Object.fromEntries(modules.map((module) => [module.id, 0]));
  PROGRAM_FEATURE_CONTRACTS.forEach((feature) => {
    phaseBreakdown[feature.phase] = (phaseBreakdown[feature.phase] ?? 0) + 1;
    statusBreakdown[feature.status] = (statusBreakdown[feature.status] ?? 0) + 1;
    moduleBreakdown[feature.moduleId] = (moduleBreakdown[feature.moduleId] ?? 0) + 1;
  });
  return {
    totalModules: modules.length,
    totalFeatures: PROGRAM_FEATURE_CONTRACTS.length,
    modules,
    phaseBreakdown,
    statusBreakdown,
    moduleBreakdown,
    milestones: getProgramMilestones(),
    noCoursesPolicy: getProgramNoCoursesPolicy()
  };
}

export function getProgramHealth({ requestCount = 0, streamClientCount = 0, uptimeMs = 0, rateLimitedCount = 0, errorCount = 0 } = {}) {
  return {
    requestCount: Number(requestCount),
    streamClientCount: Number(streamClientCount),
    rateLimitedCount: Number(rateLimitedCount),
    errorCount: Number(errorCount),
    uptimeMs: Number(uptimeMs),
    uptimeSeconds: Number((Number(uptimeMs) / 1000).toFixed(3)),
    featureContracts: PROGRAM_FEATURE_CONTRACTS.length,
    modules: PROGRAM_MODULES.length,
    noCoursesPolicyEnabled: true
  };
}
