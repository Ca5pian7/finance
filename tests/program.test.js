import test from "node:test";
import assert from "node:assert/strict";
import {
  getProgramEnvironmentBlueprint,
  getProgramFeatureContractById,
  getProgramMilestones,
  getProgramNoCoursesPolicy,
  getProgramOverview,
  getProgramPhaseBoard,
  listProgramFeatureContracts,
  listProgramModules,
  listProgramReleaseCheckpoints,
  listProgramRunbooks
} from "../src/simulator/mega-program.js";

test("program modules cover planned ten-module scope", () => {
  const modules = listProgramModules();
  assert.equal(modules.length, 10);
  assert.ok(modules.every((module) => module.featureCount >= 10));
  assert.ok(modules.some((module) => module.id === "api-security"));
  assert.ok(modules.some((module) => module.id === "ops-admin"));
});

test("program contracts include 100+ features and expose full contract fields", () => {
  const features = listProgramFeatureContracts({ limit: 1000 });
  assert.ok(features.length >= 500);
  const first = features[0];
  assert.ok(first.featureId);
  assert.ok(first.moduleId);
  assert.ok(first.title);
  assert.ok(first.phase);
  assert.ok(first.batch >= 1);
  assert.ok(first.category);
  assert.ok(first.apiSpec?.path);
  assert.ok(Array.isArray(first.uiImpact?.pages));
  assert.ok(Array.isArray(first.acceptanceCriteria));
  assert.ok(Array.isArray(first.operationalChecks));
});

test("program contracts enforce no-courses language policy", () => {
  const features = listProgramFeatureContracts({ limit: 1000 });
  const blockedTerms = /\b(academy|course|lesson|curriculum|syllabus|tutorial)\b/i;
  assert.ok(features.every((feature) => !blockedTerms.test(`${feature.title} ${feature.moduleName}`)));
  const policy = getProgramNoCoursesPolicy();
  assert.equal(policy.enabled, true);
  assert.ok(Array.isArray(policy.blockedTerms));
  assert.ok(policy.blockedTerms.includes("academy"));
  assert.equal(typeof policy.enforcement, "string");
});

test("program overview exposes coherent counts and milestones", () => {
  const overview = getProgramOverview();
  assert.equal(overview.totalModules, 10);
  assert.ok(overview.totalFeatures >= 500);
  assert.ok(overview.totalRunbooks >= 100);
  assert.ok(overview.totalReleaseCheckpoints >= 5);
  assert.equal(
    Object.values(overview.phaseBreakdown).reduce((sum, value) => sum + Number(value), 0),
    overview.totalFeatures
  );
  assert.equal(
    Object.values(overview.statusBreakdown).reduce((sum, value) => sum + Number(value), 0),
    overview.totalFeatures
  );
  const milestones = getProgramMilestones();
  assert.equal(milestones.length, 5);
  assert.ok(milestones.every((milestone) => Array.isArray(milestone.gates) && milestone.gates.length >= 3));
});

test("feature lookup and environment blueprint return stable payloads", () => {
  const features = listProgramFeatureContracts({ limit: 10 });
  const target = features[0];
  const loaded = getProgramFeatureContractById(target.featureId);
  assert.equal(loaded.featureId, target.featureId);
  assert.equal(loaded.moduleId, target.moduleId);

  const environment = getProgramEnvironmentBlueprint();
  assert.equal(environment.target, "dev/staging/prod");
  assert.equal(environment.runtime.node, ">=20");
  assert.ok(environment.configStrategy.requiredInProduction.includes("ADMIN_BEARER_TOKEN"));
  assert.ok(environment.deployment.promotionFlow.includes("prod"));
});

test("program filters support phase/status/batch/category queries", () => {
  const phaseFiltered = listProgramFeatureContracts({ phase: "phase-3", limit: 500 });
  assert.ok(phaseFiltered.length > 0);
  assert.ok(phaseFiltered.every((feature) => feature.phase === "phase-3"));

  const batchFiltered = listProgramFeatureContracts({ moduleId: "trading", batch: 2, limit: 500 });
  assert.ok(batchFiltered.length > 0);
  assert.ok(batchFiltered.every((feature) => feature.moduleId === "trading" && feature.batch === 2));

  const categoryFiltered = listProgramFeatureContracts({ moduleId: "risk", category: "stress", limit: 500 });
  assert.ok(categoryFiltered.length > 0);
  assert.ok(categoryFiltered.every((feature) => feature.moduleId === "risk"));
});

test("phase board and operational artifacts are populated", () => {
  const board = getProgramPhaseBoard();
  assert.ok(board["phase-1"]?.total > 0);
  assert.ok(board["phase-5"]?.total > 0);

  const runbooks = listProgramRunbooks({ moduleId: "analytics", limit: 200 });
  assert.ok(runbooks.length >= 5);
  assert.ok(runbooks.every((runbook) => runbook.moduleId === "analytics"));
  assert.ok(runbooks.every((runbook) => runbook.rollbackSafe === true));

  const checkpoints = listProgramReleaseCheckpoints();
  assert.equal(checkpoints.length, 5);
  assert.ok(checkpoints.every((checkpoint) => checkpoint.requirements.length >= 5));
});
