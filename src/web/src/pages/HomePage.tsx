import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import eventsArt from '@salesforce-ux/design-system/assets/images/illustrations/empty-state-events.svg?url';
import tasksArt from '@salesforce-ux/design-system/assets/images/illustrations/empty-state-tasks.svg?url';
import goalsArt from '@salesforce-ux/design-system/assets/images/illustrations/empty-state-assistant.svg?url';
import { api } from '../api/client';
import { refreshRecords, useClock, useRecordQuery } from '../api/hooks';
import type { ObjectName, SRecord } from '../api/types';
import { recordUrl } from '../components/FieldOutput';
import { ButtonIcon, Icon } from '../components/Icon';
import { Menu } from '../components/Menu';
import { useToast } from '../components/Toast';
import { STUB_TEXT, StubBadge } from '../components/Stub';
import { useActingUser } from '../context/ActingUser';
import { formatValue } from '../lib/format';
import { LAYOUTS, recordTitle } from '../lib/layouts';
import { classifyPipeline, pipelineWindowStart, type PipelineTask } from '../lib/pipeline';

const RECENT_OBJECTS: ObjectName[] = ['Lead', 'Account', 'Contact', 'Opportunity'];
const PIPELINE_PAGE = 200;

function HomeCard({ title, testId, footer, stub, action, children }: { title: string; testId: string; footer?: ReactNode; stub?: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <article className="slds-card home-card" data-testid={testId}>
      <div className="slds-card__header home-card__header">
        <h2 className="slds-card__header-title">
          {title}
          {stub && <StubBadge />}
        </h2>
        {action}
      </div>
      <div className="slds-card__body slds-card__body_inner home-card__body">{children}</div>
      {footer && <footer className="slds-card__footer home-card__footer">{footer}</footer>}
    </article>
  );
}

function EmptyState({ art, text }: { art: string; text: string }) {
  return (
    <div className="home-empty">
      <img src={art} alt="" className="home-empty__art" />
      <p>{text}</p>
    </div>
  );
}

function StubButton({ label, brand }: { label: string; brand?: boolean }) {
  return (
    <button type="button" className={`slds-button ${brand ? 'slds-button_brand' : 'slds-button_neutral'}`} disabled title={`${label}: ${STUB_TEXT}`}>
      {label}
    </button>
  );
}

/** Leads owned by the acting user and created in the last 30 days, with their activity state. */
function useBuildPipeline(ownerId: string | undefined, today: string | undefined) {
  return useQuery({
    queryKey: ['pipeline', ownerId, today],
    enabled: !!ownerId && !!today,
    queryFn: async () => {
      const since = pipelineWindowStart(today!);
      const ids: string[] = [];
      for (let offset = 0; ; offset += PIPELINE_PAGE) {
        const page = await api.query({
          object: 'Lead',
          where: [
            { field: 'OwnerId', op: 'eq', value: ownerId },
            { field: 'IsConverted', op: 'eq', value: false },
          ],
          orderBy: [{ field: 'CreatedDate', direction: 'desc' }],
          limit: PIPELINE_PAGE,
          offset,
        });
        const recent = page.records.filter((r) => String(r.CreatedDate).slice(0, 10) >= since);
        ids.push(...recent.map((r) => r.Id));
        if (recent.length < page.records.length || page.done) break;
      }
      const tasks: PipelineTask[] = [];
      for (let i = 0; i < ids.length; i += PIPELINE_PAGE) {
        const chunk = ids.slice(i, i + PIPELINE_PAGE);
        const result = await api.query({ object: 'Task', where: [{ field: 'WhoId', op: 'in', value: chunk }], limit: 2000 });
        tasks.push(...(result.records as unknown as PipelineTask[]));
      }
      return classifyPipeline(ids, tasks, today!);
    },
  });
}

