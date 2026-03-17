/**
 * Capability Grammar Templates
 *
 * Reusable decomposition templates for common architectural patterns.
 * The Architecture Expert LLM can reference these during DESIGNING
 * to accelerate decomposition instead of reasoning from scratch.
 *
 * Templates provide pre-structured component, data model, interface,
 * and workflow shapes for well-known patterns.
 */

import type { CapabilityTemplate } from '../types/architecture';

// ==================== AUTHENTICATION TEMPLATE ====================

export const AUTH_TEMPLATE: CapabilityTemplate = {
	template_id: 'TPL-AUTH',
	label: 'Authentication & Authorization',
	description: 'Standard authentication system with session/token management, login flows, and role-based access control.',
	trigger_patterns: ['auth', 'login', 'signup', 'register', 'session', 'jwt', 'oauth', 'password', 'rbac', 'permission'],
	components: [
		{
			label: 'Auth Service',
			responsibility: 'Core authentication logic: credential verification, token generation, session management',
			rationale: 'Centralizes auth logic for reuse across login flows',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'JWT or session-based auth',
			file_scope: 'src/auth/service/',
			interaction_patterns: [],
		},
		{
			label: 'Auth Middleware',
			responsibility: 'Request authentication guard: token validation, session lookup, role checking',
			rationale: 'Separates auth concerns from business logic via middleware pattern',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'Express/Koa middleware or similar',
			file_scope: 'src/auth/middleware/',
			interaction_patterns: [],
		},
		{
			label: 'Auth Data Store',
			responsibility: 'User credentials, sessions, tokens, refresh tokens persistence',
			rationale: 'Isolates persistence from auth service for testability',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'Database schema + queries',
			file_scope: 'src/auth/data/',
			interaction_patterns: [],
		},
	],
	data_models: [
		{
			entity_name: 'User',
			description: 'User account with credentials',
			fields: [
				{ name: 'id', type: 'uuid', required: true, description: 'Unique user identifier' },
				{ name: 'email', type: 'string', required: true, description: 'Email address (login identifier)' },
				{ name: 'password_hash', type: 'string', required: true, description: 'Hashed password' },
				{ name: 'roles', type: 'string[]', required: true, description: 'Assigned roles' },
				{ name: 'created_at', type: 'datetime', required: true, description: 'Account creation timestamp' },
			],
			relationships: [],
			constraints: ['Unique on email'],
			invariants: [],
			source_requirements: [],
		},
		{
			entity_name: 'Session',
			description: 'Active user session or token',
			fields: [
				{ name: 'id', type: 'uuid', required: true, description: 'Session identifier' },
				{ name: 'user_id', type: 'uuid', required: true, description: 'Owner user' },
				{ name: 'token', type: 'string', required: true, description: 'Session or refresh token' },
				{ name: 'expires_at', type: 'datetime', required: true, description: 'Expiration timestamp' },
			],
			relationships: [
				{ target_model: '', type: 'many-to-many', description: 'Many sessions per user' },
			],
			constraints: ['Unique on token', 'Expires automatically'],
			invariants: [],
			source_requirements: [],
		},
	],
	interfaces: [
		{
			type: 'REST',
			label: 'Auth API',
			description: 'Login, register, logout, refresh token endpoints',
			provider_component: '',
			consumer_components: [],
			contract: 'POST /auth/login, POST /auth/register, POST /auth/logout, POST /auth/refresh',
			source_workflows: [],
		},
	],
	workflows: [
		{
			label: 'User Login',
			description: 'User authenticates with credentials and receives a session/token',
			steps: [
				{ step_id: 'S1', label: 'Submit credentials', actor: 'User', action: 'POST /auth/login with email + password', inputs: ['email', 'password'], outputs: [], next_steps: ['S2'] },
				{ step_id: 'S2', label: 'Verify credentials', actor: 'System', action: 'Hash password, compare with stored hash', inputs: [], outputs: [], next_steps: ['S3'] },
				{ step_id: 'S3', label: 'Generate token', actor: 'System', action: 'Create JWT or session token', inputs: [], outputs: ['token'], next_steps: [] },
			],
			actors: ['User', 'System'],
			triggers: ['User navigates to login page'],
			outputs: ['Authentication token'],
		},
	],
};

// ==================== CRUD RESOURCE TEMPLATE ====================

