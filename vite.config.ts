import { defineConfig } from "vite";

const base = process.env.GITHUB_PAGES === "true" ? "/color-test/" : "/";

export default defineConfig({
  base,
});
