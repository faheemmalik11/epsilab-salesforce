import type { ReactElement } from 'react';

// Outline icons for app sidebar items that SLDS has no close match for. Drawn for this project
// in the style of the Lightning app rail (2px white strokes on a 24px grid); not Salesforce artwork.

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const OUTLINE_ICONS: Record<string, ReactElement> = {
  sales: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" {...stroke} />
      <path d="M7 16l3.5-4 3 2.5L17 9" {...stroke} />
      <path d="M14.5 9H17v2.5" {...stroke} />
    </svg>
  ),
  service: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" {...stroke} />
    </svg>
  ),
  marketing: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7" {...stroke} />
      <path d="M15.6 15.6L21 21" {...stroke} />
      <circle cx="10.5" cy="8.8" r="2" {...stroke} />
      <path d="M7 14.2c.8-1.6 2-2.4 3.5-2.4s2.7.8 3.5 2.4" {...stroke} />
    </svg>
  ),
  commerce: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 4h2.6l2.3 10.4a1.5 1.5 0 0 0 1.5 1.2h8.5a1.5 1.5 0 0 0 1.5-1.1L20.6 8H6.2" {...stroke} />
      <circle cx="9.5" cy="19.5" r="1.3" {...stroke} />
      <circle cx="17" cy="19.5" r="1.3" {...stroke} />
    </svg>
  ),
};
