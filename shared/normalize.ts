/** Chuẩn hóa để tìm theo tiền tố (D8): chữ thường, bỏ dấu tiếng Việt, gộp khoảng trắng. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_PREFIX = 40;

/**
 * Mọi tiền tố (chuẩn hóa) của từng tên, để tìm tiền tố trên NHIỀU trường bằng một truy vấn
 * `array-contains` (vd. tên thông thường hoặc tên khoa học của loài cây).
 */
export function searchPrefixes(...names: (string | null | undefined)[]): string[] {
  const result = new Set<string>();
  for (const name of names) {
    const value = normalizeSearch(name ?? '').slice(0, MAX_PREFIX);
    for (let i = 1; i <= value.length; i++) result.add(value.slice(0, i));
  }
  return [...result];
}
