import { normalizeSearch } from '../../../shared/normalize';
import { PAGE_SIZE, type Page, type PageRequest } from '../types';

type Row = { id: string; searchName: string };

/**
 * Bản mock của fetchPage: lọc tiền tố (mặc định trên searchName, hoặc qua `names` để tìm nhiều trường),
 * sắp theo searchName rồi id, cursor là vị trí.
 */
export function mockPage<T extends Row, R>(rows: T[], request: PageRequest, map: (row: T) => R, names?: (row: T) => string[]): Page<R> {
  const prefix = normalizeSearch(request.search);
  const matches = (row: T) => !prefix || (names ? names(row) : [row.searchName]).some((n) => normalizeSearch(n).startsWith(prefix));
  const sorted = rows
    .filter(matches)
    .sort((a, b) => (a.searchName === b.searchName ? (a.id < b.id ? -1 : 1) : a.searchName < b.searchName ? -1 : 1));
  const start = Number(request.cursor ?? 0);
  return { items: sorted.slice(start, start + PAGE_SIZE).map(map), cursor: start + PAGE_SIZE, more: start + PAGE_SIZE < sorted.length };
}
