/** Presentation-only live-edge following. Never changes focus, authority or work. */
import {useLayoutEffect,useRef,useState} from 'react';
const EDGE_PX=32;
type FollowState={scope:string|null;blocked:boolean;following:boolean;reader:number;alive:boolean;scrollTop:number};
export function useConversationFollow(scope:string|null,blocked:boolean){
 const threadRef=useRef<HTMLElement>(null),contentRef=useRef<HTMLDivElement>(null);
 const [away,setAway]=useState(false);
 const state=useRef<FollowState>({scope,blocked,following:true,reader:0,alive:false,scrollTop:0});
 const current=useRef({scope,blocked});
 // Only committed navigation can invalidate the active observer. A suspended or
 // discarded concurrent render must not leak its scope into the current view.
 useLayoutEffect(()=>{current.current={scope,blocked};},[scope,blocked]);
 const target=()=>{
  const thread=threadRef.current,conversation=contentRef.current?.querySelector<HTMLElement>('.iq-task-progress');
  if(!thread||!conversation||thread.hidden||thread.clientHeight<=0)return null;
  const bottom=conversation.getBoundingClientRect().bottom-thread.getBoundingClientRect().top+thread.scrollTop;
  return Math.max(0,Math.min(thread.scrollHeight-thread.clientHeight,bottom-thread.clientHeight));
 };
 const valid=()=>state.current.alive&&!!scope&&current.current.scope===scope&&!current.current.blocked&&!state.current.blocked;
 const follow=()=>{const top=target();if(!valid()||top===null)return;threadRef.current!.scrollTop=top;state.current.scrollTop=threadRef.current!.scrollTop;setAway(false);};
 useLayoutEffect(()=>{
  const s:FollowState=state.current={scope,blocked,following:!blocked,reader:0,alive:true,scrollTop:threadRef.current?.scrollTop??0};setAway(false);
  const thread=threadRef.current,content=contentRef.current;
  const onScroll=()=>{
   const top=target();if(!valid()||top===null)return;
   const position=thread!.scrollTop,upward=position<s.scrollTop-1;
   s.scrollTop=position;
   const near=Math.abs(top-position)<=EDGE_PX;
   // Scroll events are asynchronous: our previous write can be delivered after
   // content grows again. Distance from a NEW target is not reader intent.
   // Only actual upward movement suspends following; unchanged/forward events
   // from our write or browser anchoring must not strand the next message.
   if(upward&&!near){s.reader++;s.following=false;}
   else if(near)s.following=true;
   if(s.following)follow();else setAway(!near);
  };
  const onResize=()=>{if(!valid())return;if(s.following)follow();else {const top=target();if(top!==null)setAway(Math.abs(top-thread!.scrollTop)>EDGE_PX);}};
  thread?.addEventListener('scroll',onScroll,{passive:true});
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(onResize);
  if(content)observer?.observe(content);if(thread)observer?.observe(thread);
  onResize();
  return()=>{s.alive=false;observer?.disconnect();thread?.removeEventListener('scroll',onScroll);};
 },[scope,blocked]);
 const jump=()=>{if(!valid())return;state.current.following=true;follow();};
 // Capture the reader's position generation at explicit submission. A later scroll
 // or navigation wins over late acknowledgements, including reconciled admissions.
 const continuation=()=>{const s=state.current,reader=s.reader;return()=>{if(state.current!==s||!valid()||s.reader!==reader)return;s.following=true;follow();};};
 return{threadRef,contentRef,away:!!scope&&!blocked&&away,jump,continuation};
}
