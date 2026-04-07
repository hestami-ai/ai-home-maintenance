"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
suite('Registered Commands', () => {
    const extensionId = 'undefined_publisher.janumicode';
    async function ensureActivated() {
        const ext = vscode.extensions.getExtension(extensionId);
        assert.ok(ext, `Extension ${extensionId} should be installed`);
        if (!ext.isActive) {
            await ext.activate();
        }
        assert.strictEqual(ext.isActive, true, 'Extension should be active');
    }
    test('registered commands include core JanumiCode commands', async () => {
        await ensureActivated();
        const allCommands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'janumicode.startDialogue',
            'janumicode.showWorkflowStatus',
            'janumicode.exportHistory',
            'janumicode.exportDiagnosticSnapshot',
            'janumicode.openGovernedStream',
        ];
        for (const cmd of expectedCommands) {
            assert.ok(allCommands.includes(cmd), `Command "${cmd}" should be registered`);
        }
    });
    test('exportDiagnosticSnapshot writes snapshot file when target path is provided', async () => {
        await ensureActivated();
        const targetPath = path.join(os.tmpdir(), `janumicode-diagnostic-snapshot-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
        try {
            await vscode.commands.executeCommand('janumicode.exportDiagnosticSnapshot', targetPath);
            assert.ok(fs.existsSync(targetPath), 'Snapshot file should be created');
            const content = fs.readFileSync(targetPath, 'utf8');
            const snapshot = JSON.parse(content);
            assert.ok(typeof snapshot.generatedAt === 'string', 'Snapshot should include generatedAt');
            assert.ok(snapshot.database, 'Snapshot should include database diagnostics');
            assert.ok(Array.isArray(snapshot.logs), 'Snapshot should include logs array');
            assert.ok(snapshot.rows, 'Snapshot should include rows payload');
        }
        finally {
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
        }
    });
});
//# sourceMappingURL=commands.test.js.map