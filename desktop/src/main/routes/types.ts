/** Source-owned presentation contract. Genuine runtime schema generation remains required. */
export type RouteId = 'codex-responses' | 'claude-api-key';
export interface RouteConfiguration { routeId: RouteId; deployment: string; model: string; apiVersion: string; accountRef: string; region: string | null }
export interface RouteView {
  routeId: string; provider: string; configurable: boolean; configuration: RouteConfiguration | null; endpoint: string | null;
  revision: number; credentialPresent: boolean; adapterSupported: boolean; verification: 'not_verified' | 'verified_for_synthetic' | 'verified_for_real_data';
  enabled: boolean; gate: string | null; limits: string[]; evidence: string[]; executionFlow: string; inferenceFlow: string; connectorFlow: string;
}
export interface TaskRouteView { taskId: string; workspaceId: string; revision: number; configurationRevision: number | null; staleConfiguration: boolean; selected: RouteView | null }
export type RouteResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export interface ConfigureRouteInput { operationId: string; expectedRevision: number; routeId: RouteId; deployment: string; model: string; apiVersion: string; region: string | null }
export interface SelectRouteInput { operationId: string; expectedRevision: number; taskId: string; routeId: RouteId; configurationRevision: number }
export const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid route response'); return v as Record<string, unknown>; };
const text = (v: unknown): string => { if (typeof v !== 'string' || v.length > 4096) throw new Error('Invalid route text'); return v; };
const bool = (v: unknown): boolean => { if (typeof v !== 'boolean') throw new Error('Invalid route state'); return v; };
export const revision = (v: unknown): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('Invalid route revision'); return v; };
const nullable = (v: unknown) => v === null ? null : text(v);
const strings = (v: unknown) => { if (!Array.isArray(v) || v.length > 100) throw new Error('Invalid route list'); return v.map(text); };
export const routeId = (v: unknown): RouteId => { if (v !== 'codex-responses' && v !== 'claude-api-key') throw new Error('Unsupported route'); return v; };
export function parseRoute(v: unknown): RouteView {
  const r = record(v), c = r.configuration === null ? null : record(r.configuration);
  const verification = text(r.verification);
  if (!['not_verified', 'verified_for_synthetic', 'verified_for_real_data'].includes(verification)) throw new Error('Unknown route evidence');
  const out: RouteView = {
    routeId: text(r.routeId), provider: text(r.provider), configurable: bool(r.configurable), configuration: c ? {routeId: routeId(c.routeId), deployment: text(c.deployment), model:text(c.model), apiVersion:text(c.apiVersion), accountRef:text(c.accountRef), region:nullable(c.region)} : null,
    endpoint: nullable(r.endpoint), revision: revision(r.revision), credentialPresent:bool(r.credentialPresent), adapterSupported:bool(r.adapterSupported), verification:verification as RouteView['verification'], enabled:bool(r.enabled), gate:nullable(r.gate), limits:strings(r.limits), evidence:strings(r.evidence), executionFlow:text(r.executionFlow), inferenceFlow:text(r.inferenceFlow), connectorFlow:text(r.connectorFlow),
  };
  if (out.enabled && (!out.configuration || !out.credentialPresent || !out.adapterSupported || out.verification === 'not_verified' || !out.evidence.length || out.gate !== null)) throw new Error('Inconsistent route eligibility');
  if (out.configuration && out.configuration.routeId !== out.routeId) throw new Error('Mismatched route');
  return out;
}
export function parseRoutes(v: unknown): RouteView[] { const r=record(v); if(!Array.isArray(r.routes) || r.routes.length>20) throw new Error('Invalid route catalog'); const routes=r.routes.map(parseRoute); if(new Set(routes.map(x=>x.routeId)).size!==routes.length) throw new Error('Duplicate route'); return routes; }
export function parseTaskRoute(v: unknown): TaskRouteView { const r=record(v); const t={taskId:text(r.taskId),workspaceId:text(r.workspaceId),revision:revision(r.revision),configurationRevision:r.configurationRevision===null?null:revision(r.configurationRevision),staleConfiguration:bool(r.staleConfiguration),selected:r.selected===null?null:parseRoute(r.selected)}; if(t.staleConfiguration && t.selected?.enabled) throw new Error('Stale enabled route'); return t; }
