import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { iconHref } from '../icons';
import { STUB_TEXT, StubBadge } from './Stub';

export interface MenuItem {
  id: string;
  label: ReactNode;
  /** Utility icon shown before the label, such as "add" for New. */
  icon?: string;
  onSelect?(): void;
  disabled?: boolean;
  /** Out-of-scope entry: shown disabled with the stub marker. */
  stub?: boolean;
  checked?: boolean;
  testId?: string;
}

export interface MenuSection {
  header?: string;
  items: MenuItem[];
  /** Shown when the section has no items. */
  empty?: string;
}

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick(): void;
  onKeyDown(event: KeyboardEvent): void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
}

interface MenuProps {
  trigger(props: MenuTriggerProps, open: boolean): ReactNode;
  sections: MenuSection[];
  align?: 'left' | 'right' | 'center';
  /** Content above the items, such as a search box; it gets the focus when the menu opens. */
  header?: ReactNode;
  className?: string;
  testId?: string;
  onOpenChange?(open: boolean): void;
}

/**
 * Lightning dropdown menu: opens from its trigger, focuses its items on hover and with the arrow keys,
 * and closes on Escape, Tab, a click outside or a choice.
 */
export function Menu({ trigger, sections, align = 'left', header, className = '', testId, onOpenChange }: MenuProps) {
  const [open, setOpenState] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    onOpenChangeRef.current?.(next);
  }, []);
  const hasHeader = header !== undefined;

  const items = () => [...(listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => rootRef.current && !rootRef.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    const frame = requestAnimationFrame(() => {
      if (hasHeader) listRef.current?.querySelector<HTMLElement>('input')?.focus();
      else items()[0]?.focus();
    });
    return () => {
      document.removeEventListener('mousedown', close);
      cancelAnimationFrame(frame);
    };
  }, [open, hasHeader, setOpen]);

  const closeAndReturn = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index < 0 ? list.length - 1 : index - 1);
    else if (event.key === 'Home' && index >= 0) move(0);
    else if (event.key === 'End' && index >= 0) move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndReturn();
    } else if (event.key === 'Tab') setOpen(false);
  };

  const choose = (item: MenuItem) => {
    if (item.disabled || item.stub) return;
    setOpen(false);
    item.onSelect?.();
  };

  return (
    <div ref={rootRef} className={`slds-dropdown-trigger slds-dropdown-trigger_click ${open ? 'slds-is-open' : ''} ${className}`}>
      {trigger(
        {
          ref: triggerRef,
          onClick: () => setOpen(!open),
          onKeyDown: (event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault();
              setOpen(true);
            }
          },
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': id,
        },
        open,
      )}
      {open && (
        <div
          ref={listRef}
          id={id}
          className={`slds-dropdown slds-dropdown_${align} cosmos-menu`}
          data-testid={testId}
          onKeyDown={onMenuKeyDown}
        >
          {header}
          {sections.map((section, sectionIndex) => (
            <ul
              key={section.header ?? sectionIndex}
              className={`slds-dropdown__list ${sectionIndex > 0 ? 'cosmos-menu__divided' : ''}`}
              role="menu"
              aria-label={section.header}
            >
              {section.header && (
                <li className="slds-dropdown__header" role="presentation">
                  <span>{section.header}</span>
                </li>
              )}
              {section.items.length === 0 && section.empty && (
                <li className="cosmos-menu__empty" role="presentation">
                  {section.empty}
                </li>
              )}
              {section.items.map((item) => {
                const unavailable = item.disabled || item.stub;
                return (
                  <li key={item.id} className="slds-dropdown__item" role="presentation">
                    <a
                      href="#"
                      role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                      aria-checked={item.checked}
                      aria-disabled={unavailable || undefined}
                      tabIndex={-1}
                      title={item.stub ? STUB_TEXT : undefined}
                      data-testid={item.testId}
                      onMouseEnter={(event) => !unavailable && event.currentTarget.focus()}
                      onClick={(event) => {
                        event.preventDefault();
                        choose(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          choose(item);
                        }
                      }}
                    >
                      <span className={`slds-truncate ${unavailable ? 'slds-text-color_weak' : ''}`}>
                        {item.checked !== undefined && (
                          <svg className={`cosmos-menu__check ${item.checked ? '' : 'cosmos-menu__check_hidden'}`} aria-hidden="true">
                            <use href={iconHref('utility', 'check')} />
                          </svg>
                        )}
                        {item.icon && (
                          <svg className="cosmos-menu__icon" aria-hidden="true">
                            <use href={iconHref('utility', item.icon)} />
                          </svg>
                        )}
                        {item.label}
                        {item.stub && <StubBadge />}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}
