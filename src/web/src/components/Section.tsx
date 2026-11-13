import { useId, useState, type ReactNode } from 'react';
import { ButtonIcon } from './Icon';

interface SectionProps {
  title: string;
  contentClassName?: string;
  /** Record pages collapse their sections; Lightning's New and Edit dialogs show a plain band. */
  collapsible?: boolean;
  children: ReactNode;
}

/** A Lightning section band. On record pages the title is a button that collapses and expands the content. */
export function Section({ title, contentClassName = '', collapsible = true, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  const contentId = useId();
  if (!collapsible) {
    return (
      <div className="slds-section slds-is-open" data-testid="section">
        <h3 className="slds-section__title slds-theme_shade">
          <span className="slds-truncate slds-p-horizontal_small" title={title}>
            {title}
          </span>
        </h3>
        <div className={`slds-section__content ${contentClassName}`}>{children}</div>
      </div>
    );
  }
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