export const CRUD_TEMPLATE: CapabilityTemplate = {
	template_id: 'TPL-CRUD',
	label: 'CRUD Resource Management',
	description: 'Standard create-read-update-delete operations for a domain entity with validation and authorization.',
	trigger_patterns: ['crud', 'create', 'read', 'update', 'delete', 'manage', 'entity', 'resource', 'record'],
	components: [
		{
			label: 'Resource Controller',
			responsibility: 'HTTP/API endpoint handlers: request parsing, validation, response formatting',
			rationale: 'Separates HTTP concerns from business logic',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'REST or GraphQL controller',
			file_scope: 'src/resources/<name>/controller/',
			interaction_patterns: [],
		},
		{
			label: 'Resource Service',
			responsibility: 'Business logic: validation rules, authorization checks, data transformation',
			rationale: 'Encapsulates domain rules independently of transport layer',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'Service layer pattern',
			file_scope: 'src/resources/<name>/service/',
			interaction_patterns: [],
		},
		{
			label: 'Resource Repository',
			responsibility: 'Data access: queries, mutations, pagination, filtering',
			rationale: 'Abstracts data storage for testability and portability',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'Repository pattern or ORM',
			file_scope: 'src/resources/<name>/repository/',
			interaction_patterns: [],
		},
	],
	data_models: [
		{
			entity_name: 'Resource',
			description: 'Domain entity with standard lifecycle fields',
			fields: [
				{ name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
				{ name: 'created_by', type: 'uuid', required: true, description: 'Creator user ID' },
				{ name: 'created_at', type: 'datetime', required: true, description: 'Creation timestamp' },
				{ name: 'updated_at', type: 'datetime', required: true, description: 'Last modification timestamp' },
			],
			relationships: [],
			constraints: [],
			invariants: [],
			source_requirements: [],
		},
	],
	interfaces: [
		{
			type: 'REST',
			label: 'Resource CRUD API',
			description: 'Standard CRUD endpoints for the resource',
			provider_component: '',
			consumer_components: [],
			contract: 'GET /, GET /:id, POST /, PUT /:id, DELETE /:id',
			source_workflows: [],
		},
	],
	workflows: [
		{
			label: 'Create Resource',
			description: 'User creates a new resource instance',
			steps: [
				{ step_id: 'S1', label: 'Submit data', actor: 'User', action: 'POST with resource data', inputs: ['resource data'], outputs: [], next_steps: ['S2'] },
				{ step_id: 'S2', label: 'Validate', actor: 'System', action: 'Validate input against schema and business rules', inputs: [], outputs: [], next_steps: ['S3'] },
				{ step_id: 'S3', label: 'Persist', actor: 'System', action: 'Store in database', inputs: [], outputs: ['created resource'], next_steps: [] },
			],
			actors: ['User', 'System'],
			triggers: ['User submits creation form'],
			outputs: ['Created resource with ID'],
		},
	],
};

// ==================== EVENT-DRIVEN TEMPLATE ====================

export const EVENT_DRIVEN_TEMPLATE: CapabilityTemplate = {
	template_id: 'TPL-EVENT',
	label: 'Event-Driven Processing',
	description: 'Asynchronous event production and consumption with pub/sub or webhook patterns.',
	trigger_patterns: ['event', 'async', 'queue', 'pubsub', 'webhook', 'notification', 'subscribe', 'emit', 'message', 'worker'],
	components: [
		{
			label: 'Event Producer',
			responsibility: 'Emit domain events when state changes occur',
			rationale: 'Decouples event emission from consumption',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'Event emitter or message queue publisher',
			file_scope: 'src/events/producers/',
			interaction_patterns: [],
		},
		{
			label: 'Event Consumer / Handler',
			responsibility: 'Process incoming events: execute side effects, update read models, send notifications',
			rationale: 'Handles async side effects without blocking producers',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'Message queue consumer or webhook handler',
			file_scope: 'src/events/consumers/',
			interaction_patterns: [],
		},
		{
			label: 'Event Bus / Broker',
			responsibility: 'Route events between producers and consumers with delivery guarantees',
			rationale: 'Provides reliable event routing and delivery guarantees',
			workflows_served: [],
			dependencies: [],
			technology_notes: 'In-memory event bus, Redis Pub/Sub, or dedicated message broker',
			file_scope: 'src/events/bus/',
			interaction_patterns: [],
		},
	],
	data_models: [
		{
			entity_name: 'DomainEvent',
			description: 'Structured domain event with metadata',
			fields: [
				{ name: 'event_id', type: 'uuid', required: true, description: 'Unique event identifier' },
				{ name: 'event_type', type: 'string', required: true, description: 'Event type discriminator' },
				{ name: 'payload', type: 'json', required: true, description: 'Event data payload' },
				{ name: 'source', type: 'string', required: true, description: 'Producer identifier' },
				{ name: 'timestamp', type: 'datetime', required: true, description: 'Event creation time' },
			],
			relationships: [],
			constraints: ['Immutable after creation'],
			invariants: [],
			source_requirements: [],
		},
	],
	interfaces: [
		{
			type: 'EVENT',
			label: 'Domain Event Channel',
			description: 'Pub/sub channel for domain events',
			provider_component: '',
			consumer_components: [],
			contract: 'publish(event: DomainEvent) / subscribe(eventType, handler)',
			source_workflows: [],
		},
	],
	workflows: [
		{
			label: 'Event Processing',
			description: 'Domain event is produced, routed, and consumed asynchronously',
			steps: [
				{ step_id: 'S1', label: 'State change', actor: 'System', action: 'Domain operation triggers state change', inputs: ['operation result'], outputs: ['domain event'], next_steps: ['S2'] },
				{ step_id: 'S2', label: 'Emit event', actor: 'System', action: 'Publish event to bus/broker', inputs: ['domain event'], outputs: [], next_steps: ['S3'] },
				{ step_id: 'S3', label: 'Consume event', actor: 'System', action: 'Handler processes event and executes side effects', inputs: ['domain event'], outputs: ['side effect result'], next_steps: [] },
			],
			actors: ['System'],
			triggers: ['Domain state change'],
			outputs: ['Side effects executed'],
		},
	],
};

// ==================== TEMPLATE REGISTRY ====================

/**
 * All available capability grammar templates.
 */
export const CAPABILITY_TEMPLATES: CapabilityTemplate[] = [
	AUTH_TEMPLATE,
	CRUD_TEMPLATE,
	EVENT_DRIVEN_TEMPLATE,
];

/**
 * Find templates matching a set of keywords or capability descriptions.
 * Returns templates sorted by match strength (most trigger pattern matches first).
 */
export function findMatchingTemplates(keywords: string[]): CapabilityTemplate[] {
	if (keywords.length === 0) return [];

	const loweredKeywords = keywords.map(k => k.toLowerCase());

	const scored = CAPABILITY_TEMPLATES.map(template => {
		let score = 0;
		for (const pattern of template.trigger_patterns) {
			for (const keyword of loweredKeywords) {
				if (keyword.includes(pattern) || pattern.includes(keyword)) {
					score++;
				}
			}
		}
		return { template, score };
	});

	return scored
		.filter(s => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.map(s => s.template);
}
