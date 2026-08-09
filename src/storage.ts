import * as vscode from 'vscode';
import { StorageKey } from './constants';
import type { Feed } from './types';

/**
 * All user state lives in globalState. There is no backend in this phase, so
 * saves and dismissals are per-machine.
 */
export class Storage {
  constructor(private readonly memento: vscode.Memento) {}

  private getIds(key: string): string[] {
    return this.memento.get<string[]>(key, []);
  }

  private async setIds(key: string, ids: string[]): Promise<void> {
    await this.memento.update(key, ids);
  }

  getSavedIds(): string[] {
    return this.getIds(StorageKey.SAVED_IDS);
  }

  getReadIds(): string[] {
    return this.getIds(StorageKey.READ_IDS);
  }

  getDismissedIds(): string[] {
    return this.getIds(StorageKey.DISMISSED_IDS);
  }

  async toggleSaved(id: string): Promise<boolean> {
    const saved = new Set(this.getSavedIds());

    const wasSaved = saved.delete(id);

    if (!wasSaved) {
      saved.add(id);
    }

    await this.setIds(StorageKey.SAVED_IDS, [...saved]);

    return !wasSaved;
  }

  async markRead(id: string): Promise<void> {
    const read = new Set(this.getReadIds());

    if (read.has(id)) {
      return;
    }

    read.add(id);

    await this.setIds(StorageKey.READ_IDS, [...read]);
  }

  async dismiss(id: string): Promise<void> {
    const dismissed = new Set(this.getDismissedIds());

    dismissed.add(id);

    await this.setIds(StorageKey.DISMISSED_IDS, [...dismissed]);
  }

  getCachedFeed(): Feed | undefined {
    return this.memento.get<Feed>(StorageKey.CACHED_FEED);
  }

  async setCachedFeed(feed: Feed): Promise<void> {
    await this.memento.update(StorageKey.CACHED_FEED, feed);
  }
}
