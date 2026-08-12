import * as path from 'node:path';

/**
 * Decides whether an agent event belongs to this VS Code window.
 *
 * Every window on the machine receives every event, because Claude Code's
 * hooks fan out across the whole port span. Without this, whichever window
 * happened to start first would react to work happening in a project it does
 * not even have open.
 *
 * Kept free of vscode imports so the rule can be tested directly — the folder
 * list is passed in rather than read from the API.
 */
export function belongsToWindow(
  cwd: string | undefined,
  workspaceFolders: string[],
): boolean {
  // Hooks installed before cwd forwarding, or a payload without one: there is
  // nothing to match on, so accepting is the only non-breaking answer.
  if (!cwd) {
    return true;
  }

  // An empty window has no project to compare against. It acts as a catch-all
  // so a session run outside any open folder still reaches someone.
  if (workspaceFolders.length === 0) {
    return true;
  }

  return workspaceFolders.some(folder => isInside(cwd, folder));
}

/**
 * Prefix comparison on normalised paths, guarding the case where one path is
 * merely a string prefix of another — /a/project must not match /a/project-old.
 */
function isInside(target: string, folder: string): boolean {
  const relative = path.relative(normalise(folder), normalise(target));

  if (relative === '') {
    return true;
  }

  return (
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
}

function normalise(value: string): string {
  const resolved = path.resolve(value);

  // macOS and Windows filesystems are case-insensitive in practice, and a hook
  // reporting /Users/Me while the folder is /Users/me should still match.
  return process.platform === 'linux' ? resolved : resolved.toLowerCase();
}
