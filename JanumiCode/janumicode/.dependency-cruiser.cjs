/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ========================================
    // Layer 1: Presentation Layer Constraints
    // ========================================
    {
      name: 'no-presentation-to-database',
      comment: 'Presentation layer (UI/webview) cannot directly access database layer',
      severity: 'error',
      from: { path: '^src/(lib/ui|webview)/' },
      to: { path: '^src/lib/database/' }
    },
    {
      name: 'no-presentation-to-roles',
      comment: 'Presentation layer cannot directly import role implementations',
      severity: 'error',
      from: { path: '^src/webview/' },
      to: { path: '^src/lib/roles/' }
    },
    {
      name: 'no-presentation-to-cli',
      comment: 'Presentation layer cannot directly access CLI internals',
      severity: 'error',
      from: { path: '^src/(lib/ui|webview)/' },
      to: { path: '^src/lib/cli/' }
    },

    // ========================================
    // Layer 2: Business Logic Constraints
    // ========================================
    {
      name: 'no-workflow-to-ui',
      comment: 'Business logic (workflow) cannot depend on UI specifics',
      severity: 'error',
      from: { path: '^src/lib/(workflow|orchestrator|roles|dialogue)/' },
      to: { path: '^src/(lib/ui|webview)/' }
    },

    // ========================================
    // Layer 3: Infrastructure Constraints
    // ========================================
    {
      name: 'no-database-to-workflow',
      comment: 'Database layer cannot import workflow internals (reverse dependency)',
      severity: 'error',
      from: { path: '^src/lib/database/' },
      to: { path: '^src/lib/(workflow|orchestrator|roles)/' }
    },
    {
      name: 'no-database-to-ui',
      comment: 'Database layer cannot import UI layer',
      severity: 'error',
      from: { path: '^src/lib/database/' },
      to: { path: '^src/(lib/ui|webview)/' }
    },
    {
      name: 'no-llm-to-workflow',
      comment: 'LLM provider layer should not depend on workflow specifics',
      severity: 'warn',
      from: { path: '^src/lib/llm/' },
      to: { path: '^src/lib/(workflow|orchestrator)/' }
    },

    // ========================================
    // Layer 4: Foundation Constraints
    // ========================================
    {
      name: 'no-types-upward-deps',
      comment: 'Foundation types module cannot depend on upper layers',
      severity: 'error',
      from: { path: '^src/lib/types/' },
      to: { 
        path: '^src/lib/(ui|webview|workflow|database|roles|orchestrator|llm|cli)/',
        pathNot: '^src/lib/types/'
      }
    },
    {
      name: 'no-primitives-upward-deps',
      comment: 'Foundation primitives module cannot depend on upper layers',
      severity: 'error',
      from: { path: '^src/lib/primitives/' },
      to: { 
        path: '^src/lib/(ui|webview|workflow|database|roles|orchestrator|llm|cli)/',
        pathNot: '^src/lib/primitives/'
      }
    },

    // ========================================
    // Module Boundary Constraints
    // ========================================
    {
      name: 'webview-isolated-from-workflow',
      comment: 'Webview client code should not import workflow internals',
      severity: 'error',
      from: { path: '^src/webview/' },
      to: { path: '^src/lib/workflow/' }
    },
    {
      name: 'webview-isolated-from-database',
      comment: 'Webview client code should not import database layer',
      severity: 'error',
      from: { path: '^src/webview/' },
      to: { path: '^src/lib/database/' }
    },

    // ========================================
    // Circular Dependency Detection
    // ========================================
    {
      name: 'no-circular-dependencies',
      comment: 'Circular dependencies create coupling and maintenance issues',
      severity: 'error',
      from: {},
      to: { circular: true }
    },

    // ========================================
    // Orphan Detection
    // ========================================
    {
      name: 'no-orphans',
      comment: 'Detect modules not imported anywhere (potential dead code)',
      severity: 'warn',
      from: { 
        orphan: true,
        pathNot: [
          '\\.test\\.ts$',
          '\\.spec\\.ts$',
          '^src/extension\\.ts$',
          '^src/test/',
        ]
      },
      to: {}
    }
  ],

  options: {
    /* Which modules not to follow further when encountered */
    doNotFollow: {
      path: [
        'node_modules',
        '^dist/',
        '\\.test\\.ts$',
        '\\.spec\\.ts$'
      ]
    },

    /* Which modules to include in analysis */
    includeOnly: {
      path: '^src/'
    },

    /* TypeScript configuration */
    tsConfig: {
      fileName: 'tsconfig.json'
    },

    /* Reporting options */
    reporterOptions: {
      dot: {
        collapsePattern: '^src/lib/[^/]+',
        filters: {
          includeOnly: {
            path: '^src/lib'
          }
        }
      },
      text: {
        highlightFocused: true
      }
    },

    /* Performance: use caching */
    cache: true,
    
    /* Enhance module resolution */
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    }
  }
};
