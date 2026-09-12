import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    assetsInclude: ['**/*.glb'],
    define: {
      __AGNES_API_KEY__: JSON.stringify(env.AGNES_API_KEY ?? ''),
      __AGNES_MODEL__: JSON.stringify(env.AGNES_MODEL || 'agnes-2.5-flash'),
    },
  }
})
