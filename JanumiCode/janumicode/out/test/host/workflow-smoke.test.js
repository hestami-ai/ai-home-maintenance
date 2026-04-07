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
const vscode = __importStar(require("vscode"));
suite('Workflow Smoke', () => {
    const extensionId = 'undefined_publisher.janumicode';
    async function getActivatedExtension() {
        const ext = vscode.extensions.getExtension(extensionId);
        assert.ok(ext, `Extension ${extensionId} should be installed`);
        if (!ext.isActive) {
            await ext.activate();
        }
        assert.strictEqual(ext.isActive, true, 'Extension should be active');
        return ext;
    }
    test('golden command flow executes without throwing', async () => {
        await getActivatedExtension();
        const goldenCommands = [
            'janumicode.openGovernedStream',
            'janumicode.startDialogue',
            'janumicode.showWorkflowStatus',
            'janumicode.findInStream',
        ];
        for (const cmd of goldenCommands) {
            try {
                await Promise.resolve(vscode.commands.executeCommand(cmd));
            }
            catch (error) {
                assert.fail(`Command ${cmd} should execute without throwing: ${String(error)}`);
            }
        }
    });
    test('startDialogue can be retried safely', async () => {
        await getActivatedExtension();
        await Promise.resolve(vscode.commands.executeCommand('janumicode.startDialogue'));
        await Promise.resolve(vscode.commands.executeCommand('janumicode.startDialogue'));
    });
    test('re-activation is idempotent', async () => {
        const ext = await getActivatedExtension();
        await Promise.resolve(ext.activate());
        assert.strictEqual(ext.isActive, true, 'Extension should remain active after re-activate');
    });
    test('core commands remain registered after reactivation', async () => {
        await getActivatedExtension();
        const allCommands = await vscode.commands.getCommands(true);
        for (const cmd of [
            'janumicode.startDialogue',
            'janumicode.openGovernedStream',
            'janumicode.showWorkflowStatus',
            'janumicode.findInStream',
        ]) {
            assert.ok(allCommands.includes(cmd), `Expected command to remain registered: ${cmd}`);
        }
    });
});
//# sourceMappingURL=workflow-smoke.test.js.map