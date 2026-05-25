import {
  listExpandedProgramCheckpoints,
  listExpandedProgramFeatures,
  listExpandedProgramModules,
  listExpandedProgramRunbooks
} from "./program-backlog.js";

const PHASES = ["phase-1", "phase-2", "phase-3", "phase-4", "phase-5"];
const STATUSES = ["planned", "in-progress", "review", "complete", "blocked"];
const NO_COURSES_PATTERN = /\b(academy|course|lesson|curriculum|syllabus|tutorial)\b/i;

const ENVIRONMENT_BLUEPRINT = {
  target: "dev/staging/prod",
  runtime: {
    node: ">=20",
    http: "node:http",
    moduleSystem: "ESM",
    tickLoop: "1s realtime deterministic simulation",
    recommendedCpu: "4 vCPU",
    recommendedMemory: "8GB"
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
    masking: "Never return token values in API responses",
    rotation: "Rotate admin token through deployment env updates"
  },
  logging: {
    format: "JSON-like structured log events",
    levels: ["debug", "info", "warn", "error"],
    fields: ["timestamp", "level", "message", "requestId", "path", "method", "latencyMs"]
  },
  deployment: {
    model: "Single-node stateless HTTP/SSE server + checkpoint persistence",
    topology: ["dev-local", "staging-single-node", "prod-single-node"],
    rollback: "Checkpoint restore + redeploy previous build",
    promotionFlow: ["dev", "staging", "prod"]
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateNoCourses(features) {
  for (const feature of features) {
    const payload = `${feature.title} ${feature.moduleName} ${(feature.acceptanceCriteria ?? []).join(" ")}`;
    if (NO_COURSES_PATTERN.test(payload)) {
      throw new Error(`No-courses policy violation in feature contract: ${feature.featureId}`);
    }
  }
}

const EXPANDED_MODULES = Object.freeze(listExpandedProgramModules());
const EXPANDED_FEATURES = Object.freeze(listExpandedProgramFeatures());
const EXPANDED_RUNBOOKS = Object.freeze(listExpandedProgramRunbooks());
const EXPANDED_CHECKPOINTS = Object.freeze(listExpandedProgramCheckpoints());

validateNoCourses(EXPANDED_FEATURES);

export const PROGRAM_FEATURE_CONTRACTS = EXPANDED_FEATURES;

export function listProgramModules() {
  return EXPANDED_MODULES.map((module) => ({
    id: module.id,
    name: module.name,
    objective: `Scaled delivery module for ${module.name} backlog execution and ops readiness.`,
    apiPrefix: module.apiPrefix,
    uiPages: module.uiPages.slice(),
    dataEntities: module.dataEntities.slice(),
    featureCount: module.featureCount
  }));
}

function normalizeFeature(feature) {
  return {
    ...clone(feature),
    objective: `${feature.title} advances ${feature.moduleName} outcomes under deterministic simulation constraints.`
  };
}

export function listProgramFeatureContracts({ moduleId, phase, status, limit = 200, search, batch, category } = {}) {
  const normalizedLimit = Math.max(1, Math.min(2000, Number(limit || 200)));
  const searchText = String(search ?? "").trim().toLowerCase();
  const expectedModule = moduleId ? String(moduleId) : null;
  const expectedPhase = phase ? String(phase).toLowerCase() : null;
  const expectedStatus = status ? String(status).toLowerCase() : null;
  const expectedBatch = batch ? Number(batch) : null;
  const expectedCategory = category ? String(category).toLowerCase() : null;

  return EXPANDED_FEATURES.filter((contract) => {
    if (expectedModule && contract.moduleId !== expectedModule) return false;
    if (expectedPhase && contract.phase !== expectedPhase) return false;
    if (expectedStatus && String(contract.status).toLowerCase() !== expectedStatus) return false;
    if (expectedBatch && Number(contract.batch) !== expectedBatch) return false;
    if (expectedCategory && String(contract.category).toLowerCase() !== expectedCategory) return false;
    if (!searchText) return true;
    return (
      contract.title.toLowerCase().includes(searchText) ||
      contract.moduleName.toLowerCase().includes(searchText) ||
      contract.featureId.toLowerCase().includes(searchText) ||
      String(contract.category).toLowerCase().includes(searchText)
    );
  })
    .slice(0, normalizedLimit)
    .map((contract) => normalizeFeature(contract));
}

export function getProgramFeatureContractById(featureId) {
  const id = String(featureId ?? "");
  const contract = EXPANDED_FEATURES.find((item) => item.featureId === id);
  return contract ? normalizeFeature(contract) : null;
}

export function getProgramMilestones() {
  return [
    {
      id: "phase-1",
      name: "Phase 1 · Foundations",
      focus: "Contract model, environment blueprint, policy rules, and API baseline.",
      moduleIds: ["api-security", "ops-admin", "realtime-ui", "trading", "risk"],
      gates: [
        "No-courses policy active",
        "Program APIs available",
        "Baseline tests green",
        "Backlog integrity checks passed"
      ]
    },
    {
      id: "phase-2",
      name: "Phase 2 · Core Engine Expansion",
      focus: "Backend expansion for trading/risk/portfolio and deterministic analytics.",
      moduleIds: ["trading", "risk", "portfolio", "analytics"],
      gates: [
        "Deterministic outputs preserved",
        "Snapshot compatibility retained",
        "Regression tests expanded",
        "Checkpoint rollback validated"
      ]
    },
    {
      id: "phase-3",
      name: "Phase 3 · Macro + Scenario",
      focus: "Macro policy controls, scenario orchestration, and stress diagnostics.",
      moduleIds: ["macro-policy", "scenario-lab", "news-sentiment"],
      gates: [
        "Scenario replay stable",
        "Macro diagnostics visible",
        "Event response validated",
        "Phase board metrics healthy"
      ]
    },
    {
      id: "phase-4",
      name: "Phase 4 · Realtime UI + Ops",
      focus: "Realtime dashboards, status boards, and milestone governance workflows.",
      moduleIds: ["realtime-ui", "ops-admin", "analytics", "portfolio"],
      gates: [
        "Program UI responsive",
        "Health metrics visible",
        "Operational checklists complete",
        "Runbook coverage at target"
      ]
    },
    {
      id: "phase-5",
      name: "Phase 5 · Hardening + Release",
      focus: "Security hardening, performance guardrails, and release readiness validation.",
      moduleIds: ["api-security", "ops-admin", "risk", "trading", "portfolio"],
      gates: [
        "Rate limit + auth policies active",
        "Error budget acceptable",
        "Release checklist approved",
        "Rollback checkpoints archived"
      ]
    }
  ].map((milestone) => clone(milestone));
}

export function getProgramNoCoursesPolicy() {
  return {
    enabled: true,
    description: "Academy/course/lesson features are excluded from this expansion backlog.",
    blockedTerms: ["academy", "course", "lesson", "curriculum", "syllabus", "tutorial"],
    enforcement: "module-load validation + per-feature contract checks"
  };
}

export function getProgramEnvironmentBlueprint() {
  return clone(ENVIRONMENT_BLUEPRINT);
}

export function listProgramRunbooks({ moduleId, limit = 200 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(1000, Number(limit || 200)));
  const expectedModule = moduleId ? String(moduleId) : null;
  return EXPANDED_RUNBOOKS.filter((runbook) => {
    if (!expectedModule) return true;
    return runbook.moduleId === expectedModule;
  })
    .slice(0, normalizedLimit)
    .map((runbook) => clone(runbook));
}

export function listProgramReleaseCheckpoints() {
  return EXPANDED_CHECKPOINTS.map((checkpoint) => clone(checkpoint));
}

export function getProgramPhaseBoard() {
  const board = Object.fromEntries(PHASES.map((phase) => [phase, { total: 0, byModule: {}, byStatus: {} }]));
  for (const feature of EXPANDED_FEATURES) {
    const phaseBucket = board[feature.phase] ?? null;
    if (!phaseBucket) continue;
    phaseBucket.total += 1;
    phaseBucket.byModule[feature.moduleId] = (phaseBucket.byModule[feature.moduleId] ?? 0) + 1;
    phaseBucket.byStatus[feature.status] = (phaseBucket.byStatus[feature.status] ?? 0) + 1;
  }
  return clone(board);
}

export function getProgramOverview() {
  const modules = listProgramModules();
  const phaseBreakdown = Object.fromEntries(PHASES.map((phase) => [phase, 0]));
  const statusBreakdown = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const moduleBreakdown = Object.fromEntries(modules.map((module) => [module.id, 0]));
  const categoryBreakdown = {};

  EXPANDED_FEATURES.forEach((feature) => {
    phaseBreakdown[feature.phase] = (phaseBreakdown[feature.phase] ?? 0) + 1;
    statusBreakdown[feature.status] = (statusBreakdown[feature.status] ?? 0) + 1;
    moduleBreakdown[feature.moduleId] = (moduleBreakdown[feature.moduleId] ?? 0) + 1;
    categoryBreakdown[feature.category] = (categoryBreakdown[feature.category] ?? 0) + 1;
  });

  return {
    totalModules: modules.length,
    totalFeatures: EXPANDED_FEATURES.length,
    totalRunbooks: EXPANDED_RUNBOOKS.length,
    totalReleaseCheckpoints: EXPANDED_CHECKPOINTS.length,
    modules,
    phaseBreakdown,
    statusBreakdown,
    moduleBreakdown,
    categoryBreakdown,
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
    featureContracts: EXPANDED_FEATURES.length,
    modules: EXPANDED_MODULES.length,
    runbooks: EXPANDED_RUNBOOKS.length,
    releaseCheckpoints: EXPANDED_CHECKPOINTS.length,
    noCoursesPolicyEnabled: true
  };
}
