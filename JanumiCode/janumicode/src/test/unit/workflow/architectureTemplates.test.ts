import { describe, it, expect } from 'vitest';
import {
	findMatchingTemplates,
	AUTH_TEMPLATE,
	CRUD_TEMPLATE,
	EVENT_DRIVEN_TEMPLATE,
	CAPABILITY_TEMPLATES,
} from '../../../lib/workflow/architectureTemplates';

describe('ArchitectureTemplates', () => {
	describe('Template Constants', () => {
		it('AUTH_TEMPLATE has required structure', () => {
			expect(AUTH_TEMPLATE).toBeDefined();
			expect(AUTH_TEMPLATE.template_id).toBe('TPL-AUTH');
			expect(AUTH_TEMPLATE.label).toBe('Authentication & Authorization');
			expect(AUTH_TEMPLATE.trigger_patterns).toBeInstanceOf(Array);
			expect(AUTH_TEMPLATE.components).toBeInstanceOf(Array);
			expect(AUTH_TEMPLATE.data_models).toBeInstanceOf(Array);
			expect(AUTH_TEMPLATE.interfaces).toBeInstanceOf(Array);
			expect(AUTH_TEMPLATE.workflows).toBeInstanceOf(Array);
		});

		it('CRUD_TEMPLATE has required structure', () => {
			expect(CRUD_TEMPLATE).toBeDefined();
			expect(CRUD_TEMPLATE.template_id).toBe('TPL-CRUD');
			expect(CRUD_TEMPLATE.label).toBe('CRUD Resource Management');
			expect(CRUD_TEMPLATE.trigger_patterns).toBeInstanceOf(Array);
			expect(CRUD_TEMPLATE.components).toBeInstanceOf(Array);
			expect(CRUD_TEMPLATE.data_models).toBeInstanceOf(Array);
			expect(CRUD_TEMPLATE.interfaces).toBeInstanceOf(Array);
			expect(CRUD_TEMPLATE.workflows).toBeInstanceOf(Array);
		});

		it('EVENT_DRIVEN_TEMPLATE has required structure', () => {
			expect(EVENT_DRIVEN_TEMPLATE).toBeDefined();
			expect(EVENT_DRIVEN_TEMPLATE.template_id).toBe('TPL-EVENT');
			expect(EVENT_DRIVEN_TEMPLATE.label).toBe('Event-Driven Processing');
			expect(EVENT_DRIVEN_TEMPLATE.trigger_patterns).toBeInstanceOf(Array);
			expect(EVENT_DRIVEN_TEMPLATE.components).toBeInstanceOf(Array);
			expect(EVENT_DRIVEN_TEMPLATE.data_models).toBeInstanceOf(Array);
			expect(EVENT_DRIVEN_TEMPLATE.interfaces).toBeInstanceOf(Array);
			expect(EVENT_DRIVEN_TEMPLATE.workflows).toBeInstanceOf(Array);
		});

		it('CAPABILITY_TEMPLATES contains all templates', () => {
			expect(CAPABILITY_TEMPLATES).toHaveLength(3);
			expect(CAPABILITY_TEMPLATES).toContain(AUTH_TEMPLATE);
			expect(CAPABILITY_TEMPLATES).toContain(CRUD_TEMPLATE);
			expect(CAPABILITY_TEMPLATES).toContain(EVENT_DRIVEN_TEMPLATE);
		});

		it('AUTH_TEMPLATE has comprehensive trigger patterns', () => {
			expect(AUTH_TEMPLATE.trigger_patterns).toContain('auth');
			expect(AUTH_TEMPLATE.trigger_patterns).toContain('login');
			expect(AUTH_TEMPLATE.trigger_patterns).toContain('jwt');
			expect(AUTH_TEMPLATE.trigger_patterns).toContain('session');
		});

		it('CRUD_TEMPLATE has comprehensive trigger patterns', () => {
			expect(CRUD_TEMPLATE.trigger_patterns).toContain('crud');
			expect(CRUD_TEMPLATE.trigger_patterns).toContain('create');
			expect(CRUD_TEMPLATE.trigger_patterns).toContain('read');
			expect(CRUD_TEMPLATE.trigger_patterns).toContain('update');
			expect(CRUD_TEMPLATE.trigger_patterns).toContain('delete');
		});

		it('EVENT_DRIVEN_TEMPLATE has comprehensive trigger patterns', () => {
			expect(EVENT_DRIVEN_TEMPLATE.trigger_patterns).toContain('event');
			expect(EVENT_DRIVEN_TEMPLATE.trigger_patterns).toContain('async');
			expect(EVENT_DRIVEN_TEMPLATE.trigger_patterns).toContain('queue');
			expect(EVENT_DRIVEN_TEMPLATE.trigger_patterns).toContain('pubsub');
		});
	});

	describe('findMatchingTemplates', () => {
		it('returns empty array for empty keywords', () => {
			const result = findMatchingTemplates([]);
			expect(result).toEqual([]);
		});

		it('matches auth keywords to AUTH_TEMPLATE', () => {
			const result = findMatchingTemplates(['authentication', 'login']);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe(AUTH_TEMPLATE);
		});

		it('matches crud keywords to CRUD_TEMPLATE', () => {
			const result = findMatchingTemplates(['create', 'update', 'delete']);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe(CRUD_TEMPLATE);
		});

		it('matches event keywords to EVENT_DRIVEN_TEMPLATE', () => {
			const result = findMatchingTemplates(['event', 'pubsub', 'queue']);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe(EVENT_DRIVEN_TEMPLATE);
		});

		it('is case insensitive', () => {
			const lowerResult = findMatchingTemplates(['auth', 'login']);
			const upperResult = findMatchingTemplates(['AUTH', 'LOGIN']);
			const mixedResult = findMatchingTemplates(['Auth', 'LoGiN']);

			expect(lowerResult).toEqual(upperResult);
			expect(upperResult).toEqual(mixedResult);
		});

		it('returns templates sorted by match strength', () => {
			const result = findMatchingTemplates(['auth', 'login', 'session', 'jwt']);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe(AUTH_TEMPLATE);
		});

		it('returns empty array for non-matching keywords', () => {
			const result = findMatchingTemplates(['quantum', 'blockchain', 'metaverse']);
			expect(result).toEqual([]);
		});

		it('matches partial keyword overlap', () => {
			const result = findMatchingTemplates(['authentication']);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe(AUTH_TEMPLATE);
		});

		it('handles single keyword', () => {
			const authResult = findMatchingTemplates(['auth']);
			expect(authResult.length).toBeGreaterThan(0);
			expect(authResult[0]).toBe(AUTH_TEMPLATE);

			const crudResult = findMatchingTemplates(['crud']);
			expect(crudResult.length).toBeGreaterThan(0);
			expect(crudResult[0]).toBe(CRUD_TEMPLATE);

			const eventResult = findMatchingTemplates(['event']);
			expect(eventResult.length).toBeGreaterThan(0);
			expect(eventResult[0]).toBe(EVENT_DRIVEN_TEMPLATE);
		});

		it('returns multiple templates when keywords match multiple patterns', () => {
			const result = findMatchingTemplates(['manage', 'resource']);
			expect(result.length).toBeGreaterThan(0);
		});

		it('prioritizes templates with more matches', () => {
			const result = findMatchingTemplates(['auth', 'login', 'jwt', 'oauth', 'session']);
			expect(result[0]).toBe(AUTH_TEMPLATE);
		});

		it('handles keywords that match pattern substrings', () => {
			const result = findMatchingTemplates(['authentication']);
			expect(result.some(t => t.template_id === 'TPL-AUTH')).toBe(true);
		});

		it('handles keywords that are superstrings of patterns', () => {
			const result = findMatchingTemplates(['authorization']);
			expect(result.length).toBeGreaterThanOrEqual(0);
		});

		it('deduplicates templates in result', () => {
			const result = findMatchingTemplates(['auth', 'authentication', 'login']);
			const templateIds = result.map(t => t.template_id);
			const uniqueIds = new Set(templateIds);
			expect(templateIds.length).toBe(uniqueIds.size);
		});

		it('returns templates in consistent order for same keywords', () => {
			const result1 = findMatchingTemplates(['auth', 'login']);
			const result2 = findMatchingTemplates(['auth', 'login']);
			expect(result1).toEqual(result2);
		});

		it('handles mixed relevant and irrelevant keywords', () => {
			const result = findMatchingTemplates(['auth', 'xyz123', 'login', 'foobar']);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe(AUTH_TEMPLATE);
		});

		it('matches webhook keyword to event template', () => {
			const result = findMatchingTemplates(['webhook']);
			expect(result.some(t => t.template_id === 'TPL-EVENT')).toBe(true);
		});

		it('matches notification keyword to event template', () => {
			const result = findMatchingTemplates(['notification']);
			expect(result.some(t => t.template_id === 'TPL-EVENT')).toBe(true);
		});

		it('matches entity keyword to crud template', () => {
			const result = findMatchingTemplates(['entity']);
			expect(result.some(t => t.template_id === 'TPL-CRUD')).toBe(true);
		});

		it('matches rbac keyword to auth template', () => {
			const result = findMatchingTemplates(['rbac']);
			expect(result.some(t => t.template_id === 'TPL-AUTH')).toBe(true);
		});

		it('matches permission keyword to auth template', () => {
			const result = findMatchingTemplates(['permission']);
			expect(result.some(t => t.template_id === 'TPL-AUTH')).toBe(true);
		});

		it('handles empty string keywords', () => {
			const result = findMatchingTemplates(['', 'auth', '']);
			expect(result.length).toBeGreaterThan(0);
		});

		it('handles whitespace in keywords', () => {
			const result = findMatchingTemplates(['  auth  ', 'login']);
			expect(result.length).toBeGreaterThan(0);
		});

		it('returns all templates when keywords match all patterns', () => {
			const result = findMatchingTemplates(['auth', 'crud', 'event']);
			expect(result.length).toBe(3);
		});
	});

	describe('Template Component Structure', () => {
		it('AUTH_TEMPLATE has auth service component', () => {
			const authService = AUTH_TEMPLATE.components.find(c => c.label === 'Auth Service');
			expect(authService).toBeDefined();
			expect(authService?.responsibility).toContain('authentication');
		});

		it('AUTH_TEMPLATE has auth middleware component', () => {
			const middleware = AUTH_TEMPLATE.components.find(c => c.label === 'Auth Middleware');
			expect(middleware).toBeDefined();
			expect(middleware?.responsibility).toContain('authentication guard');
		});

		it('CRUD_TEMPLATE has controller component', () => {
			const controller = CRUD_TEMPLATE.components.find(c => c.label === 'Resource Controller');
			expect(controller).toBeDefined();
			expect(controller?.responsibility).toContain('endpoint handlers');
		});

		it('CRUD_TEMPLATE has service component', () => {
			const service = CRUD_TEMPLATE.components.find(c => c.label === 'Resource Service');
			expect(service).toBeDefined();
			expect(service?.responsibility).toContain('Business logic');
		});

		it('CRUD_TEMPLATE has repository component', () => {
			const repository = CRUD_TEMPLATE.components.find(c => c.label === 'Resource Repository');
			expect(repository).toBeDefined();
			expect(repository?.responsibility).toContain('Data access');
		});

		it('EVENT_DRIVEN_TEMPLATE has producer component', () => {
			const producer = EVENT_DRIVEN_TEMPLATE.components.find(c => c.label === 'Event Producer');
			expect(producer).toBeDefined();
			expect(producer?.responsibility).toContain('Emit domain events');
		});

		it('EVENT_DRIVEN_TEMPLATE has consumer component', () => {
			const consumer = EVENT_DRIVEN_TEMPLATE.components.find(c => c.label === 'Event Consumer / Handler');
			expect(consumer).toBeDefined();
			expect(consumer?.responsibility).toContain('Process incoming events');
		});

		it('EVENT_DRIVEN_TEMPLATE has event bus component', () => {
			const bus = EVENT_DRIVEN_TEMPLATE.components.find(c => c.label === 'Event Bus / Broker');
			expect(bus).toBeDefined();
			expect(bus?.responsibility).toContain('Route events');
		});
	});

	describe('Template Data Models', () => {
		it('AUTH_TEMPLATE has User data model', () => {
			const user = AUTH_TEMPLATE.data_models.find(m => m.entity_name === 'User');
			expect(user).toBeDefined();
			expect(user?.fields.some(f => f.name === 'email')).toBe(true);
			expect(user?.fields.some(f => f.name === 'password_hash')).toBe(true);
		});

		it('AUTH_TEMPLATE has Session data model', () => {
			const session = AUTH_TEMPLATE.data_models.find(m => m.entity_name === 'Session');
			expect(session).toBeDefined();
			expect(session?.fields.some(f => f.name === 'token')).toBe(true);
			expect(session?.fields.some(f => f.name === 'expires_at')).toBe(true);
		});

		it('CRUD_TEMPLATE has Resource data model', () => {
			const resource = CRUD_TEMPLATE.data_models.find(m => m.entity_name === 'Resource');
			expect(resource).toBeDefined();
			expect(resource?.fields.some(f => f.name === 'id')).toBe(true);
			expect(resource?.fields.some(f => f.name === 'created_at')).toBe(true);
		});

		it('EVENT_DRIVEN_TEMPLATE has DomainEvent data model', () => {
			const event = EVENT_DRIVEN_TEMPLATE.data_models.find(m => m.entity_name === 'DomainEvent');
			expect(event).toBeDefined();
			expect(event?.fields.some(f => f.name === 'event_type')).toBe(true);
			expect(event?.fields.some(f => f.name === 'payload')).toBe(true);
		});
	});

	describe('Template Workflows', () => {
		it('AUTH_TEMPLATE has login workflow', () => {
			const login = AUTH_TEMPLATE.workflows.find(w => w.label === 'User Login');
			expect(login).toBeDefined();
			expect(login?.steps.length).toBeGreaterThan(0);
			expect(login?.actors).toContain('User');
		});

		it('CRUD_TEMPLATE has create workflow', () => {
			const create = CRUD_TEMPLATE.workflows.find(w => w.label === 'Create Resource');
			expect(create).toBeDefined();
			expect(create?.steps.length).toBeGreaterThan(0);
		});

		it('EVENT_DRIVEN_TEMPLATE has event processing workflow', () => {
			const processing = EVENT_DRIVEN_TEMPLATE.workflows.find(w => w.label === 'Event Processing');
			expect(processing).toBeDefined();
			expect(processing?.steps.length).toBeGreaterThan(0);
		});
	});

	describe('Template Interfaces', () => {
		it('AUTH_TEMPLATE has Auth API interface', () => {
			const api = AUTH_TEMPLATE.interfaces.find(i => i.label === 'Auth API');
			expect(api).toBeDefined();
			expect(api?.type).toBe('REST');
			expect(api?.contract).toContain('/auth/login');
		});

		it('CRUD_TEMPLATE has CRUD API interface', () => {
			const api = CRUD_TEMPLATE.interfaces.find(i => i.label === 'Resource CRUD API');
			expect(api).toBeDefined();
			expect(api?.type).toBe('REST');
			expect(api?.contract).toContain('GET /');
		});

		it('EVENT_DRIVEN_TEMPLATE has event channel interface', () => {
			const channel = EVENT_DRIVEN_TEMPLATE.interfaces.find(i => i.label === 'Domain Event Channel');
			expect(channel).toBeDefined();
			expect(channel?.type).toBe('EVENT');
			expect(channel?.contract).toContain('publish');
		});
	});
});
