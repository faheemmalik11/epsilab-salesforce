/** Any problem with the seed files. The build stops on it rather than importing partial data. */
export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedError';
  }
}

export function rowError(file: string, row: number, column: string, message: string): SeedError {
  return new SeedError(`${file} row ${row}, column "${column}": ${message}`);
}
