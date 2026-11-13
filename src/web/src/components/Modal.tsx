import { useEffect, type ReactNode } from 'react';
import { ButtonIcon } from './Icon';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export function Modal({ title, onClose, children, footer, size = 'medium' }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <section role="dialog" aria-modal="true" aria-label={title} className={`slds-modal slds-fade-in-open slds-modal_${size}`}>
        <div className="slds-modal__container">
          <button type="button" className="slds-button slds-button_icon slds-modal__close" onClick={onClose}>
            <ButtonIcon name="close" />
            <span className="slds-assistive-text">Cancel and close</span>
          </button>
          <div className="slds-modal__header">
            <h1 className="slds-modal__title slds-hyphenate">{title}</h1>
          </div>
          <div className="slds-modal__content slds-p-around_medium">{children}</div>
          {footer && <div className="slds-modal__footer">{footer}</div>}
        </div>
      </section>
      <div className="slds-backdrop slds-backdrop_open" role="presentation" />
    </>
  );
}
