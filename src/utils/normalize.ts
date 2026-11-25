export { normalizeSearch } from '../../shared/normalize';

export function formatDate(value: Date | null, withTime = false): string {
  if (!value) return '—';
  return withTime ? value.toLocaleString('vi-VN') : value.toLocaleDateString('vi-VN');
}
