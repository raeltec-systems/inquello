import type { OrganiseIdentity, OrganiseRuntime } from '../organise';
import type { PolicyService } from '../policy/service';
import type { RouteService } from '../routes/service';
import { parseTaskRoute } from '../routes/types';
import { LOCAL_ENVIRONMENT, REMOTE_GATE, type TaskEnvironmentResult, type TaskEnvironmentView } from './types';

export interface EnvironmentServiceOptions {
  runtime: Pick<OrganiseRuntime, 'ready' | 'instance'>;
  identity: Pick<OrganiseIdentity, 'principalId'>;
  policy: Pick<PolicyService, 'inspectEnvironment'>;
  routes: Pick<RouteService, 'forTask'>;
}
const unavailable = (): TaskEnvironmentResult => ({ok:false, reason:'This device (local host) environment information is unavailable. Refresh when the runtime and private Task authority are available.'});
/** No folders, probes, auth handoffs, selections or dispatch occur on this path. */
export class EnvironmentService {
  private epoch = 0;
  constructor(private readonly options: EnvironmentServiceOptions) {}
  invalidate(): void { this.epoch++; }
  async forTask(taskId: string): Promise<TaskEnvironmentResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(taskId)) return unavailable();
    const principal = this.options.identity.principalId(), runtime = this.options.runtime.instance(), epoch = this.epoch;
    const current = () => !!principal && principal === this.options.identity.principalId() && runtime === this.options.runtime.instance() && epoch === this.epoch && this.options.runtime.ready();
    if (!current()) return unavailable();
    try {
      const policy = await this.options.policy.inspectEnvironment(taskId);
      if (!policy.ok || !current()) return unavailable();
      let inference: TaskEnvironmentView['inference'] = {status:'unavailable',provider:null,deployment:null,endpoint:null,model:null,apiVersion:null,region:'Unknown'};
      try {
        const result = await this.options.routes.forTask(taskId);
        if (!current()) return unavailable();
        if (result.ok) {
          const route = parseTaskRoute(result.value);
          if (route.taskId !== taskId) return unavailable();
          if (route.staleConfiguration) inference.status = 'stale';
          else if (!route.selected) inference.status = 'none';
          else {
            const selected = route.selected, config = selected.configuration;
            // The explicit route is descriptive, never a claim that inference may start.
            inference = {status:'selected',provider:selected.provider,deployment:config?.deployment??null,endpoint:selected.endpoint,model:config?.model??null,apiVersion:config?.apiVersion??null,region:config?.region??'Unknown'};
          }
        }
      } catch { /* Route failure is not an empty selection; never expose raw errors. */ }
      if (!current()) return unavailable();
      return {ok:true,value:{taskId,executionLabel:LOCAL_ENVIRONMENT,readiness:'ready',sandbox:policy.value.sandbox,inference,remoteGate:REMOTE_GATE,hostedSandboxGate:'V2 revisit (OQ-13)'}};
    } catch { return unavailable(); }
  }
}
