// Build-time check of the local data-policy register (Story 1.12).
//
// Runs the compiled loader (`dist/main/data/policy.js`) against the shipped
// `data-policy.json`, so the build fails when the register does not validate.
// An enabled category with an unknown owner, rule owner, retention or export
// rule is a real-data blocker, not a build error: it is printed here, and the
// engine's capability test refuses any real-data-eligible capability while one
// exists. The tests run the same checks (`test/data-policy.test.ts`).
'use strict';

const path = require('node:path');

const { loadShippedPolicy, policyPath, ruleBlockers } = require(path.join(__dirname, '..', 'dist', 'main', 'data', 'policy.js'));

const load = loadShippedPolicy();
if (!load.ok) {
  console.error(`data-policy: ${policyPath()} does not validate: ${load.error}`);
  process.exit(1);
}
const blockers = ruleBlockers(load.policy);
for (const blocker of blockers) console.warn(`data-policy: real-data blocker: ${blocker.detail}`);
console.log(`data-policy: ${load.policy.categories.length} categories validated, ${blockers.length} real-data blocker(s) in the register`);
