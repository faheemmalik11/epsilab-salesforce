import { describe, expect, it } from 'vitest';
import { groupTimeline } from '../../src/web/src/lib/timeline.js';

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
