import * as vscode from 'vscode';
import { VIEW_ID } from './constants';
import { Surface } from './types';
import { FeedSession } from './feedSession';
import { buildWebviewHtml, webviewOptions } from './webviewHost';
import type { SessionDeps } from './feedSession';

export class FeedViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = VIEW_ID;

  private view: vscode.WebviewView | undefined;

  private session: FeedSession | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly deps: SessionDeps,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;

    view.webview.options = webviewOptions(this.extensionUri);

    view.webview.html = buildWebviewHtml(
      view.webview,
      this.extensionUri,
      Surface.SIDEBAR,
    );

    this.session?.dispose();
    this.session = new FeedSession(view.webview, this.deps);

    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this.clearBadge();
      }
    });
  }

  /**
   * A badge on the activity bar icon is the closest an extension can get to the
   * blinking dot — the icon itself is declared statically and cannot animate.
   */
  setUnreadBadge(): void {
    const view = this.view;

    if (!view || view.visible) {
      return;
    }

    view.badge = { value: 1, tooltip: 'Claude needs your input' };
  }

  private clearBadge(): void {
    if (this.view) {
      this.view.badge = undefined;
    }
  }

  async refresh(): Promise<void> {
    await this.session?.refresh();
  }

  reveal(): void {
    void vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  /**
   * Auto-open must never steal the cursor — the user is usually mid-keystroke
   * when the agent starts working. `show(true)` preserves focus; the focus
   * command is only needed the first time, to instantiate the view at all.
   */
  async revealWithoutStealingFocus(): Promise<void> {
    const view = this.view;

    if (view) {
      view.show(true);
      return;
    }

    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  dispose(): void {
    this.session?.dispose();
  }
}
