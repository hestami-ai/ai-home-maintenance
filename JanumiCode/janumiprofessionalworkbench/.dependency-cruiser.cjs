/**
 * dependency-cruiser rules for the JPWB engine.
 * Enforces the package DAG from tracker §4 and the "engine never imports UI/host" rule (§9 risk 7).
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
	forbidden: [
		{
			name: 'no-circular',
			comment: 'Circular deps break the layered engine and the build order.',
			severity: 'error',
			from: {},
			to: { circular: true }
		},
		{
			name: 'not-to-unresolvable',
			comment: 'Every import must resolve.',
			severity: 'error',
			from: {},
			to: { couldNotResolve: true }
		},
		{
			name: 'contracts-is-foundation',
			comment: 'rph-contracts is the foundation; it must not depend on any other rph-* package.',
			severity: 'error',
			from: { path: '^packages/rph-contracts/src' },
			to: { path: '^packages/rph-(?!contracts/)[a-z-]+/' }
		},
		{
			name: 'domain-purity',
			comment: 'rph-domain is a pure kernel: no persistence/application/assurance/controller/projections/engine/product-realization-pwa.',
			severity: 'error',
			from: { path: '^packages/rph-domain/src' },
			to: {
				path: '^packages/rph-(persistence|application|assurance|controller|projections|engine|product-realization-pwa)/'
			}
		},
		{
			name: 'ports-purity',
			comment: 'rph-ports declares interfaces only; it depends solely on rph-contracts.',
			severity: 'error',
			from: { path: '^packages/rph-ports/src' },
			to: {
				path: '^packages/rph-(domain|persistence|application|assurance|controller|projections|engine|product-realization-pwa)/'
			}
		},
		{
			name: 'projections-browser-safe',
			comment:
				'rph-projections is the browser-safe pure View/read-model seam a UI consumes DIRECTLY (the M14 demo imports it, not the engine). It must not import Node-only engine packages or the PWA data package — that would drag better-sqlite3 / node:crypto into a browser bundle. It may depend only on the browser-safe rph-contracts, rph-domain, and rph-ports APIs.',
			severity: 'error',
			from: { path: '^packages/rph-projections/src' },
			to: {
				path: '^packages/rph-(persistence|application|assurance|controller|engine|product-realization-pwa)/'
			}
		},
		{
			name: 'no-app-or-ui-in-core',
			comment: 'Engine core (rph-*) must NEVER import a UI/host/app module. UI is a surface obligation.',
			severity: 'error',
			from: { path: '^packages/rph-' },
			to: { path: '^apps/' }
		}
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		exclude: { path: '(^|/)(node_modules|dist|coverage|\\.turbo)/' },
		tsConfig: { fileName: 'tsconfig.json' },
		tsPreCompilationDeps: true,
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			// Resolve workspace cross-package imports to SOURCE (not built dist, which is excluded),
			// so the boundary rules actually enforce on source. Only depcruise uses the 'source'
			// condition; Node/Bun/Vitest/tsc ignore it and use types/import -> dist.
			conditionNames: ['source', 'import', 'types', 'node', 'default']
		}
	}
};
