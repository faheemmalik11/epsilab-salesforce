import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useDescribe, useRecordQuery } from '../api/hooks';
import { useActingUser } from '../context/ActingUser';
import { LAYOUTS, TAB_ORDER, recordTitle, type TabObject } from '../lib/layouts';
import { iconHref } from '../icons';
import { recordUrl } from './FieldOutput';
import { ButtonIcon, Icon } from './Icon';
import { EnvironmentControls } from './EnvironmentControls';
import { Menu, type MenuSection } from './Menu';
import { OUTLINE_ICONS } from './SidebarIcons';
import { RecordForm } from './RecordForm';
import { scopeTitle } from './Stub';

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
    <NavLink to={to} className={({ isActive }) => `slds-context-bar__item ${stub ? 'nav-stub' : ''} ${isActive ? 'slds-is-active' : ''}`}>
      <span className="slds-context-bar__label-action" title={stub ? scopeTitle(label) : label}>
        <span className="slds-truncate">{label}</span>
      </span>
    </NavLink>
  );
}

/** An object tab: the label opens its list, and the chevron opens New, recent records and list views. */
function ObjectNavItem({ object, onNew }: { object: TabObject; onNew(object: TabObject): void }) {
  const layout = LAYOUTS[object];
  const navigate = useNavigate();
  const location = useLocation();
  const describe = useDescribe(object);
  const [open, setOpen] = useState(false);
  const recent = useRecordQuery(
    { object, orderBy: [{ field: 'LastModifiedDate', direction: 'desc' }, { field: 'Id', direction: 'desc' }], limit: 3 },
    open,
  );
  const label = describe.data?.label ?? object;
  const plural = describe.data?.labelPlural ?? layout.tabLabel;
  const listUrl = `/lightning/o/${object}/list`;
  const active = location.pathname.startsWith(`/lightning/o/${object}/`) || location.pathname.startsWith(`/lightning/r/${object}/`);

  const sections: MenuSection[] = [
    { items: [{ id: 'new', icon: 'add', label: `New ${label}`, testId: `nav-new-${object}`, onSelect: () => onNew(object) }] },
    {
      header: 'Recent records',
      empty: recent.isFetching ? 'Loading…' : 'No recent records',
      items: (recent.data?.records ?? []).map((record) => ({
        id: record.Id,
        label: recordTitle(record),
        testId: 'nav-recent-record',
        onSelect: () => navigate(recordUrl(object, record.Id)),
      })),
    },
    {
      header: 'Recent lists',
      items: [
        { id: 'all', label: `All ${plural}`, testId: `nav-list-all-${object}`, onSelect: () => navigate(`${listUrl}?view=all`) },
        { id: 'mine', label: `My ${plural}`, testId: `nav-list-mine-${object}`, onSelect: () => navigate(`${listUrl}?view=mine`) },
      ],
    },
    {
      items: [
        {
          id: 'tab',
          icon: 'new_window',
          label: `Open "${plural}" in New Tab`,
          onSelect: () => window.open(listUrl, '_blank', 'noopener'),
        },
      ],
    },
  ];

  return (
    <div className={`slds-context-bar__item nav-object ${active ? 'slds-is-active' : ''}`} data-testid={`nav-${object}`}>
      <NavLink to={listUrl} className="slds-context-bar__label-action nav-object__link" title={layout.tabLabel}>
        <span className="slds-truncate">{layout.tabLabel}</span>
      </NavLink>
      <Menu
        align="center"
        testId={`nav-menu-${object}`}
        onOpenChange={setOpen}
        sections={sections}
        trigger={(props) => (
          <button
            {...props}
            type="button"
            className="slds-button slds-button_icon nav-object__menu"
            title={`${layout.tabLabel} List`}
            data-testid={`nav-chevron-${object}`}
          >
            <svg className="nav-chevron" aria-hidden="true">
              <use href={iconHref('utility', 'chevrondown')} />
            </svg>
            <span className="slds-assistive-text">{layout.tabLabel} List</span>
          </button>
        )}
      />
    </div>
  );
}

