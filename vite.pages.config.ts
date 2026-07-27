import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/WorldByCode/",
  root: "github-pages",
  publicDir: "../public",
  plugins: [react()],
  define: {
    "process.env.NEXT_PUBLIC_BASE_PATH": JSON.stringify("/WorldByCode"),
    "process.env.NEXT_PUBLIC_STATIC_DEMO": JSON.stringify("true"),
  },
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
