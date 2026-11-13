import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { refreshRecords, useClock } from '../api/hooks';
import type { SRecord } from '../api/types';
import { formatValue } from '../lib/format';
import { recordTitle } from '../lib/layouts';
import { DEFAULT_ACTIVITY_FILTERS, describeFilters, filterActivities, groupTimeline, type ActivityFilters, type FilterableTask } from '../lib/timeline';
import { useActingUser } from '../context/ActingUser';
import { Menu } from './Menu';
import { Spinner } from './Spinner';
import { recordUrl } from './FieldOutput';
import { ButtonIcon, Icon } from './Icon';
import { PageError } from './PageError';
import { scopeTitle } from './Stub';
import { useToast } from './Toast';

export type Composer = 'call' | 'task';

interface ActivityPanelProps {
  record: SRecord;
  /** Tasks attach through WhoId for leads and contacts, WhatId for accounts and opportunities. */
  link: 'WhoId' | 'WhatId';
  readOnly?: boolean;
  /** The open docked composer; the record header's Log a Call and New Task actions open it too. */
  composer: Composer | null;
  onComposerChange(composer: Composer | null): void;
}

function useTasks(record: SRecord, link: 'WhoId' | 'WhatId') {
  return useQuery({
    queryKey: ['tasks', record.Id],
    queryFn: async () => {
      const result = await api.query({
        object: 'Task',
        where: [{ field: link, op: 'eq', value: record.Id }],
        orderBy: [{ field: 'ActivityDate', direction: 'desc' }],
        limit: 100,
      });
      return result.records;
    },
  });
}

function TimelineItem({ task, overdue }: { task: SRecord; overdue: boolean }) {
  const call = task.TaskSubtype === 'Call';
  return (
    <li className="activity-timeline__item" data-testid="timeline-item">
      <span className="activity-timeline__icon">
        <Icon name={call ? 'log_a_call' : 'task'} size="small" />
      </span>
      <div className="activity-timeline__body">
        <div className="activity-timeline__head">
          <Link className="slds-truncate" to={recordUrl('Task', task.Id)}>
            {String(task.Subject ?? '(no subject)')}
          </Link>
          <span className={`activity-timeline__date ${overdue ? 'activity-timeline__date_overdue' : ''}`}>
            {formatValue('date', task.ActivityDate)}
          </span>
        </div>
        <p className="activity-timeline__detail">
          {call ? 'You logged a call' : `${String(task.Status)} task`}
          {task.Description ? ` • ${String(task.Description)}` : ''}
        </p>
      </div>
    </li>
  );
}

function Timeline({ tasks, today, collapsed, onToggle }: { tasks: SRecord[]; today: string; collapsed: Set<string>; onToggle(key: string): void }) {
  const groups = groupTimeline(tasks, today);
  return (
    <div className="activity-timeline" data-testid="activity-timeline">
      {groups.map((group) => {
        const closed = collapsed.has(group.key);
        return (
          <section key={group.key} className="activity-group" data-testid={`timeline-group-${group.key}`}>
            <button type="button" className="activity-group__header" aria-expanded={!closed} onClick={() => onToggle(group.key)}>
              <ButtonIcon name={closed ? 'chevronright' : 'chevrondown'} />
              <span>{group.title}</span>
            </button>
            {!closed &&
              (group.tasks.length === 0 ? (
                <div className="activity-group__empty" data-testid="activity-empty">
                  <p>No activities to show.</p>
                  <p>Get started by logging a call, scheduling a task, and more.</p>
                </div>
              ) : (
                <ul>
                  {group.tasks.map((task) => (
                    <TimelineItem key={task.Id} task={task} overdue={group.key === 'upcoming' && !!task.ActivityDate && String(task.ActivityDate) < today} />
                  ))}
                </ul>
              ))}
          </section>
        );
      })}
    </div>
  );
}

