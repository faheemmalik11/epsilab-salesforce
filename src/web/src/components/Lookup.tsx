import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ObjectName } from '../api/types';
import type { LookupValue } from '../lib/formValues';
import { useActingUser } from '../context/ActingUser';
import { layoutFor } from '../lib/layouts';
import { ButtonIcon, Icon } from './Icon';

export type { LookupValue } from '../lib/formValues';

interface LookupProps {
  id: string;
  targets: ObjectName[];
  value: LookupValue | null;
  onChange(value: LookupValue | null): void;
  /** Extra filters, such as "contacts of this account". */
  where?: { field: string; op: 'eq'; value: unknown }[];
  invalid?: boolean;
  placeholder?: string;
}

/** Owner picker: active seeded users, plus the current owner even if inactive. */
function UserSelect({ id, value, onChange, invalid }: Omit<LookupProps, 'targets' | 'where'>) {
  const { users } = useActingUser();
  return (
    <div className="slds-select_container">
      <select
        id={id}
        className="slds-select"
        aria-invalid={invalid || undefined}
        value={value?.id ?? ''}
        onChange={(e) => {
          const user = users.find((u) => u.Id === e.target.value);
          onChange(user ? { id: user.Id, name: user.Name, object: 'User' } : null);
        }}
      >
        <option value="">--None--</option>
        {users
          .filter((u) => u.IsActive || u.Id === value?.id)
          .map((u) => (
            <option key={u.Id} value={u.Id} disabled={!u.IsActive}>
              {u.Name}
              {u.IsActive ? '' : ' (inactive)'}
            </option>
          ))}
      </select>
    </div>
  );
}

/** Search-as-you-type lookup over the query API, by Name (Subject for tasks). */
export function Lookup({ id, targets, value, onChange, where = [], invalid, placeholder }: LookupProps) {
  const [object, setObject] = useState<ObjectName>(value?.object ?? targets[0]!);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), 200);
    return () => clearTimeout(timer);
  }, [text]);

  const nameField = object === 'Task' ? 'Subject' : 'Name';
  const results = useQuery({
    queryKey: ['lookup', object, debounced, where],
    queryFn: () =>
      api.query({
        object,
        where: [...where, ...(debounced ? [{ field: nameField, op: 'contains' as const, value: debounced }] : [])],
        orderBy: [{ field: nameField }],
        limit: 8,
      }),
    enabled: open,
  });

  if (targets.length === 1 && targets[0] === 'User') {
    return <UserSelect id={id} value={value} onChange={onChange} invalid={invalid} />;
  }

  if (value) {
    return (
      <div className="slds-pill_container">
        <span className="slds-pill slds-pill_link" data-testid={`${id}-pill`}>
          <span className="slds-pill__icon_container">
            <Icon name={layoutFor(value.object)?.icon ?? 'record'} size="x-small" />
          </span>
          <span className="slds-pill__action slds-pill__label">{value.name}</span>
          <button type="button" className="slds-button slds-button_icon slds-pill__remove" onClick={() => onChange(null)} title="Remove">
            <ButtonIcon name="close" />
            <span className="slds-assistive-text">Remove</span>
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="slds-grid slds-gutters_xx-small">
      {targets.length > 1 && (
        <div className="slds-col slds-shrink-none">
          <div className="slds-select_container">
            <select className="slds-select" aria-label="Object" value={object} onChange={(e) => setObject(e.target.value as ObjectName)}>
              {targets.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="slds-col">
        <div className="slds-combobox_container">
          <div className={`slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${open ? 'slds-is-open' : ''}`}>
            <div className="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right" role="none">
              <input
                id={id}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-invalid={invalid || undefined}
                autoComplete="off"
                className="slds-input slds-combobox__input"
                placeholder={placeholder ?? `Search ${layoutFor(object) ? object + 's' : object}...`}
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
                  {(results.data?.records ?? []).map((record) => {
                    const name = String(record[nameField] ?? record.Id);
                    return (
                      <li key={record.Id} role="presentation" className="slds-listbox__item">
                        <div
                          role="option"
                          aria-selected="false"
                          className="slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onChange({ id: record.Id, name, object });
                            setOpen(false);
                            setText('');
                          }}
                        >
                          <span className="slds-media__figure slds-listbox__option-icon">
                            <Icon name={layoutFor(object)?.icon ?? 'record'} size="x-small" />
                          </span>
                          <span className="slds-media__body">
                            <span className="slds-listbox__option-text slds-listbox__option-text_entity">{name}</span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  {results.data && results.data.records.length === 0 && (
                    <li role="presentation" className="slds-listbox__item slds-p-around_small slds-text-color_weak">
                      No matches
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
