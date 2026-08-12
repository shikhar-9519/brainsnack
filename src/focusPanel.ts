import * as vscode from 'vscode';
import { Surface } from './types';
import { FeedSession } from './feedSession';
import { buildWebviewHtml, webviewOptions } from './webviewHost';
import type { SessionDeps } from './feedSession';

const PANEL_TYPE = 'brainsnack.focus';
const PANEL_TITLE = 'BrainSnack';

/**
 * The wide surface: the same React app in a full editor tab, where the reading
 * type scale and a centred column have room to work.
 */
export class FocusPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;

  private session: FeedSession | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly deps: SessionDeps,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_TYPE,
      PANEL_TITLE,
      vscode.ViewColumn.Active,
      { ...webviewOptions(this.extensionUri), retainContextWhenHidden: true },
    );

    panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      'media',
      'icon.svg',
    );

    panel.webview.html = buildWebviewHtml(
      panel.webview,
      this.extensionUri,
      Surface.FOCUS,
    );

    this.session = new FeedSession(panel.webview, this.deps);

    panel.onDidDispose(() => {
      this.session?.dispose();
      this.session = undefined;
      this.panel = undefined;
    });

    this.panel = panel;
  }

  async refresh(): Promise<void> {
    await this.session?.refresh();
  }

  dispose(): void {
    this.session?.dispose();
    this.panel?.dispose();
  }
}
