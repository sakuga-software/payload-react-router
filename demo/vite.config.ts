import { unstable_reactRouterRSC as reactRouterRSC } from '@react-router/dev/vite'
import rsc from '@vitejs/plugin-rsc'
import { payload } from 'payload-react-router/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [payload({ payloadConfigPath: './payload.config.ts' }), reactRouterRSC(), rsc()],
  server: { port: 3000 },
})