function BuildPipeline({ ownerId, today }: { ownerId?: string; today?: string }) {
  const pipeline = useBuildPipeline(ownerId, today);
  const counts = pipeline.data;
  const chips = [
    { key: 'upcoming', label: 'Upcoming Activity', value: counts?.upcoming },
    { key: 'past', label: 'Past Activity', value: counts?.past },
    { key: 'none', label: 'No Activity', value: counts?.none },
  ];
  return (
    <HomeCard
      title="Build Pipeline"
      testId="home-build-pipeline"
      footer={
        <Link className="slds-button slds-button_neutral" to="/lightning/o/Lead/list?view=mine">
          View Leads
        </Link>
      }
    >
      <p className="home-card__subtitle">Leads owned by me and created in the last 30 days</p>
      <div className="pipeline">
        <div className="pipeline__ring" data-testid="pipeline-count">
          <span className="pipeline__count">{counts?.total ?? '…'}</span>
          <span>Leads</span>
        </div>
        <ul className="pipeline__chips">
          {chips.map((chip) => (
            <li key={chip.key} className={`pipeline__chip pipeline__chip_${chip.key}`} data-testid={`pipeline-${chip.key}`}>
              <span className="pipeline__dot" />
              <span className="pipeline__label">
                {chip.value ?? '…'} {chip.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </HomeCard>
  );
}

type TaskFilter = 'today' | 'overdue' | 'open';

const TASK_FILTERS: { id: TaskFilter; label: string; empty: string }[] = [
  { id: 'today', label: "Today's Tasks", empty: 'Nothing due today. Be a go-getter, and check back soon.' },
  { id: 'overdue', label: 'Overdue Tasks', empty: 'No overdue tasks. Nice work!' },
  { id: 'open', label: 'All Open Tasks', empty: 'No open tasks.' },
];

/**
 * The acting user's open tasks. Today's tasks are an exact match on the due date; overdue and all open
 * read the earliest-dated tasks, since the query API compares by equality only.
 */
function TodaysTasks({ ownerId, today }: { ownerId?: string; today?: string }) {
  const [filter, setFilter] = useState<TaskFilter>('today');
  const queryClient = useQueryClient();
  const toast = useToast();
  const tasks = useRecordQuery(
    {
      object: 'Task',
      where: [
        { field: 'OwnerId', op: 'eq', value: ownerId },
        { field: 'IsClosed', op: 'eq', value: false },
        filter === 'today' ? { field: 'ActivityDate', op: 'eq', value: today } : { field: 'ActivityDate', op: 'notNull' },
      ],
      orderBy: [{ field: 'ActivityDate' }, { field: 'Subject' }],
      limit: 5,
    },
    !!ownerId && !!today,
  );
  const complete = useMutation({
    mutationFn: (task: SRecord) => api.update('Task', task.Id, { Status: 'Completed' }),
    onSuccess: async (_data, task) => {
      await refreshRecords(queryClient);
      toast(`Task "${String(task.Subject ?? '')}" was completed.`);
    },
  });
  const current = TASK_FILTERS.find((f) => f.id === filter)!;
  const due = (task: SRecord) => (task.ActivityDate ? String(task.ActivityDate) : null);
  const records = (tasks.data?.records ?? []).filter((task) => filter !== 'overdue' || (due(task) ?? '') < today!);

  return (
    <HomeCard
      title={current.label}
      testId="home-todays-tasks"
      action={
        <Menu
          align="right"
          testId="home-task-filter-menu"
          sections={[{ items: TASK_FILTERS.map((f) => ({ id: f.id, label: f.label, checked: f.id === filter, testId: `task-filter-${f.id}`, onSelect: () => setFilter(f.id) })) }]}
          trigger={(props) => (
            <button {...props} type="button" className="slds-button slds-button_icon slds-button_icon-border-filled home-card__menu" title="Select task filter" data-testid="home-task-filter">
              <ButtonIcon name="down" />
              <span className="slds-assistive-text">Select task filter</span>
            </button>
          )}
        />
      }
      footer={
        <Link className="slds-button slds-button_neutral" to="/lightning/o/Task/list?view=mine">
          View All
        </Link>
      }
    >
      {records.length === 0 ? (
        <EmptyState art={tasksArt} text={current.empty} />
      ) : (
        <ul className="home-list">
          {records.map((task) => {
            const overdue = !!due(task) && due(task)! < today!;
            return (
              <li key={task.Id} className="home-list__item" data-testid="home-task">
                <div className="slds-checkbox">
                  <input
                    type="checkbox"
                    id={`complete-${task.Id}`}
                    checked={false}
                    disabled={complete.isPending}
                    onChange={() => complete.mutate(task)}
                  />
                  <label className="slds-checkbox__label" htmlFor={`complete-${task.Id}`} data-testid="home-task-complete">
                    <span className="slds-checkbox_faux" />
                    <span className="slds-form-element__label slds-assistive-text">Mark {String(task.Subject ?? '')} complete</span>
                  </label>
                </div>
                <span className="home-list__text">
                  <Link to={recordUrl('Task', task.Id)}>{String(task.Subject ?? '(no subject)')}</Link>
                  <span className={overdue ? 'home-task__overdue' : 'slds-text-color_weak'}>{formatValue('date', task.ActivityDate)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}

/** Lightning shows recently viewed records; with no view history here, these are the most recently changed. */
function RecentRecords() {
  const recent = useQuery({
    queryKey: ['query', 'home-recent'],
    queryFn: async () => {
      const lists = await Promise.all(
        RECENT_OBJECTS.map((object) =>
          api.query({ object, orderBy: [{ field: 'LastModifiedDate', direction: 'desc' }, { field: 'Id', direction: 'desc' }], limit: 5 }),
        ),
      );
      return lists
        .flatMap((list) => list.records)
        // Records changed in the same instant (a fixed clock) fall back to the newest Id first.
        .sort((a, b) => String(b.LastModifiedDate).localeCompare(String(a.LastModifiedDate)) || (a.Id < b.Id ? 1 : -1))
        .slice(0, 5);
    },
  });
  return (
    <HomeCard title="Recent Records" testId="home-recent-records" footer={<StubButton label="View All" />}>
      <ul className="home-list">
        {(recent.data ?? []).map((record: SRecord) => {
          const layout = LAYOUTS[record.attributes.type as keyof typeof LAYOUTS];
          return (
            <li key={record.Id} className="home-list__item" data-testid="home-recent-record">
              <Icon name={layout?.icon ?? 'record'} size="small" title={record.attributes.type} />
              <Link className="home-list__link" to={recordUrl(record.attributes.type, record.Id)}>
                {recordTitle(record)}
              </Link>
            </li>
          );
        })}
      </ul>
    </HomeCard>
  );
}

function greeting(now: string | undefined): string {
  const hour = now ? new Date(now).getUTCHours() : 12;
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** Seller Home, following the brief's screenshot: a greeting and a 3 by 2 grid of cards. */
export function HomePage() {
  const { current } = useActingUser();
  const clock = useClock();
  const today = clock.data?.today;
  const firstName = current?.Name.split(' ')[0] ?? '';

  return (
    <div className="home-page" data-testid="home-page">
      <div className="home-page__header">
        <h1 className="home-page__title">Seller Home</h1>
        <p className="home-page__greeting" data-testid="home-greeting">
          {greeting(clock.data?.now)}, {firstName}. Let's get selling!
        </p>
      </div>
      <div className="home-grid">
        <BuildPipeline ownerId={current?.Id} today={today} />
        <HomeCard title="My Goals" testId="home-goals" stub footer={<StubButton label="Set goals" brand />}>
          <EmptyState art={goalsArt} text="Set personal weekly or monthly goals for emails, calls, and meetings." />
        </HomeCard>
        <HomeCard title="Today's Events" testId="home-events" stub footer={<StubButton label="View Calendar" />}>
          <EmptyState art={eventsArt} text="Events and the calendar are not available in this trial." />
        </HomeCard>
        <TodaysTasks ownerId={current?.Id} today={today} />
        <RecentRecords />
        <HomeCard title="Salesblazer" testId="home-salesblazer" stub footer={<StubButton label="Join the Community" />}>
          <div className="home-empty">
            <span className="home-empty__icon">
              <Icon name="knowledge" size="large" />
            </span>
            <p>Community articles are not available in this trial.</p>
          </div>
        </HomeCard>
      </div>
    </div>
  );
}
