import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  HOOK_HOST,
  HOOK_MARKER,
  LEGACY_HOOK_MARKERS,
  PORT_SPAN,
} from './constants';
import { AgentState } from './types';

interface HookCommand {
  type: string;
  command: string;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
}

type HooksConfig = Record<string, HookMatcher[]>;

interface ClaudeSettings {
  hooks?: HooksConfig;
  [key: string]: unknown;
}

interface EventMapping {
  event: string;
  state: AgentState;
  /** Claude Code matcher, filtering which instances of the event apply. */
  matcher?: string;
}

/**
 * Claude Code lifecycle events, mapped to the state each one implies.
 *
 * `PermissionRequest` is the one that matters for latency: it fires the moment
 * a tool call needs a decision. `Notification` is only a backstop — its
 * `idle_prompt` type is on a timer, so relying on it alone delays the sound by
 * 15-20 seconds. It is scoped here to the types that really mean "needs you".
 */
const EVENT_STATES: EventMapping[] = [
  { event: 'SessionStart', state: AgentState.IDLE },
  { event: 'UserPromptSubmit', state: AgentState.WORKING },
  { event: 'PreToolUse', state: AgentState.WORKING },
  { event: 'PermissionRequest', state: AgentState.WAITING },
  { event: 'Elicitation', state: AgentState.WAITING },
  {
    event: 'Notification',
    state: AgentState.WAITING,
    matcher: 'permission_prompt|idle_prompt|agent_needs_input',
  },
  // Fires once the tool actually runs, i.e. after any approval — this is what
  // flips the UI back out of "waiting" without waiting for the next tool call.
  { event: 'PostToolUse', state: AgentState.WORKING },
  { event: 'Stop', state: AgentState.FINISHED },
];

export function settingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/**
 * Posts to every port a VS Code window might hold, forwarding Claude Code's own
 * hook payload as the body so each window can read `cwd` and decide whether the
 * event is about a project it has open.
 *
 * stdin is buffered first because it can only be read once, and several curls
 * need it. `-m 1` and `|| true` matter as before: a hook that hangs or fails
 * would stall Claude.
 */
function buildCommand(port: number, state: AgentState): string {
  const ports = Array.from({ length: PORT_SPAN }, (_, i) => port + i).join(' ');

  const url = `"http://${HOOK_HOST}:$P/state?state=${state}"`;

  return (
    `D=$(cat); for P in ${ports}; do printf '%s' "$D" | ` +
    `curl -s -m 1 -X POST ${url} ` +
    `-H 'content-type: application/json' --data-binary @- ` +
    `>/dev/null 2>&1 || true; done ${HOOK_MARKER}`
  );
}

function isOurs(hook: HookCommand): boolean {
  return (
    hook.command.includes(HOOK_MARKER) ||
    LEGACY_HOOK_MARKERS.some(marker => hook.command.includes(marker))
  );
}

function stripOurHooks(hooks: HooksConfig): HooksConfig {
  const cleaned: HooksConfig = {};

  for (const [event, matchers] of Object.entries(hooks)) {
    const keptMatchers = matchers
      .map(matcher => ({
        ...matcher,
        hooks: matcher.hooks.filter(hook => !isOurs(hook)),
      }))
      .filter(matcher => matcher.hooks.length > 0);

    if (keptMatchers.length > 0) {
      cleaned[event] = keptMatchers;
    }
  }

  return cleaned;
}

async function readSettings(): Promise<ClaudeSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('settings.json is not an object');
    }

    return parsed as ClaudeSettings;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function writeSettings(settings: ClaudeSettings): Promise<void> {
  const target = settingsPath();

  await fs.mkdir(path.dirname(target), { recursive: true });

  await fs.writeFile(target, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/**
 * Merges our hook entries into ~/.claude/settings.json, preserving anything
 * already there. Re-running replaces only our own entries.
 */
export async function installHooks(port: number): Promise<string> {
  const settings = await readSettings();

  const hooks = stripOurHooks(settings.hooks ?? {});

  for (const { event, state, matcher } of EVENT_STATES) {
    const entry: HookMatcher = {
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: buildCommand(port, state) }],
    };

    hooks[event] = [...(hooks[event] ?? []), entry];
  }

  await writeSettings({ ...settings, hooks });

  return settingsPath();
}

export interface HookInspection {
  /** Claude Code events that currently carry an BrainSnack command. */
  events: string[];
  /** Ports referenced by those commands — a mismatch is a silent failure mode. */
  ports: number[];
}

/**
 * Reads back what is actually on disk, so the status command can distinguish
 * "hooks never installed" from "installed but pointing at the wrong port".
 */
export async function inspectHooks(): Promise<HookInspection> {
  const settings = await readSettings();

  const events: string[] = [];
  const ports = new Set<number>();

  for (const [event, matchers] of Object.entries(settings.hooks ?? {})) {
    const ourCommands = matchers
      .flatMap(matcher => matcher.hooks)
      .filter(isOurs);

    if (ourCommands.length === 0) {
      continue;
    }

    events.push(event);

    for (const hook of ourCommands) {
      // The URL interpolates $P now, so the ports live in the loop header
      // rather than the URL. Falling back to the old shape keeps Show Status
      // honest about hooks written by an earlier version.
      const span = /for P in ([\d ]+);/.exec(hook.command);

      if (span) {
        for (const port of span[1].trim().split(/\s+/)) {
          ports.add(Number(port));
        }

        continue;
      }

      const single = /127\.0\.0\.1:(\d+)/.exec(hook.command);

      if (single) {
        ports.add(Number(single[1]));
      }
    }
  }

  return { events, ports: [...ports] };
}

export async function uninstallHooks(): Promise<string> {
  const settings = await readSettings();

  if (!settings.hooks) {
    return settingsPath();
  }

  const hooks = stripOurHooks(settings.hooks);

  const next: ClaudeSettings = { ...settings, hooks };

  if (Object.keys(hooks).length === 0) {
    delete next.hooks;
  }

  await writeSettings(next);

  return settingsPath();
}
