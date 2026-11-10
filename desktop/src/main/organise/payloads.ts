/**
 * Payload validators for the `organise.*` operations (Story 1.14).
 *
 * Each takes exactly one plain object with exactly the declared keys. IDs and
 * operation IDs must be lowercase hyphenated UUIDs, text is bounded, and an
 * expected revision is a non-negative safe integer. No payload names a
 * principal, a path or a share: main binds the principal itself.
 */
import { OperationError, type PayloadValidator } from '../security/operations';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Longer than the domain allows, so the domain's own rules decide; this only stops oversized payloads. */
export const MAX_TEXT_PAYLOAD = 8192;

type FieldKind = 'uuid' | 'uuid?' | 'text' | 'text?' | 'revision' | 'boolean';
type FieldValue<K extends FieldKind> = K extends 'boolean' ? boolean : K extends 'uuid' | 'text' ? string : K extends 'uuid?' | 'text?' ? string | null : number;
type Shape = Record<string, FieldKind>;
type Parsed<S extends Shape> = { [K in keyof S]: FieldValue<S[K]> };

function field(kind: FieldKind, value: unknown, key: string): string | number | boolean | null {
  const nullable = kind.endsWith('?');
  if (nullable && value === null) return null;
  switch (kind) {
    case 'boolean':
      if(typeof value!=='boolean')throw new OperationError(`wrong type for ${key}`);
      return value;
    case 'uuid':
    case 'uuid?':
      if (typeof value !== 'string' || !UUID.test(value)) throw new OperationError(`${key} must be a UUID`);
      return value;
    case 'text':
    case 'text?':
      if (typeof value !== 'string' || value.length > MAX_TEXT_PAYLOAD) throw new OperationError(`wrong type for ${key}`);
      return value;
    case 'revision':
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new OperationError(`wrong type for ${key}`);
      return value;
  }
}

export function organisePayload<S extends Shape>(shape: S): PayloadValidator<Parsed<S>> {
  return (args) => {
    if (args.length !== 1) throw new OperationError('expected one argument');
    const value = args[0];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new OperationError('expected an object');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new OperationError('expected a plain object');
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(shape, key)) throw new OperationError(`unknown key ${key}`);
    }
    const out: Record<string, unknown> = {};
    for (const [key, kind] of Object.entries(shape)) {
      if (!Object.hasOwn(record, key)) throw new OperationError(`missing key ${key}`);
      out[key] = field(kind, record[key], key);
    }
    return out as Parsed<S>;
  };
}

export const treePayload = organisePayload({ workspaceId: 'uuid' });

export const engagementPayload = organisePayload({
  operationId: 'uuid',
  workspaceId: 'uuid',
  name: 'text',
  objectives: 'text',
  scope: 'text',
  clientEntity: 'text?',
  periodStart: 'text?',
  periodEnd: 'text?',
});

export const engagementUpdatePayload = organisePayload({
  operationId: 'uuid',
  workspaceId: 'uuid',
  engagementId: 'uuid',
  expectedRevision: 'revision',
  name: 'text',
  objectives: 'text',
  scope: 'text',
  clientEntity: 'text?',
  periodStart: 'text?',
  periodEnd: 'text?',
});

export const folderPayload = organisePayload({ operationId: 'uuid', workspaceId: 'uuid', engagementId: 'uuid', name: 'text' });

export const taskPayload = organisePayload({ operationId: 'uuid', workspaceId: 'uuid', engagementId: 'uuid?', folderId: 'uuid?', title: 'text' });

export const taskRenamePayload = organisePayload({ operationId: 'uuid', workspaceId: 'uuid', taskId: 'uuid', expectedRevision: 'revision', title: 'text' });

export const taskMovePayload = organisePayload({
  operationId: 'uuid',
  workspaceId: 'uuid',
  taskId: 'uuid',
  expectedRevision: 'revision',
  engagementId: 'uuid?',
  folderId: 'uuid?',
});

export const navigationPayload=organisePayload({operationId:'uuid',workspaceId:'uuid',taskId:'uuid',expectedRevision:'revision',pinned:'boolean',archived:'boolean'});
const contextShape=organisePayload({workspaceId:'uuid',expectedSnapshot:'text?'});
export const contextPayload:PayloadValidator<ReturnType<typeof contextShape>>=args=>{const v=contextShape(args);if(v.expectedSnapshot!==null&&!/^[0-9a-f]{64}$/.test(v.expectedSnapshot))throw new OperationError('Invalid inventory snapshot');return v;};
const searchShape=organisePayload({workspaceId:'uuid',query:'text',includeArchived:'boolean',cursor:'text?'});
export const searchPayload:PayloadValidator<ReturnType<typeof searchShape>>=args=>{const v=searchShape(args);if(!v.query.trim()||/[\u0000-\u001f\u007f-\u009f]/.test(v.query)||Buffer.byteLength(v.query.trim())>256||(v.cursor?.length??0)>4096)throw new OperationError('Invalid search');return {...v,query:v.query.trim()};};
const reopenShape=organisePayload({workspaceId:'uuid',taskId:'uuid',query:'text?',turnId:'text?',itemId:'text?'});
export const reopenPayload:PayloadValidator<ReturnType<typeof reopenShape>>=args=>{const v=reopenShape(args);if((v.query!==null&&(!v.query.trim()||/[\u0000-\u001f\u007f-\u009f]/.test(v.query)||Buffer.byteLength(v.query.trim())>256))||(v.turnId?.length??0)>256||(v.itemId?.length??0)>256||((v.turnId===null)!==(v.itemId===null))||(v.turnId!==null&&v.query===null))throw new OperationError('Invalid saved hit');return v;};
