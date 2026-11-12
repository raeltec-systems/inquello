/**
 * References, computed figures and inferences in an agent answer, and the
 * Task's Coverage (Story 2.1). Presentation only: main re-read every cited
 * location in the sandbox and decided each status; a reference is shown as
 * verified only when main said so and supplied its file and extract.
 *
 * Inline, each directive in the answer becomes a short chip. Below the answer,
 * each reference opens to its file, location, modified time, content hash,
 * labels (recognised text, converted from a legacy format) and the retained
 * extract; each computed figure opens to the command that produced it.
 */
import type {MouseEvent,ReactElement} from 'react';
import {FileChip} from '../primitives';
import {ExcludedList} from './AttachControl';
import {MessageMarkdown,type InlineMark} from './MessageMarkdown';
import {AGENT_MATERIAL_DISCLOSURE,chipType,type MarkedReference,type MessageReferences,type SourcesView} from './sources-bridge';

/** Opens a detail below the answer and moves focus to it. */
function openDetail(event:MouseEvent<HTMLElement>,selector:string):void {
 const detail=event.currentTarget.closest('[data-message-with-sources]')?.querySelector<HTMLDetailsElement>(selector);
 if(!detail)return;
 detail.open=true;
 const summary=detail.querySelector<HTMLElement>('summary');
 summary?.focus();summary?.scrollIntoView?.({block:'nearest'});
}

const statusText=(reference:MarkedReference,waiting:boolean)=>reference.status==='verified'?'Verified reference':waiting?'Reference not yet checked':'Unverified reference';
const shortName=(reference:MarkedReference)=>reference.file?.name??reference.id.split('/').at(-1)??reference.id;

function ReferenceChip({reference,number,waiting}:{reference:MarkedReference;number:number;waiting:boolean}):ReactElement {
 const status=reference.status==='verified'?'verified':waiting?'waiting':'unverified';
 return <button type="button" className={`iq-ref-chip iq-ref-chip--${status}`} data-reference-chip={number} data-reference-status={status}
  aria-label={`Reference ${number}: ${shortName(reference)}, ${reference.location}. ${statusText(reference,waiting)}. Show details`}
  onClick={event=>openDetail(event,`details[data-reference-detail="${number}"]`)}>
  <span className="iq-ref-chip-number" aria-hidden="true">{number}</span>
  <span className="iq-ref-chip-name">{shortName(reference)}</span>
  <span className="iq-ref-chip-location">{reference.location}</span>
  {status!=='verified'&&<span className="iq-ref-chip-status">{status==='waiting'?'Not yet checked':'Unverified'}</span>}
 </button>;
}

/** The marks main found in this message, kept only where the text still matches what main parsed. */
export function messageMarks(text:string,references:MessageReferences):InlineMark[] {
 const marks:InlineMark[]=[];
 const waiting=references.state==='waiting';
 references.references.forEach((reference,position)=>{if(text.slice(reference.start,reference.end)===reference.raw)marks.push({start:reference.start,end:reference.end,raw:reference.raw,node:<ReferenceChip reference={reference} number={position+1} waiting={waiting}/>});});
 for(const problem of references.problems)if(text.slice(problem.start,problem.end)===problem.raw)marks.push({start:problem.start,end:problem.end,raw:problem.raw,node:<span className="iq-ref-chip iq-ref-chip--unverified" data-reference-status="unverified" data-reference-problem>{`Unverified reference: ${problem.reason}`}</span>});
 references.computed.forEach((computed,position)=>{const raw=text.slice(computed.start,computed.end);if(raw.startsWith(':inquello-computed{'))marks.push({start:computed.start,end:computed.end,raw,node:<button type="button" className="iq-claim-mark iq-claim-mark--computed" data-computed-mark={position+1} aria-label={`Computed figure ${position+1}. Show the command`} onClick={event=>openDetail(event,`details[data-computed-detail="${position+1}"]`)}>Computed</button>});});
 for(const inference of references.inferences){const raw=text.slice(inference.start,inference.end);if(raw.startsWith(':inquello-inference{'))marks.push({start:inference.start,end:inference.end,raw,node:<span className="iq-claim-mark iq-claim-mark--inference" data-inference-mark>Agent’s inference</span>});}
 return marks.sort((a,b)=>a.start-b.start).filter((mark,index,all)=>index===0||mark.start>=all[index-1]!.end);
}

const when=(iso:string)=>{const date=new Date(iso);return Number.isNaN(date.getTime())?iso:date.toLocaleString();};

