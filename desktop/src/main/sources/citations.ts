/**
 * Citation directives in an answer (Story 2.1), following the Codex
 * `:codex-file-citation{path="..."}` directive form with a location and quote:
 *
 *   :inquello-source{id="attached/ap-ledger.xlsx" at="Ledger!C8" quote="12346"}
 *
 * Parsing only recognises the form and the location grammar for the file's
 * format. It never decides that a reference is verified; `verify.ts` re-reads
 * the location from the staged file and compares the quote.
 */
export type SourceFormat = 'text' | 'csv' | 'xlsx' | 'xls' | 'docx' | 'doc' | 'pptx' | 'ppt' | 'pdf' | 'image' | 'unsupported';

export interface Citation {
  /** Offset of the directive in the answer text. */
  start: number;
  end: number;
  raw: string;
  /** Staged relative path, always under `attached/`. */
  id: string;
  at: string;
  quote: string;
}

export interface CitationProblem { start: number; end: number; raw: string; reason: string }

const EXTENSIONS: Record<string, SourceFormat> = {
  '.txt': 'text', '.md': 'text', '.markdown': 'text', '.json': 'text', '.xml': 'text', '.log': 'text', '.yaml': 'text', '.yml': 'text',
  '.ini': 'text', '.cfg': 'text', '.html': 'text', '.htm': 'text', '.sql': 'text', '.eml': 'text',
  '.csv': 'csv', '.tsv': 'csv', '.xlsx': 'xlsx', '.xlsm': 'xlsx', '.xls': 'xls', '.docx': 'docx', '.docm': 'docx', '.doc': 'doc',
  '.pptx': 'pptx', '.pptm': 'pptx', '.ppt': 'ppt', '.pdf': 'pdf',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.tif': 'image', '.tiff': 'image', '.gif': 'image', '.bmp': 'image', '.webp': 'image',
};

export function formatOf(name: string): SourceFormat {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? 'unsupported' : EXTENSIONS[name.slice(dot).toLowerCase()] ?? 'unsupported';
}

const RANGE = String.raw`\d{1,7}(?:-[A-Z]{0,2}\d{1,7})?`;
const CELL = String.raw`[A-Z]{1,3}\d{1,7}`;
const SHEET = String.raw`(?:'(?:[^']|'')+'|[^!':\\/?*\[\]]+)`;
const LOCATORS: Record<Exclude<SourceFormat, 'unsupported'>, RegExp> = {
  text: new RegExp(`^L${RANGE}$`),
  csv: new RegExp(`^R${RANGE}$`),
  xlsx: new RegExp(`^${SHEET}!${CELL}(?::${CELL})?$`),
  xls: new RegExp(`^${SHEET}!${CELL}(?::${CELL})?$`),
  docx: new RegExp(`^(?:P|F|C)${RANGE}$`),
  doc: new RegExp(`^(?:P|F|C)${RANGE}$`),
  pptx: new RegExp(`^S${RANGE}$`),
  ppt: new RegExp(`^S${RANGE}$`),
  pdf: new RegExp(`^PG\\d{1,6}(?::L${RANGE})?$`),
  image: new RegExp(`^(?:|L${RANGE})$`),
};

/** True when `at` is a location in the file's own terms. */
export function validLocator(format: SourceFormat, at: string): boolean {
  return format !== 'unsupported' && at.length <= 512 && LOCATORS[format].test(at);
}

/** Plain words for a location, for the reference chip. */
export function locationLabel(format: SourceFormat, at: string): string {
  const range = (prefix: string, noun: string, plural: string) => {
    const match = new RegExp(`^${prefix}(\\d+)(?:-[A-Z]*(\\d+))?$`).exec(at);
    if (!match) return at;
    return match[2] && match[2] !== match[1] ? `${plural} ${match[1]}–${match[2]}` : `${noun} ${match[1]}`;
  };
  switch (format) {
    case 'text': return range('L', 'line', 'lines');
    case 'csv': return range('R', 'row', 'rows');
    case 'xlsx': case 'xls': { const bang = at.lastIndexOf('!'); return `sheet ${at.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'")}, ${at.slice(bang + 1).includes(':') ? 'cells' : 'cell'} ${at.slice(bang + 1)}`; }
    case 'docx': case 'doc': return at.startsWith('F') ? range('F', 'footnote', 'footnotes') : at.startsWith('C') ? range('C', 'comment', 'comments') : range('P', 'paragraph', 'paragraphs');
    case 'pptx': case 'ppt': return range('S', 'slide', 'slides');
    case 'pdf': { const match = /^PG(\d+)(?::L(\d+)(?:-L?(\d+))?)?$/.exec(at); if (!match) return at; return `page ${match[1]}${match[2] ? match[3] && match[3] !== match[2] ? `, lines ${match[2]}–${match[3]}` : `, line ${match[2]}` : ''}`; }
    case 'image': return at === '' ? 'whole image' : range('L', 'recognised line', 'recognised lines');
    default: return at;
  }
}

