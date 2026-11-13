import { useParams } from 'react-router';
import { STUB_TABS } from '../components/AppShell';
import { STUB_TEXT, StubBadge } from '../components/Stub';

export function StubPage() {
  const { slug } = useParams();
  const label = STUB_TABS.find((t) => t.slug === slug)?.label ?? 'This page';
  return (
    <div className="slds-p-around_medium">
      <article className="slds-card" data-testid="stub-page">
        <div className="slds-card__body slds-card__body_inner slds-p-vertical_xx-large slds-text-align_center">
          <h1 className="slds-text-heading_large slds-m-bottom_small">
            {label}
            <StubBadge />
          </h1>
          <p className="slds-text-body_regular">
            {STUB_TEXT}. {label} is out of scope for the work trial and is shown only so the navigation matches Salesforce.
          </p>
        </div>
      </article>
    </div>
  );
}
