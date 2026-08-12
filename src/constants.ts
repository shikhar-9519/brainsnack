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

/**
 * How many consecutive ports one machine may use. Every VS Code window runs
 * its own extension host and its own listener, so a single port meant the
 * first window to start received every event and the rest looked broken.
 *
 * Hooks post to all of them; each window then decides whether the event
 * belongs to it. Kept small because each unreachable port costs the hook a
 * connection attempt.
 */
export const PORT_SPAN = 4;

/**
 * Where cards come from unless overridden. Lives here rather than as a manifest
 * default because the setting is not exposed in the settings UI — an undeclared
 * property has no default, so getConfiguration() would hand back the empty
 * fallback and every install would silently serve the bundled seed instead of
 * the live feed. `npm run set-feed-url` rewrites this line.
 */
export const DEFAULT_FEED_URL =
  'https://shikhar-9519.github.io/brainsnack/feed.json';
