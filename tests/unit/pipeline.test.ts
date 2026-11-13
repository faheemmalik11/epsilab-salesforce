import { describe, expect, it } from 'vitest';
import { classifyPipeline, pipelineWindowStart } from '../../src/web/src/lib/pipeline.js';

describe('Seller Home Build Pipeline', () => {
  it('starts the 30 day window 29 days before today', () => {
    expect(pipelineWindowStart('2028-11-11')).toBe('2028-10-13');
    expect(pipelineWindowStart('2028-03-01')).toBe('2028-02-01');
  });

  it('classifies leads by their tasks', () => {
    const tasks = [
      { WhoId: 'a', ActivityDate: '2028-11-11', IsClosed: false },
      { WhoId: 'a', ActivityDate: '2028-10-01', IsClosed: true },
      { WhoId: 'b', ActivityDate: '2028-11-20', IsClosed: true },
      { WhoId: 'c', ActivityDate: '2028-11-01', IsClosed: false },
      { WhoId: 'd', ActivityDate: null, IsClosed: false },
      { WhoId: null, ActivityDate: '2028-12-01', IsClosed: false },
      { WhoId: 'other', ActivityDate: '2028-12-01', IsClosed: false },
    ];
    expect(classifyPipeline(['a', 'b', 'c', 'd', 'e'], tasks, '2028-11-11')).toEqual({ total: 5, upcoming: 1, past: 3, none: 1 });
  });

  it('handles no leads', () => {
    expect(classifyPipeline([], [], '2028-11-11')).toEqual({ total: 0, upcoming: 0, past: 0, none: 0 });
  });
});
