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
