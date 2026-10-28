/**
 * Renderer entry. Renders the design specimen (`Specimen.tsx`): the Story 1.5
 * type and icon samples and the Story 1.6 primitives in each state. The
 * `--smoke` probe reads it.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design/index.css';
import './primitives/primitives.css';
import './specimen.css';
import { Specimen } from './Specimen';

const root = document.getElementById('root');
if (!root) throw new Error('renderer root element is missing');
createRoot(root).render(
  <StrictMode>
    <Specimen />
  </StrictMode>,
);
