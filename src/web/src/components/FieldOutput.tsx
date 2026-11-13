import { Link } from 'react-router';
import type { FieldDescribe, RelatedRef } from '../api/types';
import { formatValue } from '../lib/format';
import { layoutFor } from '../lib/layouts';

export function recordUrl(object: string, id: string): string {
  return `/lightning/r/${object}/${id}/view`;
}

/** Displays a field value; references show the related record's name as a link when it has a page. */
export function FieldOutput({ field, record }: { field: FieldDescribe; record: Record<string, unknown> }) {
  if (field.type === 'reference') {
    const related = record[field.name.replace(/Id$/, '')] as RelatedRef | null | undefined;
    if (!related) return null;
    const type = related.attributes.type;
    return layoutFor(type) ? <Link to={recordUrl(type, related.Id)}>{related.Name}</Link> : <span>{related.Name}</span>;
  }
  if (field.type === 'boolean') {
    return (
      <span className="slds-checkbox">
        <input type="checkbox" checked={record[field.name] === true} readOnly disabled aria-label={field.label} />
        <span className="slds-checkbox_faux" />
      </span>
    );
  }
  // Lightning shows emails and phone numbers as links that open the mail or phone app.
  if ((field.type === 'email' || field.type === 'phone') && record[field.name]) {
    const value = String(record[field.name]);
    return <a href={field.type === 'email' ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, '')}`}>{value}</a>;
  }
  if (field.type === 'url' && record[field.name]) {
    return (
      <a href={String(record[field.name])} target="_blank" rel="noreferrer">
        {String(record[field.name])}
      </a>
    );
  }
  return <span style={{ whiteSpace: 'pre-line' }}>{formatValue(field.type, record[field.name])}</span>;
}
