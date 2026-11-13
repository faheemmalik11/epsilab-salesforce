import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { ButtonIcon } from './Icon';
import { Menu } from './Menu';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { useToast } from './Toast';

/**
 * Demo admin control for the assessment environment, not a Salesforce feature: resets the database to
 * its baseline through the existing POST /api/admin/reset, after an explicit confirmation.
 */
function ResetEnvironmentModal({ onClose }: { onClose(): void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const reset = useMutation({
    mutationFn: async () => {
      const result = await api.resetEnvironment();
      // A reset that ran but doesn't match the baseline is a failure, not a success with a caveat.
      if (!result.matches) {
        throw new ApiError(500, [{ errorCode: 'RESET_MISMATCH', message: `The reset finished but the database does not match the baseline (sha256 ${result.sha256}).` }]);
      }
      return result;
    },
    onSuccess: async (result) => {
      // Every cached record, list and related list is from before the reset: drop them all, then land
      // on Seller Home so nothing stale stays on screen. Users and object descriptions can't change
      // through a reset (users are read-only), so they are kept and the app doesn't blank while reloading.
      queryClient.removeQueries({ predicate: (query) => !['users', 'describe'].includes(String(query.queryKey[0])) });
      onClose();
      navigate('/lightning/page/home');
      toast(`Environment reset to the baseline in ${result.durationMs} ms (sha256 ${result.sha256.slice(0, 12)}…).`);
    },
  });

  return (
    <Modal
      title="Reset Environment?"
      size="small"
      onClose={() => !reset.isPending && onClose()}
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" data-testid="reset-cancel" disabled={reset.isPending} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="slds-button slds-button_brand"
            data-testid="reset-confirm"
            disabled={reset.isPending}
            aria-busy={reset.isPending}
            onClick={() => !reset.isPending && reset.mutate()}
          >
            {reset.isPending ? 'Resetting…' : 'Reset Environment'}
          </button>
        </>
      }
    >
      <PageError error={reset.error} />
      <p className="reset-modal__text">
        This restores the database to its baseline snapshot. <strong>All changes made since the baseline</strong>, in the app, the REST API and
        MCP, <strong>are permanently discarded.</strong>
      </p>
      <p className="reset-modal__note">Demo admin control for this assessment environment. It is not a standard Salesforce feature.</p>
      {reset.isPending && (
        <div className="reset-modal__progress" role="status" data-testid="reset-progress">
          <div className="slds-spinner slds-spinner_x-small slds-spinner_brand slds-spinner_inline">
            <span className="slds-assistive-text">Resetting</span>
            <div className="slds-spinner__dot-a" />
            <div className="slds-spinner__dot-b" />
          </div>
          Resetting the environment…
        </div>
      )}
    </Modal>
  );
}

/** The header's settings menu with the Environment Controls section. */
export function EnvironmentControls() {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Menu
        align="right"
        testId="settings-menu"
        sections={[
          {
            header: 'Environment Controls (demo admin)',
            items: [{ id: 'reset', icon: 'refresh', label: 'Reset to Baseline', testId: 'reset-to-baseline', onSelect: () => setConfirming(true) }],
          },
        ]}
        trigger={(props) => (
          <button {...props} type="button" className="slds-button slds-button_icon header-settings" title="Settings" data-testid="settings-button">
            <ButtonIcon name="settings" />
            <span className="slds-assistive-text">Settings</span>
          </button>
        )}
      />
      {confirming && <ResetEnvironmentModal onClose={() => setConfirming(false)} />}
    </>
  );
}
