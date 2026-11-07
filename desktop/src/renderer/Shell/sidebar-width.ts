/** Presentation preference only: never authority, identity or task state. */
import {spacing} from '../design/tokens';
export const DEFAULT_SIDEBAR_WIDTH = Number.parseFloat(spacing['sidebar-width']);
export const MIN_SIDEBAR_WIDTH = 280;
export const MAX_SIDEBAR_WIDTH = 424;
export const SIDEBAR_WIDTH_KEY = 'inquello.sidebar-width.v1';
export function clampSidebarWidth(value: number, maximum = MAX_SIDEBAR_WIDTH): number {
 return Math.round(Math.max(MIN_SIDEBAR_WIDTH, Math.min(Math.max(MIN_SIDEBAR_WIDTH, maximum), Number.isFinite(value) ? value : DEFAULT_SIDEBAR_WIDTH)));
}
export function readSidebarWidth(): number {
 try {const raw=globalThis.localStorage?.getItem(SIDEBAR_WIDTH_KEY);if(raw===null||raw===undefined||!/^\d{3}$/.test(raw))return DEFAULT_SIDEBAR_WIDTH;const value=Number(raw);return value>=MIN_SIDEBAR_WIDTH&&value<=MAX_SIDEBAR_WIDTH?value:DEFAULT_SIDEBAR_WIDTH;} catch{return DEFAULT_SIDEBAR_WIDTH;}
}
export function saveSidebarWidth(value:number):void {try{globalThis.localStorage?.setItem(SIDEBAR_WIDTH_KEY,String(clampSidebarWidth(value)));}catch{/* Storage unavailable: retain this window's preference only. */}}
