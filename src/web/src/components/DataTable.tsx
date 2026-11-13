import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { FieldDescribe, ObjectName, SRecord } from '../api/types';
import { iconHref } from '../icons';
import { toApiValue } from '../lib/formValues';
import type { Column } from '../lib/layouts';
import { FieldInput, type FormValue } from './FieldInput';
import { FieldOutput, recordUrl } from './FieldOutput';
import { Menu, type MenuItem } from './Menu';

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

/** Unsaved inline edits, keyed by record Id and then field name. */
export type Drafts = Record<string, Record<string, FormValue>>;

export interface InlineEdit {
  drafts: Drafts;
  /** API error messages for rows whose save failed. */
  errors: Record<string, string[]>;
  onChange(record: SRecord, field: string, value: FormValue): void;
}

interface DataTableProps {
  object: ObjectName;
  columns: Column[];
  fields: Map<string, FieldDescribe>;
  records: SRecord[];
  sort?: Sort;
  onSort?(field: string): void;
  onEndReached?(): void;
  /** Row numbers continue across pages, as in a Lightning list view. */
  numbered?: boolean;
  selection?: { selected: Set<string>; onChange(selected: Set<string>): void };
  rowActions?(record: SRecord): MenuItem[];
  /** Columns shown with wrapped text instead of clipped; the header menu switches it. */
  wrap?: { wrapped: Set<string>; onChange(field: string, wrap: boolean): void };
  inlineEdit?: InlineEdit;
}

export function columnLabel(column: Column, fields: Map<string, FieldDescribe>): string {
  return column.label ?? fields.get(column.field)?.label ?? column.field;
}

/** Fields a list cell can edit in place; names that are compound or derived, lookups and owners use the form. */
function canInlineEdit(column: Column, field: FieldDescribe | undefined): field is FieldDescribe {
  return !!field && field.updateable && !column.relationship && field.type !== 'reference' && field.type !== 'textarea';
}

function Cell({ object, column, field, record }: { object: ObjectName; column: Column; field: FieldDescribe; record: SRecord }) {
  if (column.link) {
    const related = column.relationship ? (record[column.relationship] as { Id: string; Name: string; attributes: { type: string } } | null) : null;
    if (related) return <Link to={recordUrl(related.attributes.type, related.Id)}>{related.Name}</Link>;
    return (
      <Link to={recordUrl(object, record.Id)} data-testid="record-link">
        {String(record[column.field] ?? '(no name)')}
      </Link>
    );
  }
  return <FieldOutput field={field} record={record} />;
}

function Checkbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <div className="slds-checkbox">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label className="slds-checkbox__label" htmlFor={id}>
        <span className="slds-checkbox_faux" />
        <span className="slds-form-element__label slds-assistive-text">{label}</span>
      </label>
    </div>
  );
}

