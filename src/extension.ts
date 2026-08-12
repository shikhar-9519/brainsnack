import * as vscode from 'vscode';
import { AgentStateStore } from './agentState';
import { Command, ConfigKey, EXTENSION_ID } from './constants';
import { FeedLoader } from './feedLoader';
import { FeedViewProvider } from './feedView';
import { FocusPanel } from './focusPanel';
import type { SessionDeps } from './feedSession';
import { HookServer } from './hookServer';
import { Logger } from './logger';
import { inspectHooks, installHooks, uninstallHooks } from './hookInstaller';
import { SoundPlayer, SoundEvent } from './sound';
import { StatusBar } from './statusBar';
import { Storage } from './storage';
import { AgentState } from './types';
import type { AboutInfo } from './types';

const MINUTE_MS = 60_000;

/**
 * Everything the About panel shows comes from package.json, so there is one
 * place to change the author link or the repo and no risk of the panel
 * disagreeing with the manifest.
 */
function buildAbout(context: vscode.ExtensionContext): AboutInfo {
  const pkg = context.extension.packageJSON as {
    version?: string;
    publisher?: string;
    name?: string;
    author?: { name?: string; url?: string };
    repository?: { url?: string };
    bugs?: { url?: string };
  };

  const repositoryUrl = (pkg.repository?.url ?? '').replace(/\.git$/, '');

  return {
    version: pkg.version ?? '0.0.0',
    publisherId: `${pkg.publisher ?? ''}.${pkg.name ?? ''}`,
    authorName: pkg.author?.name ?? '',
    authorUrl: pkg.author?.url ?? '',
    repositoryUrl,
    issuesUrl: pkg.bugs?.url ?? `${repositoryUrl}/issues`,
  };
}

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(EXTENSION_ID);
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const output = new Logger('BrainSnack');

  const storage = new Storage(context.globalState);
  const agentState = new AgentStateStore();
  const statusBar = new StatusBar();
  const sound = new SoundPlayer(output);
  const hookServer = new HookServer(agentState, output);

  const seedPath = vscode.Uri.joinPath(
    context.extensionUri,
    'content',
    'seed-feed.json',
  );

  const loader = new FeedLoader(seedPath, storage, output);

  // Declared before the deps object so both surfaces can trigger focus mode.
  let focusPanel: FocusPanel | undefined;

  const deps: SessionDeps = {
    about: buildAbout(context),
    loader,
    storage,
    agentState,
    output,
    openFocus: () => focusPanel?.show(),
  };

  const provider = new FeedViewProvider(context.extensionUri, deps);

  focusPanel = new FocusPanel(context.extensionUri, deps);

  context.subscriptions.push(
    output,
    agentState,
    statusBar,
    hookServer,
    provider,
    focusPanel,
    vscode.window.registerWebviewViewProvider(
      FeedViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  statusBar.render(agentState.current);

  context.subscriptions.push(
    agentState.onDidChange(state => {
      statusBar.render(state);

      if (state === AgentState.WORKING) {
        openFeedIfEnabled(provider);
      }

      if (state === AgentState.WAITING) {
        sound.play(SoundEvent.WAITING);
        provider.setUnreadBadge();
      }

      if (state === AgentState.FINISHED) {
        sound.play(SoundEvent.FINISHED);
      }
    }),
  );

  await startHookServer(hookServer, output);

  const refreshAll = async (): Promise<void> => {
    await provider.refresh();
    await focusPanel?.refresh();
  };

  registerCommands(context, {
    provider,
    focusPanel,
    hookServer,
    agentState,
    sound,
    output,
  });

  startRefreshTimer(context, refreshAll);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async event => {
      if (event.affectsConfiguration(`${EXTENSION_ID}.${ConfigKey.HOOK_PORT}`)) {
        await startHookServer(hookServer, output);
      }

      if (
        event.affectsConfiguration(`${EXTENSION_ID}.${ConfigKey.FEED_URL}`) ||
        event.affectsConfiguration(`${EXTENSION_ID}.${ConfigKey.INTERESTS}`) ||
        event.affectsConfiguration(`${EXTENSION_ID}.${ConfigKey.MAX_CARDS}`)
      ) {
        await refreshAll();
      }

      statusBar.render(agentState.current);
    }),
  );

  output.log('BrainSnack activated');
}

/**
 * Fires only on the transition into `working`, because AgentStateStore emits on
 * change — so the many PreToolUse hooks in one turn do not re-open the panel,
 * and closing it mid-turn keeps it closed.
 */
function openFeedIfEnabled(provider: FeedViewProvider): void {
  if (!config().get<boolean>(ConfigKey.AUTO_OPEN, true)) {
    return;
  }

  void provider.revealWithoutStealingFocus();
}

const PORT_ATTEMPTS = 8;

/**
 * Walks forward from the configured port until one binds. A port clash used to
 * need the user to find a free number and re-run the install command, which is
 * not a thing anyone should have to reason about — and the hook installer
 * writes whichever port actually bound, so the two cannot disagree.
 */
