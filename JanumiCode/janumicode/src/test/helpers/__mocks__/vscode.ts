/**
 * Minimal vscode module mock for vitest.
 * Provides just enough of the VS Code API to satisfy imports from src/lib/ modules
 * without requiring a real VS Code host.
 */

// ── EventEmitter ────────────────────────────────────────────────────

export class EventEmitter<T = void> {
	private listeners: Array<(e: T) => void> = [];

	event = (listener: (e: T) => void): { dispose: () => void } => {
		this.listeners.push(listener);
		return {
			dispose: () => {
				this.listeners = this.listeners.filter(l => l !== listener);
			},
		};
	};

	fire(data: T): void {
		this.listeners.forEach(l => l(data));
	}

	dispose(): void {
		this.listeners = [];
	}
}

// ── Disposable ──────────────────────────────────────────────────────

export class Disposable {
	private _callOnDispose: () => void;

	constructor(callOnDispose: () => void) {
		this._callOnDispose = callOnDispose;
	}

	dispose(): void {
		this._callOnDispose();
	}

	static from(...disposables: { dispose: () => void }[]): Disposable {
		return new Disposable(() => {
			disposables.forEach(d => d.dispose());
		});
	}
}

// ── Uri ─────────────────────────────────────────────────────────────

export class Uri {
	readonly scheme: string;
	readonly authority: string;
	readonly path: string;
	readonly query: string;
	readonly fragment: string;
	readonly fsPath: string;

	private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
		this.scheme = scheme;
		this.authority = authority;
		this.path = path;
		this.query = query;
		this.fragment = fragment;
		this.fsPath = path;
	}

	static file(p: string): Uri {
		return new Uri('file', '', p, '', '');
	}

	static parse(value: string): Uri {
		return new Uri('file', '', value, '', '');
	}

	static joinPath(base: Uri, ...pathSegments: string[]): Uri {
		const joined = [base.path, ...pathSegments].join('/');
		return new Uri(base.scheme, base.authority, joined, base.query, base.fragment);
	}

	with(_change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
		return new Uri(
			_change.scheme ?? this.scheme,
			_change.authority ?? this.authority,
			_change.path ?? this.path,
			_change.query ?? this.query,
			_change.fragment ?? this.fragment,
		);
	}

	toString(): string {
		return `${this.scheme}://${this.authority}${this.path}`;
	}
}

// ── ConfigurationTarget ─────────────────────────────────────────────

export enum ConfigurationTarget {
	Global = 1,
	Workspace = 2,
	WorkspaceFolder = 3,
}

// ── Workspace Configuration ─────────────────────────────────────────

const INITIAL_CONFIG_STORE: Readonly<Record<string, unknown>> = Object.freeze({
	'janumicode.databasePath': '',
	'janumicode.logLevel': 'info',
	'janumicode.llm.executor.provider': 'CLAUDE',
	'janumicode.llm.executor.model': 'claude-sonnet-4',
	'janumicode.llm.technicalExpert.provider': 'OPENAI',
	'janumicode.llm.technicalExpert.model': 'gpt-5.2',
	'janumicode.llm.verifier.provider': 'OPENAI',
	'janumicode.llm.verifier.model': 'gemini-3.0-flash',
	'janumicode.llm.historianInterpreter.provider': 'GEMINI',
	'janumicode.llm.historianInterpreter.model': 'gemini-3.0-flash',
	'janumicode.evaluator.provider': 'GEMINI',
	'janumicode.evaluator.model': 'gemini-3-flash-preview',
	'janumicode.embedding.enabled': false,
});

const configStore: Record<string, unknown> = { ...INITIAL_CONFIG_STORE };

/**
 * Test helpers — let scenarios mutate the mock workspace configuration
 * before constructing components that read from it (e.g., redirecting
 * `janumicode.cli.roles.technicalExpert` to `gemini-cli`).
 */
export function setMockConfig(key: string, value: unknown): void {
	configStore[key] = value;
}

export function clearMockConfig(key: string): void {
	delete configStore[key];
}

export function resetMockConfig(): void {
	for (const k of Object.keys(configStore)) {
		delete configStore[k];
	}
	Object.assign(configStore, INITIAL_CONFIG_STORE);
}

export function getMockConfig<T = unknown>(key: string): T | undefined {
	return configStore[key] as T | undefined;
}

