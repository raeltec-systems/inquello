# Shared-service technology and source-evidence review

Reviewed 2026-10-27. Lens: BMAD technology existence, fit, primary-source verification and honest evidence boundaries. This report is the only artifact written by this reviewer.

## Verdict

**PASS after targeted clarification: no remaining corrective findings from the technology existence/fit lens.** ST-1 and ST-2 below record the initial findings and their verified closure. No nonexistent named technology, incompatible standard or unsupported production-readiness assertion was found. Owner adoption and separate implementation authorization remain pending. This review does not approve a vendor, region, spend, deployment or real-data route.

Top observations:

1. **ST-1 — closed:** the amended service independently validates signed OIDC proof against its one-use login transaction before session creation; native-client claims are not trusted as proof.
2. **ST-2 — closed at contract level:** the amended credential rule expressly denies treating OS encryption as subprocess isolation, requires per-host verification, and gates unsupported hosts/routes. Actual isolation remains an unexecuted implementation test.
3. **Verified:** PostgreSQL 18, OIDC Core 1.0 errata set 2, RFC 8252 and RFC 9700 exist and support the recommendation. PostgreSQL's current documentation identifies 18 as current and 19 as development/RC at this check.
4. **Verified framing:** the desktop seed versions are explicitly historical inspection, not freshly verified versions or a tested combined stack. New service claims are proposals, not deployed capability.

## Reviewed snapshot and limits

| Input | SHA-256 at review |
| --- | --- |
| `ARCHITECTURE-SPINE.md` | `1b215f12dcd24dc8505e421a72b9c971725284c612e1cf6360042629adb4e694` |
| `shared-service-contract-proposal-2026-10-27.md` | `1e1a2bcc0662426e22e9c975f022674e67f524fa24d677161eea2435916f4d96` |
| `.working/technology-evidence.md` | `44da314013f95a45911e4c7a4e8ef750b8e00d2d42f30cc48ed9a33cd4dd2c8b` |

The prior technology review was read as historical evidence. Its release/source checks were not repeated and are not endorsed here as newly fetched facts. This bounded review freshly opened official standards, PostgreSQL documentation, Electron credential-storage documentation and primary pattern guidance. No dependency installation, build, source checkout, security test, service call, recovery drill or package compatibility test ran. Hashes identify the reviewed snapshot; later amendments require targeted recheck.

## ST-1 — make the OIDC-to-Inquello session proof explicit

**Severity:** medium contract-completeness issue, not evidence of a deployed vulnerability. **Locations:** proposal SC-1 lines 19–23; AD-18. **Certainty:** high that the boundary is unstated; no claim that an insecure implementation exists.

SC-1 names a public native client, callback binding and token validation, then says Inquello creates a server session. It does not allocate code redemption and ID-token validation between desktop and service or say what authenticated, replay-protected proof the service accepts to mint its opaque session. A client assertion that it validated identity must not become that proof. The concrete redirect mechanism can remain a platform implementation choice, but the trusted verifier and session bootstrap cannot be inferred differently by separate client/service implementers.

OIDC Core defines audience validation against the registered client, signature verification and nonce validation; `(iss, sub)` is its stable identity pair. Those rules support the proposal but do not define Inquello's additional native-to-service session exchange. [OIDC Core, ID-token validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), [claim stability](https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability)

**Recommended disposition:** add a short sequence identifying the OIDC relying party/client registration, owner of PKCE redemption, service verifier, allowed issuer/audience, server-bound login challenge and one-time/replay handling before app-session issuance. State explicitly that client-supplied principal/email or an unverified client-side validation result cannot create a service session. Add conformance cases for replayed bootstrap proof, wrong client audience and substituted login transaction. Keep provider selection and numeric lifetimes at their existing gates; no new vendor choice is required.

This does not invalidate OIDC or prevent owner review of the direction. It should be resolved before calling SC-1 a complete interoperable contract or building its dependent identity story.

## ST-2 — credential storage is not the subprocess security boundary

**Severity:** low, nonblocking clarification of existing implementation gates. **Locations:** SC-1 line 22; SC-5 line 79; spine AD-7 and Implementation seed. **Certainty:** high for the platform limitation; actual adapter is unselected.

