import type { PersistedState } from "./types.js";

// ===================================================================
// Fayl-əsaslı state saxlama. DataLayer/ExecutionEngine konvensiyası ilə
// eyni: fayl sistemi əməliyyatları (`readFile`/`writeFile`) inject olunur
// — testlərdə real diskə toxunmadan saxta implementasiya verilə bilsin.
// ===================================================================

export interface StatePersistenceDeps {
  /** Fayl yoxdursa null qaytarır (xəta atmır) — yalnız KORLANMIŞ fayl xəta atır */
  readFile: (path: string) => Promise<string | null>;
  writeFile: (path: string, content: string) => Promise<void>;
}

export class FileStatePersistence {
  constructor(private filePath: string, private deps: StatePersistenceDeps) {}

  /**
   * @throws Fayl mövcuddur amma JSON kimi parse olunmursa (korlanmış state —
   * sənəd, bölmə 13: "If restoration fails — HALT + report"). Çağıran bunu
   * tutub sistemi HALT vəziyyətinə keçirməlidir, sükutla adi başlanğıca keçməməlidir.
   */
  async load(): Promise<PersistedState | null> {
    const content = await this.deps.readFile(this.filePath);
    if (content === null) return null;
    try {
      return JSON.parse(content) as PersistedState;
    } catch (err) {
      throw new Error(`State faylı korlanıb (${this.filePath}): ${String(err)}`);
    }
  }

  async save(state: PersistedState): Promise<void> {
    await this.deps.writeFile(this.filePath, JSON.stringify(state, null, 2));
  }
}
