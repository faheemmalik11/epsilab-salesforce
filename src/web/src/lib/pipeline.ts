export interface PipelineTask {
  WhoId: string | null;
  ActivityDate: string | null;
  IsClosed: boolean;
}

export interface PipelineCounts {
  total: number;
  upcoming: number;
  past: number;
  none: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first day of Build Pipeline's window: leads created in the last 30 days, today included. */
export function pipelineWindowStart(today: string, days = 30): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Seller Home's Build Pipeline chips: a lead with an open task due today or later has upcoming activity,
 * a lead with any other task has past activity, and the rest have none.
 */
export function classifyPipeline(leadIds: string[], tasks: PipelineTask[], today: string): PipelineCounts {
  const upcoming = new Set<string>();
  const touched = new Set<string>();
  for (const task of tasks) {
    if (!task.WhoId) continue;
    touched.add(task.WhoId);
    if (!task.IsClosed && task.ActivityDate !== null && task.ActivityDate >= today) upcoming.add(task.WhoId);
  }
  const counts: PipelineCounts = { total: leadIds.length, upcoming: 0, past: 0, none: 0 };
  for (const id of leadIds) {
    if (upcoming.has(id)) counts.upcoming++;
    else if (touched.has(id)) counts.past++;
    else counts.none++;
  }
  return counts;
}
