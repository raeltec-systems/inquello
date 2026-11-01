import { ServiceError, type HttpsTransport } from '../identity/service-client';
import { parseErrorBody, nullable, type CommandResponse } from '../identity/wire';
import { parseCapabilities, parseCommandResponse, parseInvitations, parseMembers, parseDeliveries, parseRolesView, type Envelope } from './contracts';

/** Fixed named endpoints only; neither URLs nor credentials are renderer inputs. */
export class OnboardingClient {
  constructor(private readonly base:string, private readonly transport:HttpsTransport) {}
  private async call<T>(method:'GET'|'POST', route:string, parse:(v:unknown,p:string)=>T, access?:string, body?:unknown):Promise<T> {
    const response = await this.transport({url:this.base+route,method,headers:{...(access?{Authorization:'Bearer '+access}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    let value:unknown;
    try { value=JSON.parse(response.text); } catch { throw new ServiceError('protocol',true,response.status); }
    if(response.location!==null || !/^application\/json(?:;|$)/i.test(response.contentType)) throw new ServiceError('protocol',true,response.status);
    if(response.status<200 || response.status>=300) {
      let error; try { error=parseErrorBody(value,''); } catch { throw new ServiceError('protocol',true,response.status); }
      throw new ServiceError(error.error.kind,true,response.status,error.error.reason);
    }
    try {return parse(value,'');} catch {throw new ServiceError('protocol',true,response.status);}
  }
  capabilities() {return this.call('GET','/v1/capabilities',parseCapabilities);}
  invitations(access:string) {return this.call('GET','/v1/invitations',parseInvitations,access);}
  members(access:string,id:string) {return this.call('GET','/v1/workspaces/'+encodeURIComponent(id)+'/members',parseMembers,access);}
  roles(access:string,id:string) {return this.call('GET','/v1/workspaces/'+encodeURIComponent(id)+'/roles',parseRolesView,access);}
  deliveries(access:string,id:string) {return this.call('GET','/v1/workspaces/'+encodeURIComponent(id)+'/invitation-deliveries',parseDeliveries,access);}
  execute(access:string,e:Envelope):Promise<CommandResponse> {
    return this.call('POST',e.workspace_id?'/v1/workspaces/'+encodeURIComponent(e.workspace_id)+'/commands':'/v1/onboarding/commands',parseCommandResponse,access,e);
  }
  receipt(access:string,e:Envelope):Promise<CommandResponse|null> {
    const base=e.workspace_id?'/v1/workspaces/'+encodeURIComponent(e.workspace_id):'/v1/onboarding';
    return this.call('GET',base+'/receipts/'+encodeURIComponent(e.operation_id),nullable(parseCommandResponse),access);
  }
}
