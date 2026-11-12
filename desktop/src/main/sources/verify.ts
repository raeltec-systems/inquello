/**
 * Citation verification (Story 2.1). The app never trusts an answer's quoted
 * text: it runs the skill's own reader on the staged file inside the Task's
 * sandbox (`PolicyService.runTool`) and compares. The staged scripts are
 * writable by the agent, so the boot loader below executes them only after
 * their SHA-256 matches the copy this app ships; the staged file must still
 * have the hash recorded when it was attached.
 */
import { formatOf, locationLabel, normaliseQuote, type Citation, type SourceFormat } from './citations';
import { SKILL_DIR, type AttachmentView } from './attachments';

export interface ToolRun { exitCode: number; stdout: string; stderr: string }
export type RunInTask = (argv: string[]) => Promise<{ ok: true; value: ToolRun } | { ok: false; reason: string }>;

export interface ReferenceFile { name: string; relative: string; modifiedAt: string; sha256: string; bytes: number }
export interface ReferenceView {
  index: number;
  id: string;
  at: string;
  quote: string;
  format: SourceFormat;
  location: string;
  status: 'verified' | 'unverified';
  reason: string | null;
  file: ReferenceFile | null;
  extract: { text: string; ocr: boolean; converted: boolean; originalSha256: string | null; wholeFile: boolean } | null;
}

/** Python run with `-I -c`: verifies each reader module's digest, then executes those exact bytes. */
export const VERIFY_BOOT = `
import hashlib, json, os, sys, types
base = ${JSON.stringify(`${SKILL_DIR}/scripts`)}
want = json.loads(sys.argv[1])
order = ['readers/common.py', 'readers/read_text.py', 'readers/read_csv.py', 'readers/read_xlsx.py', 'readers/read_xls.py',
         'readers/read_docx.py', 'readers/read_pptx.py', 'readers/read_pdf.py', 'readers/read_image.py', 'readers/read_legacy.py',
         'readers/__init__.py', 'evidence.py']
if sorted(want) != sorted(order):
    print(json.dumps({'skillChanged': 'reader set'})); sys.exit(0)
code = {}
for rel in order:
    try:
        with open(os.path.join(base, rel), 'rb') as handle:
            data = handle.read()
    except OSError:
        print(json.dumps({'skillChanged': rel})); sys.exit(0)
    if hashlib.sha256(data).hexdigest() != want[rel]:
        print(json.dumps({'skillChanged': rel})); sys.exit(0)
    code[rel] = data
package = types.ModuleType('readers'); package.__path__ = []; package.__package__ = 'readers'
sys.modules['readers'] = package
for rel in order[:-1]:
    name = 'readers' if rel == 'readers/__init__.py' else 'readers.' + rel[len('readers/'):-3]
    module = package if name == 'readers' else types.ModuleType(name)
    module.__package__ = 'readers'; module.__file__ = rel
    sys.modules[name] = module
    if module is not package: setattr(package, name.split('.')[1], module)
    exec(compile(code[rel], rel, 'exec'), module.__dict__)
main = types.ModuleType('inquello_evidence'); main.__file__ = 'evidence.py'
exec(compile(code['evidence.py'], 'evidence.py', 'exec'), main.__dict__)
sys.exit(main.main(sys.argv[2:]))
`;

/** `context` lines (a CSV header brought along, a merged-cell note) are never matched; `match` is a cell's stored value, matched instead of the shown text with its formula. */
interface BatchResult { ok: boolean; reason?: string; sha256?: string; lines?: Array<{ label: string; text: string; context?: boolean; match?: string }>; ocr?: boolean; converted?: boolean; originalSha256?: string | null; noText?: boolean }

/** The prefix of every reason that means the check itself did not run (sandbox, timeout, script), not that the quote is wrong. */
export const CHECK_NOT_RUN = 'The reference could not be checked';

