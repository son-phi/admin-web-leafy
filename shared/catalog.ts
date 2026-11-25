import { z } from 'zod';
const text = z.string().trim().max(10000);
const id = z.number().int().min(1).max(2147483647);
export const plantSchema = z.object({id,name:text.min(1).max(200),scientificName:text.max(200),description:text,light:text,watering:text,soil:text,fertilizer:text,temperature:text,humidity:text,image:z.union([z.literal(''),z.url().refine(v=>v.startsWith('https://'),'URL ảnh phải dùng HTTPS')]),popularity:z.number().int().min(0).max(2147483647)}).strict();
export const diseaseSchema = z.object({id,diseaseName:text.min(1).max(200),reasons:z.array(text.min(1)).max(50),solutions:z.array(text.min(1)).max(50),plants:z.array(text.min(1).max(200)).max(100)}).strict();
export const mutationSchema = z.discriminatedUnion('collection', [z.object({collection:z.literal('plants'),operation:z.enum(['create','update']),data:plantSchema,expected:z.string().nullable()} ).strict(),z.object({collection:z.literal('diseases'),operation:z.enum(['create','update']),data:diseaseSchema,expected:z.string().nullable()}).strict()]);
export type Mutation = z.infer<typeof mutationSchema>;
export function requireAdmin(auth: {uid:string;token:Record<string,unknown>}|undefined) { if(!auth) throw new Error('unauthenticated'); if(auth.token.admin !== true) throw new Error('permission-denied'); return auth.uid; }
export const fingerprint = (data: Record<string,unknown>): string => JSON.stringify(Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b))));
