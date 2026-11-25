import { LIGHT_NEEDS, type LightNeed, type Species, type Threshold } from '../../../shared/catalog';
import type { ThresholdDraft } from '../../components/ThresholdFields';

export const LIGHT_LABELS: Record<LightNeed, string> = {
  LOW: 'Thấp (chịu bóng)',
  MEDIUM: 'Trung bình (ánh sáng gián tiếp)',
  HIGH: 'Cao (nhiều sáng)',
  DIRECT: 'Nắng trực tiếp',
};
export { LIGHT_NEEDS };

/** Trạng thái biểu mẫu: số giữ dạng chuỗi để người dùng gõ tự do, chuyển đổi khi validate. */
export type SpeciesDraft = {
  commonName: string; scientificName: string; aiLabel: string; imageUrl: string; imagePath: string;
  description: string; lightNeed: LightNeed | ''; wateringCycleDays: string; fertilizingCycleDays: string;
  threshold: ThresholdDraft;
};

const THRESHOLD_KEYS: (keyof Threshold)[] = [
  'soilMoistureMin', 'soilMoistureMax', 'temperatureMin', 'temperatureMax',
  'airHumidityMin', 'airHumidityMax', 'lightMin', 'lightMax',
];

const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

export function toDraft(data?: Species): SpeciesDraft {
  return {
    commonName: text(data?.commonName), scientificName: text(data?.scientificName), aiLabel: text(data?.aiLabel),
    imageUrl: text(data?.imageUrl), imagePath: text(data?.imagePath), description: text(data?.description),
    lightNeed: data?.lightNeed ?? '', wateringCycleDays: text(data?.wateringCycleDays), fertilizingCycleDays: text(data?.fertilizingCycleDays),
    threshold: Object.fromEntries(THRESHOLD_KEYS.map((k) => [k, text(data?.threshold?.[k])])) as ThresholdDraft,
  };
}

export function fromDraft(d: SpeciesDraft): Record<string, unknown> {
  return {
    ...d,
    lightNeed: d.lightNeed || undefined,
    wateringCycleDays: num(d.wateringCycleDays),
    fertilizingCycleDays: num(d.fertilizingCycleDays),
    threshold: Object.fromEntries(THRESHOLD_KEYS.map((k) => [k, num(d.threshold[k])])),
  };
}
