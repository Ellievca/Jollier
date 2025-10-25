import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    root: 'react',
    server: { port: 5173 },      // optional
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    publicDir: '../public'       // optional, if you keep public/ at project root
})
