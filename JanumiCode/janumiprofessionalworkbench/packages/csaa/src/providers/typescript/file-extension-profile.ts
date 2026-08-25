import ts from 'typescript';

/**
 * Public TypeScript configuration-parser extension profile used for Svelte authored sources.
 * Deferred mixed-content files are admitted as project roots; the compiler host supplies the
 * deterministic virtual TypeScript projection before Program construction.
 */
export const TYPESCRIPT_PROJECT_FILE_EXTENSION_PROFILE =
	'jan-csaa-typescript-project-file-extensions/2.0.0' as const;

export const TYPESCRIPT_PROJECT_EXTRA_FILE_EXTENSIONS = Object.freeze([
	Object.freeze({
		extension: '.svelte',
		isMixedContent: true,
		scriptKind: ts.ScriptKind.Deferred
	})
]) satisfies readonly ts.FileExtensionInfo[];

export function isSvelteAuthoredSourcePath(path: string): boolean {
	return path.endsWith('.svelte');
}
