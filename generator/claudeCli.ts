import { spawn } from 'node:child_process';

const CALL_TIMEOUT_MS = 10 * 60 * 1000;

export const CliModel = {
  FAST: 'sonnet',
  DEEP: 'opus',
} as const;

export type CliModel = (typeof CliModel)[keyof typeof CliModel];

export const Effort = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type Effort = (typeof Effort)[keyof typeof Effort];

export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface CallResult {
  text: string;
  usage: CallUsage;
}

interface CliEnvelope {
  is_error?: boolean;
  subtype?: string;
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface CallOptions {
  model: CliModel;
  effort: Effort;
  /**
   * Must be byte-identical across every call in a run. Claude Code sends ~20k
   * tokens of tool definitions and system prompt before your question; that
   * prefix is cached for an hour on a subscription, but only if it does not
   * change. Varying this per call turns one cache write into five.
   */
  systemPrompt: string;
  prompt: string;
  /**
   * Headless mode cannot prompt for approval, so any tool the call needs has
   * to be permitted up front or the call stalls. Keep this identical across
   * the generation calls; only research differs.
   */
  allowedTools?: string[];
}

function baseArgs(options: CallOptions): string[] {
  return [
    '-p',
    '--model',
    options.model,
    '--effort',
    options.effort,
    // The generator needs no MCP tools, and every configured server would be
    // loaded into the cached prefix for nothing.
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--no-session-persistence',
    '--output-format',
    'json',
    '--system-prompt',
    options.systemPrompt,
    ...(options.allowedTools?.length
      ? ['--allowed-tools', options.allowedTools.join(',')]
      : []),
    // `--allowed-tools <tools...>` is variadic and will otherwise swallow the
    // prompt as another tool name, leaving the CLI with no prompt at all.
    // Unconditional so no future variadic option can reintroduce this.
    '--',
    options.prompt,
  ];
}

/**
 * Claude Code refuses to launch inside another Claude Code session. Scheduled
 * runs are unaffected, but a manual `npm run generate` from an agent terminal
 * would fail without this.
 */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  return env;
}

/**
 * spawn rather than execFile, with stdin explicitly closed. Given an open pipe
 * on stdin the CLI waits for input that never arrives and the call hangs until
 * the timeout — silently, on every scheduled run.
 */
function runCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      env: childEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude -p timed out after ${CALL_TIMEOUT_MS}ms`));
    }, CALL_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', code => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`claude -p exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }

      resolve(stdout);
    });
  });
}

export async function callClaude(options: CallOptions): Promise<CallResult> {
  const stdout = await runCli(baseArgs(options));

  const envelope = JSON.parse(stdout) as CliEnvelope;

  if (envelope.is_error || typeof envelope.result !== 'string') {
    throw new Error(
      `claude -p failed (${envelope.subtype ?? 'unknown'}): ${
        envelope.result ?? 'no result'
      }`,
    );
  }

  const usage = envelope.usage ?? {};

  return {
    text: envelope.result,
    usage: {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      costUsd: envelope.total_cost_usd ?? 0,
      durationMs: envelope.duration_ms ?? 0,
    },
  };
}

/**
 * The CLI gives no schema guarantee, unlike the API's `output_config.format`,
 * so JSON validity has to be recovered rather than assumed. Models wrap output
 * in fences despite instructions, and occasionally add a sentence before it.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);

  const candidate = fenced ? fenced[1].trim() : trimmed;

  if (candidate.startsWith('{') || candidate.startsWith('[')) {
    return candidate;
  }

  // Fall back to the outermost brace pair.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start !== -1 && end > start) {
    return candidate.slice(start, end + 1);
  }

  return candidate;
}
