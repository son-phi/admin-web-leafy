// Chọn bản cài đặt theo môi trường. Chế độ mock KHÔNG import services/firebase.ts nên không khởi tạo Firebase.
import type { AccountLockLogRepository } from '../entities/AccountLockLogRepository';
import type { DiseaseRepository } from '../entities/DiseaseRepository';
import type { SpeciesRepository } from '../entities/SpeciesRepository';
import type { DeviceStat } from '../entities/stats/DeviceStat';
import type { PlantStat } from '../entities/stats/PlantStat';
import type { UserStat } from '../entities/stats/UserStat';
import type { UserRepository } from '../entities/UserRepository';
import type { AuthService } from './auth';
import type { Callables } from './callables';
import type { StorageService } from './storage';
import { environment } from './environment';

export type Backend = {
  auth: AuthService;
  callables: Callables;
  storage: StorageService;
  species: SpeciesRepository;
  diseases: DiseaseRepository;
  users: UserRepository;
  lockLogs: AccountLockLogRepository;
  userStat: UserStat;
  plantStat: PlantStat;
  deviceStat: DeviceStat;
};

export const backend: Backend = environment.kind === 'mock'
  ? (await import('./backendMock')).createMockBackend()
  : (await import('./backendFirebase')).createFirebaseBackend();
