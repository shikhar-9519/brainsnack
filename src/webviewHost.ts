import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import type { Surface } from './types';

export function webviewOptions(
  extensionUri: vscode.Uri,
): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
  };
}

/**
 * One document shared by both surfaces. The only difference is `data-surface`
 * on <body>, which the stylesheet and the React app branch on. VS Code adds its
 * own `vscode-light` / `vscode-dark` class to the same element, which is how a
 * fully branded palette still follows the editor between light and dark.
 */
export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  surface: Surface,
): string {
  const nonce = crypto.randomBytes(16).toString('base64');

  const asset = (file: string): vscode.Uri =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', file));

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    // Vite inlines font files as data: URIs in library mode.
    `font-src ${webview.cspSource} data:`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="${asset('webview.css')}" rel="stylesheet" />
    <title>BrainSnack</title>
  </head>
  <body data-surface="${surface}">
    <div id="root"></div>
    <script nonce="${nonce}" src="${asset('webview.js')}"></script>
  </body>
</html>`;
}
