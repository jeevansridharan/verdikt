import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CASPER_RPC_TARGET = 'https://node.testnet.casper.network'

const casperRpcProxy = {
  '/casper-rpc': {
    target: CASPER_RPC_TARGET,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/casper-rpc/, '/rpc'),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: casperRpcProxy,
  },
  preview: {
    proxy: casperRpcProxy,
  },
})
