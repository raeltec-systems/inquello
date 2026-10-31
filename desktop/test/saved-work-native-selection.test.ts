import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
const require=createRequire(import.meta.url);
const {required,verifySelection}=require('../scripts/run-navigation-native.cjs') as {required:string[];verifySelection:(output:string)=>Set<string>};
describe('native saved-work witnesses must actually be selected',()=>{
 it('rejects empty and partially selected native matrices',()=>{expect(()=>verifySelection('0 tests')).toThrow();expect(()=>verifySelection(required.slice(1).map(n=>`${n}: test`).join('\n'))).toThrow(required[0]);});
 it('requires paginated/legacy exact hits and private denials on both bindings',()=>{expect(required).toHaveLength(14);expect(verifySelection(required.map(n=>`${n}: test`).join('\n')).size).toBe(14);});
});