function createWorkspaceConfiguration(section?: string) {
	return {
		get<T>(key: string, defaultValue?: T): T | undefined {
			const fullKey = section ? `${section}.${key}` : key;
			const value = configStore[fullKey];
			return (value !== undefined ? value : defaultValue) as T | undefined;
		},
		has(key: string): boolean {
			const fullKey = section ? `${section}.${key}` : key;
			return fullKey in configStore;
		},
		inspect(_key: string) {
			return undefined;
		},
		update(_key: string, _value: unknown, _target?: ConfigurationTarget): Promise<void> {
			return Promise.resolve();
		},
	};
}

// ── Workspace ───────────────────────────────────────────────────────

export const workspace = {
	getConfiguration(section?: string) {
		return createWorkspaceConfiguration(section);
	},
	workspaceFolders: [
		{
			uri: Uri.file('/test-workspace'),
			name: 'test-workspace',
			index: 0,
		},
	],
	onDidChangeConfiguration: new EventEmitter().event,
	fs: {
		readFile: () => Promise.resolve(Buffer.from('')),
		writeFile: () => Promise.resolve(),
		stat: () => Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 }),
	},
};

// ── Window ──────────────────────────────────────────────────────────

export const window = {
	createOutputChannel(_name: string) {
		return {
			name: _name,
			append: () => {},
			appendLine: () => {},
			clear: () => {},
			show: () => {},
			hide: () => {},
			dispose: () => {},
			replace: () => {},
		};
	},
	showInformationMessage: (..._args: unknown[]) => Promise.resolve(undefined),
	showWarningMessage: (..._args: unknown[]) => Promise.resolve(undefined),
	showErrorMessage: (..._args: unknown[]) => Promise.resolve(undefined),
	showInputBox: () => Promise.resolve(undefined),
	showQuickPick: () => Promise.resolve(undefined),
	createStatusBarItem: () => ({
		show: () => {},
		hide: () => {},
		dispose: () => {},
		text: '',
		tooltip: '',
		command: '',
	}),
	withProgress: (_options: unknown, task: (progress: unknown) => Promise<unknown>) => {
		return task({ report: () => {} });
	},
	activeTextEditor: undefined,
};

// ── Commands ────────────────────────────────────────────────────────

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();

export const commands = {
	registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable {
		registeredCommands.set(command, callback);
		return new Disposable(() => {
			registeredCommands.delete(command);
		});
	},
	executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
		const handler = registeredCommands.get(command);
		if (handler) { return Promise.resolve(handler(...args)); }
		return Promise.resolve(undefined);
	},
	getCommands(): Promise<string[]> {
		return Promise.resolve([...registeredCommands.keys()]);
	},
};

// ── Extensions ──────────────────────────────────────────────────────

export const extensions = {
	getExtension: (_id: string) => undefined,
	all: [],
};

// ── SecretStorage ───────────────────────────────────────────────────

export class SecretStorage {
	private _store = new Map<string, string>();
	onDidChange = new EventEmitter<{ key: string }>().event;

	get(key: string): Promise<string | undefined> {
		return Promise.resolve(this._store.get(key));
	}

	store(key: string, value: string): Promise<void> {
		this._store.set(key, value);
		return Promise.resolve();
	}

	delete(key: string): Promise<void> {
		this._store.delete(key);
		return Promise.resolve();
	}
}

// ── ExtensionContext (partial) ───────────────────────────────────────

export function createMockExtensionContext() {
	return {
		subscriptions: [] as { dispose: () => void }[],
		extensionPath: '/mock-extension',
		extensionUri: Uri.file('/mock-extension'),
		globalStorageUri: Uri.file('/mock-global-storage'),
		storageUri: Uri.file('/mock-storage'),
		secrets: new SecretStorage(),
		globalState: {
			get: () => undefined,
			update: () => Promise.resolve(),
			keys: () => [],
			setKeysForSync: () => {},
		},
		workspaceState: {
			get: () => undefined,
			update: () => Promise.resolve(),
			keys: () => [],
		},
	};
}

// ── Enums ───────────────────────────────────────────────────────────

export enum StatusBarAlignment {
	Left = 1,
	Right = 2,
}

export enum ProgressLocation {
	SourceControl = 1,
	Window = 10,
	Notification = 15,
}

export enum ViewColumn {
	Active = -1,
	Beside = -2,
	One = 1,
	Two = 2,
}

export enum TreeItemCollapsibleState {
	None = 0,
	Collapsed = 1,
	Expanded = 2,
}