/** The filter summary, its settings menu, and Refresh and Expand All, as at the top of a Lightning timeline. */
function ActivityToolbar({
  filters,
  onFilters,
  onRefresh,
  allExpanded,
  onExpandAll,
}: {
  filters: ActivityFilters;
  onFilters(filters: ActivityFilters): void;
  onRefresh(): void;
  allExpanded: boolean;
  onExpandAll(): void;
}) {
  const option = <K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K], label: string) => ({
    id: `${key}-${value}`,
    label,
    checked: filters[key] === value,
    testId: `activity-filter-${key}-${value}`,
    onSelect: () => onFilters({ ...filters, [key]: value }),
  });
  return (
    <div className="activity-toolbar">
      <div className="activity-toolbar__filters">
        <span data-testid="activity-filter-summary">Filters: {describeFilters(filters)}</span>
        <Menu
          align="right"
          testId="activity-filter-menu"
          sections={[
            { header: 'Date range', items: [option('range', 'all', 'All time'), option('range', '2months', 'Within 2 months'), option('range', '7days', 'Last 7 days')] },
            { header: 'Activities to show', items: [option('scope', 'all', 'All activities'), option('scope', 'mine', 'My activities')] },
            { header: 'Activity types', items: [option('type', 'all', 'All types'), option('type', 'Call', 'Calls'), option('type', 'Email', 'Emails'), option('type', 'Task', 'Tasks')] },
          ]}
          trigger={(props) => (
            <button {...props} type="button" className="slds-button slds-button_icon slds-button_icon-border-filled activity-toolbar__settings" title="Timeline settings" data-testid="activity-filter-button">
              <ButtonIcon name="settings" />
              <span className="slds-assistive-text">Timeline settings</span>
            </button>
          )}
        />
      </div>
      <div className="activity-toolbar__links">
        <button type="button" className="slds-button activity-link" data-testid="activity-refresh" onClick={onRefresh}>
          Refresh
        </button>
        <span aria-hidden="true">•</span>
        <button type="button" className="slds-button activity-link" data-testid="activity-expand" onClick={onExpandAll}>
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
    </div>
  );
}

