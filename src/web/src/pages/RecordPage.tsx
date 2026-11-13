import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useDescribe, useRecord, useRecordQuery, refreshRecords } from '../api/hooks';
import type { FieldDescribe, SRecord } from '../api/types';
import { ActivityPanel, type Composer } from '../components/ActivityPanel';
import { FieldInput, type FormValue } from '../components/FieldInput';
import { Menu, type MenuItem } from '../components/Menu';
import { ChangeOwnerModal, DeleteRecordModal } from '../components/RecordActions';
import { changedFields, initialValue, toApiValue } from '../lib/formValues';
import { CloseStageModal } from '../components/CloseStageModal';
import { ContactRoleModal } from '../components/ContactRoleModal';
import { ConvertLeadModal } from '../components/ConvertLeadModal';
import { DataTable, columnLabel } from '../components/DataTable';
import { FieldOutput, recordUrl } from '../components/FieldOutput';
import { ButtonIcon, Icon } from '../components/Icon';
import { PageError } from '../components/PageError';
import { Path, type PathStep } from '../components/Path';
import { RecordForm } from '../components/RecordForm';
import { useToast } from '../components/Toast';
import { formatValue } from '../lib/format';
import { LAYOUTS, layoutFor, recordTitle, type Layout, type RelatedList, type TabObject } from '../lib/layouts';
import { Spinner } from '../components/Spinner';

/** Lead path steps (docs/reference/picklists.md): the working statuses, then conversion. */
const LEAD_PATH = ['Open - Not Contacted', 'Working - Contacted', 'Closed - Not Converted'];
const CONVERTED_STEP = '__converted';
const CLOSED_STEP = '__closed';

function useStatusUpdate(record: SRecord, field: 'Status' | 'StageName') {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (value: string) => api.update(record.attributes.type, record.Id, { [field]: value }),
    onSuccess: async (_data, value) => {
      await refreshRecords(queryClient);
      toast(`${field === 'Status' ? 'Status' : 'Stage'} changed to ${value}.`);
    },
  });
}

function LeadPath({ lead, onConvert }: { lead: SRecord; onConvert(): void }) {
  const update = useStatusUpdate(lead, 'Status');
  const steps: PathStep[] = [...LEAD_PATH.map((value) => ({ value, label: value })), { value: CONVERTED_STEP, label: 'Converted' }];
  const status = String(lead.Status);
  const currentIndex = LEAD_PATH.indexOf(status);
  return (
    <>
      <PageError error={update.error} />
      <Path
        steps={steps}
        currentIndex={currentIndex}
        currentText={`Lead Status: ${status}`}
        busy={update.isPending}
        action={(index) => {
          const step = steps[index]!;
          if (step.value === CONVERTED_STEP) return { label: 'Select Converted Status', run: onConvert };
          if (index === currentIndex) {
            const next = steps[index + 1]!;
            return next.value === CONVERTED_STEP
              ? { label: 'Select Converted Status', run: onConvert }
              : { label: 'Mark Status as Complete', run: () => update.mutate(next.value) };
          }
          return { label: 'Mark as Current Status', run: () => update.mutate(step.value) };
        }}
      />
    </>
  );
}

