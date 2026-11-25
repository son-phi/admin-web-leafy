import type { ZodType } from 'zod';
import { isMsgKey } from '../../shared/messages';
import { MSG, type MsgKey } from './messages';

type Issue = { code: string; path: PropertyKey[]; message: string; origin?: string; expected?: string; format?: string; minimum?: unknown; maximum?: unknown };

/** Lỗi validate phía web: `fields` là thông báo theo đường dẫn trường (ngoại lệ 7a), `key` là lỗi cấp biểu mẫu. */
export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>, public readonly key?: MsgKey) {
    super(key ? MSG[key] : 'Vui lòng kiểm tra các trường được đánh dấu');
    this.name = 'ValidationError';
  }
}

function fieldMessage(issue: Issue): string {
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return 'Bắt buộc nhập';
      if (issue.origin === 'array') return 'Chọn ít nhất 1 mục';
      return `Tối thiểu ${String(issue.minimum)}`;
    case 'too_big':
      return issue.origin === 'string' ? 'Quá dài' : `Tối đa ${String(issue.maximum)}`;
    case 'invalid_type':
      if (issue.expected === 'int') return 'Phải là số nguyên';
      if (issue.expected === 'number') return 'Phải là số';
      return 'Bắt buộc nhập';
    case 'invalid_format':
      return issue.format === 'url' ? 'URL không hợp lệ' : 'Định dạng không hợp lệ';
    case 'invalid_value':
      return 'Vui lòng chọn một giá trị';
    default:
      return 'Giá trị không hợp lệ';
  }
}

export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  let key: MsgKey | undefined;
  for (const issue of result.error.issues as Issue[]) {
    if (isMsgKey(issue.message)) { key = issue.message; continue; }
    const path = issue.path.map(String).join('.');
    fields[path] ??= fieldMessage(issue);
  }
  throw new ValidationError(fields, key);
}
