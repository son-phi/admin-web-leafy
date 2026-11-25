import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateEnvironment } from './shared/environment';
export default defineConfig(({mode}) => { if(mode !== 'test') validateEnvironment(mode, loadEnv(mode, process.cwd(), 'VITE_')); return {plugins:[react()],build:{target:'es2022'}}; });
