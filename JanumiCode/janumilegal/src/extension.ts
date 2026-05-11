/**
 * JanumiLegal — VS Code extension entry point.
 *
 * Wave 0: minimum viable activation that opens the platform DB, runs migrations,
 * registers the matter dashboard webview view, and exposes commands. The
 * matter switch flow, scoped DAL wiring through the webview, and full
 * Governed Stream view land in later waves.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { openDirect, FirmDal, ClvDal } from './lib/database/index.js';
import { ActiveMatterContext } from './lib/scope/activeMatterContext.js';
import { loadCLVv1 } from './lib/clv/index.js';

let dbPath: string;
let firmDal: FirmDal | null = null;
let activeContext: ActiveMatterContext | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const dataRoot = context.globalStorageUri.fsPath;
  fs.mkdirSync(dataRoot, { recursive: true });
  dbPath = path.join(dataRoot, 'janumilegal_platform.sqlite');

  try {
    const db = openDirect(dbPath);
    firmDal = new FirmDal(db);
    const clvDal = new ClvDal(db);
    const result = loadCLVv1(clvDal);
    if (result.lintFindings.length > 0) {
      const summary = result.lintFindings.map((f) => `[${f.rule}] ${f.termId}: ${f.message}`).join('\n');
      vscode.window.showErrorMessage(`JanumiLegal: CLV v1 lint failed; refusing to proceed.\n${summary}`);
      return;
    }
    if (result.inserted > 0) {
      vscode.window.setStatusBarMessage(`JanumiLegal: loaded ${result.inserted} CLV entries.`, 5000);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`JanumiLegal: failed to open platform DB: ${(err as Error).message}`);
    return;
  }

  // Per-session active matter context. Session id = activation timestamp.
  // User identity will be wired through the firm-config layer (Wave 8); for now
  // the extension uses a placeholder local user id derived from the OS user.
  const userId = process.env.USERNAME ?? process.env.USER ?? 'local';
  activeContext = new ActiveMatterContext(userId, `session-${Date.now()}`);

  context.subscriptions.push(
    vscode.commands.registerCommand('janumilegal.openMatterDashboard', () => {
      vscode.window.showInformationMessage('JanumiLegal matter dashboard — Wave 0 stub. Webview lands in Wave 7.');
    }),
    vscode.commands.registerCommand('janumilegal.switchMatter', async () => {
      if (!firmDal || !activeContext) return;
      // Wave 0 stub: real switch flow with confirmation, full repaint, and
      // op-track recording lands in Wave 7.
      vscode.window.showInformationMessage('JanumiLegal matter switch — Wave 0 stub.');
    }),
  );

  // Webview view provider scaffold. Real Svelte view lands in Wave 7.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('janumilegal.matterDashboard', {
      resolveWebviewView(view) {
        view.webview.options = { enableScripts: true };
        view.webview.html = renderBootstrapHtml(context, view.webview);
      },
    }),
  );
}

export function deactivate(): void {
  // Connection lifecycle managed by the DAL/sidecar; nothing to do at Wave 0.
}

function renderBootstrapHtml(ctx: vscode.ExtensionContext, webview: vscode.Webview): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(ctx.extensionPath, 'dist', 'webview', 'main.js')),
  );
  const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>JanumiLegal</title>
</head>
<body>
  <div id="root">JanumiLegal — Wave 0 bootstrap</div>
  <script src="${scriptUri.toString()}"></script>
</body>
</html>`;
}
