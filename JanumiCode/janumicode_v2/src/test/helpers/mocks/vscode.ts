// Minimal VS Code API mock for unit tests
export const workspace = {
  getConfiguration: () => ({
    get: (_key: string, defaultValue?: unknown) => defaultValue,
    has: () => false,
    inspect: () => undefined,
    update: async () => {},
  }),
  workspaceFolders: [],
  fs: {
    readFile: async () => new Uint8Array(),
    writeFile: async () => {},
  },
};

export const window = {
  showInformationMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showQuickPick: async () => undefined,
  showInputBox: async () => undefined,
  createOutputChannel: () => ({
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
  }),
  registerWebviewViewProvider: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: async () => undefined,
};

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  parse: (uri: string) => ({ fsPath: uri, scheme: 'file', path: uri }),
  joinPath: (...args: unknown[]) => ({ fsPath: String(args.join('/')) }),
};

export enum ViewColumn {
  One = 1,
  Two = 2,
}

export class EventEmitter {
  event = () => ({ dispose: () => {} });
  fire() {}
  dispose() {}
}

export class Disposable {
  constructor(private _callOnDispose: () => void) {}
  static from(...disposables: { dispose: () => void }[]) {
    return new Disposable(() => disposables.forEach(d => d.dispose()));
  }
  dispose() { this._callOnDispose(); }
}
