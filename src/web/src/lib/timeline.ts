export interface TimelineTask {
  Id: string;
  IsClosed?: unknown;
  ActivityDate?: unknown;
  CreatedDate?: unknown;
}

export interface TimelineGroup<T> {
  key: string;
  title: string;
  tasks: T[];
  empty?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Lightning's activity timeline: open tasks under "Upcoming & Overdue" (soonest first), then completed
 * activity grouped by month, newest first. A task with no due date uses its created date.
 */
export function groupTimeline<T extends TimelineTask>(tasks: T[], today: string): TimelineGroup<T>[] {
  const day = (task: T) => String(task.ActivityDate ?? task.CreatedDate ?? today).slice(0, 10);
  const open = tasks.filter((t) => t.IsClosed !== true).sort((a, b) => day(a).localeCompare(day(b)) || a.Id.localeCompare(b.Id));
  const groups: TimelineGroup<T>[] = [{ key: 'upcoming', title: 'Upcoming & Overdue', tasks: open, empty: 'No activities to show.' }];
  const past = tasks.filter((t) => t.IsClosed === true).sort((a, b) => day(b).localeCompare(day(a)) || b.Id.localeCompare(a.Id));
  for (const task of past) {
    const key = day(task).slice(0, 7);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const [year, month] = key.split('-');
      group = { key, title: `${MONTHS[Number(month) - 1]} • ${year}`, tasks: [] };
      groups.push(group);
    }
    group.tasks.push(task);
  }
  return groups;
}

export type ActivityRange = 'all' | '2months' | '7days';
export type ActivityScope = 'all' | 'mine';
export type ActivityType = 'all' | 'Call' | 'Email' | 'Task';

export interface ActivityFilters {
  range: ActivityRange;
  scope: ActivityScope;
  type: ActivityType;
}

/** Salesforce's default activity filters. */
export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = { range: '2months', scope: 'all', type: 'all' };

export interface FilterableTask extends TimelineTask {
  OwnerId?: unknown;
  TaskSubtype?: unknown;
}

const RANGE_DAYS: Record<ActivityRange, number | null> = { all: null, '2months': 61, '7days': 7 };

/**
 * The activity timeline filters. As in Lightning, the date range applies to past activity only:
 * open tasks always show under "Upcoming & Overdue".
 */
export function filterActivities<T extends FilterableTask>(tasks: T[], filters: ActivityFilters, today: string, userId: string | null): T[] {
  const days = RANGE_DAYS[filters.range];
  // Until the app clock has loaded there is no today to measure the range from.
  const since = days === null || !today ? null : new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  return tasks.filter((task) => {
    if (filters.scope === 'mine' && task.OwnerId !== userId) return false;
    if (filters.type !== 'all' && (task.TaskSubtype ?? 'Task') !== filters.type) return false;
    if (since && task.IsClosed === true) {
      const day = String(task.ActivityDate ?? task.CreatedDate ?? today).slice(0, 10);
      if (day < since) return false;
    }
    return true;
  });
}

/** "Within 2 months • All activities • All types", as Lightning summarizes the filters. */
export function describeFilters(filters: ActivityFilters): string {
  const range = { all: 'All time', '2months': 'Within 2 months', '7days': 'Last 7 days' }[filters.range];
  const scope = filters.scope === 'mine' ? 'My activities' : 'All activities';
  const type = { all: 'All types', Call: 'Calls', Email: 'Emails', Task: 'Tasks' }[filters.type];
  return `${range} • ${scope} • ${type}`;
}
