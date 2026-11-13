import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDescribe, useRecord, useRecordQuery, refreshRecords } from '../api/hooks';
import type { FieldDescribe, SRecord } from '../api/types';
import { ActivityPanel } from '../components/ActivityPanel';
import { CloseStageModal } from '../components/CloseStageModal';
import { ContactRoleModal } from '../components/ContactRoleModal';
import { ConvertLeadModal } from '../components/ConvertLeadModal';
import { DataTable, columnLabel } from '../components/DataTable';
import { FieldOutput, recordUrl } from '../components/FieldOutput';
import { Icon } from '../components/Icon';
import { PageError } from '../components/PageError';
import { Path, type PathStep } from '../components/Path';
import { RecordForm } from '../components/RecordForm';
import { useToast } from '../components/Toast';
import { formatValue } from '../lib/format';
import { LAYOUTS, layoutFor, recordTitle, type Layout, type RelatedList, type TabObject } from '../lib/layouts';

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
    <ul className="slds-page-header__detail-row">
      {layout.highlights.map((column) => {
        const field = fields.get(column.field);
        return field ? (
          <li key={column.field} className="slds-page-header__detail-block">
            <div className="slds-text-title slds-truncate">{columnLabel(column, fields)}</div>
            <div className="slds-truncate" data-testid={`highlight-${column.field}`}>
              <FieldOutput field={field} record={record} />
            </div>
          </li>
        ) : null;
      })}
    </ul>
  );
}

function Details({ layout, record, fields }: { layout: Layout; record: SRecord; fields: Map<string, FieldDescribe> }) {
  return (
    <>
      {layout.sections.map((section) => (
        <div key={section.title} className="slds-section slds-is-open">
          <h3 className="slds-section__title slds-theme_shade">
            <span className="slds-truncate slds-p-horizontal_small">{section.title}</span>
          </h3>
          <div className="slds-section__content slds-grid slds-wrap">
            {section.fields.map((name) => {
              const field = fields.get(name);
              return field ? (
                <div key={name} className={`slds-col slds-p-horizontal_small ${field.type === 'textarea' ? 'slds-size_1-of-1' : 'slds-size_1-of-2'}`}>
                  <div className="slds-form-element slds-form-element_readonly slds-form-element_stacked">
                    <span className="slds-form-element__label">{field.label}</span>
                    <div className="slds-form-element__control">
                      <div className="slds-form-element__static" data-testid={`detail-${name}`}>
                        <FieldOutput field={field} record={record} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>
      ))}
    </>
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

  if (!layout) return <PageError error={new Error('Unknown object')} />;
  if (record.error) return <div className="slds-p-around_medium"><PageError error={record.error} /></div>;
  if (!record.data || !describe.data) {
    return (
      <div className="slds-is-relative slds-p-around_xx-large">
        <div role="status" className="slds-spinner slds-spinner_medium">
          <span className="slds-assistive-text">Loading</span>
          <div className="slds-spinner__dot-a" />
          <div className="slds-spinner__dot-b" />
        </div>
      </div>
    );
  }

  const data = record.data;
  const fields = new Map(describe.data.fields.map((f) => [f.name, f]));
  const converted = object === 'Lead' && data.IsConverted === true;
  const stageField = fields.get('StageName');

  return (
    <div className="slds-p-around_small" data-testid="record-page">
      <div className="slds-page-header slds-page-header_record-home slds-m-bottom_small">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure">
                <Icon name={layout.icon} size="medium" />
              </div>
              <div className="slds-media__body">
                <div className="slds-page-header__name">
                  <div className="slds-page-header__name-title">
                    <h1>
                      <span>{describe.data.label}</span>
                      <span className="slds-page-header__title slds-truncate" data-testid="record-title">
                        {recordTitle(data)}
                      </span>
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-page-header__controls">
              <ul className="slds-button-group-list">
                {!converted && (
                  <li>
                    <button type="button" className="slds-button slds-button_neutral" data-testid="edit-record" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  </li>
                )}
                {object === 'Lead' && !converted && (
                  <li>
                    <button type="button" className="slds-button slds-button_neutral" data-testid="convert-lead" onClick={() => setConverting(true)}>
                      Convert
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <div className="slds-page-header__row slds-page-header__row_gutters">
          <div className="slds-page-header__col-details">
            <Highlights layout={layout} record={data} fields={fields} />
          </div>
        </div>
      </div>

      {converted && <ConvertedBanner lead={data} />}

      <div className="slds-grid slds-gutters_small">
        <div className={`slds-col ${layout.activityField ? 'slds-size_8-of-12' : 'slds-size_1-of-1'}`}>
          {object === 'Lead' && !converted && <LeadPath lead={data} onConvert={() => setConverting(true)} />}
          {object === 'Opportunity' && stageField && <OpportunityPath opportunity={data} stages={stageField} />}
          <article className="slds-card">
            <div className="slds-card__body slds-card__body_inner">
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
                    <Details layout={layout} record={data} fields={fields} />
                  ) : (
                    layout.related.map((list) => <RelatedCard key={list.title} list={list} parent={data} />)
                  )}
                </div>
              </div>
            </div>
          </article>
        </div>
        {layout.activityField && (
          <div className="slds-col slds-size_4-of-12">
            <ActivityPanel record={data} link={layout.activityField} readOnly={converted} />
          </div>
        )}
      </div>

      {editing && <RecordForm object={object} record={data} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {converting && <ConvertLeadModal lead={data} onClose={() => setConverting(false)} />}
    </div>
  );
}
