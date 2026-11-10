# Invitation notification delivery (Story 1.31)

Disabled by default. The existing service `start` and synthetic topology do not
read Resend environment keys or send email. Creating an invitation atomically
creates a `not_configured` outbox row with the command receipt. An explicitly
configured dispatcher acknowledges up to 100 unattempted rows as `pending` per
invocation before claiming one; other queued rows therefore truthfully show
configured pending delivery. In-app discovery
and deliberate verified-identity acceptance do not depend on email.

## Separately authorized deployment

Do not activate this against a real account/domain without deployment approval.
Protect configuration and secret files with the deployment account's OS ACLs.
The ordinary service binary offers one bounded, scheduler-compatible invocation:

`inquello-service delivery dispatch --config ABSOLUTE_PRIVATE_CONFIG_PATH`

Database settings use the existing explicit `--database-url` or
`INQUELLO_DATABASE_URL` mechanism. Configuration JSON has exactly:
`enabled` (boolean), `sender` (plain verified sender email address),
`api_key_file` (absolute private file path). No real example key is included.
With `enabled:false`, no key is read and no provider/database dispatch occurs.
With explicit `enabled:true`, the key is read only from that named file.
No inherited provider API-key environment variable is inspected.

An authorized deployment scheduler may invoke this command periodically (for
example every five seconds). Each invocation automatically claims at most one
eligible notification; no per-invitation engineering action is necessary.
Multiple invocations are safe through PostgreSQL row locking, a durable lease
and attempt fencing. A long-running host can instead explicitly call
`start_with_delivery(config, clock, Some(delivery_config))`; it polls at the
same bounded cadence and stops the worker on service shutdown.
Neither deployment path is activated by this implementation/test work.

## Retry and truthfulness

The exact JSON payload, stable idempotency key, first-attempt time and hashed
provider/configuration identity are committed before contacting Resend.
Configuration identity includes the fixed HTTPS endpoint, credential context and
sender; changing it after an uncertain send requires manual reconciliation.
Workspace rename cannot change a stored notification. No workspace content,
invitation bearer secret, password or acceptance token is put in email.

A one-minute lease permits restart recovery. Attempts have a 20-second worker
timeout; the concrete HTTP client has a 15-second bound, refuses redirects, and
uses public TLS trust independently of service/issuer fixture trust. Responses
are bounded, errors are not logged with bodies, and secrets have no Debug output.

Resend deduplication lasts 24 hours. Automatic retries stop conservatively at
23 hours after the first attempted send (or on a detected backward first-attempt
clock inconsistency). Never reset the first-attempt time, swap provider accounts,
or silently generate a new key after uncertainty. A backward clock that has not
reached the persisted retry/lease time simply makes the item ineligible.
Manual reconciliation is terminal for the automatic worker; deliberately creating
a replacement notification/resend requires an independently authorized operator
workflow and is not implemented as a silent reset.

States: `not_configured`, `pending`, `sending`, `retry_pending`,
`provider_accepted`, `manual_reconciliation_required`, `cancelled`, `failed`.
**provider_accepted means the API accepted the message, not inbox delivery.**
Revoked/accepted/expired invitations and currently disabled/removed grantors,
withdrawn management roles or stale/invalid policy grants are skipped before send. Revocation racing
an already in-flight notification cannot unsend it, but email grants no access.
No webhook/inbox-delivery claim is implemented.

Administrators can read up to 100 latest safe statuses through
`GET /v1/workspaces/{workspace_id}/invitation-deliveries`. Only invitation ID and
state are returned; no recipient address, provider ID, payload, key or credentials.
Existing workspace membership/management authorization is rechecked.

## Limits and verification scope

Tests use disposable PostgreSQL and injected in-process fake transports only.
They cover atomic receipt retry, private status access, lost-response exact
retries, workspace rename, crash lease recovery, concurrent workers, clock
movement, configuration/account changes, revocation and bounded dedup expiry.
No real Resend API, domain, account or mailbox has been exercised.

Disabled principals no longer count as another eligible administrator. This is
a deterministic state check under existing workspace locking; concurrent operator
disablement is not claimed as a globally serialized last-administrator invariant.
No extra late principal locks were introduced.

Provider reference:
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
