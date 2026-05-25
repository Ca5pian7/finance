import test from "node:test";
import assert from "node:assert/strict";
import {
  getProgramEnvironmentBlueprint,
  getProgramFeatureContractById,
  getProgramMilestones,
  getProgramNoCoursesPolicy,
  getProgramOverview,
  listProgramFeatureContracts,
  listProgramModules
} from "../src/simulator/mega-program.js";

test("program modules cover planned ten-module scope", () => {
  const modules = listProgramModules();
  assert.equal(modules.length, 10);
  assert.ok(modules.every((module) => module.featureCount >= 10));
  assert.ok(modules.some((module) => module.id === "api-security"));
  assert.ok(modules.some((module) => module.id === "ops-admin"));
});

test("program contracts include 100+ features and expose full contract fields", () => {
  const features = listProgramFeatureContracts({ limit: 300 });
  assert.ok(features.length >= 100);
  const first = features[0];
  assert.ok(first.featureId);
  assert.ok(first.moduleId);
  assert.ok(first.title);
  assert.ok(first.phase);
  assert.ok(first.apiSpec?.path);
  assert.ok(Array.isArray(first.uiImpact?.pages));
  assert.ok(Array.isArray(first.acceptanceCriteria));
});

test("program contracts enforce no-courses language policy", () => {
  const features = listProgramFeatureContracts({ limit: 300 });
  const blockedTerms = /\b(academy|course|lesson|curriculum|syllabus|tutorial)\b/i;
  assert.ok(features.every((feature) => !blockedTerms.test(`${feature.title} ${feature.moduleName}`)));
  const policy = getProgramNoCoursesPolicy();
  assert.equal(policy.enabled, true);
  assert.ok(Array.isArray(policy.blockedTerms));
  assert.ok(policy.blockedTerms.includes("academy"));
});

test("program overview exposes coherent counts and milestones", () => {
  const overview = getProgramOverview();
  assert.equal(overview.totalModules, 10);
  assert.ok(overview.totalFeatures >= 100);
  assert.equal(
    Object.values(overview.phaseBreakdown).reduce((sum, value) => sum + Number(value), 0),
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
});
