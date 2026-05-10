import { defineConfig } from "astro/config";

import charm from "./charm.theme.ts";

export default defineConfig({
  prefetch: true,
  site: "https://haibarai.dpdns.org/",
  output: "static",
  integrations: [
    charm,
  ],
});