/** The cell editor popover: Enter or a click outside keeps the value, Escape restores it. */
function CellEditor({ field, value, onChange, onDone }: { field: FieldDescribe; value: FormValue; onChange(value: FormValue): void; onDone(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const original = useRef(value);
  useEffect(() => {
    const close = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && onDone();
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onDone]);
  return (
    <div
      ref={ref}
      className="cell-editor"
      data-testid={`cell-editor-${field.name}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onChange(original.current);
          onDone();
        } else if (event.key === 'Enter' && field.type !== 'textarea') {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <FieldInput field={field} value={value} required={field.required} inputId={`inline-${field.name}`} hideLabel autoFocus onChange={onChange} />
    </div>
  );
}

function HeaderMenu({ column, label, wrap }: { column: Column; label: string; wrap: NonNullable<DataTableProps['wrap']> }) {
  const wrapped = wrap.wrapped.has(column.field);
  return (
    <Menu
      align="right"
      testId={`column-menu-${column.field}`}
      sections={[
        {
          items: [
            { id: 'wrap', label: 'Wrap text', checked: wrapped, testId: `wrap-${column.field}`, onSelect: () => wrap.onChange(column.field, true) },
            { id: 'clip', label: 'Clip text', checked: !wrapped, testId: `clip-${column.field}`, onSelect: () => wrap.onChange(column.field, false) },
          ],
        },
      ]}
      trigger={(props) => (
        <button {...props} type="button" className="slds-button slds-button_icon th-menu" title={`Show ${label} column actions`} data-testid={`column-actions-${column.field}`}>
          <svg className="th-chevron" aria-hidden="true">
            <use href={iconHref('utility', 'chevrondown')} />
          </svg>
          <span className="slds-assistive-text">Show {label} column actions</span>
        </button>
      )}
    />
  );
}

/** Lightning list view table: sortable headers, column menus, inline edit, row actions and infinite scroll. */
export function DataTable({ object, columns, fields, records, sort, onSort, onEndReached, numbered, selection, rowActions, wrap, inlineEdit }: DataTableProps) {
  const sentinel = useRef<HTMLTableRowElement>(null);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);

  useEffect(() => {
    if (!onEndReached || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onEndReached(), { rootMargin: '200px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [onEndReached, records.length]);

  const extraColumns = (numbered ? 1 : 0) + (selection ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout cosmos-table" role="grid" data-testid="data-table">
      <thead>
        <tr className="slds-line-height_reset">
          {numbered && <th scope="col" className="cell-number" aria-label="Row number" />}
          {selection && (
            <th scope="col" className="cell-select">
              <Checkbox
                id={`select-all-${object}`}
                label="Select all"
                checked={records.length > 0 && records.every((r) => selection.selected.has(r.Id))}
                onChange={(checked) => selection.onChange(new Set(checked ? records.map((r) => r.Id) : []))}
              />
            </th>
          )}
          {columns.map((column) => {
            const sortable = !!onSort && !column.relationship;
            const sorted = sort?.field === column.field;
            const label = columnLabel(column, fields);
            return (
              <th
                key={column.field}
                scope="col"
                aria-sort={sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                className={`${sortable ? 'slds-is-sortable' : ''} ${sorted ? `slds-is-sorted slds-is-sorted_${sort.direction}` : ''}`}
              >
                <div className="th-content">
                  {sortable ? (
                    <a
                      href="#"
                      role="button"
                      className="slds-th__action slds-text-link_reset"
                      data-testid={`sort-${column.field}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onSort(column.field);
                      }}
                    >
                      <span className="slds-truncate" title={label}>
                        {label}
                      </span>
                      <span className="slds-icon_container slds-icon-utility-arrowdown">
                        <svg className="slds-icon slds-icon-text-default slds-is-sortable__icon" aria-hidden="true">
                          <use href={iconHref('utility', sorted && sort.direction === 'desc' ? 'arrowdown' : 'arrowup')} />
                        </svg>
                      </span>
                    </a>
                  ) : (
                    <div className="slds-th__action slds-truncate" title={label}>
                      {label}
                    </div>
                  )}
                  {wrap && <HeaderMenu column={column} label={label} wrap={wrap} />}
                </div>
              </th>
            );
          })}
          {rowActions && <th scope="col" className="cell-actions" aria-label="Actions" />}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => {
          const draft = inlineEdit?.drafts[record.Id];
          const rowErrors = inlineEdit?.errors[record.Id];
          return (
            <tr key={record.Id} className={`slds-hint-parent ${rowErrors ? 'row-has-error' : ''}`} data-testid="data-row">
              {numbered && (
                <td className="slds-text-color_weak cell-number">
                  {rowErrors ? (
                    <span className="row-error-icon" title={rowErrors.join('\n')} data-testid="row-error">
                      <svg className="slds-icon slds-icon_x-small" aria-hidden="true">
                        <use href={iconHref('utility', 'error')} />
                      </svg>
                      <span className="slds-assistive-text">{rowErrors.join(' ')}</span>
                    </span>
                  ) : (
                    index + 1
                  )}
                </td>
              )}
              {selection && (
                <td className="cell-select">
                  <Checkbox
                    id={`select-${record.Id}`}
                    label={`Select item ${index + 1}`}
                    checked={selection.selected.has(record.Id)}
                    onChange={(checked) => {
                      const next = new Set(selection.selected);
                      if (checked) next.add(record.Id);
                      else next.delete(record.Id);
                      selection.onChange(next);
                    }}
                  />
                </td>
              )}
              {columns.map((column) => {
                const field = fields.get(column.field);
                const editable = inlineEdit && canInlineEdit(column, field);
                const edited = !!draft && column.field in draft;
                const shown = edited && field ? { ...record, [column.field]: toApiValue(field, draft[column.field] ?? null) } : record;
                const open = editing?.id === record.Id && editing.field === column.field;
                return (
                  <td
                    key={column.field}
                    data-field={column.field}
                    className={`${editable ? 'cell-editable' : ''} ${edited ? 'cell-edited' : ''} ${wrap?.wrapped.has(column.field) ? 'cell-wrap' : ''}`}
                  >
                    <div className="cell-content">
                      <div className="slds-truncate">{field && <Cell object={object} column={column} field={field} record={shown} />}</div>
                      {editable && (
                        <button
                          type="button"
                          className="slds-button slds-button_icon cell-edit"
                          title={`Edit ${field.label}`}
                          aria-label={`Edit ${field.label}: Item ${index + 1}`}
                          data-testid={`edit-cell-${column.field}`}
                          onClick={() => setEditing({ id: record.Id, field: column.field })}
                        >
                          <svg className="slds-button__icon slds-button__icon_hint" aria-hidden="true">
                            <use href={iconHref('utility', 'edit')} />
                          </svg>
                        </button>
                      )}
                    </div>
                    {open && editable && (
                      <CellEditor
                        field={field}
                        value={edited ? (draft[column.field] ?? null) : (shown[column.field] === null || shown[column.field] === undefined ? null : String(shown[column.field]))}
                        onChange={(value) => inlineEdit.onChange(record, column.field, value)}
                        onDone={() => setEditing(null)}
                      />
                    )}
                  </td>
                );
              })}
              {rowActions && (
                <td className="cell-actions">
                  <Menu
                    align="right"
                    testId="row-action-menu"
                    sections={[{ items: rowActions(record) }]}
                    trigger={(props) => (
                      <button {...props} type="button" className="slds-button slds-button_icon row-action" title="Show actions" data-testid="row-actions">
                        <svg className="slds-button__icon" aria-hidden="true">
                          <use href={iconHref('utility', 'down')} />
                        </svg>
                        <span className="slds-assistive-text">Show actions</span>
                      </button>
                    )}
                  />
                </td>
              )}
            </tr>
          );
        })}
        {onEndReached && (
          <tr ref={sentinel} aria-hidden="true">
            <td colSpan={columns.length + extraColumns} style={{ border: 0, padding: 0 }} />
          </tr>
        )}
      </tbody>
    </table>
  );
}
