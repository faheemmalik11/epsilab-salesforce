import { openDatabase, type Db } from '../db/connection.js';

/** The working database. Reset swaps the file underneath it, so callers always read `store.db`. */
export class DbStore {
  #db: Db;

  constructor(readonly file: string) {
    this.#db = openDatabase(file);
  }

  get db(): Db {
    return this.#db;
  }

  /**
   * Closes the connection, runs `replace` on the closed file, then reopens. Everything here is
   * synchronous, so no request can run in between: that is the app-level lock for reset.
   */
  swap<T>(replace: () => T): T {
    if (this.#db.inTransaction) throw new Error('Cannot swap the database during a transaction');
    this.#db.close();
    try {
      return replace();
    } finally {
      this.#db = openDatabase(this.file);
    }
  }

  close(): void {
    if (this.#db.open) this.#db.close();
  }
}
