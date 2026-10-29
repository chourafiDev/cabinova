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
        {
          paths: [
            { name: "lucide-react", message: "Use react-icons instead (e.g. LuX from \"react-icons/lu\")." },
            { name: "@tabler/icons-react", message: "Use react-icons instead (e.g. TbX from \"react-icons/tb\")." },
          ],
        },
      ],
    },
  },
  // Vendored from Aceternity UI (https://ui.aceternity.com), kept close to
  // upstream so updates stay easy to apply.
  {
    files: ["src/components/ui/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
