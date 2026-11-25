import { createMockLockLogRepository } from '../entities/AccountLockLogRepository';
import { createMockDiseaseRepository } from '../entities/DiseaseRepository';
import { MockStore } from '../entities/mock/store';
import { createMockSpeciesRepository } from '../entities/SpeciesRepository';
import { createMockDeviceStat } from '../entities/stats/DeviceStat';
import { createMockPlantStat } from '../entities/stats/PlantStat';
import { createMockUserStat } from '../entities/stats/UserStat';
import { createMockUserRepository } from '../entities/UserRepository';
import { AppError } from '../utils/messages';
import { createMockAuth } from './auth';
import type { Backend } from './backend';
import { createMockCallables } from './callables';
import { createMockStorage } from './storage';

export function createMockBackend(): Backend {
  const store = new MockStore();
  const auth = createMockAuth();
  const requireAdmin = () => {
    const session = auth.current();
    if (!session?.admin) throw new AppError('PERMISSION_DENIED');
    return session.uid;
  };
  const assertAdmin = () => { requireAdmin(); };
  return {
    auth,
    callables: createMockCallables(store, requireAdmin),
    storage: createMockStorage(),
    species: createMockSpeciesRepository(store, assertAdmin),
    diseases: createMockDiseaseRepository(store, assertAdmin),
    users: createMockUserRepository(store, assertAdmin),
    lockLogs: createMockLockLogRepository(store, assertAdmin),
    userStat: createMockUserStat(store, assertAdmin),
    plantStat: createMockPlantStat(store, assertAdmin),
    deviceStat: createMockDeviceStat(store, assertAdmin),
  };
}
