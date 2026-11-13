import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDescribe, refreshRecords } from '../api/hooks';
import type { ConvertResult, SRecord } from '../api/types';
import { useActingUser } from '../context/ActingUser';
import { recordUrl } from './FieldOutput';
import { Icon } from './Icon';
import { Lookup, type LookupValue } from './Lookup';
import { Modal } from './Modal';
import { PageError } from './PageError';

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="slds-box slds-m-bottom_small">
      <legend className="slds-text-heading_small slds-p-horizontal_x-small">
        <Icon name={icon} size="small" /> <span className="slds-m-left_x-small">{title}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function ConvertedSummary({ result, lead, onClose }: { result: ConvertResult; lead: SRecord; onClose(): void }) {
  const links = [
    { object: 'Account', id: result.accountId, icon: 'account' },
    { object: 'Contact', id: result.contactId, icon: 'contact' },
    ...(result.opportunityId ? [{ object: 'Opportunity', id: result.opportunityId, icon: 'opportunity' }] : []),
  ];
  return (
    <Modal
      title="Your lead has been converted"
      onClose={onClose}
      footer={
        <Link className="slds-button slds-button_brand" to="/lightning/o/Lead/list" onClick={onClose}>
          Go to Leads
        </Link>
      }
    >
      <p className="slds-m-bottom_medium" data-testid="convert-success">
        {String(lead.Name ?? '')} was converted.
      </p>
      <div className="slds-grid slds-gutters">
        {links.map((link) => (
          <div key={link.object} className="slds-col">
            <article className="slds-card slds-card_boundary">
              <div className="slds-card__header slds-grid">
                <header className="slds-media slds-media_center">
                  <div className="slds-media__figure">
                    <Icon name={link.icon} size="small" />
                  </div>
                  <div className="slds-media__body">
                    <h2 className="slds-card__header-title">
                      <Link to={recordUrl(link.object, link.id)} onClick={onClose} data-testid={`converted-${link.object}`}>
                        {link.object}
                      </Link>
                    </h2>
                  </div>
                </header>
              </div>
            </article>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Convert Lead: new or existing account, a new contact, an optional opportunity, owner and converted status. */
export function ConvertLeadModal({ lead, onClose }: { lead: SRecord; onClose(): void }) {
  const describe = useDescribe('Lead');
  const { users } = useActingUser();
  const queryClient = useQueryClient();
  const company = String(lead.Company ?? '');
  const convertedStatuses = (describe.data?.fields.find((f) => f.name === 'Status')?.picklistValues ?? []).filter((v) => v.converted);

  const [accountMode, setAccountMode] = useState<'new' | 'existing'>('new');
  const [account, setAccount] = useState<LookupValue | null>(null);
  const [opportunityName, setOpportunityName] = useState(company);
  const [noOpportunity, setNoOpportunity] = useState(false);
  const [ownerId, setOwnerId] = useState(String(lead.OwnerId ?? ''));
  const [status, setStatus] = useState<string>('');

  const convert = useMutation({
    mutationFn: () =>
      api.convertLead(lead.Id, {
        convertedStatus: status || convertedStatuses[0]?.value,
        ownerId,
        ...(accountMode === 'existing' && account ? { accountId: account.id } : {}),
        // An unchanged name is left to the API, which defaults it to the lead's Company.
        ...(noOpportunity ? { doNotCreateOpportunity: true } : opportunityName !== company ? { opportunityName } : {}),
      }),
    onSuccess: () => refreshRecords(queryClient),
  });

  if (convert.data) return <ConvertedSummary result={convert.data} lead={lead} onClose={onClose} />;

  return (
    <Modal
      title="Convert Lead"
      onClose={onClose}
      size="large"
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="slds-button slds-button_brand"
            data-testid="convert-submit"
            disabled={convert.isPending || (accountMode === 'existing' && !account)}
            onClick={() => convert.mutate()}
          >
            Convert
          </button>
        </>
      }
    >
      <PageError error={convert.error} />

      <Section icon="account" title="Account">
        <fieldset className="slds-form-element">
          <div className="slds-form-element__control">
            <span className="slds-radio">
              <input type="radio" id="account-new" name="account" checked={accountMode === 'new'} onChange={() => setAccountMode('new')} />
              <label className="slds-radio__label" htmlFor="account-new">
                <span className="slds-radio_faux" />
                <span className="slds-form-element__label">Create New: {company}</span>
              </label>
            </span>
            <span className="slds-radio">
              <input
                type="radio"
                id="account-existing"
                name="account"
                checked={accountMode === 'existing'}
                onChange={() => setAccountMode('existing')}
              />
              <label className="slds-radio__label" htmlFor="account-existing">
                <span className="slds-radio_faux" />
                <span className="slds-form-element__label">Choose Existing</span>
              </label>
            </span>
          </div>
        </fieldset>
        {accountMode === 'existing' && (
          <div className="slds-m-top_x-small">
            <Lookup id="convert-account" targets={['Account']} value={account} onChange={setAccount} />
          </div>
        )}
      </Section>

      <Section icon="contact" title="Contact">
        <p>
          Create New: <strong>{String(lead.Name ?? '')}</strong>
        </p>
        <p className="slds-text-color_weak slds-text-body_small">Converting into an existing contact is not supported in this trial.</p>
      </Section>

      <Section icon="opportunity" title="Opportunity">
        <div className="slds-form-element">
          <label className="slds-form-element__label" htmlFor="convert-opportunity-name">
            Opportunity Name
          </label>
          <div className="slds-form-element__control">
            <input
              id="convert-opportunity-name"
              className="slds-input"
              value={opportunityName}
              disabled={noOpportunity}
              onChange={(e) => setOpportunityName(e.target.value)}
            />
          </div>
        </div>
        <div className="slds-form-element slds-m-top_x-small">
          <div className="slds-checkbox">
            <input type="checkbox" id="convert-no-opportunity" checked={noOpportunity} onChange={(e) => setNoOpportunity(e.target.checked)} />
            <label className="slds-checkbox__label" htmlFor="convert-no-opportunity">
              <span className="slds-checkbox_faux" />
              <span className="slds-form-element__label">Don't create an opportunity upon conversion</span>
            </label>
          </div>
        </div>
      </Section>

      <div className="slds-grid slds-gutters">
        <div className="slds-col slds-form-element">
          <label className="slds-form-element__label" htmlFor="convert-owner">
            Record Owner
          </label>
          <div className="slds-select_container">
            <select id="convert-owner" className="slds-select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {users
                .filter((u) => u.IsActive || u.Id === ownerId)
                .map((u) => (
                  <option key={u.Id} value={u.Id} disabled={!u.IsActive}>
                    {u.Name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="slds-col slds-form-element">
          <label className="slds-form-element__label" htmlFor="convert-status">
            <abbr className="slds-required" title="required">
              *{' '}
            </abbr>
            Converted Status
          </label>
          <div className="slds-select_container">
            <select id="convert-status" className="slds-select" value={status || convertedStatuses[0]?.value || ''} onChange={(e) => setStatus(e.target.value)}>
              {convertedStatuses.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
