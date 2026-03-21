/**
 * Primitive Registry
 *
 * Singleton registry of all composable primitives. Provides lookup by ID
 * and generates a compact catalog string for LLM system prompt injection.
 */

import type { PrimitiveDefinition } from './types';
import { PrimitiveCategory, PrimitiveSafety } from './types';

export class PrimitiveRegistry {
	private _primitives = new Map<string, PrimitiveDefinition>();

	/** Register a primitive definition. */
	register(def: PrimitiveDefinition): void {
		this._primitives.set(def.id, def);
	}

	/** Get a primitive by ID. */
	get(id: string): PrimitiveDefinition | undefined {
		return this._primitives.get(id);
	}

	/** Get all primitives in a category. */
	getByCategory(category: PrimitiveCategory): PrimitiveDefinition[] {
		return Array.from(this._primitives.values()).filter(
			(p) => p.category === category
		);
	}

	/** Get all primitives. */
	getAll(): PrimitiveDefinition[] {
		return Array.from(this._primitives.values());
	}

	/**
	 * Generate a compact catalog string for LLM consumption.
	 * Groups by category, includes ID, description, params, safety level.
	 * RESTRICTED primitives are excluded by default.
	 */
	generateCatalog(options?: { includeRestricted?: boolean }): string {
		const includeRestricted = options?.includeRestricted === true;
		const lines: string[] = [];

		const categories = [
			{ cat: PrimitiveCategory.STATE_READ, label: 'State Reads (safe, no side effects)' },
			{ cat: PrimitiveCategory.STATE_MUTATION, label: 'State Mutations (checked, may modify data)' },
			{ cat: PrimitiveCategory.UI_COMMUNICATION, label: 'UI Communication (safe, display only)' },
			{ cat: PrimitiveCategory.WORKFLOW_CONTROL, label: 'Workflow Control (checked, affects execution)' },
		];

		for (const { cat, label } of categories) {
			const primitives = this.getByCategory(cat).filter(
				(p) => includeRestricted || p.safety !== PrimitiveSafety.RESTRICTED
			);
			if (primitives.length === 0) {continue;}

			lines.push(`## ${label}`);
			for (const p of primitives) {
				const paramList = p.params
					.map((param) => {
						const req = param.required ? '' : '?';
						return `${param.name}${req}: ${param.type}`;
					})
					.join(', ');
				lines.push(`- **${p.id}**(${paramList}): ${p.description} → ${p.returns}`);
			}
			lines.push('');
		}

		return lines.join('\n');
	}
}

// Singleton
let _instance: PrimitiveRegistry | undefined;

export function getPrimitiveRegistry(): PrimitiveRegistry {
	if (!_instance) {
		_instance = new PrimitiveRegistry();
		// Lazy import to avoid circular dependencies
		const { registerAllPrimitives } = require('./catalog');
		registerAllPrimitives(_instance);
	}
	return _instance;
}