function OpportunityPath({ opportunity, stages }: { opportunity: SRecord; stages: FieldDescribe }) {
  const update = useStatusUpdate(opportunity, 'StageName');
  const [closing, setClosing] = useState(false);
  const values = stages.picklistValues ?? [];
  const open = values.filter((v) => !v.closed);
  const closed = values.filter((v) => v.closed).map((v) => v.value);
  const stage = String(opportunity.StageName);
  const isClosed = closed.includes(stage);
  const steps: PathStep[] = [...open.map((v) => ({ value: v.value, label: v.value })), { value: CLOSED_STEP, label: isClosed ? stage : 'Closed' }];
  const currentIndex = isClosed ? steps.length - 1 : open.findIndex((v) => v.value === stage);

  return (
    <>
      <PageError error={update.error} />
      <Path
        steps={steps}
        currentIndex={currentIndex}
        currentText={`Stage: ${stage}`}
        busy={update.isPending}
        action={(index) => {
          const step = steps[index]!;
          const openClose = { label: 'Select Closed Stage', run: () => setClosing(true) };
          if (step.value === CLOSED_STEP) return openClose;
          if (index === currentIndex) {
            const next = steps[index + 1]!;
            return next.value === CLOSED_STEP ? openClose : { label: 'Mark Stage as Complete', run: () => update.mutate(next.value) };
          }
          return { label: 'Mark as Current Stage', run: () => update.mutate(step.value) };
        }}
      />
      {closing && <CloseStageModal opportunity={opportunity} closedStages={closed} onClose={() => setClosing(false)} />}
    </>
  );
}

function Highlights({ layout, record, fields }: { layout: Layout; record: SRecord; fields: Map<string, FieldDescribe> }) {
  return (
    <ul className="record-highlights">
      {layout.highlights.map((column) => {
        const field = fields.get(column.field);
        return field ? (
          <li key={column.field} className="record-highlights__item">
            <div className="record-highlights__label slds-truncate">{columnLabel(column, fields)}</div>
            <div className="slds-truncate" data-testid={`highlight-${column.field}`}>
              <FieldOutput field={field} record={record} />
            </div>
          </li>
        ) : null;
      })}
    </ul>
  );
}

const NAME_PARTS = ['Salutation', 'FirstName', 'LastName'];

