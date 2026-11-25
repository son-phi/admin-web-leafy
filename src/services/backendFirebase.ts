import { createFirebaseLockLogRepository } from '../entities/AccountLockLogRepository';
import { createFirebaseDiseaseRepository } from '../entities/DiseaseRepository';
import { createFirebaseSpeciesRepository } from '../entities/SpeciesRepository';
import { createFirebaseDeviceStat } from '../entities/stats/DeviceStat';
import { createFirebasePlantStat } from '../entities/stats/PlantStat';
import { createFirebaseUserStat } from '../entities/stats/UserStat';
import { createFirebaseUserRepository } from '../entities/UserRepository';
import { createFirebaseAuth } from './auth';
import type { Backend } from './backend';
import { createFirebaseCallables } from './callables';
import { auth, db, functions, rtdb, storage } from './firebase';
import { createFirebaseStorage } from './storage';

export function createFirebaseBackend(): Backend {
  return {
    auth: createFirebaseAuth(auth),
    callables: createFirebaseCallables(functions),
    storage: createFirebaseStorage(storage),
    species: createFirebaseSpeciesRepository(db),
    diseases: createFirebaseDiseaseRepository(db),
    users: createFirebaseUserRepository(db),
    lockLogs: createFirebaseLockLogRepository(db),
    userStat: createFirebaseUserStat(db),
    plantStat: createFirebasePlantStat(db),
    deviceStat: createFirebaseDeviceStat(db, rtdb),
  };
}
