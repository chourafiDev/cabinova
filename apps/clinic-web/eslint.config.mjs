import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Icons come from react-icons only (Lucide set: "react-icons/lu").
  {
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "lucide-react", message: "Use react-icons instead (e.g. LuX from \"react-icons/lu\")." }] },
      ],
    },
  },
  // Vendored from tablecn (https://tablecn.com): the "latest ref" pattern,
  // flagged by React Compiler's refs rule. Kept as-is, like in admin-web.
  {
    files: ["src/hooks/use-debounced-callback.ts"],
    rules: { "react-hooks/refs": "off" },
  },
  // Vendored from big-calendar (https://github.com/lramos33/big-calendar, MIT,
  // see src/calendar/LICENSE). Its drag & drop and memoization patterns trip
  // React Compiler rules; kept close to upstream.
  {
    files: ["src/calendar/**"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
