import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Icons come from @/components/icons only (Iconsax "Bulk", plus a few
  // Lucide glyphs); that file is the one place that imports icon packages.
  {
    ignores: ["src/components/icons.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["lucide-react", "@tabler/icons-react", "react-icons", "iconsax-reactjs"].map((name) => ({
            name,
            message: "Import icons from \"@/components/icons\" (add new ones there).",
          })),
          patterns: [{ group: ["react-icons/*"], message: "Import icons from \"@/components/icons\" (add new ones there)." }],
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
