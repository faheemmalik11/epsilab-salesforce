import { iconHref, type IconCategory } from '../icons';

interface IconProps {
  name: string;
  category?: IconCategory;
  size?: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large';
  className?: string;
  title?: string;
}

/** An SLDS standard icon in its colored container (objects), or a plain utility glyph. */
export function Icon({ name, category = 'standard', size = 'small', className = '', title }: IconProps) {
  const svg = (
    <svg className={`slds-icon slds-icon_${size} ${category === 'utility' ? 'slds-icon-text-default' : ''} ${className}`} aria-hidden="true">
      <use href={iconHref(category, name)} />
    </svg>
  );
  if (category === 'utility') return svg;
  return (
    <span className={`slds-icon_container slds-icon-standard-${name.replace(/_/g, '-')}`} title={title}>
      {svg}
      {title && <span className="slds-assistive-text">{title}</span>}
    </span>
  );
}

export function ButtonIcon({ name, position }: { name: string; position?: 'left' | 'right' }) {
  return (
    <svg className={`slds-button__icon${position ? ` slds-button__icon_${position}` : ''}`} aria-hidden="true">
      <use href={iconHref('utility', name)} />
    </svg>
  );
}