const WORD = /[\p{L}\p{N}]/u;
/** True when `needle` occurs in `haystack` as a whole: not directly preceded or followed by a letter or digit, so `100` is not found in `1100`. */
export function quotedIn(haystack: string, needle: string): boolean {
  if (!needle) return false;
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const before = Array.from(haystack.slice(Math.max(0, at - 2), at)).pop() ?? '';
    const after = String.fromCodePoint(haystack.codePointAt(at + needle.length) ?? 32);
    if (!WORD.test(before) && !WORD.test(after)) return true;
  }
  return false;
}

const unverified = (citation: Citation, index: number, reason: string, file: ReferenceFile | null = null): ReferenceView =>
  ({ index, id: citation.id, at: citation.at, quote: citation.quote, format: formatOf(citation.id), location: locationLabel(formatOf(citation.id), citation.at), status: 'unverified', reason, file, extract: null });

/**
 * Verifies citations against the staged material. Each is verified only when
 * the file was attached to this Task, the staged copy still has its recorded
 * hash, the location exists, and the quote is in the text found there.
 */
export async function verifyCitations(citations: readonly Citation[], attached: AttachmentView | null, digests: Record<string, string>, run: RunInTask): Promise<ReferenceView[]> {
  const files = new Map((attached?.files ?? []).map(file => [file.id, file]));
  const views: ReferenceView[] = citations.map((citation, index) => {
    const file = files.get(citation.id);
    return file ? { index, id: citation.id, at: citation.at, quote: citation.quote, format: file.format, location: locationLabel(file.format, citation.at), status: 'unverified', reason: 'Not yet checked', file: { name: file.name, relative: file.relative, modifiedAt: file.modifiedAt, sha256: file.sha256, bytes: file.bytes }, extract: null }
      : unverified(citation, index, 'The cited file is not in this Task’s attached material');
  });
  const pending = views.filter(view => view.file);
  if (pending.length === 0) return views;
  const request = pending.map(view => [view.id, view.at, view.file!.sha256]);
  const result = await run(['/usr/bin/python3', '-I', '-c', VERIFY_BOOT, JSON.stringify(digests), 'verify-batch', JSON.stringify(request)]);
  const fail = (reason: string) => { for (const view of pending) view.reason = reason; return views; };
  if (!result.ok) return fail(`${CHECK_NOT_RUN}: ${result.reason}`);
  if (result.value.exitCode !== 0) return fail(`${CHECK_NOT_RUN}: the reading script failed`);
  let parsed: unknown;
  try { parsed = JSON.parse(result.value.stdout); } catch { return fail(`${CHECK_NOT_RUN}: unreadable result`); }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'skillChanged' in parsed) return fail('The reading scripts in the Task folder were changed; references cannot be checked');
  if (!Array.isArray(parsed) || parsed.length !== pending.length) return fail(`${CHECK_NOT_RUN}: incomplete result`);
  pending.forEach((view, position) => {
    const item = parsed[position] as BatchResult;
    if (!item || typeof item !== 'object' || item.ok !== true || !Array.isArray(item.lines)) { view.reason = typeof item?.reason === 'string' ? item.reason : 'Nothing at that location'; return; }
    if (item.sha256 !== view.file!.sha256) { view.reason = 'The staged copy changed since it was attached'; return; }
    const text = item.lines.map(line => `${line.label}: ${line.text}`).join('\n');
    const wholeFile = view.format === 'image' && view.at === '';
    const haystack = normaliseQuote(item.lines.filter(line => line.context !== true).map(line => typeof line.match === 'string' ? line.match : line.text).join(' '));
    if (!wholeFile && !quotedIn(haystack, normaliseQuote(view.quote))) { view.reason = 'The quoted text is not at that location'; return; }
    view.status = 'verified';
    view.reason = null;
    view.extract = { text, ocr: item.ocr === true, converted: item.converted === true, originalSha256: typeof item.originalSha256 === 'string' ? item.originalSha256 : null, wholeFile };
  });
  return views;
}
