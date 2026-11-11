/**
 * Attach files or a folder to a Task (Story 2.1). Main opens the system
 * dialog and inventories the choice; this control shows main's summary:
 * what will be read, what will not be searched and why, and an incomplete
 * input set. Attaching is optional, and removing an attachment never touches
 * the original files.
 *
 * It sits outside the Composer so the Composer stays a plain message field.
 */
import type {ReactElement} from 'react';
import {Button,FileChip} from '../primitives';
import {chipType,type AttachmentView} from './sources-bridge';

const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;

/** One attachment as main inventoried it, before or after staging. */
export function AttachmentSummary({attachment,onRemove}:{attachment:AttachmentView;onRemove?:()=>void}):ReactElement {
 const folder=attachment.files.some(file=>file.relative.includes('/'))||attachment.notSearched.some(file=>file.relative.includes('/'));
 const chip=folder?{type:'folder' as const}:attachment.files.length===1?chipType(attachment.files[0]!.name):{type:'files',typeLabel:'Files'};
 const counts=[`${plural(attachment.files.length,'file')} to read`,attachment.notSearched.length?`${attachment.notSearched.length} not searched`:null,attachment.inaccessible.length?`${attachment.inaccessible.length} inaccessible`:null].filter((part):part is string=>!!part).join(' · ');
 return <div className="iq-attachment" data-attachment={attachment.attachmentId}>
  <div className="iq-attachment-line">
   <FileChip {...chip} name={attachment.label} source="Attached by you; the original is never changed" onRemove={onRemove}/>
   <span className="iq-attachment-counts" data-attachment-counts>{counts}</span>
  </div>
  {attachment.incomplete.length>0&&<p className="iq-sources-incomplete" data-attachment-incomplete>Incomplete input set: {attachment.incomplete.join(' ')}</p>}
  {(attachment.notSearched.length>0||attachment.inaccessible.length>0)&&<details className="iq-attachment-details">
   <summary>What will not be searched</summary>
   <ExcludedList title="Not searched" items={attachment.notSearched} state="unreadable"/>
   <ExcludedList title="Inaccessible" items={attachment.inaccessible} state="permission-limited"/>
  </details>}
 </div>;
}

/** A named list of files left out, each with its reason. */
export function ExcludedList({title,items,state}:{title:string;items:readonly {relative:string;reason:string}[];state:'unreadable'|'permission-limited'}):ReactElement|null {
 if(!items.length)return null;
 const shown=items.slice(0,200);
 return <section className="iq-excluded" aria-label={title} data-excluded={title}>
  <h4>{`${title} · ${items.length}`}</h4>
  <ul>{shown.map((item,index)=><li key={`${item.relative}:${index}`}><FileChip {...chipType(item.relative)} name={item.relative} state={state}/><span className="iq-excluded-reason">{item.reason}</span></li>)}</ul>
  {items.length>shown.length&&<p>{`${items.length-shown.length} more not shown.`}</p>}
 </section>;
}

export interface AttachControlProps {
 attachments:readonly AttachmentView[];
 onAttach:(kind:'files'|'folder')=>void;
 onRemove?:(attachmentId:string)=>void;
 /** Why attaching is unavailable now; the buttons stay focusable with the reason. */
 disabledReason?:string;
 pending?:boolean;
 notice?:string|null;
}

export function AttachControl({attachments,onAttach,onRemove,disabledReason,pending=false,notice}:AttachControlProps):ReactElement {
 return <section className="iq-attach" aria-label="Attached material" data-attach-control>
  <div className="iq-attach-actions">
   <Button size="sm" variant="quiet" icon="paperclip" pending={pending} pendingText="Waiting for your choice" disabledReason={disabledReason} onPress={()=>onAttach('files')} data-attach="files">Attach files</Button>
   <Button size="sm" variant="quiet" icon="folder" pending={pending} pendingText="Waiting for your choice" disabledReason={disabledReason} onPress={()=>onAttach('folder')} data-attach="folder">Attach folder</Button>
  </div>
  {attachments.length>0&&<ul className="iq-attachments" aria-label="Attachments">{attachments.map(item=><li key={item.attachmentId}><AttachmentSummary attachment={item} onRemove={onRemove?()=>onRemove(item.attachmentId):undefined}/></li>)}</ul>}
  {notice&&<p role="status" data-attach-notice>{notice}</p>}
 </section>;
}
