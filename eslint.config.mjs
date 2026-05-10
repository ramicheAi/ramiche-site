import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static / vendored trees (not Next app source)
    "public/projects/**",
    "public/yolo-builds/**",
  ]),
  {
    rules: {
      // Downgrade React Compiler rules to warnings — too strict for current codebase
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/rules-of-hooks": "error",
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
