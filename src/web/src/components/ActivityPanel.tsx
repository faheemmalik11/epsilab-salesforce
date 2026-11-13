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
    return <p className="slds-text-color_weak slds-p-around_small">No activities to show.</p>;
  }
  return (
    <ul className="slds-timeline" data-testid="activity-timeline">
      {tasks.map((task) => {
        const call = task.TaskSubtype === 'Call';
        return (
          <li key={task.Id} data-testid="timeline-item">
            <div className={`slds-timeline__item_expandable ${call ? 'slds-timeline__item_call' : 'slds-timeline__item_task'}`}>
              <div className="slds-media">
                <div className="slds-media__figure">
                  <Icon name={call ? 'log_a_call' : 'task'} size="small" className="slds-timeline__icon" />
                </div>
                <div className="slds-media__body">
                  <div className="slds-grid slds-grid_align-spread slds-timeline__trigger">
                    <h3 className="slds-truncate">
                      <Link to={recordUrl('Task', task.Id)}>
                        <strong>{String(task.Subject ?? '(no subject)')}</strong>
                      </Link>
                    </h3>
                    <p className="slds-timeline__date">{formatValue('date', task.ActivityDate)}</p>
                  </div>
                  <p className="slds-m-horizontal_xx-small slds-text-body_small">
                    {String(task.Status)}
                    {task.Description ? ` • ${String(task.Description)}` : ''}
                  </p>
                </div>
              </div>
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

  const tabs: { id: Composer | 'event' | 'email'; label: string; stub?: boolean }[] = [
    { id: 'call', label: 'Log a Call' },
    { id: 'task', label: 'New Task' },
    { id: 'event', label: 'New Event', stub: true },
    { id: 'email', label: 'Email', stub: true },
  ];

  return (
    <article className="slds-card" data-testid="activity-panel">
      <div className="slds-card__header slds-grid">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <h2 className="slds-card__header-title">Activity</h2>
        </header>
      </div>
      <div className="slds-card__body slds-card__body_inner">
        {!readOnly && (
          <div className="slds-tabs_default slds-m-bottom_medium activity-tabs">
            <ul className="slds-tabs_default__nav" role="tablist">
              {tabs.map((tab) => (
                <li
                  key={tab.id}
                  className={`slds-tabs_default__item ${composer === tab.id ? 'slds-is-active' : ''}`}
                  title={tab.stub ? STUB_TEXT : tab.label}
                  role="presentation"
                >
                  <a
                    className={`slds-tabs_default__link ${tab.stub ? 'slds-text-color_weak' : ''}`}
                    href="#"
                    role="tab"
                    aria-disabled={tab.stub || undefined}
                    data-testid={`composer-${tab.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!tab.stub) setComposer(tab.id as Composer);
                    }}
                  >
                    {tab.label}
                    {tab.stub && <StubBadge />}
                  </a>
                </li>
              ))}
            </ul>
            <div className="slds-tabs_default__content slds-show" role="tabpanel">
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
        <h3 className="slds-text-title_caps slds-m-bottom_x-small">Activity History</h3>
        <Timeline tasks={tasks.data ?? []} />
      </div>
    </article>
  );
}
