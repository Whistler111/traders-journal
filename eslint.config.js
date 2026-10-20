import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default ts.config(
  {
    ignores: [
      "node_modules/**",
      ".security-tools/**",
      ".emulator-cache/**",
      "build/**",
      ".react-router/**",
      ".reference/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
