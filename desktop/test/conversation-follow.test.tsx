// @vitest-environment jsdom
import {Suspense,startTransition,useState} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useConversationFollow} from '../src/renderer/Shell/use-conversation-follow';
let resize:()=>void,disconnected=0,control:ReturnType<typeof useConversationFollow>;
const pendingRender=new Promise<void>(()=>{});
let suspendedRender=false;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){disconnected++;}});disconnected=0;});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function View({scope='owner/workspace/task/runtime',blocked=false,suspend=false}:{scope?:string;blocked?:boolean;suspend?:boolean}){
 control=useConversationFollow(scope,blocked);
 if(suspend){suspendedRender=true;throw pendingRender;}
 return <><main ref={control.threadRef}><div ref={control.contentRef}><section className="iq-task-progress">Conversation</section><details><summary>Inspector</summary></details></div></main><input aria-label="Draft"/>{control.away&&<button onClick={control.jump}>Jump to latest</button>}</>;
}
function geometry(){const thread=document.querySelector('main')!,conversation=document.querySelector('.iq-task-progress')!;let height=600;
 Object.defineProperties(thread,{clientHeight:{configurable:true,value:100},scrollHeight:{configurable:true,get:()=>height+80}});
 vi.spyOn(thread,'getBoundingClientRect').mockImplementation(()=>({top:0} as DOMRect));
 vi.spyOn(conversation,'getBoundingClientRect').mockImplementation(()=>({bottom:height-thread.scrollTop} as DOMRect));
 return{thread,setHeight:(value:number)=>{height=value;},grow:(value:number)=>{height=value;act(()=>resize());},scroll:(value:number)=>{thread.scrollTop=value;fireEvent.scroll(thread);}};
}
it('initial authorized conversation and content growth follow conversation end, not inspector or page',()=>{
 render(<View/>);const g=geometry(),input=screen.getByLabelText('Draft');input.focus();const page=document.documentElement.scrollTop;
 g.grow(600);expect(g.thread.scrollTop).toBe(500);g.grow(800);expect(g.thread.scrollTop).toBe(700);
 expect(document.activeElement).toBe(input);expect(document.documentElement.scrollTop).toBe(page);
});
it('reader scroll-up suspends growth until explicit Jump to latest without changing focus',()=>{
 render(<View/>);const g=geometry();g.grow(600);g.scroll(40);g.grow(800);expect(g.thread.scrollTop).toBe(40);
 const input=screen.getByLabelText('Draft');input.focus();fireEvent.click(screen.getByRole('button',{name:'Jump to latest'}));
 expect(g.thread.scrollTop).toBe(700);expect(document.activeElement).toBe(input);g.grow(900);expect(g.thread.scrollTop).toBe(800);
});
it('successful own continuation rearms following but later manual scroll wins over late admission',()=>{
 render(<View/>);const g=geometry();g.grow(600);g.scroll(40);const admitted=control.continuation();act(()=>admitted());expect(g.thread.scrollTop).toBe(500);
 const delayed=control.continuation();g.scroll(25);act(()=>delayed());g.grow(800);expect(g.thread.scrollTop).toBe(25);
});
it.each(['different-owner/workspace/task/runtime','owner/workspace/other-task/runtime','owner/workspace/task/new-runtime'])('scope change disconnects observers and rejects old continuation (%s)',scope=>{
 const view=render(<View/>);const g=geometry();g.grow(600);const old=control.continuation();view.rerender(<View scope={scope}/>);expect(disconnected).toBeGreaterThan(0);g.scroll(20);act(()=>old());expect(g.thread.scrollTop).toBe(20);
});
it('selected message/question or hidden work blocks initial follow and pending admission',()=>{
 const view=render(<View/>);const g=geometry();g.grow(600);const old=control.continuation();view.rerender(<View blocked/>);g.scroll(35);g.grow(800);act(()=>old());expect(g.thread.scrollTop).toBe(35);expect(screen.queryByRole('button',{name:'Jump to latest'})).toBeNull();
});

it('queued programmatic scroll after content growth does not masquerade as reader scroll-up',()=>{
 render(<View/>);const g=geometry();g.grow(600);expect(g.thread.scrollTop).toBe(500);
 // The next projection changes geometry before Chromium delivers our old scroll event.
 g.setHeight(850);fireEvent.scroll(g.thread);
 expect(g.thread.scrollTop).toBe(750);expect(screen.queryByRole('button',{name:'Jump to latest'})).toBeNull();
 g.grow(1000);expect(g.thread.scrollTop).toBe(900);
});
it('browser forward scroll anchoring during growth preserves following',()=>{
 render(<View/>);const g=geometry();g.grow(600);g.setHeight(900);g.thread.scrollTop=520;fireEvent.scroll(g.thread);
 expect(g.thread.scrollTop).toBe(800);g.scroll(25);g.grow(1000);expect(g.thread.scrollTop).toBe(25);
 expect(screen.getByRole('button',{name:'Jump to latest'})).toBeTruthy();
});

it.each(['scope','blocked'] as const)('uncommitted %s transition cannot invalidate the committed conversation',async kind=>{
 let begin!:()=>void;
 function ConcurrentView(){
  const [pending,setPending]=useState(false);
  begin=()=>startTransition(()=>setPending(true));
  return <Suspense fallback={<p>Pending navigation</p>}><View scope={pending&&kind==='scope'?'uncommitted-owner/task/runtime':'owner/workspace/task/runtime'} blocked={pending&&kind==='blocked'} suspend={pending}/></Suspense>;
 }
 suspendedRender=false;render(<ConcurrentView/>);const g=geometry();g.grow(600);
 const committed=control;g.scroll(40);const admitted=committed.continuation();
 await act(async()=>{begin();});
 expect(suspendedRender).toBe(true);expect(screen.queryByText('Pending navigation')).toBeNull();
 act(()=>admitted());expect(g.thread.scrollTop).toBe(500);
 g.grow(800);expect(g.thread.scrollTop).toBe(700);
});

it.each(['wheel','keydown','pointerdown'] as const)('lets a reader scroll downward past a short conversation using %s without snapback',kind=>{
 render(<View/>);const g=geometry();g.grow(50);expect(g.thread.scrollTop).toBe(0);
 if(kind==='wheel')fireEvent.wheel(g.thread,{deltaY:30});
 if(kind==='keydown')fireEvent.keyDown(g.thread,{key:'PageDown'});
 if(kind==='pointerdown')fireEvent.pointerDown(g.thread);
 g.scroll(30);expect(g.thread.scrollTop).toBe(30);
 g.grow(800);expect(g.thread.scrollTop).toBe(30);
 fireEvent.click(screen.getByRole('button',{name:'Jump to latest'}));expect(g.thread.scrollTop).toBe(700);
});
