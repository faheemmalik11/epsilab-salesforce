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
import { Section } from '../components/Section';
import { useToast } from '../components/Toast';
import { formatValue } from '../lib/format';
import { LAYOUTS, layoutFor, recordTitle, type Layout, type RelatedList, type TabObject } from '../lib/layouts';
import { Spinner } from '../components/Spinner';

/**
 * Lead path steps (docs/reference/picklists.md): the working statuses, then conversion. A lead whose
 * status is one of the rarer seed values gets that value too, so the Path always has a current step.
 */
const LEAD_PATH = ['Open - Not Contacted', 'Prospecting', 'Working - Contacted', 'Closed - Not Converted'];
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

function LeadPath({ lead, statuses, onConvert }: { lead: SRecord; statuses: FieldDescribe | undefined; onConvert(): void }) {
  const update = useStatusUpdate(lead, 'Status');
  const status = String(lead.Status);
  // Picklist order, so an added status sits where Lightning's Path would show it.
  const order = (statuses?.picklistValues ?? []).map((v) => v.value);
  const shown = LEAD_PATH.includes(status) ? LEAD_PATH : [...LEAD_PATH, status].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const steps: PathStep[] = [...shown.map((value) => ({ value, label: value })), { value: CONVERTED_STEP, label: 'Converted' }];
  const currentIndex = shown.indexOf(status);
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

/** Fields Lightning shows as one row: the Name and Address compounds, and "Created By: user, date". */
interface FieldGroup {
  key: string;
  label: string;
  parts: string[];
  /** Read-only audit pairs: user, then date. */
  audit?: boolean;
}

const FIELD_GROUPS: FieldGroup[] = [
  { key: 'Name', label: 'Name', parts: ['Salutation', 'FirstName', 'LastName'] },
  { key: 'Address', label: 'Address', parts: ['Street', 'City', 'State', 'PostalCode', 'Country'] },
  { key: 'CreatedBy', label: 'Created By', parts: ['CreatedById', 'CreatedDate'], audit: true },
  { key: 'LastModifiedBy', label: 'Last Modified By', parts: ['LastModifiedById', 'LastModifiedDate'], audit: true },
];

function DetailRow({ label, testId, onEdit, wide, children }: { label: string; testId?: string; onEdit?(): void; wide: boolean; children: ReactNode }) {
  return (
    <div className={`slds-col slds-p-horizontal_small ${wide ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
      <div className="slds-form-element slds-form-element_readonly slds-form-element_stacked detail-row">
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

/** A section's fields, with each group's parts collapsed into one entry where the first part was. */
function sectionEntries(names: string[]): (string | FieldGroup)[] {
  const entries: (string | FieldGroup)[] = [];
  for (const name of names) {
    const group = FIELD_GROUPS.find((g) => g.parts.includes(name) && g.parts.filter((p) => names.includes(p)).length > 1);
    if (!group) entries.push(name);
    else if (!entries.includes(group)) entries.push(group);
  }
  return entries;
}

/** "Street, City, State Postcode, Country" on separate lines, as Lightning shows an address. */
function formatAddress(record: SRecord): string {
  const cityLine = [record.City, [record.State, record.PostalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [record.Street, cityLine, record.Country].filter(Boolean).join('\n');
}

/**
 * Detail sections with Lightning inline edit: a pencil switches the whole panel into edit mode, changed
 * fields are highlighted, and the sticky footer saves only the changed fields through the update API.
 */
function Details({ layout, label, record, fields, editable, singleColumn }: { layout: Layout; label: string; record: SRecord; fields: Map<string, FieldDescribe>; editable: boolean; singleColumn: boolean }) {
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
        <Section key={section.title} title={section.title} contentClassName="slds-grid slds-wrap">
            {sectionEntries(section.fields.filter((name) => fields.has(name))).map((entry) => {
              if (typeof entry !== 'string') {
                const parts = entry.parts.filter((n) => fields.has(n)).map((n) => fields.get(n)!);
                if (editing && !entry.audit && parts.some(canEdit)) {
                  return (
                    <div key={entry.key} className={`slds-col slds-p-horizontal_small detail-edit ${singleColumn ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
                      <fieldset className="slds-form-element slds-form-element_compound">
                        <legend className="slds-form-element__legend slds-form-element__label">{entry.label}</legend>
                        {parts.filter(canEdit).map(input)}
                      </fieldset>
                    </div>
                  );
                }
                let value: ReactNode;
                if (entry.audit) {
                  const [user, date] = parts;
                  value = (
                    <>
                      <FieldOutput field={user!} record={record} />
                      {date && record[date.name] ? `, ${formatValue('datetime', record[date.name])}` : ''}
                    </>
                  );
                } else if (entry.key === 'Address') value = <span style={{ whiteSpace: 'pre-line' }}>{formatAddress(record)}</span>;
                else value = entry.parts.map((n) => record[n]).filter(Boolean).join(' ');
                return (
                  <DetailRow
                    key={entry.key}
                    label={entry.label}
                    testId={`detail-${entry.key}`}
                    wide={singleColumn}
                    onEdit={editable && !entry.audit && parts.some(canEdit) ? () => startEdit(parts.find(canEdit)!.name) : undefined}
                  >
                    {value}
                  </DetailRow>
                );
              }
              const field = fields.get(entry)!;
              const wide = singleColumn || field.type === 'textarea';
              if (editing && canEdit(field)) {
                return (
                  <div key={entry} className={`slds-col slds-p-horizontal_small detail-edit ${wide ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
                    {input(field)}
                  </div>
                );
              }
              return (
                <DetailRow key={entry} label={field.label} testId={`detail-${entry}`} wide={wide} onEdit={editable && canEdit(field) ? () => startEdit(entry) : undefined}>
                  <FieldOutput field={field} record={record} />
                </DetailRow>
              );
            })}
        </Section>
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
    <article className="slds-card related-card" data-testid={`related-${list.object}`}>
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
  const columnCount = 1 + (layout.activityField ? 1 : 0) + (layout.related.length > 0 ? 1 : 0);

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
          {object === 'Lead' && !converted && <LeadPath lead={data} statuses={fields.get('Status')} onConvert={() => setConverting(true)} />}
          {object === 'Opportunity' && stageField && <OpportunityPath opportunity={data} stages={stageField} />}
        </div>
      )}

      {/* Lightning's record layout: details, then activity, then related lists, in equal columns.
          Without related lists (leads), activity takes the remaining width rather than an empty panel. */}
      <div className={`record-columns record-columns_${columnCount}`} data-testid="record-columns">
        <div className="record-panel record-columns__details" data-testid="record-details">
          <Details
            key={data.Id}
            layout={layout}
            label={describe.data.label}
            record={data}
            fields={fields}
            editable={!converted}
            singleColumn={columnCount > 1}
          />
        </div>
        {layout.activityField && (
          <div className={`record-columns__activity ${layout.related.length === 0 ? 'record-columns__activity_wide' : ''}`}>
            <ActivityPanel record={data} link={layout.activityField} readOnly={converted} composer={composer} onComposerChange={setComposer} />
          </div>
        )}
        {layout.related.length > 0 && (
          <div className="record-columns__related" data-testid="record-related">
            {layout.related.map((list) => (
              <RelatedCard key={list.title} list={list} parent={data} />
            ))}
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
