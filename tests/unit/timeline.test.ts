import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITY_FILTERS, describeFilters, filterActivities, groupTimeline } from '../../src/web/src/lib/timeline.js';

describe('activity timeline grouping', () => {
  it('puts open tasks first, soonest first, then closed tasks by month, newest first', () => {
    const tasks = [
      { Id: 'a', IsClosed: true, ActivityDate: '2028-10-03' },
      { Id: 'b', IsClosed: false, ActivityDate: '2028-11-20' },
      { Id: 'c', IsClosed: false, ActivityDate: '2028-11-01' },
      { Id: 'd', IsClosed: true, ActivityDate: '2028-11-05' },
      { Id: 'e', IsClosed: true, ActivityDate: null, CreatedDate: '2028-10-30T09:00:00.000Z' },
    ];
    const groups = groupTimeline(tasks, '2028-11-11');
    expect(groups.map((g) => [g.key, g.title, g.tasks.map((t) => t.Id)])).toEqual([
      ['upcoming', 'Upcoming & Overdue', ['c', 'b']],
      ['2028-11', 'November • 2028', ['d']],
      ['2028-10', 'October • 2028', ['e', 'a']],
    ]);
  });

  it('always shows the upcoming group, even when empty', () => {
    expect(groupTimeline([], '2028-11-11')).toEqual([{ key: 'upcoming', title: 'Upcoming & Overdue', tasks: [], empty: 'No activities to show.' }]);
  });
});

describe('activity filters', () => {
  const tasks = [
    { Id: 'open-old', IsClosed: false, ActivityDate: '2027-01-01', OwnerId: 'me', TaskSubtype: 'Task' },
    { Id: 'call-recent', IsClosed: true, ActivityDate: '2028-11-01', OwnerId: 'me', TaskSubtype: 'Call' },
    { Id: 'email-old', IsClosed: true, ActivityDate: '2028-06-01', OwnerId: 'other', TaskSubtype: 'Email' },
    { Id: 'task-week', IsClosed: true, ActivityDate: '2028-11-08', OwnerId: 'other', TaskSubtype: 'Task' },
  ];
  const ids = (filters: Parameters<typeof filterActivities>[1]) => filterActivities(tasks, filters, '2028-11-11', 'me').map((t) => t.Id);

  it('applies the date range to past activity only, keeping every open task', () => {
    expect(ids({ range: 'all', scope: 'all', type: 'all' })).toEqual(['open-old', 'call-recent', 'email-old', 'task-week']);
    expect(ids(DEFAULT_ACTIVITY_FILTERS)).toEqual(['open-old', 'call-recent', 'task-week']);
    expect(ids({ range: '7days', scope: 'all', type: 'all' })).toEqual(['open-old', 'task-week']);
  });

  it('filters by owner and by type', () => {
    expect(ids({ range: 'all', scope: 'mine', type: 'all' })).toEqual(['open-old', 'call-recent']);
    expect(ids({ range: 'all', scope: 'all', type: 'Email' })).toEqual(['email-old']);
    expect(ids({ range: 'all', scope: 'all', type: 'Task' })).toEqual(['open-old', 'task-week']);
  });

  it('summarizes the filters the way Lightning does', () => {
    expect(describeFilters(DEFAULT_ACTIVITY_FILTERS)).toBe('Within 2 months • All activities • All types');
    expect(describeFilters({ range: 'all', scope: 'mine', type: 'Call' })).toBe('All time • My activities • Calls');
  });
});

describe('activity filters before the clock loads', () => {
  it('does not throw without a today, and keeps every task', () => {
    const tasks = [{ Id: 'a', IsClosed: true, ActivityDate: '2020-01-01' }];
    expect(filterActivities(tasks, DEFAULT_ACTIVITY_FILTERS, '', null)).toEqual(tasks);
  });
});
