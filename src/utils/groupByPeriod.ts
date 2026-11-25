// Chia khoảng thời gian thành các mốc (ngày/tháng) và điền đủ giá trị 0 (kịch bản 2.2.5.1 bước 4).
import { addDays, addMonths, startOfMonth, type DateRange } from './dateRange';

export type Bucket = { label: string; start: Date; end: Date };

const p = (n: number) => String(n).padStart(2, '0');

/** Các mốc liên tiếp phủ kín [start, end); mốc tháng đầu/cuối bị cắt theo khoảng. */
export function buckets(range: DateRange): Bucket[] {
  const result: Bucket[] = [];
  if (range.granularity === 'day') {
    for (let d = range.start; d < range.end; d = addDays(d, 1)) {
      result.push({ label: `${p(d.getDate())}/${p(d.getMonth() + 1)}`, start: d, end: addDays(d, 1) });
    }
    return result;
  }
  for (let m = startOfMonth(range.start); m < range.end; m = addMonths(m, 1)) {
    const start = m < range.start ? range.start : m;
    const next = addMonths(m, 1);
    result.push({ label: `${p(m.getMonth() + 1)}/${m.getFullYear()}`, start, end: next > range.end ? range.end : next });
  }
  return result;
}

/** Gom các mốc thời gian (ms) vào bucket; bucket không có dữ liệu = 0. Dùng cho mock. */
export function countInBuckets(times: number[], list: Bucket[]): number[] {
  return list.map((b) => times.filter((t) => t >= b.start.getTime() && t < b.end.getTime()).length);
}
