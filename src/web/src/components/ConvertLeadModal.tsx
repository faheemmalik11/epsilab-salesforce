import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDescribe, useRecordQuery, refreshRecords } from '../api/hooks';
import type { ConvertResult, SRecord } from '../api/types';
import { useActingUser } from '../context/ActingUser';
import { recordUrl } from './FieldOutput';
import { Icon } from './Icon';
import { Lookup, type LookupValue } from './Lookup';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { STUB_TEXT, StubBadge } from './Stub';
import { formatNumber } from '../lib/format';

function Radio({ id, name, label, checked, disabled, onChange }: { id: string; name: string; label: string; checked: boolean; disabled?: boolean; onChange?(): void }) {
  return (
    <span className="slds-radio">
      <input type="radio" id={id} name={name} checked={checked} disabled={disabled} onChange={onChange} />
      <label className="slds-radio__label" htmlFor={id}>
        <span className="slds-radio_faux" />
        <span className="slds-form-element__label">{label}</span>
      </label>
    </span>
  );
}

/** One Convert Lead row: the object, "Create New" on the left, "- OR -", and "Choose Existing" on the right. */
function ConvertRow({ title, left, right }: { title: string; left: ReactNode; right: ReactNode }) {
  return (
    <div className="convert-row" data-testid={`convert-row-${title}`}>
      <h2 className="convert-row__title">{title}</h2>
      <div className="convert-row__side">{left}</div>
      <div className="convert-row__or">- OR -</div>
      <div className="convert-row__side">{right}</div>
    </div>
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

  const matches = useRecordQuery({
    object: 'Account',
    where: [{ field: 'Name', op: 'contains', value: company }],
    orderBy: [{ field: 'Name' }],
    limit: 5,
  }, company !== '');
  const matchList = matches.data?.records ?? [];
  const chooseAccount = (value: LookupValue | null) => {
    setAccount(value);
    if (value) setAccountMode('existing');
  };

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

      <ConvertRow
        title="Account"
        left={
          <>
            <Radio id="account-new" name="account" label="Create New Account" checked={accountMode === 'new'} onChange={() => setAccountMode('new')} />
            <div className="convert-box">
              <label className="slds-form-element__label" htmlFor="convert-account-name">
                <abbr className="slds-required" title="required">
                  *{' '}
                </abbr>
                Account Name
              </label>
              <input
                id="convert-account-name"
                className="slds-input"
                value={company}
                readOnly
                title="The new account is named after the lead's Company"
              />
            </div>
          </>
        }
        right={
          <>
            <Radio
              id="account-existing"
              name="account"
              label="Choose Existing Account"
              checked={accountMode === 'existing'}
              onChange={() => setAccountMode('existing')}
            />
            <div className="convert-box convert-box_plain">
              <span className="slds-form-element__label">
                <abbr className="slds-required" title="required">
                  *{' '}
                </abbr>
                Account Search
              </span>
              <Lookup id="convert-account" targets={['Account']} value={account} onChange={chooseAccount} />
              <div className="convert-matches" data-testid="account-matches">
                <p className="slds-text-color_weak">
                  {matches.data ? `${formatNumber(matches.data.totalSize)} Account Match${matches.data.totalSize === 1 ? '' : 'es'}` : 'Searching…'}
                </p>
                {matchList.map((match) => (
                  <Radio
                    key={match.Id}
                    id={`account-match-${match.Id}`}
                    name="account-match"
                    label={String(match.Name)}
                    checked={account?.id === match.Id}
                    onChange={() => chooseAccount({ id: match.Id, name: String(match.Name), object: 'Account' })}
                  />
                ))}
              </div>
            </div>
          </>
        }
      />

      <ConvertRow
        title="Contact"
        left={
          <>
            <Radio id="contact-new" name="contact" label="Create New Contact" checked />
            <span className="convert-pill" data-testid="convert-contact-name">
              {String(lead.Name ?? '')}
            </span>
          </>
        }
        right={
          <>
            <Radio id="contact-existing" name="contact" label="Choose Existing Contact" checked={false} disabled />
            <p className="convert-disabled" title={STUB_TEXT}>
              Choosing an existing contact: {STUB_TEXT}
              <StubBadge />
            </p>
          </>
        }
      />

      <ConvertRow
        title="Opportunity"
        left={
          <>
            <Radio id="opportunity-new" name="opportunity" label="Create New Opportunity" checked={!noOpportunity} onChange={() => setNoOpportunity(false)} />
            <input
              id="convert-opportunity-name"
              aria-label="Opportunity Name"
              className="slds-input convert-pill-input"
              value={opportunityName}
              disabled={noOpportunity}
              onChange={(e) => setOpportunityName(e.target.value)}
            />
            <div className="slds-checkbox convert-no-opportunity">
              <input type="checkbox" id="convert-no-opportunity" checked={noOpportunity} onChange={(e) => setNoOpportunity(e.target.checked)} />
              <label className="slds-checkbox__label" htmlFor="convert-no-opportunity">
                <span className="slds-checkbox_faux" />
                <span className="slds-form-element__label">Don't create an opportunity upon conversion</span>
              </label>
            </div>
          </>
        }
        right={
          <>
            <Radio id="opportunity-existing" name="opportunity" label="Choose Existing Opportunity" checked={false} disabled />
            <p className="convert-disabled" title={STUB_TEXT}>
              Choosing an existing opportunity: {STUB_TEXT}
              <StubBadge />
            </p>
          </>
        }
      />

      <div className="convert-footer-fields">
        <div className="slds-form-element">
          <label className="slds-form-element__label" htmlFor="convert-owner">
            <abbr className="slds-required" title="required">
              *{' '}
            </abbr>
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
        <div className="slds-form-element">
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
