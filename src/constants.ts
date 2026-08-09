export const EXTENSION_ID = 'interlude';
export const VIEW_ID = 'interlude.feed';

export const ConfigKey = {
  FEED_URL: 'feedUrl',
  AUTO_OPEN: 'autoOpen',
  INTERESTS: 'interests',
  TRACKS: 'tracks',
  MAX_CARDS: 'maxCards',
  REMOVE_AFTER_SECONDS: 'removeAnsweredAfterSeconds',
  REFRESH_MINUTES: 'refreshMinutes',
  SOUND_ENABLED: 'sound.enabled',
  SOUND_ON_WAITING: 'sound.onWaiting',
  SOUND_ON_FINISHED: 'sound.onFinished',
  STATUS_BAR_ENABLED: 'statusBar.enabled',
  HOOK_PORT: 'hookPort',
} as const;

export const StorageKey = {
  SAVED_IDS: 'interlude.savedIds',
  READ_IDS: 'interlude.readIds',
  DISMISSED_IDS: 'interlude.dismissedIds',
  CACHED_FEED: 'interlude.cachedFeed',
} as const;

export const Command = {
  OPEN: 'interlude.open',
  REFRESH: 'interlude.refresh',
  INSTALL_HOOKS: 'interlude.installHooks',
  UNINSTALL_HOOKS: 'interlude.uninstallHooks',
  TEST_SOUND: 'interlude.testSound',
  SHOW_STATUS: 'interlude.showStatus',
  OPEN_FOCUS: 'interlude.openFocus',
} as const;

/** Marks hook entries this extension owns, so install/uninstall is idempotent. */
export const HOOK_MARKER = '#interlude';

/**
 * The marker used before the project was renamed. Still recognised on removal
 * so hooks installed under the old name can be cleaned up rather than
 * orphaned in settings.json forever.
 */
export const LEGACY_HOOK_MARKERS = ['#idleflow'];

export const HOOK_HOST = '127.0.0.1';
