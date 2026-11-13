import type { ObjectName } from '../api/types';

export type ListView = 'all' | 'mine';

const key = (object: ObjectName) => `pinnedListView:${object}`;

/** The list view an object's tab opens with. It is kept in this browser, like the acting user. */
export function getPinnedView(object: ObjectName): ListView {
  try {
    return localStorage.getItem(key(object)) === 'mine' ? 'mine' : 'all';
  } catch {
    return 'all';
  }
}

export function setPinnedView(object: ObjectName, view: ListView): void {
  try {
    localStorage.setItem(key(object), view);
  } catch {
    // Without storage the pin lasts until the page is reloaded.
  }
}
