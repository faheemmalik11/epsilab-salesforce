import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useActingUser } from '../context/ActingUser';
import { LAYOUTS, TAB_ORDER } from '../lib/layouts';
import { ButtonIcon, Icon } from './Icon';
import { STUB_TEXT, StubBadge } from './Stub';

/** Sales app tabs that exist in Salesforce but are out of scope here; each opens a stub page. */
export const STUB_TABS = [
  { slug: 'reports', label: 'Reports' },
  { slug: 'dashboards', label: 'Dashboards' },
  { slug: 'forecasts', label: 'Forecasts' },
  { slug: 'campaigns', label: 'Campaigns' },
  { slug: 'cases', label: 'Cases' },
];

function UserSwitcher() {
  const { users, current, switchTo } = useActingUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className={`slds-dropdown-trigger slds-dropdown-trigger_click ${open ? 'slds-is-open' : ''}`}>
      <button
        type="button"
        className="slds-button slds-button_neutral"
        aria-haspopup="true"
        aria-expanded={open}
        data-testid="acting-user"
        title="Switch the seeded user you act as"
        onClick={() => setOpen(!open)}
      >
        <ButtonIcon name="user" position="left" />
        Acting as: {current?.Name}
        <ButtonIcon name="down" position="right" />
      </button>
      {open && (
        <div className="slds-dropdown slds-dropdown_right slds-dropdown_medium">
          <ul className="slds-dropdown__list" role="menu">
            {users.map((user) => (
              <li key={user.Id} className={`slds-dropdown__item ${user.Id === current?.Id ? 'slds-is-selected' : ''}`} role="presentation">
                <a
                  role="menuitemcheckbox"
                  aria-checked={user.Id === current?.Id}
                  aria-disabled={!user.IsActive}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!user.IsActive) return;
                    switchTo(user.Id);
                    setOpen(false);
                  }}
                >
                  <span className="slds-truncate">
                    {user.Name}
                    {!user.IsActive && <span className="slds-text-color_weak"> (inactive)</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NavItem({ to, label, stub }: { to: string; label: string; stub?: boolean }) {
  return (
    <NavLink to={to} className={({ isActive }) => `slds-context-bar__item ${isActive ? 'slds-is-active' : ''}`}>
      <span className="slds-context-bar__label-action" title={stub ? `${label}: ${STUB_TEXT}` : label}>
        <span className="slds-truncate">{label}</span>
        {stub && <StubBadge />}
      </span>
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="slds-global-header_container">
        <div className="slds-global-header slds-grid slds-grid_align-spread">
          <div className="slds-global-header__item">
            <div className="slds-global-header__logo app-logo" aria-label="Sales">
              <Icon name="opportunity" size="small" />
            </div>
          </div>
          <div className="slds-global-header__item slds-global-header__item_search">
            <div className="slds-form-element">
              <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                <span className="slds-icon_container slds-input__icon slds-input__icon_left">
                  <Icon name="search" category="utility" size="x-small" />
                </span>
                <input
                  type="search"
                  className="slds-input"
                  disabled
                  placeholder={`Search: ${STUB_TEXT}`}
                  aria-label={`Global search: ${STUB_TEXT}`}
                  data-testid="global-search-stub"
                />
              </div>
            </div>
          </div>
          <div className="slds-global-header__item">
            <UserSwitcher />
          </div>
        </div>
      </header>
      <div className="slds-context-bar">
        <div className="slds-context-bar__primary">
          <div className="slds-context-bar__item slds-context-bar__dropdown-trigger slds-no-hover">
            <span className="slds-context-bar__icon-action" title={`App Launcher: ${STUB_TEXT}`}>
              <Icon name="apps" category="utility" size="x-small" />
            </span>
            <span className="slds-context-bar__label-action slds-context-bar__app-name">
              <span className="slds-truncate" title="Sales">
                Sales
              </span>
            </span>
          </div>
        </div>
        <nav className="slds-context-bar__secondary" role="navigation">
          <ul className="slds-grid">
            <li>
              <NavItem to="/lightning/page/home" label="Home" />
            </li>
            {TAB_ORDER.map((object) => (
              <li key={object}>
                <NavItem to={`/lightning/o/${object}/list`} label={LAYOUTS[object].tabLabel} />
              </li>
            ))}
            {STUB_TABS.map((tab) => (
              <li key={tab.slug}>
                <NavItem to={`/lightning/stub/${tab.slug}`} label={tab.label} stub />
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <main className="app-body">{children}</main>
    </div>
  );
}
