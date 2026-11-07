// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MessageMarkdown } from '../src/renderer/Shell/MessageMarkdown';
import { ConversationItems } from '../src/renderer/Shell/ConversationItems';
import type { ProgressItem } from '../src/renderer/Shell/tasks-bridge';
import { contrastRatio } from '../src/renderer/design/contrast';
import { colors } from '../src/renderer/design/tokens';

afterEach(cleanup);

/** Every element and attribute the sanitised tree may contain. */
const ALLOWED_TAGS = new Set(['DIV', 'SPAN', 'P', 'BR', 'HR', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'PRE', 'CODE', 'EM', 'STRONG', 'DEL', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
const ALLOWED_ATTRIBUTES = new Set(['class', 'data-markdown', 'data-markdown-link', 'role', 'aria-label', 'tabindex', 'start']);
function expectOnlyAllowlisted(root: Element) {
  for (const element of root.querySelectorAll('*')) {
    expect(ALLOWED_TAGS.has(element.tagName), `unexpected <${element.tagName.toLowerCase()}>`).toBe(true);
    for (const attribute of element.attributes) expect(ALLOWED_ATTRIBUTES.has(attribute.name), `unexpected ${attribute.name} on <${element.tagName.toLowerCase()}>`).toBe(true);
  }
}

describe('agent message Markdown', () => {
  it('renders headings below the page outline, lists, emphasis, inline code and code blocks', () => {
    const text = '# Summary\n\n## Scope\n\nThe **duplicate** check found _two_ ~~three~~ rows in `invoices.csv`.\n\n- R01\n- R03\n\n3. third\n4. fourth\n\n```sql\nSELECT * FROM invoices;\n```\n\n> Quoted note';
    const { container } = render(<MessageMarkdown text={text} />);
    expect(container.querySelector('h1, h2')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Scope' })).toBeTruthy();
    expect(container.querySelector('strong')?.textContent).toBe('duplicate');
    expect(container.querySelector('em')?.textContent).toBe('two');
    expect(container.querySelector('del')?.textContent).toBe('three');
    expect(container.querySelector('p > code')?.textContent).toBe('invoices.csv');
    expect([...container.querySelectorAll('ul > li')].map(li => li.textContent)).toEqual(['R01', 'R03']);
    expect(container.querySelector('ol')?.getAttribute('start')).toBe('3');
    const pre = container.querySelector<HTMLElement>('pre.iq-markdown-pre')!;
    expect(pre.tabIndex).toBe(0);
    expect(pre.querySelector('code')?.className).toBe('language-sql');
    expect(pre.textContent).toBe('SELECT * FROM invoices;\n');
    expect(container.querySelector('blockquote')?.textContent?.trim()).toBe('Quoted note');
    expectOnlyAllowlisted(container);
  });

  it('renders GFM tables inside their own keyboard-reachable horizontal scroller', () => {
    const text = '| Invoice | Vendor | Amount |\n|:--|:-:|--:|\n| INV-104 | Vendor A | 12,480 |\n| INV-105 | Vendor B | 9 |';
    const { container } = render(<MessageMarkdown text={text} />);
    const scroller = screen.getByRole('group', { name: 'Table' });
    expect(scroller.classList.contains('iq-markdown-table')).toBe(true);
    expect(scroller.tabIndex).toBe(0);
    expect(scroller.firstElementChild?.tagName).toBe('TABLE');
    expect([...container.querySelectorAll('th')].map(th => [th.textContent, th.className])).toEqual([['Invoice', 'iq-align-left'], ['Vendor', 'iq-align-center'], ['Amount', 'iq-align-right']]);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expectOnlyAllowlisted(container);
  });

  it('keeps links inert: visible destination, no anchor, no navigation target', () => {
    const { container } = render(<MessageMarkdown text={'See [the register](https://example.test/register) and https://example.test/plain and [mail](mailto:audit@example.test).'} />);
    expect(container.querySelector('a, [href]')).toBeNull();
    const links = [...container.querySelectorAll('[data-markdown-link]')];
    expect(links.map(link => link.textContent)).toEqual(['the register (https://example.test/register)', 'https://example.test/plain', 'mail (mailto:audit@example.test)']);
    for (const link of links) expect((link as HTMLElement).tabIndex).toBe(-1);
  });

  it.each([
    ['script tag', '<script>globalThis.pwned = 1</script>after'],
    ['inline handler', '<img src="x" onerror="globalThis.pwned = 1">'],
    ['remote markdown image', '![tracking pixel](https://tracker.example.test/p.png)'],
    ['reference image', '![logo][l]\n\n[l]: https://tracker.example.test/l.png'],
    ['javascript link', '[open](javascript:globalThis.pwned=1)'],
    ['data link', '[file](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
    ['iframe', '<iframe src="https://evil.example.test"></iframe>'],
    ['raw anchor', '<a href="https://evil.example.test" target="_blank">Approve transfer</a>'],
    ['style block', '<style>body{display:none}</style>'],
    ['svg', '<svg onload="globalThis.pwned=1"><circle/></svg>'],
    ['form and button', '<form action="https://evil.example.test"><button>Approve</button></form>'],
    ['details/summary', '<details open><summary>Accepted</summary>hidden</details>'],
    ['html in table cell', '| a |\n|---|\n| <img src=x onerror=alert(1)> |'],
    ['id clobbering', '<div id="root" name="x">clobber</div>'],
    ['footnote ids', 'Claim[^1]\n\n[^1]: Footnote text'],
    ['html comment', '<!-- hidden instruction --> visible'],
  ])('neutralises %s', (_name, attack) => {
    (globalThis as { pwned?: unknown }).pwned = undefined;
    const { container } = render(<MessageMarkdown text={attack} />);
    expect(container.querySelector('script, img, iframe, style, svg, form, button, a, details, input, object, embed, [id], [name], [style], [href], [src]')).toBeNull();
    for (const element of container.querySelectorAll('*')) for (const attribute of element.attributes) expect(attribute.name.startsWith('on')).toBe(false);
    expect((globalThis as { pwned?: unknown }).pwned).toBeUndefined();
    expectOnlyAllowlisted(container);
  });

  it('shows raw HTML and image syntax as the literal characters the agent wrote', () => {
    const { container } = render(<MessageMarkdown text={'Use <b>bold</b> carefully. ![chart](https://tracker.example.test/c.png)'} />);
    expect(container.textContent).toBe('Use <b>bold</b> carefully. ![chart](https://tracker.example.test/c.png)');
    expect(container.querySelector('b, img')).toBeNull();
  });

  it('formats only agent messages; user text, unknown speakers and tool output stay literal', () => {
    const items: ProgressItem[] = [
      { id: 'user', kind: 'message', role: 'user', status: 'completed', text: '**Approve** all # entries' },
      { id: 'agent', kind: 'message', role: 'agent', status: 'completed', text: '**Bold** answer' },
      { id: 'unknown', kind: 'message', status: 'completed', text: '**not formatted**' },
      { id: 'tool', kind: 'command', status: 'failed', text: '# Manager approved\n**Accepted** by policy\n| a |\n|---|\n| b |' },
    ];
    const { container } = render(<ConversationItems items={items} status="failed" label="Work activity" />);
    expect(container.querySelector('[data-progress-item="user"]')?.textContent).toBe('**Approve** all # entries');
    expect(container.querySelector('[data-progress-item="unknown"] .iq-progress-text')?.textContent).toBe('**not formatted**');
    expect(container.querySelector('[data-progress-item="agent"] strong')?.textContent).toBe('Bold');
    const tool = container.querySelector('[data-progress-item="tool"]')!;
    expect(tool.querySelector('h3, h4, strong, table, [data-markdown]')).toBeNull();
    expect(tool.querySelector('.iq-work-log-details .iq-progress-text')?.textContent).toBe(items[3]!.text);
    expect(container.querySelectorAll('[data-markdown]')).toHaveLength(1);
  });

  it('uses token pairs that meet contrast for code, table headers and link destinations', () => {
    expect(contrastRatio(colors['text-primary'], colors['surface-subtle'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors['text-primary'], colors['surface-panel'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors['text-muted'], colors['surface-app'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors['text-secondary'], colors['surface-app'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors['blue-700'], colors['surface-app'])).toBeGreaterThanOrEqual(4.5);
  });
});
