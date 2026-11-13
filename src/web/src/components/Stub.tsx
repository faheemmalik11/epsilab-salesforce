/** The wording every out-of-scope entry point uses, so nothing is stubbed silently. */
export const STUB_TEXT = 'Not in scope';

/** Tooltip text naming the out-of-scope feature. */
export function scopeTitle(feature: string): string {
  return `${feature} is not in scope for this Salesforce clone`;
}

/** The subtle label beside a disabled, out-of-scope control. */
export function ScopeLabel({ feature }: { feature?: string }) {
  return (
    <span className="scope-label" data-testid="scope-label" title={feature ? scopeTitle(feature) : STUB_TEXT}>
      {STUB_TEXT}
    </span>
  );
}
