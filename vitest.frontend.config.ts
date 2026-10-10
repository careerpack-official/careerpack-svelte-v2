import { defineConfig } from "vitest/config";
import config from "./vitest.config";

// Compile component tests without changing the existing domain coverage scope.
export default defineConfig({
  ...config,
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    ...config.test,
    include: ["frontend/**/*.spec.tsx"],
    coverage: { ...config.test?.coverage, enabled: false },
  },
});
