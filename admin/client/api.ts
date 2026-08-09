import type { Card } from '../../src/types';

export interface AdminState {
  queue: Card[];
  feed: Card[];
  feedGeneratedAt: string;
  rejectedCount: number;
}

export async function fetchState(): Promise<AdminState> {
  const response = await fetch('/api/state');

  if (!response.ok) {
    throw new Error(`Failed to load state: HTTP ${response.status}`);
  }

  return (await response.json()) as AdminState;
}

export const AdminAction = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REMOVE: 'remove',
} as const;

export type AdminAction = (typeof AdminAction)[keyof typeof AdminAction];

export async function runAction(
  action: AdminAction,
  ids: string[],
): Promise<number> {
  const response = await fetch(`/api/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(`${action} failed: HTTP ${response.status}`);
  }

  const body = (await response.json()) as { changed: number };

  return body.changed;
}
