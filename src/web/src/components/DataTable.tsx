import { useEffect, useRef } from 'react';
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
}

export function columnLabel(column: Column, fields: Map<string, FieldDescribe>): string {
  return column.label ?? fields.get(column.field)?.label ?? column.field;
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
export function DataTable({ object, columns, fields, records, sort, onSort, onEndReached, numbered }: DataTableProps) {
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
          {numbered && <th scope="col" style={{ width: '3.25rem' }} aria-label="Row number" />}
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
                  </a>
                ) : (
                  <div className="slds-truncate slds-p-horizontal_x-small" title={label}>
                    {label}
                  </div>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr key={record.Id} className="slds-hint-parent" data-testid="data-row">
            {numbered && <td className="slds-text-color_weak">{index + 1}</td>}
            {columns.map((column) => {
              const field = fields.get(column.field);
              return (
                <td key={column.field}>
                  <div className="slds-truncate">{field && <Cell object={object} column={column} field={field} record={record} />}</div>
                </td>
              );
            })}
          </tr>
        ))}
        {onEndReached && (
          <tr ref={sentinel} aria-hidden="true">
            <td colSpan={columns.length + (numbered ? 1 : 0)} style={{ border: 0, padding: 0 }} />
          </tr>
        )}
      </tbody>
    </table>
  );
}
