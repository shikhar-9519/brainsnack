import * as vscode from 'vscode';
import { AgentState } from './types';

/**
 * Single source of truth for what Claude is currently doing. Fed by the hook
 * server; consumed by the status bar, the sound player, and the webview.
 */
export class AgentStateStore implements vscode.Disposable {
  private state: AgentState = AgentState.IDLE;

  private readonly emitter = new vscode.EventEmitter<AgentState>();

  readonly onDidChange = this.emitter.event;

  get current(): AgentState {
    return this.state;
  }

  set(next: AgentState): void {
    if (next === this.state) {
      return;
    }

    this.state = next;

    this.emitter.fire(next);
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
