import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { refreshRecords } from '../api/hooks';
import type { SRecord } from '../api/types';
import { formatValue } from '../lib/format';
import { recordUrl } from './FieldOutput';
import { Icon } from './Icon';
import { PageError } from './PageError';
import { STUB_TEXT, StubBadge } from './Stub';
import { useToast } from './Toast';

type Composer = 'call' | 'task';

interface ActivityPanelProps {
  record: SRecord;
  /** Tasks attach through WhoId for leads and contacts, WhatId for accounts and opportunities. */
  link: 'WhoId' | 'WhatId';
  readOnly?: boolean;
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

function Timeline({ tasks }: { tasks: SRecord[] }) {
  if (tasks.length === 0) {
    return <p className="slds-text-color_weak slds-p-vertical_small">No activities to show.</p>;
  }
  return (
    <ul className="activity-timeline" data-testid="activity-timeline">
      {tasks.map((task) => {
        const call = task.TaskSubtype === 'Call';
        return (
          <li key={task.Id} className="activity-timeline__item" data-testid="timeline-item">
            <span className="activity-timeline__icon">
              <Icon name={call ? 'log_a_call' : 'task'} size="small" />
            </span>
            <div className="activity-timeline__body">
              <div className="activity-timeline__head">
                <Link className="slds-truncate" to={recordUrl('Task', task.Id)}>
                  {String(task.Subject ?? '(no subject)')}
                </Link>
                <span className="activity-timeline__date">{formatValue('date', task.ActivityDate)}</span>
              </div>
              <p className="activity-timeline__detail">
                {String(task.Status)}
                {task.Description ? ` • ${String(task.Description)}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Activity composer and timeline. Log a Call creates a completed Call task through the API. */
export function ActivityPanel({ record, link, readOnly }: ActivityPanelProps) {
  const [composer, setComposer] = useState<Composer>('call');
  const [subject, setSubject] = useState('Call');
  const [comments, setComments] = useState('');
  const [taskSubject, setTaskSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const tasks = useTasks(record, link);
  const queryClient = useQueryClient();
  const toast = useToast();
  const target = link === 'WhoId' ? { whoId: record.Id } : { whatId: record.Id };

  const save = useMutation({
    mutationFn: async () => {
      if (composer === 'call') return api.logCall({ ...target, subject, description: comments || null });
      return api.create('Task', {
        Subject: taskSubject,
        ActivityDate: dueDate || null,
        [link]: record.Id,
      });
    },
    onSuccess: async () => {
      await refreshRecords(queryClient);
      toast(`Task "${composer === 'call' ? subject : taskSubject}" was created.`);
      setComments('');
      setTaskSubject('');
      setDueDate('');
    },
  });

  const actions: { id: Composer | 'email' | 'event'; label: string; icon: string; stub?: boolean }[] = [
    { id: 'email', label: 'Email', icon: 'email', stub: true },
    { id: 'event', label: 'New Event', icon: 'event', stub: true },
    { id: 'call', label: 'Log a Call', icon: 'log_a_call' },
    { id: 'task', label: 'New Task', icon: 'task' },
  ];

  return (
    <article className="slds-card activity-panel" data-testid="activity-panel">
      <div className="slds-card__header">
        <h2 className="slds-card__header-title">Activity</h2>
      </div>
      <div className="slds-card__body slds-card__body_inner">
        {!readOnly && (
          <div className="activity-composer">
            <div className="activity-actions" role="tablist" aria-label="Activity composer">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="tab"
                  aria-selected={composer === action.id}
                  className={`activity-action ${composer === action.id ? 'activity-action_active' : ''}`}
                  disabled={action.stub}
                  title={action.stub ? `${action.label}: ${STUB_TEXT}` : action.label}
                  data-testid={`composer-${action.id}`}
                  onClick={() => !action.stub && setComposer(action.id as Composer)}
                >
                  <Icon name={action.icon} size="small" />
                  <span className="slds-assistive-text">{action.stub ? `${action.label}: ${STUB_TEXT}` : action.label}</span>
                </button>
              ))}
            </div>
            <p className="activity-stub-note">
              Email and New Event: {STUB_TEXT}
              <StubBadge />
            </p>
            <div role="tabpanel" className="activity-form">
              <h3 className="activity-form__title">{composer === 'call' ? 'Log a Call' : 'New Task'}</h3>
              <PageError error={save.error} />
              {composer === 'call' ? (
                <>
                  <div className="slds-form-element slds-m-bottom_x-small">
                    <label className="slds-form-element__label" htmlFor="call-subject">
                      Subject
                    </label>
                    <input id="call-subject" className="slds-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                  <div className="slds-form-element slds-m-bottom_x-small">
                    <label className="slds-form-element__label" htmlFor="call-comments">
                      Comments
                    </label>
                    <textarea id="call-comments" className="slds-textarea" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="slds-form-element slds-m-bottom_x-small">
                    <label className="slds-form-element__label" htmlFor="task-subject">
                      Subject
                    </label>
                    <input id="task-subject" className="slds-input" value={taskSubject} onChange={(e) => setTaskSubject(e.target.value)} />
                  </div>
                  <div className="slds-form-element slds-m-bottom_x-small">
                    <label className="slds-form-element__label" htmlFor="task-due">
                      Due Date
                    </label>
                    <input id="task-due" type="date" className="slds-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </>
              )}
              <div className="slds-text-align_right">
                <button
                  type="button"
                  className="slds-button slds-button_brand"
                  data-testid="activity-save"
                  disabled={save.isPending || (composer === 'task' && !taskSubject)}
                  onClick={() => save.mutate()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        <h3 className="activity-history__title">Activity History</h3>
        <Timeline tasks={tasks.data ?? []} />
      </div>
    </article>
  );
}
