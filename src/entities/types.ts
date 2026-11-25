export const PAGE_SIZE = 10;

/** `filter`: bộ lọc bổ sung tùy danh sách (vd. id loài cây khi lọc bệnh theo loài). */
export type PageRequest = { search: string; cursor?: unknown; filter?: string };
export type Page<T> = { items: T[]; cursor: unknown; more: boolean };
