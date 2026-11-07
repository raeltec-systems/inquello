/** Exact unresolved consent envelopes only; no keys, tokens or Task content. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {detectCredentialStorage,type SafeStorageLike} from '../identity/vault';
import {ensurePrivateDirectory,restrictPrivateFile,isPrivatePath} from '../runtime/private-paths';
import {uuid,object,str,nullable,parseProviderConsentCommand,type ProviderConsentCommand} from '../identity/wire';
export interface ConsentStorage {
  load(principal:string,workspace:string):ProviderConsentCommand|null;
  save(principal:string,workspace:string,pending:ProviderConsentCommand|null):void;
}
export class ConsentStore implements ConsentStorage {
  constructor(private readonly options:{dir:string;scope:string;safeStorage:SafeStorageLike;platform:NodeJS.Platform}) {}
  private file(principal:string,workspace:string):string {
    uuid(principal,'');uuid(workspace,'');
    return path.join(this.options.dir,createHash('sha256').update(JSON.stringify([this.options.scope,principal,workspace])).digest('hex')+'.bin');
  }
  private ready():void {
    if(detectCredentialStorage(this.options.safeStorage,this.options.platform)!=='os-backed')throw new Error('Secure consent journal unavailable');
  }
  load(principal:string,workspace:string):ProviderConsentCommand|null {
    this.ready();const file=this.file(principal,workspace);
    if(!fs.existsSync(file))return null;
    if(!isPrivatePath(file,'file')||fs.statSync(file).size>32*1024)throw new Error('Consent journal unavailable');
    const saved=object({scope:str,principalId:uuid,workspaceId:uuid,pending:nullable(parseProviderConsentCommand)})(
      JSON.parse(this.options.safeStorage.decryptString(fs.readFileSync(file))),'');
    if(saved.scope!==this.options.scope||saved.principalId!==principal||saved.workspaceId!==workspace||
      (saved.pending&&saved.pending.workspace_id!==workspace))throw new Error('Consent journal binding mismatch');
    return saved.pending;
  }
  save(principal:string,workspace:string,pending:ProviderConsentCommand|null):void {
    this.ready();const file=this.file(principal,workspace);
    const parsed=pending?parseProviderConsentCommand(pending,''):null;
    if(parsed&&parsed.workspace_id!==workspace)throw new Error('Consent journal binding mismatch');
    ensurePrivateDirectory(this.options.dir);
    const data=this.options.safeStorage.encryptString(JSON.stringify({scope:this.options.scope,principalId:principal,workspaceId:workspace,pending:parsed}));
    const temp=file+'.'+randomUUID()+'.tmp';
    try {
      fs.writeFileSync(temp,data,{flag:'wx',mode:0o600});restrictPrivateFile(temp);
      const fd=fs.openSync(temp,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      fs.renameSync(temp,file);
    }finally{fs.rmSync(temp,{force:true});}
  }
}
