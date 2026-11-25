import { validateEnvironment } from '../../shared/environment';

export const environment = validateEnvironment(import.meta.env.MODE, import.meta.env);
