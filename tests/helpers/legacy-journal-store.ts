// Test-only compatibility fixture for the pre-Firebase version-1 device journal.
import { KEY, parseBackup, type Trade } from "../../app/lib/journal";
import {
  emptyPractice,
  validatePractice,
  type Practice,
} from "../../app/lib/practice";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class JournalStore {
  trades: Trade[] = [];
  raw: string | null = null;
  failed = false;
  practice: Practice = emptyPractice();
  constructor(private storage: StorageLike) {}
  load() {
    try {
      this.raw = this.storage.getItem(KEY);
      const data = this.raw === null ? null : JSON.parse(this.raw);
      this.trades = data === null ? [] : parseBackup(data);
      this.practice =
        data?.practice === undefined
          ? emptyPractice()
          : validatePractice(data.practice);
      this.failed = false;
      return this.trades;
    } catch {
      this.failed = true;
      throw Error(
        "Saved journal could not be read. Saving is blocked to protect it. Download the raw data before restoring a valid backup.",
      );
    }
  }
  commit(next: Trade[], restore = false, practice: Practice = this.practice) {
    if (this.failed && !restore)
      throw Error(
        "Restore a valid backup before saving; unreadable saved data is protected.",
      );
    parseBackup({ version: 1, trades: next });
    validatePractice(practice);
    const current = this.storage.getItem(KEY);
    if (!restore && current !== this.raw)
      throw Error(
        "Journal changed in another tab. Reload before editing to avoid overwriting newer trades.",
      );
    const serialized = JSON.stringify({
      version: 1,
      trades: next,
      ...(practice.playbooks.length || practice.reflections.length
        ? { practice }
        : {}),
    });
    this.storage.setItem(KEY, serialized);
    this.raw = serialized;
    this.trades = next;
    this.practice = practice;
    this.failed = false;
    return next;
  }
  save(trade: Trade, editing: boolean) {
    const existing = this.trades.find((t) => t.id === trade.id);
    if (editing && !existing)
      throw Error("This trade no longer exists. Reload your journal.");
    if (!editing && existing) throw Error("This trade has already been saved.");
    return this.commit(
      editing
        ? this.trades.map((t) => (t.id === trade.id ? { ...t, ...trade } : t))
        : [...this.trades, trade],
    );
  }
  delete(id: string) {
    return this.commit(this.trades.filter((t) => t.id !== id));
  }
}
