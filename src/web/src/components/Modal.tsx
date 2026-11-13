import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ButtonIcon } from './Icon';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** Large is the 1024px Convert Lead dialog. */
  size?: 'small' | 'medium' | 'large';
  /** Unsaved changes: closing asks to discard them first. */
  dirty?: boolean;
}

/** The discard prompt shown over a form with unsaved changes. */
function DiscardPrompt({ onKeep, onDiscard }: { onKeep(): void; onDiscard(): void }) {
  return (
    <>
      <section role="alertdialog" aria-modal="true" aria-label="Discard Changes?" className="slds-modal slds-modal_prompt slds-fade-in-open modal-discard" data-testid="discard-prompt">
        <div className="slds-modal__container">
          <div className="slds-modal__header">
            <h2 className="slds-modal__title">Discard Changes?</h2>
          </div>
          <div className="slds-modal__content slds-p-around_medium">
            <p className="slds-text-align_center">You have unsaved changes. Are you sure you want to discard them?</p>
          </div>
          <div className="slds-modal__footer">
            <button type="button" className="slds-button slds-button_neutral" data-testid="discard-keep" autoFocus onClick={onKeep}>
              Keep Editing
            </button>
            <button type="button" className="slds-button slds-button_brand" data-testid="discard-confirm" onClick={onDiscard}>
              Discard
            </button>
          </div>
        </div>
      </section>
      <div className="slds-backdrop slds-backdrop_open modal-discard__backdrop" role="presentation" />
    </>
  );
}

/**
 * Lightning dialog. A click on the backdrop, Escape and the close button all dismiss it the same way,
 * asking first when the form has unsaved changes; clicks inside the dialog never close it.
 */
export function Modal({ title, onClose, children, footer, size = 'medium', dirty = false }: ModalProps) {
  // Opened a frame after mounting, so the SLDS fade-in transition runs.
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dismissRef = useRef(() => {});
  dismissRef.current = () => {
    if (confirming) setConfirming(false);
    else if (dirty) setConfirming(true);
    else onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      dismissRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The section and its container fill the viewport around the dialog, so a press and release on them
  // (not a text selection dragged out of a field) is a backdrop click.
  const isBackdrop = (event: MouseEvent) => event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('slds-modal__container');

  return (
    <>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`slds-modal slds-modal_${size} ${open ? 'slds-fade-in-open' : ''}`}
        data-testid="modal"
        onMouseDown={(event) => {
          pressedOnBackdrop.current = isBackdrop(event);
        }}
        onClick={(event) => {
          if (pressedOnBackdrop.current && isBackdrop(event)) dismissRef.current();
          pressedOnBackdrop.current = false;
        }}
      >
        <div className="slds-modal__container">
          <div className="slds-modal__header">
            <button type="button" className="slds-button slds-button_icon slds-modal__close" data-testid="modal-close" onClick={() => dismissRef.current()}>
              <ButtonIcon name="close" />
              <span className="slds-assistive-text">Cancel and close</span>
            </button>
            <h1 className="slds-modal__title slds-hyphenate">{title}</h1>
          </div>
          <div className="slds-modal__content slds-p-around_medium">{children}</div>
          {footer && <div className="slds-modal__footer">{footer}</div>}
        </div>
      </section>
      <div className={`slds-backdrop ${open ? 'slds-backdrop_open' : ''}`} role="presentation" />
      {confirming && <DiscardPrompt onKeep={() => setConfirming(false)} onDiscard={onClose} />}
    </>
  );
}
