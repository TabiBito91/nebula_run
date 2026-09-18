import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' },
    // Runtime databases and browser artifacts are not source. Watching locked
    // Windows output files can stop Vite with EBUSY during inspection.
    watch: { ignored: ['**/.data/**', '**/.logs/**', '**/test-results/**', '**/playwright-report/**'] },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
})
