import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ButtonIcon, Icon } from './Icon';

interface Toast {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="slds-notify_container">
        {toasts.map((toast) => (
          <div key={toast.id} className="slds-notify slds-notify_toast slds-theme_success" role="status" data-testid="toast">
            <span className="slds-icon_container slds-m-right_small">
              <Icon name="success" category="utility" size="small" className="slds-icon_container" />
            </span>
            <div className="slds-notify__content">
              <h2 className="slds-text-heading_small">{toast.message}</h2>
            </div>
            <div className="slds-notify__close">
              <button
                type="button"
                className="slds-button slds-button_icon slds-button_icon-inverse"
                onClick={() => setToasts((list) => list.filter((t) => t.id !== toast.id))}
              >
                <ButtonIcon name="close" />
                <span className="slds-assistive-text">Close</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
