import { useEffect, useState } from 'react';
import { iconHref } from './icons';

interface Health {
  status: string;
  fixture: string;
  expectedLeads: number;
  expectedUsers: number;
  sqliteVersion: string;
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="slds-p-around_large">
      <article className="slds-card" data-testid="health-card">
        <div className="slds-card__header slds-grid">
          <header className="slds-media slds-media_center slds-has-flexi-truncate">
            <div className="slds-media__figure">
              <span className="slds-icon_container slds-icon-standard-lead">
                <svg className="slds-icon slds-icon_small" aria-hidden="true" data-testid="lead-icon">
                  <use href={iconHref('standard', 'lead')} />
                </svg>
              </span>
            </div>
            <div className="slds-media__body">
              <h2 className="slds-card__header-title">Stack check</h2>
            </div>
          </header>
        </div>
        <div className="slds-card__body slds-card__body_inner">
          {error && <p className="slds-text-color_error">Health check failed: {error}</p>}
          {!error && !health && <p>Loading…</p>}
          {health && (
            <dl className="slds-list_horizontal slds-wrap">
              <dt className="slds-item_label">Fixture</dt>
              <dd className="slds-item_detail" data-testid="fixture">{health.fixture}</dd>
              <dt className="slds-item_label">Expected leads</dt>
              <dd className="slds-item_detail">{health.expectedLeads}</dd>
              <dt className="slds-item_label">SQLite</dt>
              <dd className="slds-item_detail">{health.sqliteVersion}</dd>
            </dl>
          )}
        </div>
      </article>
    </div>
  );
}