function ReferenceDetail({reference,number,waiting}:{reference:MarkedReference;number:number;waiting:boolean}):ReactElement {
 const verified=reference.status==='verified'&&reference.file&&reference.extract;
 return <details className={`iq-ref-detail iq-ref-detail--${verified?'verified':'unverified'}`} data-reference-detail={number}>
  <summary><span className="iq-ref-chip-number" aria-hidden="true">{number}</span><FileChip {...chipType(shortName(reference))} name={shortName(reference)} state={verified?'ready':'failed'}/><span>{reference.location}</span><span className="iq-ref-detail-status">{statusText(reference,waiting)}</span></summary>
  {verified?<dl className="iq-ref-facts">
   <dt>File</dt><dd>{reference.file!.relative}</dd>
   <dt>Location</dt><dd>{`${reference.location} (${reference.at||'whole file'})`}</dd>
   <dt>Modified</dt><dd>{when(reference.file!.modifiedAt)}</dd>
   <dt>Content hash (SHA-256)</dt><dd className="iq-ref-hash">{reference.file!.sha256}</dd>
   {reference.extract!.ocr&&<><dt>Text source</dt><dd data-reference-ocr>Recognised text (OCR). Recognition can be wrong; compare with the original page.</dd></>}
   {reference.extract!.converted&&<><dt>Converted</dt><dd data-reference-converted>{`Converted from legacy format before reading.${reference.extract!.originalSha256?` Original file hash: ${reference.extract!.originalSha256}`:''}`}</dd></>}
   {reference.extract!.wholeFile&&<><dt>Scope</dt><dd>The whole image is cited; its content was not read as text.</dd></>}
   {reference.quote&&<><dt>Quoted</dt><dd>{`“${reference.quote}”`}</dd></>}
  </dl>:<dl className="iq-ref-facts">
   <dt>Why</dt><dd data-reference-reason>{reference.reason??'Not verified'}</dd>
   <dt>Cited</dt><dd>{`${reference.id}${reference.at?` at ${reference.at}`:''}`}</dd>
   {reference.quote&&<><dt>Quoted</dt><dd>{`“${reference.quote}”`}</dd></>}
  </dl>}
  {verified?<><p className="iq-ref-extract-label">Extract found at this location, retained privately on this device</p><pre className="iq-ref-extract" tabIndex={0} data-reference-extract>{reference.extract!.text}</pre></>
   :<p>{waiting?'This reference will be checked against the attached file when the turn ends.':'Nothing was retained. Do not rely on this statement without checking the original.'}</p>}
 </details>;
}

/** An agent answer with its references, computed figures and inferences. */
export function MessageWithSources({text,references}:{text:string;references:MessageReferences}):ReactElement {
 const marks=messageMarks(text,references);
 const waiting=references.state==='waiting';
 const verified=references.references.filter(reference=>reference.status==='verified').length;
 return <div className="iq-message-with-sources" data-message-with-sources data-references-state={references.state}>
  <MessageMarkdown text={text} marks={marks}/>
  {(references.references.length>0||references.computed.length>0)&&<section className="iq-message-sources" aria-label="Sources for this answer">
   {references.references.length>0&&<>
    <h4>{waiting?`References · ${references.references.length}, checked when the turn ends`:`References · ${verified} of ${references.references.length} verified`}</h4>
    {references.references.map((reference,position)=><ReferenceDetail key={`${reference.start}:${position}`} reference={reference} number={position+1} waiting={waiting}/>)}
   </>}
   {references.computed.length>0&&<>
    <h4>{`Computed figures · ${references.computed.length}`}</h4>
    {references.computed.map((computed,position)=><details key={`${computed.start}:${position}`} className="iq-computed-detail" data-computed-detail={position+1}>
     <summary>{`Computed figure ${position+1}`}</summary>
     <p>The agent produced this figure with the command below. Re-run it on the attached material to re-perform the work; Inquello did not check the result.</p>
     <pre className="iq-computed-command" tabIndex={0} data-computed-command>{computed.command}</pre>
     {computed.from&&<p>{`Inputs: ${computed.from}`}</p>}
    </details>)}
   </>}
  </section>}
 </div>;
}

/** The Task's attached material and Coverage, shown with the answer. Nothing is shown for a Task without attachments. */
export function AttachedMaterial({view}:{view:SourcesView}):ReactElement|null {
 const coverage=view.coverage;
 if(!view.attachments.length&&!view.problem&&!coverage)return null;
 return <section className="iq-sources" aria-label="Attached material and coverage" data-sources-panel>
  <h3>Attached material</h3>
  {view.attachments.length>0&&<ul className="iq-sources-chips">{view.attachments.map(item=><li key={item.attachmentId}><FileChip {...(item.kind==='folder'?{type:'folder' as const}:item.files===1?chipType(item.label):{type:'files',typeLabel:'Files'})} name={item.label}/></li>)}</ul>}
  {view.attachments.length>0&&<p className="iq-sources-agent" data-agent-instruction>{AGENT_MATERIAL_DISCLOSURE}</p>}
  {view.problem&&<p role="alert" data-sources-problem>{view.problem}</p>}
  {coverage&&<>
   <p className="iq-coverage" data-coverage-statement><strong>Coverage:</strong> {coverage.statement}</p>
   {coverage.incomplete&&<p className="iq-sources-incomplete" role="status" data-incomplete-input>Incomplete input set. Some attached material was not searched, could not be read or was only partly read; it is named below. Answers cover only what was read.</p>}
   <ExcludedList title="Not searched" items={[...coverage.notSearched,...coverage.unreadable]} state="unreadable"/>
   <ExcludedList title="Partly read" items={coverage.partlyRead} state="unreadable"/>
   <ExcludedList title="Inaccessible" items={coverage.inaccessible} state="permission-limited"/>
  </>}
 </section>;
}
