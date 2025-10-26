import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // allow external/localhost access
    strictPort: true,  // fail if port is busy (clear error signal)
    port: 5173,        // standard Vite port
  },
});