async function startHookServer(
  hookServer: HookServer,
  output: Logger,
): Promise<void> {
  const first = config().get<number>(ConfigKey.HOOK_PORT, 43117);

  for (let offset = 0; offset < PORT_ATTEMPTS; offset += 1) {
    const port = first + offset;

    try {
      await hookServer.start(port);

      if (offset > 0) {
        output.log(`Port ${first} was busy; listening on ${port} instead`);
      }

      return;
    } catch (error) {
      output.log(`Port ${port} unavailable: ${String(error)}`);
    }
  }

  void vscode.window.showWarningMessage(
    `BrainSnack could not find a free port between ${first} and ${first + PORT_ATTEMPTS - 1}. Agent detection is off; everything else still works.`,
  );
}

interface CommandDeps {
  provider: FeedViewProvider;
  focusPanel: FocusPanel;
  hookServer: HookServer;
  agentState: AgentStateStore;
  sound: SoundPlayer;
  output: Logger;
}

/**
 * Every way this feature can silently fail — server not bound, hooks never
 * installed, hooks pointing at an old port, Claude not restarted — looks
 * identical from the outside: nothing happens. This tells them apart.
 */
async function buildStatusReport(deps: CommandDeps): Promise<string> {
  const { hookServer, agentState } = deps;

  const lines: string[] = ['BrainSnack status', ''];

  lines.push(
    hookServer.isListening
      ? `Hook server:     listening on 127.0.0.1:${hookServer.activePort}`
      : 'Hook server:     NOT LISTENING (port in use? change brainsnack.hookPort)',
  );

  try {
    const { events, ports } = await inspectHooks();

    if (events.length === 0) {
      lines.push(
        'Hooks installed: NO — run "BrainSnack: Install Claude Code Hooks"',
      );
    } else {
      lines.push(`Hooks installed: ${events.join(', ')}`);
      lines.push(`Hook target:     port ${ports.join(', ') || 'unknown'}`);

      if (!ports.includes(hookServer.activePort)) {
        lines.push(
          `  ! MISMATCH: hooks point at ${ports.join(', ')} but the server is on ${hookServer.activePort}.`,
        );
        lines.push('    Re-run "BrainSnack: Install Claude Code Hooks".');
      }
    }
  } catch (error) {
    lines.push(`Hooks installed: could not read settings (${String(error)})`);
  }

  lines.push('');
  lines.push(`Events received: ${hookServer.receivedCount}`);
  lines.push(
    `Last event:      ${hookServer.lastReceivedAt?.toLocaleTimeString() ?? 'never'}`,
  );
  lines.push(`Current state:   ${agentState.current}`);

  if (hookServer.receivedCount === 0 && hookServer.isListening) {
    lines.push('');
    lines.push(
      'No events yet. If hooks are installed, restart Claude Code — it reads',
    );
    lines.push('settings.json at startup, so a running session ignores them.');
  }

  return lines.join('\n');
}

function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps,
): void {
  const { provider, focusPanel, hookServer, sound, output } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand(Command.OPEN, () => provider.reveal()),

    vscode.commands.registerCommand(Command.OPEN_FOCUS, () => focusPanel.show()),

    vscode.commands.registerCommand(Command.REFRESH, async () => {
      await provider.refresh();
      await focusPanel.refresh();

      void vscode.window.showInformationMessage('BrainSnack feed refreshed.');
    }),

    vscode.commands.registerCommand(Command.INSTALL_HOOKS, async () => {
      const port = hookServer.activePort || config().get<number>(ConfigKey.HOOK_PORT, 43117);

      try {
        const target = await installHooks(port);

        void vscode.window.showInformationMessage(
          `BrainSnack hooks installed in ${target}. Restart Claude Code to pick them up.`,
        );
      } catch (error) {
        output.log(`Hook install failed: ${String(error)}`);

        void vscode.window.showErrorMessage(
          `BrainSnack could not write Claude settings: ${String(error)}`,
        );
      }
    }),

    vscode.commands.registerCommand(Command.UNINSTALL_HOOKS, async () => {
      try {
        const target = await uninstallHooks();

        void vscode.window.showInformationMessage(
          `BrainSnack hooks removed from ${target}.`,
        );
      } catch (error) {
        void vscode.window.showErrorMessage(
          `BrainSnack could not update Claude settings: ${String(error)}`,
        );
      }
    }),

    vscode.commands.registerCommand(Command.TEST_SOUND, () => {
      sound.play(SoundEvent.WAITING);
    }),

    vscode.commands.registerCommand(Command.SHOW_STATUS, async () => {
      const report = await buildStatusReport(deps);

      output.log('');
      output.raw(report);
      output.show();
    }),
  );
}

function startRefreshTimer(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
): void {
  let timer: NodeJS.Timeout | undefined;

  const schedule = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }

    const minutes = config().get<number>(ConfigKey.REFRESH_MINUTES, 15);

    if (minutes <= 0) {
      return;
    }

    timer = setInterval(() => void refresh(), minutes * MINUTE_MS);
  };

  schedule();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration(
          `${EXTENSION_ID}.${ConfigKey.REFRESH_MINUTES}`,
        )
      ) {
        schedule();
      }
    }),
    { dispose: () => timer && clearInterval(timer) },
  );
}

export function deactivate(): void {
  // Subscriptions handle teardown.
}
