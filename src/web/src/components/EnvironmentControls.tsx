import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { formatNumber } from '../lib/format';
import { ButtonIcon } from './Icon';
import { Menu } from './Menu';
import { Modal } from './Modal';
import { PageError } from './PageError';
import { useToast } from './Toast';

type Dialog = 'baseline' | 'seed-only' | 'generate';

const RESETS = {
  baseline: {
    label: 'the baseline',
    text: (
      <>
        This restores the database to its baseline snapshot. <strong>All changes made since the baseline</strong>, in the app, the REST API and
        MCP, <strong>are permanently discarded.</strong>
      </>
    ),
  },
  'seed-only': {
    label: 'the seed only',
    text: (
      <>
        This restores the database to the seed alone: 21,628 leads and 9 users. <strong>Every account, contact, opportunity, contact role and task</strong>,
        generated or added since, <strong>is permanently discarded.</strong> Generate Synthetic Data brings the generated records back.
      </>
    ),
  },
} as const;

// Every cached record, list and related list is from before the change: drop them all. Users and object
// descriptions can't change this way (users are read-only), so they are kept and the app doesn't blank.
function dropRecordCaches(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => !['users', 'describe'].includes(String(query.queryKey[0])) });
}

function Progress({ children }: { children: ReactNode }) {
  return (
    <div className="reset-modal__progress" role="status" data-testid="reset-progress">
      <div className="slds-spinner slds-spinner_x-small slds-spinner_brand slds-spinner_inline">
        <span className="slds-assistive-text">Working</span>
        <div className="slds-spinner__dot-a" />
        <div className="slds-spinner__dot-b" />
      </div>
      {children}
    </div>
  );
}

const NOTE = 'Demo admin control for this assessment environment. It is not a standard Salesforce feature.';

/**
 * Demo admin control for the assessment environment, not a Salesforce feature: resets the database to
 * the baseline or to the seed alone through the existing POST /api/admin/reset, after an explicit confirmation.
 */
function ResetEnvironmentModal({ snapshot, onClose }: { snapshot: keyof typeof RESETS; onClose(): void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const target = RESETS[snapshot];
  const reset = useMutation({
    mutationFn: async () => {
      const result = await api.resetEnvironment(snapshot === 'baseline' ? undefined : snapshot);
      // A reset that ran but doesn't match the snapshot is a failure, not a success with a caveat.
      if (!result.matches) {
        throw new ApiError(500, [{ errorCode: 'RESET_MISMATCH', message: `The reset finished but the database does not match ${target.label} (sha256 ${result.sha256}).` }]);
      }
      return result;
    },
    onSuccess: (result) => {
      // Land on Seller Home so nothing stale stays on screen.
      dropRecordCaches(queryClient);
      onClose();
      navigate('/lightning/page/home');
      toast(`Environment reset to ${target.label} in ${result.durationMs} ms (sha256 ${result.sha256.slice(0, 12)}…).`);
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
      <p className="reset-modal__text">{target.text}</p>
      <p className="reset-modal__note">{NOTE}</p>
      {reset.isPending && <Progress>Resetting the environment…</Progress>}
    </Modal>
  );
}

/** Generates the synthetic records into a seed-only database through POST /api/admin/synthetic-data. */
function GenerateDataModal({ onClose }: { onClose(): void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const generate = useMutation({
    mutationFn: () => api.generateSyntheticData(),
    onSuccess: (result) => {
      dropRecordCaches(queryClient);
      onClose();
      navigate('/lightning/page/home');
      const total = Object.values(result.generated).reduce((sum, n) => sum + n, 0);
      toast(`Generated ${formatNumber(total)} records in ${(result.durationMs / 1000).toFixed(1)} s.`);
    },
  });

  return (
    <Modal
      title="Generate Synthetic Data?"
      size="small"
      onClose={() => !generate.isPending && onClose()}
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" data-testid="generate-cancel" disabled={generate.isPending} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="slds-button slds-button_brand"
            data-testid="generate-confirm"
            disabled={generate.isPending}
            aria-busy={generate.isPending}
            onClick={() => !generate.isPending && generate.mutate()}
          >
            {generate.isPending ? 'Generating…' : 'Generate Data'}
          </button>
        </>
      }
    >
      <PageError error={generate.error} />
      <p className="reset-modal__text">
        This adds the generated accounts, contacts, opportunities, contact roles and tasks to the seed leads and users. The data is the same every
        time. Records you added since the reset are kept. It takes a few seconds.
      </p>
      <p className="reset-modal__note">{NOTE}</p>
      {generate.isPending && <Progress>Generating synthetic data…</Progress>}
    </Modal>
  );
}

/** The header's settings menu with the Environment Controls section. */
export function EnvironmentControls() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Read when the menu opens, so the Generate item reflects resets made through REST or MCP too.
  const data = useQuery({ queryKey: ['synthetic-data'], queryFn: api.syntheticData, enabled: menuOpen, staleTime: 0 });
  const canGenerate = data.data?.status === 'none';
  return (
    <>
      <Menu
        align="right"
        testId="settings-menu"
        onOpenChange={setMenuOpen}
        sections={[
          {
            header: 'Environment Controls (demo admin)',
            items: [
              { id: 'reset', icon: 'refresh', label: 'Reset to Baseline', testId: 'reset-to-baseline', onSelect: () => setDialog('baseline') },
              { id: 'seed-only', icon: 'undo', label: 'Reset to Seed Only', testId: 'reset-to-seed-only', onSelect: () => setDialog('seed-only') },
              {
                id: 'generate',
                icon: 'database',
                label: canGenerate ? 'Generate Synthetic Data' : 'Generate Synthetic Data (already generated)',
                testId: 'generate-synthetic-data',
                disabled: !canGenerate,
                onSelect: () => setDialog('generate'),
              },
            ],
          },
        ]}
        trigger={(props) => (
          <button {...props} type="button" className="slds-button slds-button_icon header-settings" title="Settings" data-testid="settings-button">
            <ButtonIcon name="settings" />
            <span className="slds-assistive-text">Settings</span>
          </button>
        )}
      />
      {dialog === 'generate' && <GenerateDataModal onClose={() => setDialog(null)} />}
      {dialog && dialog !== 'generate' && <ResetEnvironmentModal snapshot={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}
