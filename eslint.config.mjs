import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      "node_modules/**",
      "ci-results/**",
      "coverage/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // These Node entry points intentionally use CommonJS. The campaign suite
    // also loads modules after installing its isolated environment and mocks.
    files: ["scripts/**/*.cjs", "tests/campaign-safety.test.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
