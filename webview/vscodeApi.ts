import type { CardType } from '../src/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const api = acquireVsCodeApi();

export function send(type: string, payload?: Record<string, unknown>): void {
  api.postMessage({ type, ...payload });
}

export function persist(state: unknown): void {
  api.setState(state);
}

export function restore<T>(): T | undefined {
  return api.getState<T>();
}

export interface PersistedState {
  activeTab: string;
  scrollTop: number;
  revealedIds: string[];
  interests: CardType[];
}
