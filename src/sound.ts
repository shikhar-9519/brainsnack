import { execFile } from 'node:child_process';
import * as vscode from 'vscode';
import { ConfigKey, EXTENSION_ID } from './constants';
import type { Logger } from './logger';

const Platform = {
  MAC: 'darwin',
  WINDOWS: 'win32',
} as const;

const MAC_DEFAULTS = {
  waiting: '/System/Library/Sounds/Glass.aiff',
  finished: '/System/Library/Sounds/Submarine.aiff',
} as const;

export const SoundEvent = {
  WAITING: 'waiting',
  FINISHED: 'finished',
} as const;

export type SoundEvent = (typeof SoundEvent)[keyof typeof SoundEvent];

function run(command: string, args: string[]): void {
  // Fire and forget — a missing player must never surface as an error toast.
  execFile(command, args, () => undefined);
}

function playWindows(file: string | undefined): void {
  const script = file
    ? `(New-Object Media.SoundPlayer '${file.replace(/'/g, "''")}').PlaySync()`
    : '[console]::beep(880,200)';

  run('powershell', ['-NoProfile', '-Command', script]);
}

function playLinux(file: string | undefined): void {
  if (!file) {
    process.stdout.write('');
    return;
  }

  execFile('paplay', [file], error => {
    if (error) {
      run('aplay', [file]);
    }
  });
}

/**
 * Played from the extension host rather than the webview: the webview may be
 * closed or disposed at exactly the moment the sound matters most.
 */
export class SoundPlayer {
  constructor(private readonly output: Logger) {}

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(EXTENSION_ID);
  }

  private resolveFile(event: SoundEvent): string | undefined {
    const key =
      event === SoundEvent.WAITING
        ? ConfigKey.SOUND_ON_WAITING
        : ConfigKey.SOUND_ON_FINISHED;

    const configured = this.config().get<string>(key, '').trim();

    if (configured) {
      return configured;
    }

    if (process.platform === Platform.MAC) {
      return MAC_DEFAULTS[event];
    }

    return undefined;
  }

  play(event: SoundEvent): void {
    if (!this.config().get<boolean>(ConfigKey.SOUND_ENABLED, true)) {
      return;
    }

    const file = this.resolveFile(event);

    this.output.log(`Playing ${event} sound (${file ?? 'system beep'})`);

    if (process.platform === Platform.MAC && file) {
      run('afplay', [file]);
      return;
    }

    if (process.platform === Platform.WINDOWS) {
      playWindows(file);
      return;
    }

    playLinux(file);
  }
}
