import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cloudflare } from '@cloudflare/vite-plugin';
import * as compiler from 'vue/compiler-sfc';
export default defineConfig(({ mode }) => ({
  plugins: [vue({ compiler }), cloudflare({ remoteBindings: false, persistState: mode === 'e2e' ? { path: '.wrangler/e2e' } : true, inspectorPort: false })],
}));
