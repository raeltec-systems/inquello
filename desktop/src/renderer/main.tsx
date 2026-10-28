/**
 * Renderer entry. Story 1.5 renders a minimal design specimen: title text, one
 * decorative and one informative icon, and a visually hidden span in each of
 * the five IBM Plex faces so all five load. The `--smoke` probe reads it.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design/index.css';
import './specimen.css';
import { Icon } from './icons/Icon';

const FACES = [
  ['sans', 400],
  ['sans', 500],
  ['sans', 600],
  ['mono', 400],
  ['mono', 500],
] as const;

function Specimen() {
  return (
    <main className="specimen">
      <h1 className="specimen-title">Inquello</h1>
      <p className="specimen-body">Design tokens, IBM Plex and icon semantics. Desktop features arrive in later stories.</p>
      <div className="specimen-icons">
        <span className="specimen-icon-row" data-probe="icon-decorative">
          <Icon name="search" />
          <span>Search</span>
        </span>
        <span className="specimen-icon-row" data-probe="icon-informative">
          <Icon name="triangle-alert" label="Needs evidence" />
        </span>
      </div>
      <div className="specimen-weights" aria-hidden="true">
        {FACES.map(([family, weight]) => (
          <span key={`${family}-${weight}`} className={`specimen-${family} specimen-${weight}`}>
            Inquello {family} {weight}
          </span>
        ))}
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('renderer root element is missing');
createRoot(root).render(
  <StrictMode>
    <Specimen />
  </StrictMode>,
);
