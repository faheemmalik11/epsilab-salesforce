import { useId, useState, type ReactNode } from 'react';
import { ButtonIcon } from './Icon';

/** A Lightning section band: the title is a button that collapses and expands the section's content. */
export function Section({ title, contentClassName = '', children }: { title: string; contentClassName?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const contentId = useId();
  return (
    <div className={`slds-section ${open ? 'slds-is-open' : ''}`} data-testid="section">
      <h3 className="slds-section__title">
        <button type="button" className="slds-button slds-section__title-action" aria-controls={contentId} aria-expanded={open} onClick={() => setOpen(!open)}>
          <ButtonIcon name="chevrondown" />
          <span className="slds-truncate" title={title}>
            {title}
          </span>
        </button>
      </h3>
      <div id={contentId} className={`slds-section__content ${contentClassName}`} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
