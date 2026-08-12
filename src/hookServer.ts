import * as http from 'node:http';
import * as vscode from 'vscode';
import { HOOK_HOST } from './constants';
import { AgentState } from './types';
import type { AgentStateStore } from './agentState';
// Type-only: keeps the vscode dependency out of this module's runtime graph.
import type { Logger } from './logger';

const MAX_BODY_BYTES = 4096;

function isAgentState(value: unknown): value is AgentState {
  return (
    value === AgentState.IDLE ||
    value === AgentState.WORKING ||
    value === AgentState.WAITING ||
    value === AgentState.FINISHED
  );
}

/**
 * Tiny localhost listener that Claude Code hooks POST to. Bound to 127.0.0.1
 * only — nothing off-machine can reach it.
 */
export interface HookEvent {
  state: AgentState;
  /** Claude Code's working directory, when the payload carried one. */
  cwd?: string;
}

export class HookServer implements vscode.Disposable {
  private server: http.Server | undefined;

  private port = 0;

  /** Diagnostics: proves whether hook events are actually arriving. */
  private lastEventAt: Date | undefined;

  private eventCount = 0;

  constructor(
    private readonly store: AgentStateStore,
    private readonly output: Logger,
    /**
     * Decides whether an event belongs to this window. Every window on the
     * machine receives every event, so without this the wrong one reacts.
     * A plain predicate keeps this module free of vscode imports.
     */
    private readonly accepts: (event: HookEvent) => boolean = () => true,
  ) {}

  get activePort(): number {
    return this.port;
  }

  get isListening(): boolean {
    return this.server !== undefined;
  }

  get receivedCount(): number {
    return this.eventCount;
  }

  get lastReceivedAt(): Date | undefined {
    return this.lastEventAt;
  }

  async start(port: number): Promise<void> {
    await this.stop();

    const server = http.createServer((req, res) => {
      this.handle(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);

      server.listen(port, HOOK_HOST, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });

    this.server = server;
    this.port = port;

    this.output.log(`Hook server listening on ${HOOK_HOST}:${port}`);
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, state: this.store.current }));
      return;
    }

    const requested = new URL(req.url ?? '/', `http://${HOOK_HOST}`);

    if (req.method !== 'POST' || requested.pathname !== '/state') {
      res.writeHead(404);
      res.end();
      return;
    }

    // State moved to the query string so the body can carry Claude Code's own
    // hook payload untouched; the old body form still works.
    const queryState = requested.searchParams.get('state');

    let body = '';
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');

      if (body.length > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });

    req.on('end', () => {
      if (aborted) {
        return;
      }

      const state = isAgentState(queryState)
        ? queryState
        : this.parseState(body);

      if (!state) {
        res.writeHead(400);
        res.end();
        return;
      }

      this.eventCount += 1;
      this.lastEventAt = new Date();

      const event: HookEvent = { state, cwd: this.parseCwd(body) };

      if (!this.accepts(event)) {
        this.output.log(
          `Ignored ${state} for ${event.cwd ?? 'unknown cwd'} — not this window`,
        );

        res.writeHead(204);
        res.end();
        return;
      }

      this.store.set(state);
      this.output.log(`Agent state -> ${state}`);

      res.writeHead(204);
      res.end();
    });
  }

  private parseCwd(body: string): string | undefined {
    try {
      const parsed: unknown = JSON.parse(body);

      if (typeof parsed !== 'object' || parsed === null) {
        return undefined;
      }

      const cwd = (parsed as { cwd?: unknown }).cwd;

      return typeof cwd === 'string' ? cwd : undefined;
    } catch {
      return undefined;
    }
  }

  private parseState(body: string): AgentState | undefined {
    try {
      const parsed: unknown = JSON.parse(body);

      if (typeof parsed !== 'object' || parsed === null) {
        return undefined;
      }

      const candidate = (parsed as { state?: unknown }).state;

      return isAgentState(candidate) ? candidate : undefined;
    } catch (error) {
      this.output.log(`Malformed hook payload: ${String(error)}`);
      return undefined;
    }
  }

  async stop(): Promise<void> {
    const server = this.server;

    if (!server) {
      return;
    }

    this.server = undefined;
    this.port = 0;

    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  }

  dispose(): void {
    void this.stop();
  }
}
