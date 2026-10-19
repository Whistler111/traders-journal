import { existsSync, readFileSync, statSync } from "node:fs";
import { validAnimation } from "../app/lib/lottie.ts";
const types = ["success", "profit", "loss", "milestone", "empty", "loading"];
for (const type of types) {
  const path = `public/lottie/${type}.json`;
  if (!existsSync(path)) {
    console.log(`Optional artwork missing (static fallback): ${path}`);
    continue;
  }
  if (statSync(path).size >= 102400)
    throw Error(`${path} must be under 100 KB.`);
  if (!validAnimation(JSON.parse(readFileSync(path, "utf8"))))
    throw Error(
      `${path} must be valid, self-contained vector Lottie without external assets or expressions.`,
    );
}
