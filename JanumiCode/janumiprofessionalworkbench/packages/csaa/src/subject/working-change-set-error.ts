export class WorkingChangeSetIncompatibleError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'WorkingChangeSetIncompatibleError';
	}
}
