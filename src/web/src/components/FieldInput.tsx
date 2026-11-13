import type { FieldDescribe } from '../api/types';
import { Lookup, type LookupValue } from './Lookup';

export type FormValue = string | boolean | LookupValue | null;

interface FieldInputProps {
  field: FieldDescribe;
  value: FormValue;
  onChange(value: FormValue): void;
  errors?: string[];
  /** Shows the required asterisk; the API still decides what is required. */
  required?: boolean;
  disabled?: boolean;
  lookupWhere?: { field: string; op: 'eq'; value: unknown }[];
}

const INPUT_TYPES: Record<string, string> = {
  email: 'email',
  phone: 'tel',
  url: 'url',
  int: 'number',
  double: 'number',
  currency: 'number',
  percent: 'number',
  date: 'date',
};

/** One form element for a field, chosen by its describe type, with SLDS error styling. */
export function FieldInput({ field, value, onChange, errors = [], required, disabled, lookupWhere }: FieldInputProps) {
  const id = `field-${field.name}`;
  const invalid = errors.length > 0;

  if (field.type === 'boolean') {
    return (
      <div className={`slds-form-element ${invalid ? 'slds-has-error' : ''}`}>
        <div className="slds-form-element__control">
          <div className="slds-checkbox">
            <input type="checkbox" id={id} checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
            <label className="slds-checkbox__label" htmlFor={id}>
              <span className="slds-checkbox_faux" />
              <span className="slds-form-element__label">{field.label}</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  let control;
  if (field.type === 'picklist') {
    control = (
      <div className="slds-select_container">
        <select
          id={id}
          className="slds-select"
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">--None--</option>
          {(field.picklistValues ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.value}
            </option>
          ))}
          {typeof value === 'string' && value && !field.picklistValues?.some((o) => o.value === value) && (
            <option value={value}>{value}</option>
          )}
        </select>
      </div>
    );
  } else if (field.type === 'reference') {
    control = (
      <Lookup
        id={id}
        targets={field.referenceTo ?? []}
        value={value && typeof value === 'object' ? value : null}
        onChange={onChange}
        where={lookupWhere}
        invalid={invalid}
      />
    );
  } else if (field.type === 'textarea') {
    control = (
      <textarea
        id={id}
        className="slds-textarea"
        rows={3}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else {
    control = (
      <input
        id={id}
        className="slds-input"
        type={INPUT_TYPES[field.type] ?? 'text'}
        step={field.type === 'int' ? 1 : 'any'}
        maxLength={field.length}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={`slds-form-element slds-form-element_stacked ${invalid ? 'slds-has-error' : ''}`}>
      <label className="slds-form-element__label" htmlFor={id}>
        {required && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {field.label}
      </label>
      <div className="slds-form-element__control">{control}</div>
      {errors.map((message) => (
        <div key={message} className="slds-form-element__help" data-testid={`field-error-${field.name}`}>
          {message}
        </div>
      ))}
    </div>
  );
}
