import * as vscode from 'vscode';
import { Command, ConfigKey, EXTENSION_ID } from './constants';
import { AgentState } from './types';

const WARNING_BACKGROUND = new vscode.ThemeColor(
  'statusBarItem.warningBackground',
);

interface StatusPresentation {
  text: string;
  tooltip: string;
  warn: boolean;
}

/**
 * The activity bar icon cannot be animated by an extension, so the moving part
 * lives here: `$(sync~spin)` is a genuinely animated codicon in the status bar.
 */
const PRESENTATIONS: Record<AgentState, StatusPresentation | undefined> = {
  [AgentState.WORKING]: {
    text: '$(sync~spin) Claude working',
    tooltip: 'Claude is working — open Interlude while you wait',
    warn: false,
  },
  [AgentState.WAITING]: {
    text: '$(bell-dot) Claude needs you',
    tooltip: 'Claude is waiting for your input',
    warn: true,
  },
  [AgentState.FINISHED]: {
    text: '$(check) Claude done',
    tooltip: 'Claude finished its turn',
    warn: false,
  },
  [AgentState.IDLE]: undefined,
};

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    this.item.command = Command.OPEN;
  }

  render(state: AgentState): void {
    const enabled = vscode.workspace
      .getConfiguration(EXTENSION_ID)
      .get<boolean>(ConfigKey.STATUS_BAR_ENABLED, true);

    const presentation = PRESENTATIONS[state];

    if (!enabled || !presentation) {
      this.item.hide();
      return;
    }

    this.item.text = presentation.text;
    this.item.tooltip = presentation.tooltip;
    this.item.backgroundColor = presentation.warn
      ? WARNING_BACKGROUND
      : undefined;

    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