function DetailRow({ label, testId, onEdit, wide, edited, children }: { label: string; testId?: string; onEdit?(): void; wide?: boolean; edited?: boolean; children: ReactNode }) {
  return (
    <div className={`slds-col slds-p-horizontal_small ${wide ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
      <div className={`slds-form-element slds-form-element_readonly slds-form-element_stacked detail-row ${edited ? 'detail-row_edited' : ''}`}>
        <span className="slds-form-element__label">{label}</span>
        <div className="slds-form-element__control">
          <div className="slds-form-element__static" data-testid={testId}>
            {children}
          </div>
        </div>
        {onEdit && (
          <button type="button" className="slds-button slds-button_icon detail-row__edit" title={`Edit ${label}`} data-testid={`inline-edit-${testId?.replace('detail-', '')}`} onClick={onEdit}>
            <ButtonIcon name="edit" />
            <span className="slds-assistive-text">Edit {label}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** The run of name parts in a section, collapsed into one entry for the Name compound field. */
function sectionEntries(names: string[]): (string | string[])[] {
  const parts = names.filter((n) => NAME_PARTS.includes(n));
  if (parts.length < 2) return names;
  const first = names.indexOf(parts[0]!);
  const rest = names.filter((n) => !NAME_PARTS.includes(n));
  return [...rest.slice(0, first), parts, ...rest.slice(first)];
}

/**
 * Detail sections with Lightning inline edit: a pencil switches the whole panel into edit mode, changed
 * fields are highlighted, and the sticky footer saves only the changed fields through the update API.
 */
function Details({ layout, label, record, fields, editable }: { layout: Layout; label: string; record: SRecord; fields: Map<string, FieldDescribe>; editable: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, FormValue> | null>(null);
  const [focusField, setFocusField] = useState<string | null>(null);
  const editing = values !== null;
  const canEdit = (field: FieldDescribe | undefined) => !!field && field.updateable;
  const valueOf = (field: FieldDescribe) => (values && field.name in values ? values[field.name]! : initialValue(field, record));
  const isEdited = (field: FieldDescribe) =>
    !!values && field.name in values && toApiValue(field, values[field.name] ?? null) !== toApiValue(field, initialValue(field, record));

  const save = useMutation({
    mutationFn: () => api.update(record.attributes.type, record.Id, changedFields([...fields.values()], record, values ?? {})),
    onSuccess: async () => {
      await refreshRecords(queryClient);
      toast(`${label} "${recordTitle(record)}" was saved.`);
      setValues(null);
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;
  const fieldErrors = (name: string) =>
    (error?.fieldErrors(name) ?? []).map((e) => (e.errorCode === 'REQUIRED_FIELD_MISSING' ? 'Complete this field.' : e.message));
  const startEdit = (name: string) => {
    setFocusField(name);
    setValues(values ?? {});
  };
  const cancel = () => {
    setValues(null);
    save.reset();
  };

  const input = (field: FieldDescribe) => (
    <div key={field.name} className={isEdited(field) ? 'detail-input_edited' : ''}>
      <FieldInput
        field={field}
        value={valueOf(field)}
        required={field.required}
        errors={fieldErrors(field.name)}
        autoFocus={focusField === field.name}
        onChange={(value) => setValues({ ...values, [field.name]: value })}
      />
    </div>
  );

  return (
    <div className={editing ? 'details_editing' : ''} data-testid={editing ? 'details-edit-mode' : undefined}>
      {layout.sections.map((section) => (
        <div key={section.title} className="slds-section slds-is-open">
          <h3 className="slds-section__title slds-theme_shade">
            <ButtonIcon name="chevrondown" />
            <span className="slds-truncate slds-p-horizontal_small">{section.title}</span>
          </h3>
          <div className="slds-section__content slds-grid slds-wrap">
            {sectionEntries(section.fields.filter((name) => fields.has(name))).map((entry) => {
              if (Array.isArray(entry)) {
                const parts = entry.map((n) => fields.get(n)!);
                if (editing && parts.some(canEdit)) {
                  return (
                    <div key="Name" className="slds-col slds-p-horizontal_small slds-size_1-of-2 detail-edit">
                      <fieldset className="slds-form-element slds-form-element_compound">
                        <legend className="slds-form-element__legend slds-form-element__label">Name</legend>
                        {parts.filter(canEdit).map(input)}
                      </fieldset>
                    </div>
                  );
                }
                const full = entry.map((n) => record[n]).filter(Boolean).join(' ');
                return (
                  <DetailRow key="Name" label="Name" testId="detail-Name" onEdit={editable && parts.some(canEdit) ? () => startEdit('FirstName') : undefined}>
                    {full}
                  </DetailRow>
                );
              }
              const field = fields.get(entry)!;
              if (editing && canEdit(field)) {
                return (
                  <div key={entry} className={`slds-col slds-p-horizontal_small detail-edit ${field.type === 'textarea' ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
                    {input(field)}
                  </div>
                );
              }
              return (
                <DetailRow
                  key={entry}
                  label={field.label}
                  testId={`detail-${entry}`}
                  wide={field.type === 'textarea'}
                  onEdit={editable && canEdit(field) ? () => startEdit(entry) : undefined}
                >
                  <FieldOutput field={field} record={record} />
                </DetailRow>
              );
            })}
          </div>
        </div>
      ))}
      {editing && (
        <div className="details-footer" data-testid="details-footer">
          {save.error && (
            <div className="inline-edit-errors" role="alert">
              <h2>We hit a snag.</h2>
              <p>{save.error.message}</p>
            </div>
          )}
          <button type="button" className="slds-button slds-button_neutral" data-testid="details-cancel" onClick={cancel}>
            Cancel
          </button>
          <button type="button" className="slds-button slds-button_brand" data-testid="details-save" disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function RelatedCard({ list, parent }: { list: RelatedList; parent: SRecord }) {
  const describe = useDescribe(list.object);
  const result = useRecordQuery({ object: list.object, where: [{ field: list.parentField, op: 'eq', value: parent.Id }], limit: 50 });
  const [adding, setAdding] = useState(false);
  const fields = new Map((describe.data?.fields ?? []).map((f) => [f.name, f]));
  const records = result.data?.records ?? [];
  const isContactRoles = list.object === 'OpportunityContactRole';
  const canAdd = isContactRoles ? parent.attributes.type === 'Opportunity' : !!layoutFor(list.object);
  const parentRef = { id: parent.Id, name: recordTitle(parent), object: parent.attributes.type };

  return (
    <article className="slds-card slds-card_boundary slds-m-bottom_small" data-testid={`related-${list.object}`}>
      <div className="slds-card__header slds-grid">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <div className="slds-media__figure">
            <Icon name={layoutFor(list.object)?.icon ?? 'contact'} size="small" />
          </div>
          <div className="slds-media__body">
            <h2 className="slds-card__header-title">
              {list.title} ({result.data?.totalSize ?? 0})
            </h2>
          </div>
        </header>
        {canAdd && (
          <div className="slds-no-flex">
            <button type="button" className="slds-button slds-button_neutral" data-testid={`related-new-${list.object}`} onClick={() => setAdding(true)}>
              {isContactRoles ? 'Add Contact Roles' : 'New'}
            </button>
          </div>
        )}
      </div>
      {records.length > 0 && (
        <div className="slds-card__body">
          <DataTable object={list.object} columns={list.columns} fields={fields} records={records} />
        </div>
      )}
      {adding &&
        (isContactRoles ? (
          <ContactRoleModal opportunity={parent} onClose={() => setAdding(false)} />
        ) : (
          <RecordForm
            object={list.object as TabObject}
            initial={{ [list.parentField]: parentRef }}
            onClose={() => setAdding(false)}
            onSaved={() => setAdding(false)}
          />
        ))}
    </article>
  );
}

function ConvertedBanner({ lead }: { lead: SRecord }) {
  const links = [
    ['ConvertedAccount', 'Account'],
    ['ConvertedContact', 'Contact'],
    ['ConvertedOpportunity', 'Opportunity'],
  ] as const;
  return (
    <div className="slds-notify slds-notify_alert slds-alert_info slds-m-bottom_small" role="status" data-testid="converted-banner">
      <h2>
        This lead was converted on {formatValue('date', lead.ConvertedDate)} and is read-only.{' '}
        {links.map(([relationship, label]) => {
          const related = lead[relationship] as { Id: string; Name: string } | null;
          return related ? (
            <span key={label} className="slds-m-left_small">
              {label}: <Link to={recordUrl(label, related.Id)}>{related.Name}</Link>
            </span>
          ) : null;
        })}
      </h2>
    </div>
  );
}

export function RecordPage() {
  const params = useParams();
  const object = params.object as TabObject;
  const layout = LAYOUTS[object];
  const record = useRecord(object, params.id!);
  const describe = useDescribe(object);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [tab, setTab] = useState<'details' | 'related'>('details');
  const [composer, setComposer] = useState<Composer | null>(null);
  const [changingOwner, setChangingOwner] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  if (!layout) return <PageError error={new Error('Unknown object')} />;
  if (record.error) return <div className="slds-p-around_medium"><PageError error={record.error} /></div>;
  if (!record.data || !describe.data) {
    return (
      <div className="page-loading">
        <Spinner overlay />
      </div>
    );
  }

  const data = record.data;
  const fields = new Map(describe.data.fields.map((f) => [f.name, f]));
  const converted = object === 'Lead' && data.IsConverted === true;
  const stageField = fields.get('StageName');

  const actions = [
    ...(object === 'Lead' && !converted
      ? [{ id: 'convert-lead', label: 'Convert', run: () => setConverting(true) }]
      : []),
    ...(!converted && 'OwnerId' in data ? [{ id: 'change-owner', label: 'Change Owner', run: () => setChangingOwner(true) }] : []),
    ...(!converted ? [{ id: 'edit-record', label: 'Edit', run: () => setEditing(true) }] : []),
  ];
  const canLogActivity = !!layout.activityField && !converted;
  const moreActions: MenuItem[] = [
    ...(canLogActivity
      ? [
          { id: 'event', label: 'New Event', stub: true },
          { id: 'call', label: 'Log a Call', testId: 'more-log-call', onSelect: () => setComposer('call') },
          { id: 'task', label: 'New Task', testId: 'more-new-task', onSelect: () => setComposer('task') },
        ]
      : []),
    { id: 'delete', label: 'Delete', testId: 'more-delete', onSelect: () => setDeleting(true) },
  ];
  const hasPath = (object === 'Lead' && !converted) || (object === 'Opportunity' && !!stageField);

  return (
    <div className="record-page" data-testid="record-page">
      <div className="record-header">
        <div className="record-header__row">
          <div className="slds-media slds-media_center">
            <div className="slds-media__figure">
              <Icon name={layout.icon} size="medium" />
            </div>
            <div className="slds-media__body">
              <p className="record-header__object">{describe.data.label}</p>
              <h1 className="record-header__title slds-truncate" data-testid="record-title">
                {recordTitle(data)}
              </h1>
            </div>
          </div>
          <ul className="slds-button-group-list">
            {actions.map((action) => (
              <li key={action.id}>
                <button type="button" className="slds-button slds-button_neutral" data-testid={action.id} onClick={action.run}>
                  {action.label}
                </button>
              </li>
            ))}
            <li>
              <Menu
                align="right"
                testId="more-actions-menu"
                sections={[{ items: moreActions }]}
                trigger={(props) => (
                  <button {...props} type="button" className="slds-button slds-button_icon-border-filled record-more" title="Show more actions" data-testid="more-actions">
                    <ButtonIcon name="down" />
                    <span className="slds-assistive-text">Show more actions</span>
                  </button>
                )}
              />
            </li>
          </ul>
        </div>
        <Highlights layout={layout} record={data} fields={fields} />
      </div>

      {converted && <ConvertedBanner lead={data} />}

      {hasPath && (
        <div className="record-panel record-panel_path">
          {object === 'Lead' && !converted && <LeadPath lead={data} onConvert={() => setConverting(true)} />}
          {object === 'Opportunity' && stageField && <OpportunityPath opportunity={data} stages={stageField} />}
        </div>
      )}

      <div className="record-columns">
        <div className="record-panel record-columns__main">
          <div className="slds-tabs_default">
            <ul className="slds-tabs_default__nav" role="tablist">
              {(['details', 'related'] as const)
                .filter((t) => t === 'details' || layout.related.length > 0)
                .map((t) => (
                  <li key={t} className={`slds-tabs_default__item ${tab === t ? 'slds-is-active' : ''}`} role="presentation">
                    <a
                      className="slds-tabs_default__link"
                      href="#"
                      role="tab"
                      data-testid={`tab-${t}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setTab(t);
                      }}
                    >
                      {t === 'details' ? 'Details' : 'Related'}
                    </a>
                  </li>
                ))}
            </ul>
            <div className="slds-tabs_default__content slds-show" role="tabpanel">
              {tab === 'details' ? (
                <Details key={data.Id} layout={layout} label={describe.data.label} record={data} fields={fields} editable={!converted} />
              ) : (
                layout.related.map((list) => <RelatedCard key={list.title} list={list} parent={data} />)
              )}
            </div>
          </div>
        </div>
        {layout.activityField && (
          <div className="record-columns__side">
            <ActivityPanel record={data} link={layout.activityField} readOnly={converted} composer={composer} onComposerChange={setComposer} />
          </div>
        )}
      </div>

      {editing && <RecordForm object={object} record={data} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {converting && <ConvertLeadModal lead={data} onClose={() => setConverting(false)} />}
      {changingOwner && <ChangeOwnerModal record={data} onClose={() => setChangingOwner(false)} />}
      {deleting && <DeleteRecordModal record={data} onClose={() => setDeleting(false)} onDeleted={() => navigate(`/lightning/o/${object}/list`)} />}
    </div>
  );
}
