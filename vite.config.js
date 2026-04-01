import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const srcDir = fileURLToPath(new URL("./src", import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": srcDir,
        },
    },
    server: {
        port: 3000,
        host: true,
    },
    build: {
        outDir: "dist",
        assetsDir: "assets",
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom"],
                },
            },
        },
    },
    preview: {
        port: 3000,
        host: true,
    },
});
