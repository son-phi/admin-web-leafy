// Khởi tạo controller với backend theo môi trường (mock / emulator / dev / production).
import { backend } from '../services/backend';
import { createAccountController } from './AccountController';
import { createDiseaseController } from './DiseaseController';
import { createSpeciesController } from './SpeciesController';
import { createStatisticController } from './StatisticController';

export const authService = backend.auth;
export const statisticController = createStatisticController(backend.userStat, backend.plantStat, backend.deviceStat, backend.species);
export const accountController = createAccountController(backend.users, backend.lockLogs, backend.callables);
export const speciesController = createSpeciesController(backend.species, backend.callables, backend.storage);
export const diseaseController = createDiseaseController(backend.diseases, backend.species, backend.callables, backend.storage);
