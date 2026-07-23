import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

let loaded = false;

export function loadRootEnv(): void {
  if (loaded) {
    return;
  }

  for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
    if (existsSync(candidate)) {
      config({ path: candidate, quiet: true });
      loaded = true;
      return;
    }
  }

  loaded = true;
}
