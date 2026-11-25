import { useCallback, useEffect, useState } from 'react';
import type { Page, PageRequest } from '../entities/types';
import { messageOf } from '../utils/messages';

/** Trạng thái danh sách phân trang cursor + tìm kiếm tiền tố, dùng chung cho các trang quản lý. */
export function usePagedList<T>(load: (request: PageRequest) => Promise<Page<T>>) {
  const [cursors, setCursors] = useState<unknown[]>([undefined]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState<Page<T>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load({ search, cursor: cursors.at(-1), filter: filter || undefined })
      .then((p) => { if (active) setPage(p); })
      .catch((e) => { if (active) { setPage(undefined); setError(messageOf(e)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, search, filter, cursors, version]);

  return {
    items: page?.items ?? [],
    loading,
    error,
    pageNumber: cursors.length,
    hasPrevious: cursors.length > 1,
    hasNext: Boolean(page?.more),
    search,
    applySearch: useCallback((value: string) => { setSearch(value.trim()); setCursors([undefined]); }, []),
    filter,
    applyFilter: useCallback((value: string) => { setFilter(value); setCursors([undefined]); }, []),
    next: () => { if (page?.more) setCursors((c) => [...c, page.cursor]); },
    previous: () => setCursors((c) => (c.length > 1 ? c.slice(0, -1) : c)),
    /** Tải lại trang hiện tại (sau khi thêm/sửa hoặc khi bấm "Tải lại"). */
    reload: useCallback(() => setVersion((v) => v + 1), []),
  };
}
