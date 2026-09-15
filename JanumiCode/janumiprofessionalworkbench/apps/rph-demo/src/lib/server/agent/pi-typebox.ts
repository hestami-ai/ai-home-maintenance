// The ONE mapping from this repository's Pi-agnostic `ParamSpec` onto the TypeBox schema Pi's `defineTool`
// wants — extracted from `pi-agent.ts` when a SECOND minter appeared.
//
// ⛔ EXTRACTED RATHER THAN COPIED, AND `JAN-EXEC PHASE 3` IS WHEN THAT STOPPED BEING A PREFERENCE. Until then
// exactly one place minted Pi tools (the AUTHORING agent) and the mapping could live inside it. Phase 3 mints an
// EXECUTION surface too, and a second copy of this function is a second answer to "what does `string[]` mean to
// the model" — which would drift silently, because a tool whose schema is subtly wrong does not fail: the model
// simply stops sending the argument, and the host sees a refusal it reads as the model's choice.
//
// ⚠ IT IS DELIBERATELY NOT A `zod` SCHEMA. Pi's `defineTool` takes TypeBox and this repository's contracts are
// zod; translating between them at this seam would be a third grammar for the same declaration, which is the
// re-derivation `REG-F-314` records. The `ParamSpec` DSL stays the single source and each adapter maps it once.
import { Type, type TSchema } from 'typebox';
import type { ParamSpec } from './types.js';

/** Map the flat param spec onto a TypeBox object schema (optional wrapper for non-required params). */
export function toTypeBox(spec: ParamSpec): TSchema {
	const props: Record<string, TSchema> = {};
	for (const [key, def] of Object.entries(spec)) {
		let t: TSchema;
		if (def.type === 'boolean') t = Type.Boolean({ description: def.description });
		else if (def.type === 'string[]')
			t = Type.Array(Type.String(), { description: def.description });
		else if (def.type === 'object[]' && def.items)
			t = Type.Array(toTypeBox(def.items), { description: def.description });
		else t = Type.String({ description: def.description });
		props[key] = def.required ? t : Type.Optional(t);
	}
	return Type.Object(props);
}