Electron documents that Windows `safeStorage` protects against other users but not other applications in the same userspace. Linux protection varies by secret backend, and its synchronous `basic_text` fallback is not protected storage. Therefore “OS-backed credential store” cannot, alone, establish the stronger no-agent/no-arbitrary-subprocess credential invariant. No particular Electron API is selected by the proposal. [Electron safeStorage security semantics](https://www.electronjs.org/docs/latest/api/safe-storage)

**Recommended disposition:** retain AD-7's denial requirement and explicitly include credentials, not only materialized shared caches, in the first shared-host isolation acceptance check. Require a supported secure backend and deny shared authentication/processing where the actual adapter cannot meet the boundary; do not silently fall back to plaintext storage. Test with an ordinary enabled agent subprocess under the actual host sandbox. This is an implementation proof obligation, not a request to replace the adopted desktop stack or a claim that renderer isolation provides OS process isolation.

## Fresh decision and technology checks

| Decision / contract | Primary-source reality check | Assessment |
| --- | --- | --- |
| AS-SVC1 / AD-18 / SC-1: native login | RFC 8252 requires external-user-agent authorization and PKCE for public native clients. Its flow returns an authorization code to the native client; packaged secrets do not make it confidential. [RFC 8252](https://www.rfc-editor.org/info/rfc8252/) | External system browser, no embedded webview and no bundled client secret fit. The proposed S256 choice is also supported by current OAuth security guidance. ST-1 concerns the additional Inquello session boundary, not these standard mechanisms. |
| AS-SVC1: PKCE and refresh replay defense | RFC 9700 requires public-client PKCE and refresh-token sender constraint or rotation; S256 avoids exposing the verifier in the authorization request. Rotation detects replay and revokes the active token, potentially forcing the legitimate client to reauthenticate. [RFC 9700 §§2.1.1, 2.2.2 and 4.14](https://www.rfc-editor.org/info/rfc9700/) | Atomic rotation/family revocation and serialized refresh are plausible application choices. Opaque Inquello sessions, numeric lifetimes and current membership checks remain application design, not features supplied automatically by OIDC. |
| AS-SVC1: identity mapping | OIDC Core errata set 2 exists as the final specification; issuer plus subject is stable, while email is not a guaranteed unique account key. [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html) | Correct distinction between authentication, mutable profile attributes and Inquello resource authorization. No password infrastructure or inference-account entitlement is inferred. |
| AS-SVC2 / AD-19 / SC-2, SC-6: PostgreSQL 18 | Official 18 release notes give its release date as 2025-09-25. The documentation navigation currently marks 18 current and 19 development. [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html), [versioned documentation](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) | Existing supported major is a plausible transactional metadata choice. Exact patch, Rust driver, deployment availability and pool behavior remain correctly unselected and must be pinned/tested before dependent code. No combined-stack compatibility was demonstrated. |
| AS-SVC2 / SC-2, SC-6: transaction and RLS semantics | PostgreSQL documents transaction snapshots/retries and owner/superuser/BYPASSRLS exemptions. It also warns that policies consulting other rows can race. [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) | Same-transaction authorization, explicit Workspace epoch ordering, non-owner/non-bypass runtime roles and defense-in-depth RLS are well matched. RLS or serializable isolation alone does not prove the promised revocation order. Retain concurrent read/mutation/removal, retry and pooled-tenant-context tests. |
| SC-2: wire primitives | UUIDs, Internet timestamps and secure digests are actual standards. [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html), [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html), [NIST SHS](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) | Opaque UUID references, UTC timestamps, decimal-string revisions and exact-byte digests are compatible contract choices. Canonical request encoding, UUID generation and timestamp precision remain schema-fixture details. The text correctly denies that a digest confers authenticity or access. |
| AS-SVC3 / AD-20 / SC-3, SC-4: immutable transfer | PostgreSQL transactions cover database state, not an independently stored blob. The proposal explicitly stages, verifies, commits and reconciles instead of promising a shared transaction. | Plausible application protocol, not a pre-existing product capability. Authenticated streams and exact-version cache materialization require adapter tests. “Private blob storage” names no unverified vendor/version. Immutable registration/grants still depend on verified blob lifecycle and lineage. |
| AS-SVC4 / AD-21 / SC-5: revocation and offline behavior | Current metadata checks can be ordered by the service; host/storage isolation remains platform-dependent (ST-2). PostgreSQL concurrency behavior is documented, not an automatic cross-host cancellation mechanism. | Properly distinguishes the authorization boundary from already transmitted provider work, exported copies and instantaneous erasure. Live events accelerate invalidation but do not replace authority checks. Fail-closed shared use is a proposed product constraint; it trades availability for the required access rule. No offline lease or unsupported recall guarantee is claimed. |
| AS-SVC5 / AD-22 / SC-6: outbox and restore | Primary outbox guidance documents atomic database/outbox writes, possible duplicate events and idempotent consumers. [AWS transactional-outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Pattern fits metadata/index coordination and does not select AWS. A current independent deletion/revocation journal and quarantined restore are explicit Inquello design obligations, not capabilities guaranteed by PostgreSQL or an unspecified backup supplier. Failure injection remains required. |

## Historical stack and adoption honesty

The spine's Stack preface (line 202), source-snapshot wording (line 212), separate SQLite-runtime gate (line 214), service proposal boundary (line 230) and proposal evidence close (line 126) clearly limit the evidence. Electron 45.0.0, React 19.3.1, TypeScript 5.9.2, Rust 1.99.1/edition 2024 and pnpm 10.34.5 are preserved as historical seeds, not represented as freshly revalidated or a working installation. This review neither updates those pins nor repeats their prior release checks. The selected delivery fork, resolved SQLite driver/runtime and actual desktop/service libraries remain implementation gates.

AD-18–22 are labeled proposed; OQ-16A adoption is separate from OQ-16B supplier/deployment/real-data eligibility. The actual route, restore and revocation tests remain unexecuted. Those boundaries should survive any approval summary. No corrective finding requires changing the adopted product scope or silently authorizing implementation.

## Targeted closure verification — 2026-10-27

The author amended the proposal while this review was in progress. This reviewer reread SC-1, SC-2 and the conformance/gate section; the spine remained unchanged. No second live-source research or runtime test was needed for these clarifications.

| Rechecked input | SHA-256 |
| --- | --- |
| `ARCHITECTURE-SPINE.md` | `1b215f12dcd24dc8505e421a72b9c971725284c612e1cf6360042629adb4e694` |
| `shared-service-contract-proposal-2026-10-27.md` | `45bd308ecbee81aa265301dfb7d947fe5a011d98c9651250807fa89bc658159b` |

- **ST-1 closed:** SC-1 line 21 identifies the native host as PKCE/code-redemption owner, the service as independent signed-token verifier and the server-created one-use transaction as the nonce/issuer/client/redirect binding. It requires expected audience/authorized-party checks, atomic transaction consumption/session creation, replay/mismatch denial and a lost-response recovery rule. SC-2 separates this pre-Workspace bootstrap and credential rotation from ordinary operation receipts. These additions resolve the allocation ambiguity without picking a supplier. Bootstrap proof replay/substitution, token-audience mismatch and lost credential responses must become concrete schema/conformance fixtures before implementation claims.
- **ST-2 closed:** SC-1 line 23 now requires process/sandbox access boundaries verified on every supported host, explicitly says OS storage/encryption does not prove same-user subprocess isolation, and gates unsupported hosts/routes. This carries the official platform limitation into the contract without selecting an unverified storage adapter. Real host isolation tests remain necessary.
- The additional principal → session → Workspace → resource lock ordering and durable session invalidation clarify global session/principal revocation, rather than suggesting Workspace epochs alone cover logout. Refresh is expressly excluded from general credential-bearing receipt replay. These are application protocol obligations, not assertions that OIDC/PostgreSQL implements them automatically; race and failure-injection tests remain mandatory.

**Final disposition:** technology direction passes with no open corrective findings. All named new technologies/standards were primary-source checked; application protocols were assessed as proposed mechanisms with explicit testing and deployment gates, not ratified implementations. Only this review report was edited by the reviewer.
