/**
 * Agent message text rendered as sanitised Markdown (GFM). Presentation only.
 *
 * - Raw HTML in the message is shown as the literal characters the agent wrote;
 *   it never becomes markup. Images never load: they stay literal Markdown text.
 * - The rendered tree passes a strict allowlist (rehype-sanitize) before React
 *   sees it: no scripts, styles, iframes, images, ids, inline styles or event
 *   attributes reach the DOM.
 * - Links are inert. They render as text with their destination visible, never
 *   as an anchor, so nothing in an agent message can navigate the app window or
 *   open the system browser. Main's navigation policy remains the backstop.
 *
 * Only agent messages use this. User text, tool output, refusals, permission
 * text and notices stay plain and literal.
 */
import { memo, type ReactElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize';

interface MdNode { type: string; value?: string; alt?: string | null; url?: string; children?: MdNode[]; label?: string | null; identifier?: string }
interface HastNode { type: string; value?: string; children?: HastNode[] }

/** The written source of nodes that must never become markup or a fetch. */
function literal(node: MdNode): MdNode | null {
  if (node.type === 'html') return { type: 'text', value: node.value ?? '' };
  if (node.type === 'image') return { type: 'text', value: `![${node.alt ?? ''}](${node.url ?? ''})` };
  if (node.type === 'imageReference') return { type: 'text', value: `![${node.alt ?? ''}]${node.label ? `[${node.label}]` : ''}` };
  return null;
}

/** remark plugin: raw HTML and images become plain text before any HTML exists. */
export function remarkLiteralUnsafe() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    node.children = node.children.map(child => literal(child) ?? (walk(child), child));
  };
  return (tree: MdNode) => { walk(tree); };
}

const ALIGN = ['left', 'right', 'center'];

/** Strict allowlist. Anything not named here is unwrapped to its text or dropped. */
export const MARKDOWN_SCHEMA: SanitizeSchema = {
  tagNames: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code',
    'em', 'strong', 'del', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'],
  attributes: {
    a: ['href'],
    ol: ['start', ['className', 'contains-task-list']],
    ul: [['className', 'contains-task-list']],
    li: [['className', 'task-list-item']],
    code: [['className', /^language-[\w+#.-]{1,32}$/]],
    th: [['align', ...ALIGN]],
    td: [['align', ...ALIGN]],
    input: [['type', 'checkbox'], ['disabled', true], 'checked'],
  },
  required: { input: { type: 'checkbox', disabled: true } },
  ancestors: { li: ['ol', 'ul'], thead: ['table'], tbody: ['table'], tr: ['table'], th: ['table'], td: ['table'], input: ['li'] },
  protocols: { href: ['http', 'https', 'mailto'] },
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math'],
  clobber: ['id', 'name'],
  clobberPrefix: 'user-content-',
  allowComments: false,
  allowDoctypes: false,
};

function hastText(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(hastText).join('');
}

function alignClass(style: { textAlign?: unknown } | undefined): string | undefined {
  const align = style?.textAlign;
  return typeof align === 'string' && ALIGN.includes(align) ? `iq-align-${align}` : undefined;
}

type HeadingProps = { node?: unknown; children?: ReactNode };
/** Agent headings sit below the page's own headings: h1 → h3, h2 → h4, deeper → h5/h6. */
const heading = (level: 1 | 2 | 3 | 4 | 5 | 6) => function MarkdownHeading({ children }: HeadingProps): ReactElement {
  const shifted = Math.min(6, level + 2);
  const Tag = `h${shifted}` as 'h3' | 'h4' | 'h5' | 'h6';
  return <Tag className={`iq-markdown-heading iq-markdown-h${level}`}>{children}</Tag>;
};

const components: Components = {
  a({ href, children, node }) {
    const label = hastText(node as HastNode | undefined).trim();
    const target = typeof href === 'string' ? href : '';
    const shown = target && ![label, `mailto:${label}`, `http://${label}`, `https://${label}`].includes(target);
    return <span className="iq-markdown-link" data-markdown-link>{children}{shown ? <span className="iq-markdown-link-target"> ({target})</span> : null}</span>;
  },
  h1: heading(1), h2: heading(2), h3: heading(3), h4: heading(4), h5: heading(5), h6: heading(6),
  table({ children }) {
    return <div className="iq-markdown-table" role="group" aria-label="Table" tabIndex={0}><table>{children}</table></div>;
  },
  // Alignment arrives as an inline style; carry it as a class so no style attribute reaches the DOM.
  th({ children, style }) { return <th className={alignClass(style)}>{children}</th>; },
  td({ children, style }) { return <td className={alignClass(style)}>{children}</td>; },
  pre({ children }) {
    return <pre className="iq-markdown-pre" tabIndex={0}>{children}</pre>;
  },
  input({ checked }) {
    return <span className="iq-markdown-task">{checked ? '[x]' : '[ ]'} </span>;
  },
};

const remarkPlugins = [remarkGfm, remarkLiteralUnsafe];
const rehypePlugins: NonNullable<Parameters<typeof Markdown>[0]['rehypePlugins']> = [[rehypeSanitize, MARKDOWN_SCHEMA]];

/** Sanitised Markdown for one agent message; re-renders only when its text changes. */
export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }): ReactElement {
  return <div className="iq-progress-text iq-markdown" data-markdown>
    <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components} skipHtml={false}>{text}</Markdown>
  </div>;
});
