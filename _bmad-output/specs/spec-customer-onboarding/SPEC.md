---
id: SPEC-customer-onboarding
companions:
  - brownfield-and-acceptance.md
sources: []
---

# Customer onboarding into a secure private workspace

## Why

A customer cannot currently reach the private desktop workflow without operator-created workspace access and helper acceptance. The owner wants to test the actual experience: establish an account, create or join a workspace, invite colleagues, and begin private work through the UI. This extends the deliberately operator-only Story 1.11 rather than retroactively claiming that story promised self-service onboarding.

## Capabilities

- **CAP-1**
  - **intent:** People can sign up, sign in and recover an Inquello identity independently of inference credentials.
  - **success:** The configured identity service returns a verified desktop session; cancellation, replay and foreign callbacks fail safely.
- **CAP-2**
  - **intent:** An eligible authenticated person can establish a company workspace and its first responsible owner.
  - **success:** One deliberate action creates one workspace and owner membership atomically; uncertain retries reconcile without duplicates or authority in existing workspaces.
- **CAP-3**
  - **intent:** Permitted administrators invite colleagues who can discover and explicitly accept access.
  - **success:** Only the intended verified identity accepts a current invitation; pending, accepted and unavailable states are understandable without directory disclosure.
- **CAP-4**
  - **intent:** Administrators manage members and policy-defined roles.
  - **success:** Unauthorized grants, stale changes and removal of the last eligible administrator fail; revocation blocks subsequent protected use and disclosure.
- **CAP-5**
  - **intent:** People resume interrupted onboarding and enter their permitted workspace without developer intervention.
  - **success:** Restart, cancellation and retry preserve choices, reconcile receipts and do not duplicate memberships or workspaces.
- **CAP-6**
  - **intent:** Newly onboarded people reach existing private conversations and secure provider setup.
  - **success:** A normal-UI fictional journey reaches permitted work; another member or administrator cannot read the creator's Task.

## Constraints

- Preserve immutable issuer/subject identity, server-authoritative permissions, receipt/revision checks, isolated IPC, OS-backed credential storage and private-by-default Tasks.
- Membership or first ownership never grants another person's Task, provider credentials, sharing, export or tool execution implicitly.
- Keep signup identity distinct from OpenAI/Anthropic authentication. No password store, raw key in chat, real credentials in fixtures or fabricated qualification.
- Extend the approved operator-only baseline explicitly; preserve its historical spec and existing operator path.
- Reuse current PKCE and membership services plus selected T3 presentation patterns with exact provenance/MIT notices, not T3's backend or Clerk authority wholesale.
- Use plausible fictional names while retaining test classification in metadata. No accounts, invitations, trust-store changes or paid requests are authorized merely by spec/build work.
- Owner-approved policy: verified users may create a new workspace and own only that workspace; owners invite by email, requiring the correct verified identity without automatic email-based account linking.
- Auth0 hosted OIDC is selected, subject to native callback compatibility validation. Existing Inquello workspace authority remains independent of vendor Organizations. No vendor account or paid plan is authorized.
- Grant transactions require fresh server-validated verified-email proof; local display claims or stale sessions are insufficient. Validate discovery/JWKS rotation and exact issuer/subject without email auto-linking.
- Approve the build spec before implementation.

## Non-goals

- Billing, external-audit/client/guest access, public account directory, password-auth backend, general shell redesign or automatic cross-issuer account linking.
- Treating seeded acceptance, a synthetic issuer or fixture inference as real customer onboarding/provider acceptance.

## Success signal

From a fresh desktop profile, two fictional people use the actual onboarding controls to establish and join a workspace, see correct roles, and reach private work. Duplicate/revoked/interrupted cases and cross-user Task reads remain safe. Production signup and delivery are separately verified against the selected deployed services.
