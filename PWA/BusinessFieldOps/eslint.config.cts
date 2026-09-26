import js from "@eslint/js";
import globals from "globals";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
	baseDirectory: __dirname,
});


let hasIgnoresFile = false;
try {
  require.resolve("./eslint.ignores.js");
  hasIgnoresFile = true;
} catch {
  // eslint.ignores.js doesn't exist
}

const gtsIgnores = hasIgnoresFile
  ? [{ ignores: require("./eslint.ignores.js") }]
  : [];

const gts = require("gts");
const {default: preact} = require("eslint-config-preact");

export default defineConfig([
  ...gtsIgnores,
  ...gts,
  ...compat.config(preact.__esModule),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
]);