/** The docked composer window at the bottom right of the page, as Lightning opens for Log a Call and New Task. */
function DockedComposer({ record, link, composer, onClose }: { record: SRecord; link: 'WhoId' | 'WhatId'; composer: Composer; onClose(): void }) {
  const [minimized, setMinimized] = useState(false);
  const [subject, setSubject] = useState(composer === 'call' ? 'Call' : '');
  const [comments, setComments] = useState('');
  const [dueDate, setDueDate] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();
  const title = composer === 'call' ? 'Log a Call' : 'New Task';
  const target = link === 'WhoId' ? { whoId: record.Id } : { whatId: record.Id };

  const save = useMutation({
    mutationFn: async () => {
      if (composer === 'call') return api.logCall({ ...target, subject, description: comments || null });
      return api.create('Task', { Subject: subject, ActivityDate: dueDate || null, [link]: record.Id });
    },
    onSuccess: async () => {
      await refreshRecords(queryClient);
      toast(`Task "${subject}" was created.`);
      onClose();
    },
  });

  return (
    <section className={`docked-composer ${minimized ? 'docked-composer_minimized' : ''}`} role="dialog" aria-label={title} data-testid="docked-composer">
      <header className="docked-composer__header">
        <Icon name={composer === 'call' ? 'log_a_call' : 'task'} size="small" />
        <h2 className="docked-composer__title">{title}</h2>
        <button type="button" className="slds-button slds-button_icon" title={minimized ? 'Expand' : 'Minimize'} onClick={() => setMinimized(!minimized)}>
          <ButtonIcon name={minimized ? 'expand_alt' : 'minimize_window'} />
          <span className="slds-assistive-text">{minimized ? 'Expand' : 'Minimize'}</span>
        </button>
        <button type="button" className="slds-button slds-button_icon" title="Close" data-testid="composer-close" onClick={onClose}>
          <ButtonIcon name="close" />
          <span className="slds-assistive-text">Close {title}</span>
        </button>
      </header>
      {!minimized && (
        <>
          <div className="docked-composer__body">
            <PageError error={save.error} />
            <div className="slds-form-element slds-m-bottom_small">
              <label className="slds-form-element__label" htmlFor={composer === 'call' ? 'call-subject' : 'task-subject'}>
                {composer === 'task' && (
                  <abbr className="slds-required" title="required">
                    *{' '}
                  </abbr>
                )}
                Subject
              </label>
              <input
                id={composer === 'call' ? 'call-subject' : 'task-subject'}
                className="slds-input"
                autoFocus
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            {composer === 'call' ? (
              <div className="slds-form-element slds-m-bottom_small">
                <label className="slds-form-element__label" htmlFor="call-comments">
                  Comments
                </label>
                <textarea id="call-comments" className="slds-textarea" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
              </div>
            ) : (
              <div className="slds-form-element slds-m-bottom_small">
                <label className="slds-form-element__label" htmlFor="task-due">
                  Due Date
                </label>
                <input id="task-due" type="date" className="slds-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
            <div className="slds-form-element">
              <span className="slds-form-element__label">{link === 'WhoId' ? 'Name' : 'Related To'}</span>
              <span className="slds-pill docked-composer__pill">
                <Icon name={record.attributes.type === 'Lead' ? 'lead' : record.attributes.type.toLowerCase()} size="x-small" />
                <span className="slds-pill__label">{recordTitle(record)}</span>
              </span>
            </div>
          </div>
          <footer className="docked-composer__footer">
            <button
              type="button"
              className="slds-button slds-button_brand"
              data-testid="activity-save"
              disabled={save.isPending || (composer === 'task' && !subject)}
              onClick={() => save.mutate()}
            >
              Save
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

/** Activity: the composer buttons, the docked composer and the grouped timeline. */
export function ActivityPanel({ record, link, readOnly, composer, onComposerChange }: ActivityPanelProps) {
  const tasks = useTasks(record, link);
  const clock = useClock();
  const { current } = useActingUser();
  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_ACTIVITY_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const today = clock.data?.today ?? '';
  const all = tasks.data ?? [];
  const shown = filterActivities(all as (SRecord & FilterableTask)[], filters, today, current?.Id ?? null);
  const groupKeys = groupTimeline(shown, today).map((g) => g.key);
  const allExpanded = groupKeys.every((key) => !collapsed.has(key));
  const hidden = all.length - shown.length;
  const actions: { id: Composer | 'email' | 'event'; label: string; icon: string; stub?: boolean }[] = [
    { id: 'email', label: 'Email', icon: 'email', stub: true },
    { id: 'event', label: 'New Event', icon: 'event', stub: true },
    { id: 'call', label: 'Log a Call', icon: 'log_a_call' },
    { id: 'task', label: 'New Task', icon: 'task' },
  ];

  return (
    <article className="slds-card activity-panel" data-testid="activity-panel">
      <h2 className="slds-assistive-text">Activity</h2>
      <div className="slds-card__body slds-card__body_inner">
        {!readOnly && (
          <div className="activity-actions">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="activity-action"
                disabled={action.stub}
                aria-pressed={composer === action.id}
                title={action.stub ? scopeTitle(action.label) : action.label}
                data-testid={`composer-${action.id}`}
                onClick={() => !action.stub && onComposerChange(action.id as Composer)}
              >
                <Icon name={action.icon} size="small" />
                <span className="slds-assistive-text">{action.stub ? scopeTitle(action.label) : action.label}</span>
              </button>
            ))}
          </div>
        )}
        <ActivityToolbar
          filters={filters}
          onFilters={setFilters}
          onRefresh={() => void tasks.refetch()}
          allExpanded={allExpanded}
          onExpandAll={() => setCollapsed(allExpanded ? new Set(groupKeys) : new Set())}
        />
        {tasks.isFetching && <Spinner size="small" />}
        <Timeline
          tasks={shown}
          today={today}
          collapsed={collapsed}
          onToggle={(key) => {
            const next = new Set(collapsed);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            setCollapsed(next);
          }}
        />
        {hidden > 0 && (
          <div className="activity-hidden" data-testid="activity-hidden">
            <p className="activity-hidden__note">
              <ButtonIcon name="info" />
              To change what's shown, try changing your filters.
            </p>
            <button type="button" className="slds-button slds-button_brand" data-testid="activity-show-all" onClick={() => setFilters({ range: 'all', scope: 'all', type: 'all' })}>
              Show All Activities
            </button>
          </div>
        )}
      </div>
      {composer && !readOnly && (
        <DockedComposer key={composer} record={record} link={link} composer={composer} onClose={() => onComposerChange(null)} />
      )}
    </article>
  );
}
