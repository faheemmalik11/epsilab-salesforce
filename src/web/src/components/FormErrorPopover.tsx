import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { ButtonIcon } from './Icon';

export interface ErrorField {
  /** Id of the input the link moves focus to. */
  inputId: string;
  label: string;
}

/** The org's error mark, a circle with a slash; the SLDS 1 sprite has no outline version of it. */
function ErrorGlyph() {
  return (
    <svg className="form-error__glyph" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.6 12.4 12.4 3.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Lightning's form error: an icon button in the dialog footer with a "We hit a snag." popover above it.
 * The API's messages are shown exactly as returned, followed by links to the fields they name.
 */
export function FormErrorPopover({ error, fields }: { error: unknown; fields: ErrorField[] }) {
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(true), [error]);
  if (!error) return null;
  const messages = error instanceof ApiError ? error.errors.map((e) => e.message) : [String((error as Error).message ?? error)];

  return (
    <span className="form-error">
      <button type="button" className="slds-button slds-button_icon form-error__toggle" title="Review the errors" aria-expanded={open} data-testid="form-error-toggle" onClick={() => setOpen(!open)}>
        <ErrorGlyph />
        <span className="slds-assistive-text">Review the errors</span>
      </button>
      {open && (
        <section className="slds-popover slds-popover_error slds-nubbin_bottom form-error__popover" role="alert" data-testid="page-error">
          <header className="slds-popover__header form-error__header">
            <ErrorGlyph />
            <h2 className="slds-truncate form-error__title">We hit a snag.</h2>
            <button type="button" className="slds-button slds-button_icon form-error__close" title="Close error dialog" onClick={() => setOpen(false)}>
              <ButtonIcon name="close" />
              <span className="slds-assistive-text">Close error dialog</span>
            </button>
          </header>
          <div className="slds-popover__body form-error__body">
            <strong>Review the errors on this page.</strong>
            <ul>
              {messages.map((message) => (
                <li key={message} data-testid="page-error-message">
                  {message}
                </li>
              ))}
            </ul>
            {fields.length > 0 && (
              <>
                <strong>Review the following fields</strong>
                <ul>
                  {fields.map((field) => (
                    <li key={field.inputId}>
                      <button type="button" className="slds-button form-error__field" data-testid="form-error-field" onClick={() => document.getElementById(field.inputId)?.focus()}>
                        {field.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}
    </span>
  );
}
