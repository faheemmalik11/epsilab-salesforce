import { useParams } from 'react-router';
import { STUB_TABS } from '../components/AppShell';
import { ScopeLabel } from '../components/Stub';

/** The page behind an out-of-scope navigation tab: it says so plainly instead of pretending to work. */
export function StubPage() {
  const { slug } = useParams();
  const label = STUB_TABS.find((t) => t.slug === slug)?.label ?? 'This page';
  return (
    <div className="stub-page">
      <article className="slds-card" data-testid="stub-page">
        <div className="slds-card__body slds-card__body_inner stub-page__body">
          <h1 className="stub-page__title">
            {label}
            <ScopeLabel feature={label} />
          </h1>
          <p>{label} is not in scope for this Salesforce clone. The tab is shown so the Sales app navigation matches Salesforce.</p>
        </div>
      </article>
    </div>
  );
}
