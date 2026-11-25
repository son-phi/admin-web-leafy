// Khoảng thời gian thống kê (kịch bản 2.2.5.1 bước 4). Ngày tính theo múi giờ của trình duyệt.
import { AppError } from './messages';

export type RangeOption = '7d' | '30d' | '12m' | 'custom';
export type Granularity = 'day' | 'month';
/** `end` là mốc KHÔNG bao gồm (nửa mở [start, end)). */
export type DateRange = { start: Date; end: Date; granularity: Granularity };

export const RANGE_LABELS: Record<RangeOption, string> = {
  '7d': '7 ngày gần nhất',
  '30d': '30 ngày gần nhất',
  '12m': '12 tháng gần nhất',
  custom: 'Tùy chọn',
};

/** Tùy chọn ≤ 62 ngày nhóm theo ngày, dài hơn nhóm theo tháng. */
export const MAX_DAILY_DAYS = 62;

const DAY = 86_400_000;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** Chuỗi `yyyy-mm-dd` từ ô chọn ngày → Date 00:00 giờ địa phương; sai định dạng → null. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Xác định khoảng thời gian; tùy chọn sai (thiếu ngày, từ > đến, đến sau hôm nay) → INVALID_RANGE (4a). */
export function resolveRange(option: RangeOption, now: Date, customFrom = '', customTo = ''): DateRange {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  switch (option) {
    case '7d': return { start: addDays(today, -6), end: tomorrow, granularity: 'day' };
    case '30d': return { start: addDays(today, -29), end: tomorrow, granularity: 'day' };
    case '12m': return { start: addMonths(startOfMonth(today), -11), end: addMonths(startOfMonth(today), 1), granularity: 'month' };
    case 'custom': {
      const from = parseDateInput(customFrom);
      const to = parseDateInput(customTo);
      if (!from || !to || from > to || to > today) throw new AppError('INVALID_RANGE');
      const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
      return { start: from, end: addDays(to, 1), granularity: days <= MAX_DAILY_DAYS ? 'day' : 'month' };
    }
  }
}
