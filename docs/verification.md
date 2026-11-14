# Verification contract

Treat verification as part of implementation. Establish evidence that the delivered behavior meets the user's intent, with effort proportional to the consequences of failure. Small presentation changes need focused visual and interaction checks; money movement, authorization, isolation, and concurrent state transitions require stronger evidence. Never claim universal correctness from passing tests or a bounded proof.

## 1. Define success before changing code

Identify observable acceptance behavior, relevant failure cases, and the highest-risk assumptions. For consequential stateful behavior, state invariants explicitly: for example, balances are conserved, unauthorized access is rejected, tenants remain isolated, and retries do not duplicate effects. Identify the checks that could falsify these claims. Keep this plan brief and update it when requirements change.

## 2. Exercise the real workflow

Use available browser or computer tools for user-facing changes. Perform representative actions through the actual interface, including relevant keyboard, focus, scrolling, resizing, and navigation behavior. Inspect the rendered result against user intent, not just DOM assertions. Follow consequential workflows through UI → API → database or durable state → response → visible outcome. Check persistence after refresh or restart where relevant.

Distinguish evidence from mocked components, the actual renderer with mocked services, and real provider integration. Each establishes different things; label substitutions and unverified boundaries. A screenshot alone does not verify behavior, and an API success alone does not verify the UI.

Preserve existing profiles, sessions, and user data. Use isolated fixtures or approved test environments. Never bypass permissions, security controls, or approval requirements to obtain evidence. Real paid calls, secret use, and external side effects require applicable authorization. Report blocked checks rather than silently substituting mocks. Do not introduce product controls solely to make testing convenient.

## 3. Test failures and prevent regression

Cover relevant negative paths, validation, permission failures, timeouts, retry behavior, concurrency, and partial writes, based on risk. For bug fixes, reproduce the failure and add a regression check that fails before the fix and passes afterward where practical. If reproduction is unavailable, say so and explain the substitute evidence.

Run focused changed-code checks and affected regression coverage, expanding when shared behavior is at risk. Never delete, skip, or weaken a valid assertion simply to obtain green results. Correct obsolete tests only with a documented reason tied to the intended behavior.

## 4. Use stronger methods where they earn their cost

For high-risk logic, explicitly assess and use property-based, model-based, or formal checks where they can materially improve confidence. Explain briefly when a stronger check is impractical and identify the residual risk. Consider actual formal methods, such as model checking or deductive verification, when the consequences, state space, or specification justify them. Unit tests, types, linting, and randomized property tests are not formal proofs.

For formal results, record the specification, assumptions, modeled bounds, checked properties, and connection to implementation. Examine counterexamples and limitations. A proof of a model is not automatically a proof of running code. Revalidate affected models and proofs after changes to prevent drift. Do not require heavyweight proofs for low-risk cosmetic work.

## 5. Close the loop with evidence

Use human or AI review to guide verification, not replace it. Treat review findings as hypotheses: establish a reproduction, violated invariant, concrete impact, or supporting proof. Prioritize consequential findings over speculative debate. Fix authorized, recoverable failures and rerun affected checks; continue toward completion rather than repeatedly reporting intermediate failures. Escalate when progress requires a decision, permission, or unavailable capability.

Keep minimal durable evidence tied to the final commit, artifact, and tested runtime: commands or workflow steps, expected and observed outcomes, and useful logs or screenshots. Distinguish **passed**, **failed**, **blocked**, and **not run**. Recheck evidence invalidated by subsequent edits. Mark work complete only when the agreed acceptance behavior and relevant visual quality are verified. If you must stop earlier, provide an honest partial handoff with outstanding gaps and the decision needed; do not label it complete. Report residual risk without overstating what the evidence establishes.
