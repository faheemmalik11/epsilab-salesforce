import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { refreshRecords, useDescribe } from '../api/hooks';
import type { SRecord } from '../api/types';
import { useActingUser } from '../context/ActingUser';
import { recordTitle } from '../lib/layouts';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { useToast } from './Toast';

/** Salesforce's delete confirmation; the API decides whether the delete is allowed. */
export function DeleteRecordModal({ record, onClose, onDeleted }: { record: SRecord; onClose(): void; onDeleted(): void }) {
  const describe = useDescribe(record.attributes.type);
  const queryClient = useQueryClient();
  const toast = useToast();
  const label = describe.data?.label ?? record.attributes.type;
  const remove = useMutation({
    mutationFn: () => api.remove(record.attributes.type, record.Id),
    onSuccess: async () => {
      toast(`${label} "${recordTitle(record)}" was deleted.`);
      onDeleted();
      // The record no longer exists, so drop its cached page instead of refetching it.
      queryClient.removeQueries({ queryKey: ['record', record.attributes.type, record.Id] });
      await refreshRecords(queryClient);
    },
  });
  return (
    <Modal
      title={`Delete ${label}`}
      size="small"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="slds-button slds-button_brand" data-testid="confirm-delete" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Delete
          </button>
        </>
      }
    >
      <PageError error={remove.error} />
      <p className="slds-text-align_center">Are you sure you want to delete this {label.toLowerCase()}?</p>
    </Modal>
  );
}

/** Change Owner: picks an active user and saves OwnerId through the same update API. */
export function ChangeOwnerModal({ record, onClose }: { record: SRecord; onClose(): void }) {
  const { users } = useActingUser();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [ownerId, setOwnerId] = useState(String(record.OwnerId ?? ''));
  const save = useMutation({
    mutationFn: () => api.update(record.attributes.type, record.Id, { OwnerId: ownerId }),
    onSuccess: async () => {
      await refreshRecords(queryClient);
      toast(`${recordTitle(record)} is now owned by ${users.find((u) => u.Id === ownerId)?.Name ?? 'the new owner'}.`);
      onClose();
    },
  });
  return (
    <Modal
      title={`Change ${recordTitle(record)} Owner`}
      size="small"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="slds-button slds-button_brand"
            data-testid="change-owner-submit"
            disabled={save.isPending || ownerId === String(record.OwnerId ?? '')}
            onClick={() => save.mutate()}
          >
            Change Owner
          </button>
        </>
      }
    >
      <PageError error={save.error} />
      <div className="slds-form-element">
        <label className="slds-form-element__label" htmlFor="change-owner">
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
          Owner
        </label>
        <div className="slds-select_container">
          <select id="change-owner" className="slds-select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {users
              .filter((u) => u.IsActive || u.Id === record.OwnerId)
              .map((u) => (
                <option key={u.Id} value={u.Id} disabled={!u.IsActive}>
                  {u.Name}
                </option>
              ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
