/**
 * Renderer entry. Renders `App`: the Story 1.14 Shell (Sidebar, Header, Task),
 * or the design specimen (`Specimen.tsx`) at `#specimen`, which the `--smoke`
 * probes read.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design/index.css';
import './primitives/primitives.css';
import './specimen.css';
import './Shell/shell.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('renderer root element is missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
