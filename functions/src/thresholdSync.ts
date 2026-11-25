// Đồng bộ ngưỡng loài cây xuống ESP32 (ADMIN_SPEC D5, kịch bản 2.2.5.3 bước 14, biểu đồ 2.3.2.3):
// findPlantsBySpecies → tìm node đang gắn với từng cây → syncThreshold vào RTDB
// `devices/{deviceId}/nodes/{nodeId}/config/thresholds`. ESP32 ngoại tuyến tự nhận khi kết nối lại (14a).
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { ThresholdSchema, stableStringify, type Threshold } from '../../shared/catalog.js';

/** Firestore giới hạn toán tử `in` tối đa 30 giá trị mỗi truy vấn. */
const IN_LIMIT = 30;

type PlantRef = { id: string; userId: string | null };
type NodeTarget = { deviceId: string; nodeId: string };

export function thresholdChanged(before: unknown, after: unknown): boolean {
  return stableStringify(before ?? null) !== stableStringify(after ?? null);
}

/** findPlantsBySpecies: cây người dùng thuộc loài và đang dùng ngưỡng theo loài. */
async function findPlantsBySpecies(speciesId: string): Promise<PlantRef[]> {
  const snap = await getFirestore()
    .collectionGroup('plants')
    .where('speciesId', '==', speciesId)
    .where('useSpeciesThresholds', '==', true)
    .get();
  // users/{uid}/plants/{plantId} → userId để đối chiếu node của đúng người dùng.
  return snap.docs.map((d) => ({ id: d.id, userId: d.ref.parent.parent?.id ?? null }));
}

/** Node ESP32 đang gắn với các cây (collection group `nodes` where plantId in …). */
async function findNodes(plants: PlantRef[]): Promise<NodeTarget[]> {
  const owner = new Map(plants.map((p) => [p.id, p.userId]));
  const ids = [...owner.keys()];
  const targets: NodeTarget[] = [];
  for (let i = 0; i < ids.length; i += IN_LIMIT) {
    const snap = await getFirestore()
      .collectionGroup('nodes')
      .where('plantId', 'in', ids.slice(i, i + IN_LIMIT))
      .get();
    for (const node of snap.docs) {
      const deviceId = node.ref.parent.parent?.id;
      const plantId = String(node.get('plantId'));
      const nodeUser = node.get('userId');
      // Mã cây chỉ duy nhất trong phạm vi một người dùng: bỏ qua node của người dùng khác nếu node có userId.
      if (!deviceId || (typeof nodeUser === 'string' && owner.get(plantId) && nodeUser !== owner.get(plantId))) continue;
      targets.push({ deviceId, nodeId: node.id });
    }
  }
  return targets;
}

/** syncThreshold: ghi một lần (multi-path update) cho mọi node bị ảnh hưởng. */
async function syncThreshold(targets: NodeTarget[], threshold: Threshold) {
  if (!targets.length) return;
  const updates = Object.fromEntries(
    targets.map((t) => [`devices/${t.deviceId}/nodes/${t.nodeId}/config/thresholds`, threshold]),
  );
  await getDatabase().ref().update(updates);
}

/** Trả về số node đã đồng bộ (0 nếu ngưỡng không đổi hoặc không hợp lệ). */
export async function syncSpeciesThreshold(speciesId: string, before: unknown, after: unknown): Promise<number> {
  if (!thresholdChanged(before, after)) return 0;
  const parsed = ThresholdSchema.safeParse(after);
  if (!parsed.success) {
    logger.warn('Bỏ qua đồng bộ: ngưỡng không hợp lệ', { speciesId });
    return 0;
  }
  const plants = await findPlantsBySpecies(speciesId);
  if (!plants.length) return 0;
  const targets = await findNodes(plants);
  await syncThreshold(targets, parsed.data);
  logger.info('Đã đồng bộ ngưỡng loài cây', { speciesId, plants: plants.length, nodes: targets.length });
  return targets.length;
}

