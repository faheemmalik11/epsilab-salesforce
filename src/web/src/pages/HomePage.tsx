import type { ReactNode } from 'react';
import { useDescribe, useRecordQuery } from '../api/hooks';
import { DataTable } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { useActingUser } from '../context/ActingUser';
import { LAYOUTS } from '../lib/layouts';

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <article className="slds-card slds-m-bottom_small">
      <div className="slds-card__header slds-grid">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <div className="slds-media__figure">
            <Icon name={icon} size="small" />
          </div>
          <div className="slds-media__body">
            <h2 className="slds-card__header-title">{title}</h2>
          </div>
        </header>
      </div>
      <div className="slds-card__body">{children}</div>
    </article>
  );
}

/** Home: the acting user's open tasks and the most recently changed opportunities. */
export function HomePage() {
  const { current } = useActingUser();
  const taskFields = useDescribe('Task');
  const oppFields = useDescribe('Opportunity');
  const tasks = useRecordQuery({
    object: 'Task',
    where: [
      { field: 'OwnerId', op: 'eq', value: current?.Id },
      { field: 'IsClosed', op: 'eq', value: false },
    ],
    orderBy: [{ field: 'ActivityDate' }],
    limit: 10,
  });
  const opportunities = useRecordQuery({
    object: 'Opportunity',
    orderBy: [{ field: 'LastModifiedDate', direction: 'desc' }],
    limit: 10,
  });
  const map = (d: typeof taskFields) => new Map((d.data?.fields ?? []).map((f) => [f.name, f]));

  return (
    <div className="slds-p-around_small" data-testid="home-page">
      <div className="slds-grid slds-gutters_small">
      <div className="slds-col slds-size_1-of-2">
        <Card icon="task" title={`My Open Tasks (${tasks.data?.totalSize ?? 0})`}>
          <DataTable object="Task" columns={LAYOUTS.Task.columns.slice(0, 5)} fields={map(taskFields)} records={tasks.data?.records ?? []} />
        </Card>
      </div>
      <div className="slds-col slds-size_1-of-2">
        <Card icon="opportunity" title="Recently Updated Opportunities">
          <DataTable object="Opportunity" columns={LAYOUTS.Opportunity.columns.slice(0, 5)} fields={map(oppFields)} records={opportunities.data?.records ?? []} />
        </Card>
      </div>
      </div>
    </div>
  );
}
