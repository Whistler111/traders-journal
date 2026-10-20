import { createServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const redirects = new Map([
  [
    resolve(root, "app/components/provider.tsx"),
    resolve(root, "tests/visual/provider.tsx"),
  ],
  [
    resolve(root, "app/components/auth/AuthProvider.tsx"),
    resolve(root, "tests/visual/auth.tsx"),
  ],
  ...["onboarding-tour", "verification-banner", "price-alerts"].map((name) => [
    resolve(root, `app/components/${name}.tsx`),
    resolve(root, "tests/visual/stubs.tsx"),
  ]),
]);
const server = await createServer({
  root,
  configFile: false,
  plugins: [
    {
      name: "visual-fixtures-only",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer || !source.startsWith(".")) return;
        const full = resolve(dirname(importer.split("?")[0]), source);
        return redirects.get(full) || redirects.get(full + ".tsx");
      },
      configureServer(instance) {
        instance.middlewares.use((req, _res, next) => {
          if (
            req.url &&
            !req.url.includes(".") &&
            !req.url.startsWith("/@") &&
            !req.url.startsWith("/node_modules")
          )
            req.url = "/tests/visual/index.html";
          next();
        });
      },
    },
    tailwindcss(),
  ],
  server: { host: "127.0.0.1", port: 4181, strictPort: true },
  esbuild: { jsx: "automatic" },
});
await server.listen();
console.log("Isolated visual fixture: http://127.0.0.1:4181");
