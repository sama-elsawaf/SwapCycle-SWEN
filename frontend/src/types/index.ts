export * from './user';
export * from './book';
export * from './exchange';

export interface ApiError {
  code: string;
  message: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
