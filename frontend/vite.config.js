import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// En développement, les appels à /api sont redirigés vers l'API Express (port 3000) :
// pas de problème de CORS, et le frontend n'a pas besoin de connaître l'adresse de l'API.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
