/** Durable encrypted onboarding drafts and exact operation envelopes, separate from logout credentials. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {detectCredentialStorage,type SafeStorageLike} from '../identity/vault';
import {ensurePrivateDirectory,restrictPrivateFile,isPrivatePath} from '../runtime/private-paths';
import {uuid,object,str,oneOf} from '../identity/wire';
import {emptyDraft,draftInput,mutation,envelope,type Envelope} from './contracts';
import type {Draft,Pending,Mutation} from './types';
export type StoredPending = Mutation & {operationId:string;state:Pending['state'];envelope:Envelope;terminalRejection:boolean};
export interface RecordState {draft:Draft;pending:StoredPending|null}
export interface OnboardingStorage {load(principal:string):RecordState; save(principal:string,state:RecordState):void}
export class OnboardingStore implements OnboardingStorage {
  constructor(private readonly options:{dir:string;scope:string;safeStorage:SafeStorageLike;platform:NodeJS.Platform}) {}
  private file(principal:string) {
    uuid(principal,'');
    return path.join(this.options.dir,createHash('sha256').update(this.options.scope+'\n'+principal).digest('hex')+'.bin');
  }
  private ready() {
    if(detectCredentialStorage(this.options.safeStorage,this.options.platform)!=='os-backed') throw new Error('OS-backed onboarding storage unavailable');
  }
  load(principal:string):RecordState {
    this.ready();
    const file=this.file(principal);
    if(!fs.existsSync(file)) return {draft:emptyDraft(),pending:null};
    if(!isPrivatePath(file,'file') || fs.statSync(file).size>128*1024) throw new Error('Onboarding storage unavailable');
    const raw:unknown=JSON.parse(this.options.safeStorage.decryptString(fs.readFileSync(file)));
    const saved=object({scope:str,principalId:uuid,draft:draftInput,pending:(v:unknown)=>v})(raw,'');
    if(saved.scope!==this.options.scope || saved.principalId!==principal) throw new Error('Onboarding storage binding mismatch');
    let pending:StoredPending|null=null;
    if(saved.pending!==null) {
      const p=object({kind:str,input:(v:unknown)=>v,operationId:uuid,state:oneOf(['prepared','uncertain','retryable'] as const),terminalRejection:(v:unknown)=>{if(typeof v!=='boolean')throw new Error('Invalid terminal marker');return v;},envelope:(v:unknown)=>v})(saved.pending,'');
      const m=mutation(p.kind,p.input);
      const e=p.envelope as Envelope;
      if(!e || typeof e.command_epoch!=='string') throw new Error('Invalid stored envelope');
      const expected=envelope(m,p.operationId,e.command_epoch);
      if(JSON.stringify(e)!==JSON.stringify(expected)) throw new Error('Invalid stored envelope');
      // Retry/discard always perform a new receipt read; this state is display metadata only.
      pending={...m,operationId:p.operationId,state:p.state,terminalRejection:p.terminalRejection,envelope:expected};
    }
    return {draft:saved.draft,pending};
  }
  save(principal:string,state:RecordState):void {
    this.ready();
    const file=this.file(principal);
    ensurePrivateDirectory(this.options.dir);
    const data=this.options.safeStorage.encryptString(JSON.stringify({scope:this.options.scope,principalId:principal,...state}));
    const temp=file+'.'+randomUUID()+'.tmp';
    try {
      fs.writeFileSync(temp,data,{flag:'wx',mode:0o600});
      restrictPrivateFile(temp);
      const fd=fs.openSync(temp,'r+');try {fs.fsyncSync(fd);}finally {fs.closeSync(fd);}
      fs.renameSync(temp,file);
    } finally {fs.rmSync(temp,{force:true});}
  }
}
