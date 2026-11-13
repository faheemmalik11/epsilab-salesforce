/** The Lightning loading indicator: brand blue dots, optionally on a white overlay over its container. */
export function Spinner({ size = 'medium', overlay }: { size?: 'small' | 'medium'; overlay?: boolean }) {
  const spinner = (
    <div role="status" className={`slds-spinner slds-spinner_${size} slds-spinner_brand`}>
      <span className="slds-assistive-text">Loading</span>
      <div className="slds-spinner__dot-a" />
      <div className="slds-spinner__dot-b" />
    </div>
  );
  return overlay ? <div className="slds-spinner_container">{spinner}</div> : <div className="slds-is-relative spinner-inline">{spinner}</div>;
}
