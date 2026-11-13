/** The marker every out-of-scope entry point carries, so nothing is stubbed silently. */
export const STUB_TEXT = 'Not available in this trial';

export function StubBadge() {
  return (
    <span className="slds-badge slds-badge_lightest slds-m-left_x-small" data-testid="stub-badge">
      Stub
    </span>
  );
}
