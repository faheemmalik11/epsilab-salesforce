import { ApiError } from '../api/client';
import { Icon } from './Icon';

/** "We hit a snag." with the API's error messages shown exactly as returned. */
export function PageError({ error }: { error: unknown }) {
  if (!error) return null;
  const messages = error instanceof ApiError ? error.errors.map((e) => e.message) : [String((error as Error).message ?? error)];
  return (
    <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_small" role="alert" data-testid="page-error">
      <span className="slds-icon_container slds-m-right_x-small">
        <Icon name="error" category="utility" size="x-small" className="slds-icon-text-error" />
      </span>
      <div className="slds-text-align_left">
        <h2 className="slds-text-heading_small">We hit a snag.</h2>
        <ul>
          {messages.map((message) => (
            <li key={message} data-testid="page-error-message">
              {message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
