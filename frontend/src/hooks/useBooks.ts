import { getBook, listMyBooks, searchBooks } from '../api/books';
import type { BookSearchParams } from '../types';
import { LIMITS } from '../utils/constants';
import { useAsync } from './useAsync';

export function useBookSearch(filters: BookSearchParams) {
  const key = JSON.stringify(filters);
  return useAsync(() => searchBooks({ pageSize: LIMITS.pageSize, ...filters }), [key]);
}

export function useBook(copyId: string | undefined) {
  return useAsync(() => (copyId ? getBook(copyId) : Promise.reject(new Error('Missing book id'))), [copyId]);
}

export function useMyBooks(page: number) {
  return useAsync(() => listMyBooks({ page, pageSize: LIMITS.pageSize }), [page]);
}
