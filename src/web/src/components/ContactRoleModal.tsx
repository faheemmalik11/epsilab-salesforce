import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDescribe, refreshRecords } from '../api/hooks';
import type { SRecord } from '../api/types';
import { FieldInput, type FormValue } from './FieldInput';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { useToast } from './Toast';

/** Add Contact Roles: a contact (from the opportunity's account when it has one), a role and the primary flag. */
export function ContactRoleModal({ opportunity, onClose }: { opportunity: SRecord; onClose(): void }) {
  const describe = useDescribe('OpportunityContactRole');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, FormValue>>({ ContactId: null, Role: null, IsPrimary: false });
  const field = (name: string) => describe.data?.fields.find((f) => f.name === name);

  const save = useMutation({
    mutationFn: () =>
      api.create('OpportunityContactRole', {
        OpportunityId: opportunity.Id,
        ContactId: values.ContactId && typeof values.ContactId === 'object' ? values.ContactId.id : null,
        Role: values.Role || null,
        IsPrimary: values.IsPrimary === true,
      }),
    onSuccess: async () => {
      await refreshRecords(queryClient);
      toast('Contact role was added.');
      onClose();
    },
  });

  const accountId = typeof opportunity.AccountId === 'string' ? opportunity.AccountId : null;

  return (
    <Modal
      title="Add Contact Roles"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="slds-button slds-button_brand" disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </>
      }
    >
      <PageError error={save.error} />
      {(['ContactId', 'Role', 'IsPrimary'] as const).map((name) => {
        const describeField = field(name);
        return describeField ? (
          <FieldInput
            key={name}
            field={describeField}
            value={values[name] ?? null}
            required={describeField.required}
            lookupWhere={name === 'ContactId' && accountId ? [{ field: 'AccountId', op: 'eq', value: accountId }] : undefined}
            onChange={(value) => setValues({ ...values, [name]: value })}
          />
        ) : null;
      })}
    </Modal>
  );
}
