import { defineConfig } from "astro/config";

import charm from "./charm.theme.ts";

export default defineConfig({
  prefetch: true,
  site: "https://garden.vercel.app/",
  output: "static",
  integrations: [
    charm,
  ],
});