interface SidebarApp {
  label: string;
  icon: string;
  /** Where a supported app goes; out-of-scope apps have none. */
  to?: string;
}

/** The Lightning app rail, in the order a Sales org shows it. */
const SIDEBAR_APPS: SidebarApp[] = [
  { label: 'Home', icon: 'home', to: '/lightning/page/home' },
  { label: 'Contacts', icon: 'groups', to: '/lightning/o/Contact/list' },
  { label: 'Accounts', icon: 'company', to: '/lightning/o/Account/list' },
  { label: 'Sales', icon: 'sales', to: '/lightning/o/Lead/list' },
  { label: 'Service', icon: 'service' },
  { label: 'Marketing', icon: 'marketing' },
  { label: 'Commerce', icon: 'commerce' },
  { label: 'Your Account', icon: 'account' },
  { label: 'Automation', icon: 'flow' },
];

/** The rail item for the current page: Home, Contacts and Accounts have their own; everything else is Sales. */
function activeApp(pathname: string): string {
  if (pathname.startsWith('/lightning/page/home')) return 'Home';
  if (/^\/lightning\/[or]\/Contact\//.test(pathname)) return 'Contacts';
  if (/^\/lightning\/[or]\/Account\//.test(pathname)) return 'Accounts';
  return 'Sales';
}

function Sidebar() {
  const location = useLocation();
  const active = activeApp(location.pathname);
  return (
    <nav className="app-sidebar" aria-label="Apps" data-testid="app-sidebar">
      <ul>
        {SIDEBAR_APPS.map((app) => {
          const content = (
            <>
              <span className="app-sidebar__icon">
                {OUTLINE_ICONS[app.icon] ?? (
                  <svg aria-hidden="true">
                    <use href={iconHref('utility', app.icon)} />
                  </svg>
                )}
              </span>
              <span className="app-sidebar__label">{app.label}</span>
            </>
          );
          return (
            <li key={app.label}>
              {app.to ? (
                <Link
                  to={app.to}
                  className={`app-sidebar__item ${active === app.label ? 'app-sidebar__item_active' : ''}`}
                  aria-current={active === app.label ? 'page' : undefined}
                  aria-label={`${app.label} app`}
                  data-testid={`sidebar-${app.label}`}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className="app-sidebar__item app-sidebar__item_disabled"
                  role="link"
                  aria-disabled="true"
                  title={scopeTitle(app.label)}
                  aria-label={`${app.label} app: not in scope`}
                  data-testid={`sidebar-${app.label.replace(' ', '')}`}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [creating, setCreating] = useState<TabObject | null>(null);
  const navigate = useNavigate();
  return (
    <div className="app-frame">
      <Sidebar />
    <div className="app-shell">
      <header className="slds-global-header_container">
        <div className="slds-global-header slds-grid slds-grid_align-spread">
          <div className="slds-global-header__item">
            {/* SLDS's own cloud glyph (licensed with the SLDS icons), not Salesforce's logo file. */}
            <Link to="/lightning/page/home" className="slds-global-header__logo app-logo" aria-label="Home" data-testid="app-logo">
              <svg aria-hidden="true">
                <use href={iconHref('utility', 'salesforce1')} />
              </svg>
            </Link>
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
                  placeholder="Search..."
                  title={scopeTitle('Global search')}
                  aria-label={scopeTitle('Global search')}
                  data-testid="global-search-stub"
                />
              </div>
            </div>
          </div>
          <div className="slds-global-header__item header-actions">
            <EnvironmentControls />
            <UserSwitcher />
          </div>
        </div>
      </header>
      <div className="slds-context-bar">
        <div className="slds-context-bar__primary">
          <div className="slds-context-bar__item slds-context-bar__dropdown-trigger slds-no-hover">
            <span className="slds-context-bar__icon-action" title={scopeTitle('The App Launcher')}>
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
                <ObjectNavItem object={object} onNew={setCreating} />
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
      {creating && (
        <RecordForm
          key={creating}
          object={creating}
          onClose={() => setCreating(null)}
          onSaved={(id) => {
            setCreating(null);
            navigate(recordUrl(creating, id));
          }}
        />
      )}
    </div>
    </div>
  );
}
