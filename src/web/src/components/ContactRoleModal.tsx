import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDescribe, useRecordQuery, refreshRecords } from '../api/hooks';
import type { QueryCondition, RelatedRef, SRecord } from '../api/types';
import { ButtonIcon, Icon } from './Icon';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { Spinner } from './Spinner';
import { useToast } from './Toast';

interface ContactOption {
  id: string;
  name: string;
}

const CONTACT_COLUMNS = [
  { label: 'Name', value: (c: SRecord) => c.Name },
  { label: 'Account Name', value: (c: SRecord) => (c.Account as RelatedRef | null)?.Name },
  { label: 'Phone', value: (c: SRecord) => c.Phone },
  { label: 'Email', value: (c: SRecord) => c.Email },
  { label: 'Contact Owner', value: (c: SRecord) => (c.Owner as RelatedRef | null)?.Name },
];

function Checkbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <div className="slds-checkbox">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label className="slds-checkbox__label" htmlFor={id}>
        <span className="slds-checkbox_faux" />
        <span className="slds-form-element__label slds-assistive-text">{label}</span>
      </label>
    </div>
  );
}

/** The optional primary contact: a pill when chosen, otherwise a search over the contacts on this opportunity. */
function PrimaryContact({ options, value, onChange }: { options: ContactOption[]; value: ContactOption | null; onChange(id: string | null): void }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const matches = options.filter((o) => o.name.toLowerCase().includes(text.trim().toLowerCase()));

  return (
    <div className="slds-form-element contact-roles__primary">
      <label className="slds-form-element__label contact-roles__primary-label" htmlFor="contact-role-primary">
        Primary Contact (Optional)
        <span className="slds-m-left_xx-small" title="The primary contact is the main point of contact for this opportunity.">
          <Icon name="info" category="utility" size="xx-small" />
        </span>
      </label>
      <div className="slds-form-element__control">
        {value ? (
          <div className="slds-pill_container">
            <span className="slds-pill slds-pill_link" data-testid="contact-role-primary-pill">
              <span className="slds-pill__icon_container">
                <Icon name="contact" size="x-small" />
              </span>
              <span className="slds-pill__action slds-pill__label">{value.name}</span>
              <button type="button" className="slds-button slds-button_icon slds-pill__remove" onClick={() => onChange(null)} title="Remove">
                <ButtonIcon name="close" />
                <span className="slds-assistive-text">Remove primary contact</span>
              </button>
            </span>
          </div>
        ) : (
          <div className="slds-combobox_container">
            <div className={`slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${open ? 'slds-is-open' : ''}`}>
              <div className="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right" role="none">
                <input
                  id="contact-role-primary"
                  type="text"
                  role="combobox"
                  aria-expanded={open}
                  autoComplete="off"
                  className="slds-input slds-combobox__input"
                  placeholder="Search Contacts..."
                  value={text}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  onChange={(e) => setText(e.target.value)}
                />
                <span className="slds-icon_container slds-input__icon slds-input__icon_right">
                  <Icon name="search" category="utility" size="x-small" />
                </span>
              </div>
              {open && (
                <div className="slds-dropdown slds-dropdown_length-with-icon-7 slds-dropdown_fluid" role="listbox">
                  <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                    {matches.map((option) => (
                      <li key={option.id} role="presentation" className="slds-listbox__item">
                        <div
                          role="option"
                          aria-selected="false"
                          className="slds-media slds-listbox__option slds-listbox__option_entity"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onChange(option.id);
                            setOpen(false);
                            setText('');
                          }}
                        >
                          <span className="slds-media__figure slds-listbox__option-icon">
                            <Icon name="contact" size="x-small" />
                          </span>
                          <span className="slds-media__body">
                            <span className="slds-listbox__option-text slds-listbox__option-text_entity">{option.name}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                    {matches.length === 0 && (
                      <li role="presentation" className="slds-listbox__item slds-p-around_small slds-text-color_weak">
                        No matches
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Add Contact Roles, in Lightning's two steps: pick contacts (the opportunity's account first, or search all),
 * then set each one's role and the opportunity's primary contact. Each role is saved with its own API call.
 */
export function ContactRoleModal({ opportunity, onClose }: { opportunity: SRecord; onClose(): void }) {
  const describe = useDescribe('OpportunityContactRole');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState<'select' | 'roles'>('select');
  const [selected, setSelected] = useState<SRecord[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [showSelected, setShowSelected] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  // undefined until the user changes it: the opportunity's current primary contact is shown.
  const [primaryChoice, setPrimaryChoice] = useState<string | null>();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 200);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  // The dialog becomes visible a frame after mounting, and a hidden input can't take focus.
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => searchInput.current?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const accountId = typeof opportunity.AccountId === 'string' ? opportunity.AccountId : null;
  const where: QueryCondition[] = search
    ? [{ field: 'Name', op: 'contains', value: search }]
    : accountId
      ? [{ field: 'AccountId', op: 'eq', value: accountId }]
      : [];
  const contacts = useRecordQuery({ object: 'Contact', where, orderBy: [{ field: 'Name' }], limit: 50 });
  const existing = useRecordQuery({ object: 'OpportunityContactRole', where: [{ field: 'OpportunityId', op: 'eq', value: opportunity.Id }], limit: 200 });

  const existingRoles = existing.data?.records ?? [];
  const currentPrimary = existingRoles.find((r) => r.IsPrimary === true);
  const primaryId = primaryChoice === undefined ? ((currentPrimary?.ContactId as string | undefined) ?? null) : primaryChoice;
  const primaryOptions: ContactOption[] = [
    ...selected.map((c) => ({ id: c.Id, name: String(c.Name ?? '') })),
    ...existingRoles.map((r) => ({ id: String(r.ContactId), name: String((r.Contact as RelatedRef | null)?.Name ?? '') })),
  ].filter((option, index, all) => all.findIndex((o) => o.id === option.id) === index);

  const selectedIds = new Set(selected.map((c) => c.Id));
  const rows = showSelected ? selected : (contacts.data?.records ?? []);
  const toggle = (contact: SRecord, on: boolean) => setSelected(on ? [...selected, contact] : selected.filter((c) => c.Id !== contact.Id));
  const allChecked = rows.length > 0 && rows.every((c) => selectedIds.has(c.Id));
  const roleValues = describe.data?.fields.find((f) => f.name === 'Role')?.picklistValues ?? [];

  const save = useMutation({
    mutationFn: async () => {
      let created = 0;
      // An unchanged primary contact keeps its existing role as the primary one.
      const primaryChanged = (currentPrimary?.ContactId ?? null) !== primaryId;
      try {
        for (const contact of selected) {
          await api.create('OpportunityContactRole', {
            OpportunityId: opportunity.Id,
            ContactId: contact.Id,
            Role: roles[contact.Id] || null,
            IsPrimary: primaryChanged && contact.Id === primaryId,
          });
          created++;
          // A saved contact leaves the list, so a retry after an error can't add it twice.
          setSelected((current) => current.filter((c) => c.Id !== contact.Id));
        }
        if (primaryChanged && !selectedIds.has(primaryId ?? '')) {
          const role = existingRoles.find((r) => r.ContactId === primaryId);
          if (role && role.IsPrimary !== true) await api.update('OpportunityContactRole', role.Id, { IsPrimary: true });
          else if (!primaryId && currentPrimary) await api.update('OpportunityContactRole', currentPrimary.Id, { IsPrimary: false });
        }
      } finally {
        if (created > 0) await refreshRecords(queryClient);
      }
      return created;
    },
    onSuccess: (created) => {
      toast(created === 1 ? 'Contact role was created.' : `${created} contact roles were created.`);
      onClose();
    },
  });

  return (
    <Modal
      title="Add Contact Roles"
      onClose={onClose}
      dirty={selected.length > 0}
      footer={
        step === 'select' ? (
          <>
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="slds-button slds-button_brand" data-testid="contact-roles-next" disabled={selected.length === 0} onClick={() => setStep('roles')}>
              Next
            </button>
          </>
        ) : (
          <>
            <button type="button" className="slds-button slds-button_neutral slds-float_left" data-testid="contact-roles-back" onClick={() => setStep('select')}>
              Back
            </button>
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="slds-button slds-button_brand" disabled={save.isPending || selected.length === 0} onClick={() => save.mutate()}>
              Save
            </button>
          </>
        )
      }
    >
      <div className="contact-roles" data-testid={`contact-roles-${step}`}>
        <PageError error={save.error} />
        {step === 'select' ? (
          <>
            <div className="contact-roles__toolbar">
              <div className="slds-form-element contact-roles__search">
                <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                  <span className="slds-icon_container slds-input__icon slds-input__icon_left">
                    <Icon name="search" category="utility" size="x-small" />
                  </span>
                  <input
                    type="search"
                    className="slds-input"
                    placeholder="Search Contacts..."
                    aria-label="Search Contacts"
                    data-testid="contact-roles-search"
                    ref={searchInput}
                    value={searchDraft}
                    onChange={(e) => {
                      setSearchDraft(e.target.value);
                      setShowSelected(false);
                    }}
                  />
                </div>
              </div>
              <button type="button" className="slds-button" data-testid="contact-roles-show-selected" onClick={() => setShowSelected(!showSelected)}>
                {showSelected ? 'Back to Results' : `Show Selected (${selected.length})`}
              </button>
            </div>
            <div className="contact-roles__list">
              <table className="slds-table slds-table_bordered slds-table_fixed-layout cosmos-table" role="grid" data-testid="contact-roles-table">
                <thead>
                  <tr className="slds-line-height_reset">
                    <th scope="col" className="cell-select">
                      <Checkbox
                        id="contact-roles-select-all"
                        label="Select all"
                        checked={allChecked}
                        onChange={(on) => setSelected(on ? [...selected, ...rows.filter((c) => !selectedIds.has(c.Id))] : selected.filter((c) => !rows.some((r) => r.Id === c.Id)))}
                      />
                    </th>
                    {CONTACT_COLUMNS.map((column) => (
                      <th key={column.label} scope="col" className="th-data">
                        <div className="slds-truncate contact-roles__th" title={column.label}>
                          {column.label}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((contact) => (
                    <tr key={contact.Id} className="slds-hint-parent" data-testid="contact-roles-row">
                      <td className="cell-select">
                        <Checkbox
                          id={`contact-role-select-${contact.Id}`}
                          label={`Select ${String(contact.Name ?? '')}`}
                          checked={selectedIds.has(contact.Id)}
                          onChange={(on) => toggle(contact, on)}
                        />
                      </td>
                      {CONTACT_COLUMNS.map((column) => {
                        const text = String(column.value(contact) ?? '');
                        return (
                          <td key={column.label}>
                            <div className="slds-truncate" title={text}>
                              {text}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {contacts.isFetching && !showSelected && <Spinner size="small" />}
              {rows.length === 0 && !contacts.isFetching && (
                <p className="slds-text-align_center slds-text-color_weak slds-p-around_medium" data-testid="contact-roles-empty">
                  {showSelected ? 'No contacts selected.' : 'No contacts found.'}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <PrimaryContact options={primaryOptions} value={primaryOptions.find((o) => o.id === primaryId) ?? null} onChange={setPrimaryChoice} />
            <table className="slds-table slds-table_bordered slds-table_fixed-layout cosmos-table contact-roles__edit" role="grid" data-testid="contact-roles-edit-table">
              <thead>
                <tr className="slds-line-height_reset">
                  <th scope="col" className="cell-number" aria-label="Row number" />
                  <th scope="col" className="th-data">
                    <div className="slds-truncate contact-roles__th">
                      <abbr className="slds-required" title="required">
                        *
                      </abbr>
                      Contact
                    </div>
                  </th>
                  <th scope="col" className="th-data">
                    <div className="slds-truncate contact-roles__th">Role</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {selected.map((contact, index) => (
                  <tr key={contact.Id} data-testid="contact-roles-edit-row">
                    <td className="slds-text-color_weak cell-number">{index + 1}</td>
                    <td>
                      <div className="slds-truncate contact-roles__contact">{String(contact.Name ?? '')}</div>
                    </td>
                    <td>
                      <div className="slds-select_container">
                        <select
                          className="slds-select"
                          aria-label={`Role for ${String(contact.Name ?? '')}`}
                          data-testid="contact-role-role"
                          value={roles[contact.Id] ?? ''}
                          onChange={(e) => setRoles({ ...roles, [contact.Id]: e.target.value })}
                        >
                          <option value="">--None--</option>
                          {roleValues.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Modal>
  );
}
