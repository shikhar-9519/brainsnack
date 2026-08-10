import * as vscode from 'vscode';
import { ConfigKey, EXTENSION_ID } from './constants';
import {
  ALL_CARD_TYPES,
  ALL_TRACKS,
  InboundMessage,
  OutboundMessage,
} from './types';
import type {
  AboutInfo,
  AgentState,
  Card,
  CardType,
  Track,
  WebviewInitPayload,
} from './types';
import type { AgentStateStore } from './agentState';
import type { FeedLoader } from './feedLoader';
import type { Logger } from './logger';
import type { Storage } from './storage';

interface InboundPayload {
  type: string;
  id?: string;
  url?: string;
  interests?: CardType[];
  tracks?: Track[];
}

export interface SessionDeps {
  about: AboutInfo;
  loader: FeedLoader;
  storage: Storage;
  agentState: AgentStateStore;
  output: Logger;
  openFocus: () => void;
}

/**
 * Drives one webview. The sidebar view and the focus-mode panel each own an
 * instance, so both stay live and in sync without duplicating any logic.
 */
export class FeedSession implements vscode.Disposable {
  private cards: Card[] = [];

  private feedGeneratedAt = '';

  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly webview: vscode.Webview,
    private readonly deps: SessionDeps,
  ) {
    this.disposables.push(
      webview.onDidReceiveMessage((message: InboundPayload) =>
        this.handleMessage(message),
      ),
      deps.agentState.onDidChange(state => this.postAgentState(state)),
    );
  }

  private post(type: string, payload: unknown): void {
    void this.webview.postMessage({ type, payload });
  }

  private postAgentState(state: AgentState): void {
    this.post(OutboundMessage.AGENT_STATE, state);
  }

  /**
   * Settings persist across upgrades, so a value retired from the enum (an old
   * card type, say) survives in the user's config and would otherwise render as
   * a blank tab. Anything unrecognised is dropped; an empty result falls back
   * to the full set rather than showing nothing.
   */
  private sanitise<T extends string>(stored: T[], known: T[]): T[] {
    const valid = stored.filter(value => known.includes(value));

    return valid.length > 0 ? valid : known;
  }

  private buildInitPayload(): WebviewInitPayload {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    return {
      cards: this.cards,
      savedIds: this.deps.storage.getSavedIds(),
      readIds: this.deps.storage.getReadIds(),
      interests: this.sanitise(
        config.get<CardType[]>(ConfigKey.INTERESTS, [...ALL_CARD_TYPES]),
        ALL_CARD_TYPES,
      ),
      tracks: this.sanitise(
        config.get<Track[]>(ConfigKey.TRACKS, [...ALL_TRACKS]),
        ALL_TRACKS,
      ),
      about: this.deps.about,
      feedGeneratedAt: this.feedGeneratedAt,
      removeAfterSeconds: config.get<number>(ConfigKey.REMOVE_AFTER_SECONDS, 10),
      agentState: this.deps.agentState.current,
    };
  }

  private async handleMessage(message: InboundPayload): Promise<void> {
    const { storage, output, openFocus } = this.deps;

    switch (message.type) {
      case InboundMessage.READY:
      case InboundMessage.REFRESH:
        await this.refresh();
        return;

      case InboundMessage.TOGGLE_SAVE:
        if (message.id) {
          await storage.toggleSaved(message.id);
          this.post(OutboundMessage.SAVED_CHANGED, storage.getSavedIds());
        }
        return;

      case InboundMessage.MARK_READ:
        if (message.id) {
          await storage.markRead(message.id);
        }
        return;

      case InboundMessage.DISMISS:
        if (message.id) {
          await storage.dismiss(message.id);
        }
        return;

      case InboundMessage.OPEN_EXTERNAL:
        await this.openExternal(message.url);
        return;

      case InboundMessage.OPEN_FOCUS:
        openFocus();
        return;

      // Deep-links to the native settings editor rather than reimplementing
      // it, so the two cannot drift apart.
      case InboundMessage.OPEN_SETTINGS:
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          `@ext:${this.deps.about.publisherId}`,
        );
        return;

      case InboundMessage.SET_INTERESTS:
        await this.updateSetting(ConfigKey.INTERESTS, message.interests);
        return;

      case InboundMessage.SET_TRACKS:
        await this.updateSetting(ConfigKey.TRACKS, message.tracks);
        return;

      default:
        output.log(`Unknown webview message: ${message.type}`);
    }
  }

  /** Card URLs come from generated content, so only http(s) is ever opened. */
  private async openExternal(url: string | undefined): Promise<void> {
    if (!url) {
      return;
    }

    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      this.deps.output.log(`Refused to open malformed URL: ${url}`);
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      this.deps.output.log(`Refused to open non-web URL: ${url}`);
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(parsed.toString()));
  }

  /**
   * Filters live in settings rather than webview state so the sidebar and the
   * focus panel cannot drift apart, and the choice survives a reload.
   */
  private async updateSetting(
    key: string,
    value: string[] | undefined,
  ): Promise<void> {
    if (!value) {
      return;
    }

    await vscode.workspace
      .getConfiguration(EXTENSION_ID)
      .update(key, value, vscode.ConfigurationTarget.Global);

    await this.refresh();
  }

  async refresh(): Promise<void> {
    const feed = await this.deps.loader.load();

    this.feedGeneratedAt = feed.generatedAt;

    this.cards = this.deps.loader.visibleCards(feed);

    this.post(OutboundMessage.INIT, this.buildInitPayload());
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
