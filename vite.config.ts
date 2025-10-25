import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    root: resolve(__dirname, "react"),             // use ./react as the app root
    plugins: [react()],
    server: { open: true },                         // auto-open browser
    build: {
        outDir: resolve(__dirname, "dist"),          // put build in ./dist at repo root
        emptyOutDir: true
    }
});
