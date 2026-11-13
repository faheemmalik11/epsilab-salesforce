import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { FieldDescribe, ObjectName, SRecord } from '../api/types';
import type { Column } from '../lib/layouts';
import { FieldOutput, recordUrl } from './FieldOutput';
import { iconHref } from '../icons';

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
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
  /** Adds the row action menu with Edit. */
  onEdit?(record: SRecord): void;
}

export function columnLabel(column: Column, fields: Map<string, FieldDescribe>): string {
  return column.label ?? fields.get(column.field)?.label ?? column.field;
}

function RowActions({ record, onEdit }: { record: SRecord; onEdit(record: SRecord): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className={`slds-dropdown-trigger slds-dropdown-trigger_click ${open ? 'slds-is-open' : ''}`}>
      <button
        type="button"
        className="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small row-action"
        aria-haspopup="true"
        aria-expanded={open}
        title="Show actions"
        data-testid="row-actions"
        onClick={() => setOpen(!open)}
      >
        <svg className="slds-button__icon slds-button__icon_hint slds-button__icon_small" aria-hidden="true">
          <use href={iconHref('utility', 'down')} />
        </svg>
        <span className="slds-assistive-text">Show actions</span>
      </button>
      {open && (
        <div className="slds-dropdown slds-dropdown_right slds-dropdown_actions">
          <ul className="slds-dropdown__list" role="menu">
            <li className="slds-dropdown__item" role="presentation">
              <a
                href="#"
                role="menuitem"
                data-testid="row-edit"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  onEdit(record);
                }}
              >
                <span className="slds-truncate">Edit</span>
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
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

/** SLDS data table with sortable headers and an optional infinite-scroll sentinel. */
export function DataTable({ object, columns, fields, records, sort, onSort, onEndReached, numbered, selection, onEdit }: DataTableProps) {
  const sentinel = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (!onEndReached || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onEndReached(), { rootMargin: '200px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [onEndReached, records.length]);

  return (
    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout" role="grid" data-testid="data-table">
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
                    <svg className="th-chevron" aria-hidden="true">
                      <use href={iconHref('utility', 'chevrondown')} />
                    </svg>
                  </a>
                ) : (
                  <div className="slds-truncate slds-p-horizontal_x-small" title={label}>
                    {label}
                  </div>
                )}
              </th>
            );
          })}
          {onEdit && <th scope="col" className="cell-actions" aria-label="Actions" />}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr key={record.Id} className="slds-hint-parent" data-testid="data-row">
            {numbered && <td className="slds-text-color_weak cell-number">{index + 1}</td>}
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
              return (
                <td key={column.field} data-field={column.field}>
                  <div className="slds-truncate">{field && <Cell object={object} column={column} field={field} record={record} />}</div>
                </td>
              );
            })}
            {onEdit && (
              <td className="cell-actions">
                <RowActions record={record} onEdit={onEdit} />
              </td>
            )}
          </tr>
        ))}
        {onEndReached && (
          <tr ref={sentinel} aria-hidden="true">
            <td colSpan={columns.length + (numbered ? 1 : 0) + (selection ? 1 : 0) + (onEdit ? 1 : 0)} style={{ border: 0, padding: 0 }} />
          </tr>
        )}
      </tbody>
    </table>
  );
}
