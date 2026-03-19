/**
 * Document Generator Types
 *
 * Enums, interfaces, and type definitions for the prose document
 * generation feature. Documents are ephemeral LLM-generated markdown
 * artifacts synthesized from a dialogue's accumulated structured data.
 */

/**
 * The types of engineering documents that can be generated.
 */
export enum DocumentType {
	VISION = 'VISION',
	CONOPS = 'CONOPS',
	PRD = 'PRD',
	DOMAIN_MODEL = 'DOMAIN_MODEL',
	ARCHITECTURE = 'ARCHITECTURE',
	IMPLEMENTATION_ROADMAP = 'IMPLEMENTATION_ROADMAP',
	TECHNICAL_BRIEF = 'TECHNICAL_BRIEF',
	CHANGE_IMPACT = 'CHANGE_IMPACT',
	VERIFICATION_SUMMARY = 'VERIFICATION_SUMMARY',
}

/**
 * Which request category a document type applies to.
 * 'any' means it applies regardless of category.
 */
export type ApplicableCategory = 'product_or_feature' | 'technical_task' | 'any';

/**
 * Definition of a document type — metadata used by the registry
 * to determine availability and by the generator to build prompts.
 */
export interface DocumentDefinition {
	type: DocumentType;
	/** Human-readable label shown in the QuickPick */
	label: string;
	/** Short description shown in the QuickPick detail */
	description: string;
	/** Which requestCategory this applies to */
	applicableCategory: ApplicableCategory;
	/** System prompt template for the LLM */
	systemPrompt: string;
}

/**
 * A generated document record stored in SQLite.
 */
export interface GeneratedDocument {
	id: number;
	dialogue_id: string;
	document_type: DocumentType;
	title: string;
	content: string;
	created_at: string;
}

/**
 * Result returned by the document generator.
 */
export interface DocumentGenerationResult {
	documentType: DocumentType;
	title: string;
	content: string;
}
