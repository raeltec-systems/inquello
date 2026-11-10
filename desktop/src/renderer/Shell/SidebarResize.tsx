import {useRef,type ReactElement} from 'react';
import {clampSidebarWidth,DEFAULT_SIDEBAR_WIDTH,MIN_SIDEBAR_WIDTH,MAX_SIDEBAR_WIDTH} from './sidebar-width';
/** Pointer capture owns the drag; no document listeners survive navigation/unmount. */
export function SidebarResize({width,maximum=MAX_SIDEBAR_WIDTH,onChange}:{width:number;maximum?:number;onChange:(width:number)=>void}):ReactElement {
 const drag=useRef<{id:number;left:number}|null>(null);
 const change=(value:number)=>onChange(clampSidebarWidth(value,maximum));
 return <div role="separator" aria-label="Sidebar width" aria-orientation="vertical" aria-valuemin={MIN_SIDEBAR_WIDTH} aria-valuemax={Math.max(MIN_SIDEBAR_WIDTH,maximum)} aria-valuenow={width} aria-valuetext={`${width} pixels. Arrow keys resize; Enter resets.`} tabIndex={0} className="iq-sidebar-resize"
 onPointerDown={event=>{if(event.button!==0||drag.current)return;event.preventDefault();drag.current={id:event.pointerId,left:event.currentTarget.parentElement?.getBoundingClientRect().left??0};event.currentTarget.setPointerCapture?.(event.pointerId);}}
 onPointerMove={event=>{if(drag.current&&drag.current.id===event.pointerId)change(event.clientX-drag.current.left);}}
 onPointerUp={event=>{if(drag.current&&drag.current.id===event.pointerId){drag.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);}}}
 onPointerCancel={event=>{if(drag.current?.id===event.pointerId)drag.current=null;}} onLostPointerCapture={event=>{if(drag.current?.id===event.pointerId)drag.current=null;}}
 onDoubleClick={()=>change(DEFAULT_SIDEBAR_WIDTH)}
 onKeyDown={event=>{const value=event.key==='ArrowLeft'?width-16:event.key==='ArrowRight'?width+16:event.key==='Home'?MIN_SIDEBAR_WIDTH:event.key==='End'?maximum:event.key==='Enter'?DEFAULT_SIDEBAR_WIDTH:null;if(value!==null){event.preventDefault();event.stopPropagation();change(value);}}}/>;
}
