export const EXTENSION_ID = 'brainsnack';
export const VIEW_ID = 'brainsnack.feed';

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
  SAVED_IDS: 'brainsnack.savedIds',
  READ_IDS: 'brainsnack.readIds',
  DISMISSED_IDS: 'brainsnack.dismissedIds',
  CACHED_FEED: 'brainsnack.cachedFeed',
} as const;

export const Command = {
  OPEN: 'brainsnack.open',
  REFRESH: 'brainsnack.refresh',
  INSTALL_HOOKS: 'brainsnack.installHooks',
  UNINSTALL_HOOKS: 'brainsnack.uninstallHooks',
  TEST_SOUND: 'brainsnack.testSound',
  SHOW_STATUS: 'brainsnack.showStatus',
  OPEN_FOCUS: 'brainsnack.openFocus',
} as const;

/** Marks hook entries this extension owns, so install/uninstall is idempotent. */
export const HOOK_MARKER = '#brainsnack';

/**
 * The marker used before the project was renamed. Still recognised on removal
 * so hooks installed under the old name can be cleaned up rather than
 * orphaned in settings.json forever.
 */
export const LEGACY_HOOK_MARKERS = ['#idleflow', '#interlude'];

export const HOOK_HOST = '127.0.0.1';
