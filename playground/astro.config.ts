import { defineConfig } from "astro/config";

import charm from "./charm.theme.ts";

export default defineConfig({
  prefetch: true,
  site: "https://life.xuchenhui.cc/",
  output: "static",
  server: { port: 4322 },
  integrations: [
    charm,
  ],
});
