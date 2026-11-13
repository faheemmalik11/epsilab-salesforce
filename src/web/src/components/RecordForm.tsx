import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useDescribe, refreshRecords } from '../api/hooks';
import type { FieldDescribe, ObjectName, RelatedRef } from '../api/types';
import { useActingUser } from '../context/ActingUser';
import { LAYOUTS, recordTitle, type TabObject } from '../lib/layouts';
import { FieldInput, type FormValue } from './FieldInput';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { useToast } from './Toast';

const NUMERIC = new Set(['int', 'double', 'currency', 'percent']);
const SYSTEM_FIELDS = new Set(['CreatedById', 'CreatedDate', 'LastModifiedById', 'LastModifiedDate']);

interface RecordFormProps {
  object: TabObject;
  /** The record being edited; omit to create. */
  record?: Record<string, unknown>;
  /** Prefilled values for a new record, such as the parent account. */
  initial?: Record<string, FormValue>;
  onClose(): void;
  onSaved(id: string): void;
}

function initialValue(field: FieldDescribe, record: Record<string, unknown>): FormValue {
  const raw = record[field.name];
  if (raw === null || raw === undefined) return field.type === 'boolean' ? false : null;
  if (field.type === 'reference') {
    const related = record[field.name.replace(/Id$/, '')] as RelatedRef | null;
    return related ? { id: related.Id, name: related.Name ?? related.Id, object: related.attributes.type } : null;
  }
  if (field.type === 'boolean') return raw === true;
  return String(raw);
}

/** Converts a form value to the JSON the API expects. Validation itself happens in the API. */
function toApiValue(field: FieldDescribe, value: FormValue): unknown {
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value.id;
  if (typeof value === 'boolean') return value;
  if (NUMERIC.has(field.type)) {
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
  }
  return value;
}

export function RecordForm({ object, record, initial = {}, onClose, onSaved }: RecordFormProps) {
  const describe = useDescribe(object);
  const { current } = useActingUser();
  const queryClient = useQueryClient();
  const toast = useToast();
  const editing = record !== undefined;
  const layout = LAYOUTS[object];
  const fieldMap = new Map((describe.data?.fields ?? []).map((f) => [f.name, f]));

  const visible = (field: FieldDescribe | undefined): field is FieldDescribe =>
    !!field && !SYSTEM_FIELDS.has(field.name) && (field.createable || field.updateable) && (editing || field.createable);

  const [values, setValues] = useState<Record<string, FormValue> | null>(null);
  const formValues: Record<string, FormValue> =
    values ??
    (describe.data
      ? Object.fromEntries(
          describe.data.fields.map((field) => {
            if (editing) return [field.name, initialValue(field, record)];
            if (field.name in initial) return [field.name, initial[field.name]!];
            if (field.name === 'OwnerId' && current) return [field.name, { id: current.Id, name: current.Name, object: 'User' as ObjectName }];
            if (field.type === 'boolean') return [field.name, field.defaultValue === true];
            return [field.name, field.defaultValue === undefined ? null : String(field.defaultValue)];
          }),
        )
      : {});

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const field of describe.data!.fields) {
        if (!visible(field)) continue;
        if (editing && !field.updateable) continue;
        const value = toApiValue(field, formValues[field.name] ?? null);
        if (editing) {
          const before = toApiValue(field, initialValue(field, record));
          if (value !== before) payload[field.name] = value;
        } else if (value !== null && !(field.type === 'boolean' && value === false && field.defaultValue === false)) {
          payload[field.name] = value;
        }
      }
      if (editing) {
        await api.update(object, String(record.Id), payload);
        return String(record.Id);
      }
      return (await api.create(object, payload)).id;
    },
    onSuccess: async (id) => {
      await refreshRecords(queryClient);
      const saved = await queryClient.fetchQuery({ queryKey: ['record', object, id], queryFn: () => api.get(object, id) });
      toast(`${describe.data!.label} "${recordTitle(saved)}" was ${editing ? 'saved' : 'created'}.`);
      onSaved(id);
    },
  });

  const error = save.error instanceof ApiError ? save.error : null;
  const fieldErrors = (name: string) =>
    (error?.fieldErrors(name) ?? []).map((e) => (e.errorCode === 'REQUIRED_FIELD_MISSING' ? 'Complete this field.' : e.message));

  const title = editing ? `Edit ${recordTitle(record)}` : `New ${describe.data?.label ?? object}`;

  return (
    <Modal
      title={title}
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
            disabled={!describe.data || save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </button>
        </>
      }
    >
      <PageError error={save.error} />
      {layout.sections
        .filter((section) => section.fields.some((name) => visible(fieldMap.get(name))))
        .map((section) => (
          <div key={section.title} className="slds-section slds-is-open">
            <h3 className="slds-section__title slds-theme_shade">
              <span className="slds-truncate slds-p-horizontal_small">{section.title}</span>
            </h3>
            <div className="slds-section__content slds-grid slds-wrap slds-gutters_small">
              {section.fields
                .map((name) => fieldMap.get(name))
                .filter(visible)
                .map((field) => (
                  <div key={field.name} className={`slds-col ${field.type === 'textarea' ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
                    <FieldInput
                      field={field}
                      value={formValues[field.name] ?? null}
                      required={field.required}
                      disabled={editing && !field.updateable}
                      errors={fieldErrors(field.name)}
                      onChange={(value) => setValues({ ...formValues, [field.name]: value })}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
    </Modal>
  );
}
