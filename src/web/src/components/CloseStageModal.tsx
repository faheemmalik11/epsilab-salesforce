import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { refreshRecords } from '../api/hooks';
import type { SRecord } from '../api/types';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { useToast } from './Toast';

/** Choosing the final step of the opportunity path asks which closed stage to set. */
export function CloseStageModal({ opportunity, closedStages, onClose }: { opportunity: SRecord; closedStages: string[]; onClose(): void }) {
  const [stage, setStage] = useState(closedStages[0] ?? '');
  const queryClient = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => api.update('Opportunity', opportunity.Id, { StageName: stage }),
    onSuccess: async () => {
      await refreshRecords(queryClient);
      toast(`Stage changed to ${stage}.`);
      onClose();
    },
  });

  return (
    <Modal
      title="Close This Opportunity"
      onClose={onClose}
      size="small"
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="slds-button slds-button_brand" data-testid="close-stage-save" disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </>
      }
    >
      <PageError error={save.error} />
      <div className="slds-form-element">
        <label className="slds-form-element__label" htmlFor="close-stage">
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
          Stage
        </label>
        <div className="slds-select_container">
          <select id="close-stage" className="slds-select" value={stage} onChange={(e) => setStage(e.target.value)}>
            {closedStages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
