import { validateEnvironment } from '../../shared/environment';
export const environment=validateEnvironment(import.meta.env.MODE,import.meta.env);
export const repository=environment.kind==='mock'?(await import('./mock')).createMock():(await import('./firebase')).createFirebase();