const DIRECTIVE = /:inquello-source\{((?:[^{}"]|"(?:[^"\\]|\\.)*")*)\}/g;
const ATTRIBUTE = /\s*([a-z]+)="((?:[^"\\]|\\.)*)"\s*/gy;
const MAX_CITATIONS = 500;

function unescape(value: string): string {
  return value.replace(/\\(.)/g, '$1');
}

/** Every directive in an answer: well-formed citations and the problems with the rest. */
export function parseCitations(answer: string): { citations: Citation[]; problems: CitationProblem[] } {
  const citations: Citation[] = [];
  const problems: CitationProblem[] = [];
  for (const match of answer.matchAll(DIRECTIVE)) {
    const start = match.index, raw = match[0], end = start + raw.length;
    if (citations.length + problems.length >= MAX_CITATIONS) { problems.push({ start, end, raw, reason: 'Too many references in one answer' }); continue; }
    const attributes = new Map<string, string>();
    const body = match[1]!;
    ATTRIBUTE.lastIndex = 0;
    let parsed: RegExpExecArray | null, consumed = 0, duplicate = false;
    while ((parsed = ATTRIBUTE.exec(body)) !== null) {
      if (attributes.has(parsed[1]!)) duplicate = true;
      attributes.set(parsed[1]!, unescape(parsed[2]!));
      consumed = ATTRIBUTE.lastIndex;
    }
    const id = attributes.get('id'), at = attributes.get('at') ?? '', quote = attributes.get('quote') ?? '';
    const reason = duplicate || consumed !== body.length || [...attributes.keys()].some(key => !['id', 'at', 'quote'].includes(key)) ? 'The reference is malformed'
      : !id ? 'The reference names no file'
      : !isStagedId(id) ? 'The reference does not name an attached file'
      : !validLocator(formatOf(id), at) ? 'The location is not in this file’s own terms'
      : quote.length > 2000 ? 'The quoted text is too long'
      : quote.trim() === '' && !(formatOf(id) === 'image' && at === '') ? 'The reference quotes no text'
      : null;
    if (reason) problems.push({ start, end, raw, reason });
    else citations.push({ start, end, raw, id: id!, at, quote });
  }
  return { citations, problems };
}

export interface ComputedMarker { start: number; end: number; command: string; from: string }
export interface InferenceMarker { start: number; end: number }
const COMPUTED = /:inquello-computed\{((?:[^{}"]|"(?:[^"\\]|\\.)*")*)\}/g;
const INFERENCE = /:inquello-inference\{\s*\}/g;

/**
 * Computed figures keep the command that produced them so a reviewer can
 * re-perform it; inferences are the agent's own and are marked as such. A
 * computed marker without a command is ignored (shown as plain text).
 */
export function parseMarkers(answer: string): { computed: ComputedMarker[]; inferences: InferenceMarker[] } {
  const computed: ComputedMarker[] = [];
  for (const match of answer.matchAll(COMPUTED)) {
    const attributes = new Map<string, string>();
    ATTRIBUTE.lastIndex = 0;
    let parsed: RegExpExecArray | null;
    while ((parsed = ATTRIBUTE.exec(match[1]!)) !== null) attributes.set(parsed[1]!, unescape(parsed[2]!));
    const command = attributes.get('command') ?? '';
    if (command.trim() && command.length <= 8000 && computed.length < MAX_CITATIONS) computed.push({ start: match.index, end: match.index + match[0].length, command, from: (attributes.get('from') ?? '').slice(0, 2000) });
  }
  const inferences = [...answer.matchAll(INFERENCE)].slice(0, MAX_CITATIONS).map(match => ({ start: match.index, end: match.index + match[0].length }));
  return { computed, inferences };
}

/** A staged path: `attached/` plus safe relative segments, never escaping it. */
export function isStagedId(id: string): boolean {
  if (!id.startsWith('attached/') || id.length > 1100 || id.includes('\\') || id.includes('\0')) return false;
  return id.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

/** The comparison form shared with the reading scripts' `normalise`. */
export function normaliseQuote(text: string): string {
  return text.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
}
