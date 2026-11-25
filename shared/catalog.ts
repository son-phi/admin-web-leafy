import { z } from 'zod';

/** Thiết bị coi là trực tuyến khi now − lastSeen ≤ ngưỡng này (ADMIN_SPEC 4.2). */
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export const LIGHT_NEEDS = ['LOW', 'MEDIUM', 'HIGH', 'DIRECT'] as const;
export type LightNeed = (typeof LIGHT_NEEDS)[number];

const required = z.string().trim().min(1).max(5000);
const imageUrl = z.url({ protocol: /^https?$/ });
const docId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const ThresholdSchema = z
  .object({
    soilMoistureMin: z.number().min(0).max(100), soilMoistureMax: z.number().min(0).max(100),
    temperatureMin: z.number().min(-10).max(60), temperatureMax: z.number().min(-10).max(60),
    airHumidityMin: z.number().min(0).max(100), airHumidityMax: z.number().min(0).max(100),
    lightMin: z.number().min(0).max(100000), lightMax: z.number().min(0).max(100000),
  })
  .strict()
  .refine(
    (t) => t.soilMoistureMin <= t.soilMoistureMax && t.temperatureMin <= t.temperatureMax
      && t.airHumidityMin <= t.airHumidityMax && t.lightMin <= t.lightMax,
    { message: 'INVALID_THRESHOLD' }, // ngoại lệ 7b
  );

export const SpeciesSchema = z
  .object({ // species/{speciesId}
    commonName: required.max(200),
    scientificName: required.max(200),
    aiLabel: required.max(200), // mã nhãn trong mô hình AI
    imageUrl,
    imagePath: z.string().max(500), // để xóa ảnh trên Storage
    description: required,
    lightNeed: z.enum(LIGHT_NEEDS),
    wateringCycleDays: z.number().int().positive().max(365),
    fertilizingCycleDays: z.number().int().positive().max(365),
    threshold: ThresholdSchema,
  })
  .strict();

export const DiseaseSchema = z
  .object({ // diseases/{diseaseId}
    nameVi: required.max(200),
    scientificName: z.string().trim().max(200).nullable(),
    aiLabel: required.max(200),
    imageUrl,
    imagePath: z.string().max(500),
    affectedSpeciesIds: z.array(docId).min(1).max(100), // loài cây thường mắc
    causes: required,
    symptoms: required,
    treatmentMild: required,
    treatmentModerate: required,
    treatmentSevere: required,
    prevention: z.string().trim().max(5000).nullable(),
  })
  .strict();

export type Threshold = z.infer<typeof ThresholdSchema>;
export type Species = z.infer<typeof SpeciesSchema>;
export type Disease = z.infer<typeof DiseaseSchema>;

export const SPECIES_FIELDS = Object.keys(SpeciesSchema.shape) as (keyof Species)[];
export const DISEASE_FIELDS = Object.keys(DiseaseSchema.shape) as (keyof Disease)[];

/** Input callable: có `id` là sửa (bắt buộc kèm fingerprint), không có là thêm mới. */
export const SaveSpeciesInput = z.object({ id: docId.optional(), data: SpeciesSchema, fingerprint: z.string().optional() }).strict();
export const SaveDiseaseInput = z.object({ id: docId.optional(), data: DiseaseSchema, fingerprint: z.string().optional() }).strict();
export type SaveSpeciesRequest = z.infer<typeof SaveSpeciesInput>;
export type SaveDiseaseRequest = z.infer<typeof SaveDiseaseInput>;
export const DeleteInput = z.object({ id: docId }).strict();

/** Ảnh danh mục: jpg/png/webp, tối đa 5 MB (ngoại lệ 7d/7c), lưu tại `<folder>/<tên>.<đuôi>`. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type ImageFolder = 'species' | 'diseases';

/** Chỉ chấp nhận đường dẫn ảnh trong đúng thư mục danh mục, để callable không thể xóa file tùy ý. */
export function isImagePath(folder: ImageFolder, path: string): boolean {
  return new RegExp(`^${folder}/[A-Za-z0-9_-]{1,128}[.](jpe?g|png|webp)$`).test(path);
}

export function requireAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined): string {
  if (!auth) throw new Error('unauthenticated');
  if (auth.token.admin !== true) throw new Error('permission-denied');
  return auth.uid;
}

/** JSON có thứ tự khóa ổn định (kể cả object lồng nhau như threshold). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function pickFields<T>(fields: readonly (keyof T)[], data: Record<string, unknown>): T {
  return Object.fromEntries(fields.filter((f) => data[f as string] !== undefined).map((f) => [f, data[f as string]])) as T;
}

/** Dấu vân tay chỉ trên các trường nghiệp vụ, dùng để chống ghi đè bản sửa cũ. */
export function fingerprint(fields: readonly string[], data: Record<string, unknown>): string {
  return stableStringify(Object.fromEntries(fields.filter((f) => data[f] !== undefined).map((f) => [f, data[f]])));
}
