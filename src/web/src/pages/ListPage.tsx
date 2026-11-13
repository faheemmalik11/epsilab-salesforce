import { useCallback, useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '../api/client';
import { refreshRecords, useDescribe } from '../api/hooks';
import type { FieldDescribe, QueryCondition, SRecord } from '../api/types';
import { DataTable, type Drafts, type Sort } from '../components/DataTable';
import type { FormValue } from '../components/FieldInput';
import { Menu } from '../components/Menu';
import { ChangeOwnerModal, DeleteRecordModal } from '../components/RecordActions';
import { useToast } from '../components/Toast';
import { changedFields, initialValue, toApiValue } from '../lib/formValues';
import { ButtonIcon, Icon } from '../components/Icon';
import { PageError } from '../components/PageError';
import { RecordForm } from '../components/RecordForm';
import { scopeTitle } from '../components/Stub';
import { useActingUser } from '../context/ActingUser';
import { formatNumber } from '../lib/format';
import { LAYOUTS, recordTitle, type TabObject } from '../lib/layouts';
import { recordUrl } from '../components/FieldOutput';
import { Spinner } from '../components/Spinner';

const PAGE_SIZE = 50;

interface Filter {
  field: string;
  value: string;
}

/** Filters live in the URL as field:value pairs, so a list view can be reloaded or shared. */
function parseFilters(params: URLSearchParams): Filter[] {
  return params.getAll('filter').flatMap((raw) => {
    const at = raw.indexOf(':');
    return at > 0 ? [{ field: raw.slice(0, at), value: raw.slice(at + 1) }] : [];
  });
}

function FilterPanel({
  fields,
  applied,
  onApply,
  onClose,
}: {
  fields: FieldDescribe[];
  applied: Filter[];
  onApply(filters: Filter[]): void;
  onClose(): void;
}) {
  const [draft, setDraft] = useState<Filter[]>(applied);
  const [adding, setAdding] = useState<Filter | null>(null);
  const fieldFor = (name: string) => fields.find((f) => f.name === name);

  return (
    <div className="slds-panel slds-size_medium slds-panel_docked slds-panel_docked-right slds-is-open" data-testid="filter-panel">
      <div className="slds-panel__header">
        <h2 className="slds-panel__header-title slds-text-heading_small slds-truncate">Filters</h2>
        <button type="button" className="slds-button slds-button_icon slds-panel__close" onClick={onClose} title="Close filters">
          <ButtonIcon name="close" />
          <span className="slds-assistive-text">Close filters</span>
        </button>
      </div>
      <div className="slds-panel__body">
        <ol className="slds-list_vertical slds-list_vertical-space">
          {draft.map((filter, index) => (
            <li key={`${filter.field}-${index}`} className="slds-item slds-box slds-box_x-small slds-grid slds-grid_align-spread">
              <span data-testid="filter-item">
                <span className="slds-text-title">{fieldFor(filter.field)?.label}</span>
                <br />
                equals {filter.value}
              </span>
              <button type="button" className="slds-button slds-button_icon" title="Remove filter" onClick={() => setDraft(draft.filter((_, i) => i !== index))}>
                <ButtonIcon name="close" />
                <span className="slds-assistive-text">Remove filter</span>
              </button>
            </li>
          ))}
        </ol>
        {adding ? (
          <div className="slds-box slds-box_x-small slds-m-top_small">
            <div className="slds-form-element slds-m-bottom_x-small">
              <label className="slds-form-element__label" htmlFor="filter-field">
                Field
              </label>
              <div className="slds-select_container">
                <select
                  id="filter-field"
                  className="slds-select"
                  value={adding.field}
                  onChange={(e) => setAdding({ field: e.target.value, value: '' })}
                >
                  <option value="">--Select a field--</option>
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="slds-form-element slds-m-bottom_x-small">
              <span className="slds-form-element__label">Operator</span>
              <div className="slds-form-element__static">equals</div>
            </div>
            <div className="slds-form-element slds-m-bottom_x-small">
              <label className="slds-form-element__label" htmlFor="filter-value">
                Value
              </label>
              <div className="slds-select_container">
                <select
                  id="filter-value"
                  className="slds-select"
                  value={adding.value}
                  disabled={!adding.field}
                  onChange={(e) => setAdding({ ...adding, value: e.target.value })}
                >
                  <option value="">--Select a value--</option>
                  {(fieldFor(adding.field)?.picklistValues ?? []).map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="slds-button slds-button_neutral"
              disabled={!adding.field || !adding.value}
              onClick={() => {
                setDraft([...draft, adding]);
                setAdding(null);
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <button type="button" className="slds-button slds-m-top_small" onClick={() => setAdding({ field: '', value: '' })}>
            Add Filter
          </button>
        )}
      </div>
      <div className="slds-panel__header slds-grid slds-grid_align-spread">
        <button type="button" className="slds-button" onClick={() => setDraft([])} disabled={draft.length === 0}>
          Remove All
        </button>
        <div>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="slds-button slds-button_brand" onClick={() => onApply(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const STUB_VIEWS = ['Recently Viewed', 'All Open'];

export function ListPage({ object }: { object: TabObject }) {
  const layout = LAYOUTS[object];
  const describe = useDescribe(object);
  const { current } = useActingUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewSearch, setViewSearch] = useState('');
  const [editing, setEditing] = useState<SRecord | null>(null);
  const [deleting, setDeleting] = useState<SRecord | null>(null);
  const [changingOwner, setChangingOwner] = useState<SRecord | null>(null);
  const [wrapped, setWrapped] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string[]>>({});
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const search = params.get('q') ?? '';
  const [searchDraft, setSearchDraft] = useState(search);

  const view = params.get('view') === 'mine' ? 'mine' : 'all';
  const sort: Sort = { field: params.get('sort') ?? layout.defaultSort, direction: params.get('dir') === 'desc' ? 'desc' : 'asc' };
  const filters = parseFilters(params);
  const searchField = layout.columns.find((c) => c.link && !c.relationship)?.field ?? 'Name';
  const plural = describe.data?.labelPlural ?? `${object}s`;
  const fields = new Map((describe.data?.fields ?? []).map((f) => [f.name, f]));

  const where: QueryCondition[] = [
    ...(object === 'Lead' ? [{ field: 'IsConverted', op: 'eq' as const, value: false }] : []),
    ...(view === 'mine' && current ? [{ field: 'OwnerId', op: 'eq' as const, value: current.Id }] : []),
    ...filters.map((f) => ({ field: f.field, op: 'eq' as const, value: f.value })),
    ...(search ? [{ field: searchField, op: 'contains' as const, value: search }] : []),
  ];

  const list = useInfiniteQuery({
    queryKey: ['list', object, where, sort],
    queryFn: ({ pageParam }) =>
      api.query({ object, where, orderBy: [{ field: sort.field, direction: sort.direction }], limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.done ? undefined : pages.length * PAGE_SIZE),
  });

  const records = list.data?.pages.flatMap((p) => p.records) ?? [];
  const total = list.data?.pages[0]?.totalSize;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const update = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value !== null) next.set(key, value);
    }
    setParams(next);
  };

  // Search as the user types, like Lightning's "Search this list", once typing pauses.
  useEffect(() => {
    const text = searchDraft.trim();
    if (text === search) return;
    const timer = setTimeout(
      () =>
        setParams((prev) => {
          const next = new URLSearchParams(prev);
          if (text) next.set('q', text);
          else next.delete('q');
          return next;
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchDraft, search, setParams]);

  /** Keeps a cell's draft only while it differs from the saved value, as Lightning does. */
  const editCell = (record: SRecord, name: string, value: FormValue) => {
    const field = fields.get(name);
    if (!field) return;
    setDrafts((current) => {
      const row = { ...current[record.Id], [name]: value };
      if (toApiValue(field, value) === toApiValue(field, initialValue(field, record))) delete row[name];
      const next = { ...current, [record.Id]: row };
      if (Object.keys(row).length === 0) delete next[record.Id];
      return next;
    });
  };
  const editCount = Object.keys(drafts).length;
  const cancelEdits = () => {
    setDrafts({});
    setSaveErrors({});
  };

  // Each edited row is saved with its own PATCH; rows that fail keep their edits and show the API's messages.
  const saveEdits = useMutation({
    mutationFn: async () => {
      const failed: Record<string, string[]> = {};
      let saved = 0;
      for (const [id, row] of Object.entries(drafts)) {
        const record = records.find((r) => r.Id === id);
        if (!record) continue;
        try {
          await api.update(object, id, changedFields([...fields.values()], record, row));
          saved++;
        } catch (error) {
          failed[id] = error instanceof ApiError ? error.errors.map((e) => e.message) : [String(error)];
        }
      }
      return { failed, saved };
    },
    onSuccess: async ({ failed, saved }) => {
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id in failed)));
      setSaveErrors(failed);
      await refreshRecords(queryClient);
      if (saved > 0) toast(`${saved} ${saved === 1 ? describe.data?.label ?? 'record' : plural} saved.`);
    },
  });

  const listKey = JSON.stringify([object, where, sort]);
  useEffect(() => setSelected(new Set()), [listKey]);

  const viewLabel = `${view === 'mine' ? 'My' : 'All'} ${plural}`;
  const sortLabel = describe.data ? (fields.get(sort.field)?.label ?? sort.field) : '';
  const filterLabels = [...new Set(filters.map((f) => fields.get(f.field)?.label ?? f.field))];
  const picklistFields = (describe.data?.fields ?? []).filter((f) => f.type === 'picklist');

  const toolbarStubs = [
    { icon: 'settings', label: 'List View Controls' },
    { icon: 'table', label: 'Display as Table' },
    { icon: 'edit', label: 'Edit List' },
    { icon: 'chart', label: 'Show charts' },
  ];

  return (
    <div className="list-page">
      <div className="list-view">
        <div className="list-header">
          <div className="list-header__row">
            <div className="slds-media slds-media_center">
              <div className="slds-media__figure">
                <Icon name={layout.icon} size="medium" />
              </div>
              <div className="slds-media__body">
                <p className="list-header__breadcrumb">{plural}</p>
                <div className="list-header__title-row">
                  <h1 className="list-header__title slds-truncate" data-testid="list-view-name">
                    {viewLabel}
                  </h1>
                  <Menu
                    testId="list-view-menu"
                    onOpenChange={(open) => !open && setViewSearch('')}
                    header={
                      <div className="cosmos-menu__search">
                        <input
                          type="search"
                          className="slds-input"
                          placeholder="Search lists..."
                          aria-label="Search lists"
                          data-testid="list-view-search"
                          value={viewSearch}
                          onChange={(e) => setViewSearch(e.target.value)}
                        />
                      </div>
                    }
                    sections={[
                      {
                        header: 'List Views',
                        empty: 'No results',
                        items: [
                          ...(['all', 'mine'] as const).map((v) => ({
                            id: v,
                            label: `${v === 'mine' ? 'My' : 'All'} ${plural}`,
                            checked: view === v,
                            onSelect: () => update({ view: v === 'all' ? null : v }),
                          })),
                          ...STUB_VIEWS.map((name) => ({ id: name, label: name === 'All Open' ? `All Open ${plural}` : name, stub: true })),
                        ].filter((item) => item.label.toLowerCase().includes(viewSearch.trim().toLowerCase())),
                      },
                    ]}
                    trigger={(props) => (
                      <button
                        {...props}
                        type="button"
                        className="slds-button slds-button_icon slds-button_icon-small list-header__picker"
                        title="Select a List View"
                        data-testid="list-view-picker"
                      >
                        <ButtonIcon name="down" />
                        <span className="slds-assistive-text">Select a List View</span>
                      </button>
                    )}
                  />
                  <button
                    type="button"
                    className="slds-button slds-button_icon slds-button_icon-border list-header__pin"
                    disabled
                    title={scopeTitle('Pinning a list view')}
                  >
                    <ButtonIcon name="pin" />
                    <span className="slds-assistive-text">{scopeTitle('Pinning a list view')}</span>
                  </button>
                </div>
              </div>
            </div>
            <ul className="slds-button-group-list">
              <li>
                <button type="button" className="slds-button slds-button_neutral" onClick={() => setCreating(true)} data-testid="new-record">
                  New
                </button>
              </li>
            </ul>
          </div>
          <div className="list-header__row list-header__row_meta">
            <p className="list-header__meta" data-testid="list-meta">
              {total === undefined ? 'Loading…' : `${formatNumber(total)} item${total === 1 ? '' : 's'}`}
              {sortLabel && ` • Sorted by ${sortLabel}`}
              {filterLabels.length > 0 && ` • Filtered by ${filterLabels.join(', ')}`}
              {search && ` • Search: "${search}"`}
              {selected.size > 0 && ` • ${selected.size} selected`}
            </p>
            <div className="list-toolbar">
              <div className="slds-form-element list-toolbar__search">
                <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                  <span className="slds-icon_container slds-input__icon slds-input__icon_left">
                    <Icon name="search" category="utility" size="x-small" />
                  </span>
                  <input
                    type="search"
                    className="slds-input"
                    placeholder="Search this list..."
                    aria-label="Search this list"
                    data-testid="list-search"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                  />
                </div>
              </div>
              {toolbarStubs.map((tool) => (
                <button
                  key={tool.icon}
                  type="button"
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  disabled
                  title={scopeTitle(tool.label)}
                >
                  <ButtonIcon name={tool.icon} />
                  <span className="slds-assistive-text">
                    {scopeTitle(tool.label)}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="slds-button slds-button_icon slds-button_icon-border-filled"
                title="Refresh"
                data-testid="list-refresh"
                onClick={() => void list.refetch()}
              >
                <ButtonIcon name="refresh" />
                <span className="slds-assistive-text">Refresh</span>
              </button>
              <button
                type="button"
                className={`slds-button slds-button_icon slds-button_icon-border-filled ${showFilters ? 'slds-is-selected' : ''}`}
                title="Show filters"
                data-testid="toggle-filters"
                onClick={() => setShowFilters(!showFilters)}
              >
                <ButtonIcon name="filterList" />
                <span className="slds-assistive-text">Show filters</span>
              </button>
            </div>
          </div>
        </div>

      <PageError error={list.error} />

      <div className="slds-grid list-body">
        <div className="slds-col slds-scrollable_y list-scroll" data-testid="list-scroll">
          <DataTable
            object={object}
            columns={layout.columns}
            fields={fields}
            records={records}
            numbered
            selection={{ selected, onChange: setSelected }}
            rowActions={(record) => [
              { id: 'edit', label: 'Edit', testId: 'row-edit', onSelect: () => setEditing(record) },
              { id: 'delete', label: 'Delete', testId: 'row-delete', onSelect: () => setDeleting(record) },
              ...('OwnerId' in record ? [{ id: 'owner', label: 'Change Owner', testId: 'row-change-owner', onSelect: () => setChangingOwner(record) }] : []),
              { id: 'labels', label: 'Edit Labels', stub: true },
            ]}
            wrap={{
              wrapped,
              onChange: (field, on) => {
                const next = new Set(wrapped);
                if (on) next.add(field);
                else next.delete(field);
                setWrapped(next);
              },
            }}
            inlineEdit={{ drafts, errors: saveErrors, onChange: editCell }}
            sort={sort}
            onSort={(field) =>
              update({ sort: field, dir: sort.field === field && sort.direction === 'asc' ? 'desc' : null })
            }
            onEndReached={loadMore}
          />
          {isFetchingNextPage && <Spinner size="small" />}
          {list.isFetching && !isFetchingNextPage && <Spinner overlay />}
        </div>
        {editCount > 0 && (
          <div className="inline-edit-footer" role="region" aria-label="Unsaved changes" data-testid="inline-edit-footer">
            {Object.keys(saveErrors).length > 0 && (
              <div className="inline-edit-errors" role="alert" data-testid="inline-edit-errors">
                <h2>We hit a snag.</h2>
                <ul>
                  {Object.entries(saveErrors).map(([id, messages]) => (
                    <li key={id}>
                      <strong>{recordTitle(records.find((r) => r.Id === id) ?? { Id: id })}:</strong> {messages.join(' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="slds-button slds-button_neutral" data-testid="inline-cancel" onClick={cancelEdits}>
              Cancel
            </button>
            <button type="button" className="slds-button slds-button_brand" data-testid="inline-save" disabled={saveEdits.isPending} onClick={() => saveEdits.mutate()}>
              Save
            </button>
          </div>
        )}
        {showFilters && (
          <FilterPanel
            fields={picklistFields}
            applied={filters}
            onClose={() => setShowFilters(false)}
            onApply={(next) => {
              update({ filter: next.map((f) => `${f.field}:${f.value}`) });
              setShowFilters(false);
            }}
          />
        )}
      </div>
      </div>

      {creating && (
        <RecordForm object={object} onClose={() => setCreating(false)} onSaved={(id) => navigate(recordUrl(object, id))} />
      )}
      {editing && <RecordForm object={object} record={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
      {deleting && <DeleteRecordModal record={deleting} onClose={() => setDeleting(null)} onDeleted={() => setDeleting(null)} />}
      {changingOwner && <ChangeOwnerModal record={changingOwner} onClose={() => setChangingOwner(null)} />}
    </div>
  );
}
