import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { StatePersistenceDeps } from "./filePersistence.js";

export function createNodeFsStateDeps(): StatePersistenceDeps {
  return {
    async readFile(path) {
      try {
        return await fsReadFile(path, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async writeFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await fsWriteFile(path, content, "utf-8");
    },
  };
}
