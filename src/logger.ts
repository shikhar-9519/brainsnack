import * as vscode from 'vscode';

/**
 * Timestamps every line. Without them there is no way to tell whether a delay
 * is ours or upstream in when Claude Code fires the hook.
 */
export class Logger implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  log(message: string): void {
    const stamp = new Date().toISOString().slice(11, 23);

    this.channel.appendLine(`[${stamp}] ${message}`);
  }

  /** For multi-line reports, where per-line stamps would be noise. */
  raw(message: string): void {
    this.channel.appendLine(message);
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
