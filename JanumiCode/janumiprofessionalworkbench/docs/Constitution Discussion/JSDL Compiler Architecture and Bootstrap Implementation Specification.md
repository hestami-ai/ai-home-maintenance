# JSDL Compiler Architecture and Bootstrap Implementation Specification

## Compiler Specification v0.1.0

**Document ID:** `JAN-JSDLC-001`
**Version:** `0.1.0`
**Status:** Draft
**Depends on:** JSDL Core v0.1, CPCO v0.1, PWU Specification v0.1, RPH Specification v0.1, Canonical Projection Model v0.1
**Primary audiences:** Compiler engineers, coding agents, platform architects, TypeScript engineers, generator authors, test engineers
**Reference implementation language:** TypeScript
**Reference runtimes:** Node.js and Bun

---

# 1. Purpose

This specification defines the reference architecture and first implementation plan for the Janumi Semantic Definition Language compiler.

The JSDL compiler transforms canonical semantic source into a validated, normalized, technology-neutral model from which implementation artifacts are generated.

The compiler SHALL operate as a semantic compiler rather than a text-template processor.

It must understand and validate:

* modules;
* imports;
* types;
* entities;
* value objects;
* relationships;
* aggregates;
* lifecycles;
* commands;
* events;
* invariants;
* validators;
* permissions;
* projections;
* observability definitions;
* PWA extensions;
* semantic version compatibility.

The compiler SHALL reject ambiguous or invalid professional semantics before code generation begins.

---

# 2. Compiler Objectives

The reference compiler SHALL provide:

1. deterministic compilation;
2. precise structured diagnostics;
3. source-to-generated-artifact traceability;
4. explicit module and version resolution;
5. strong semantic validation;
6. technology-neutral intermediate representation;
7. isolated target generators;
8. reproducible builds;
9. compatibility analysis;
10. testable compiler phases;
11. safe handling of untrusted model source;
12. extensibility without semantic fragmentation.

---

# 3. Non-Goals

The first compiler SHALL NOT attempt to:

* execute professional workflows;
* run validators against live enterprise state;
* replace the Janumi runtime;
* generate complete production applications;
* infer missing professional semantics;
* support arbitrary executable code in JSDL;
* optimize generated SQL for all deployment scales;
* provide a general-purpose programming language;
* implement unrestricted macros;
* dynamically download unknown compiler plugins during compilation.

The first milestone is a trustworthy semantic compilation pipeline.

---

# 4. End-to-End Compilation Pipeline

```text
JSDL YAML or JSON
        ↓
Source Loader
        ↓
Parser
        ↓
Raw Syntax Tree
        ↓
Module Resolver
        ↓
Symbol Collection
        ↓
Reference Resolution
        ↓
Type Checking
        ↓
Semantic Validation
        ↓
Canonical Intermediate Representation
        ↓
Model Compatibility Analysis
        ↓
Generator Planning
        ↓
Target Generators
        ↓
Generated Artifacts
        ↓
Generated Artifact Validation
```

Each phase SHALL possess a defined input contract, output contract, and diagnostic boundary.

---

# 5. Reference Package Architecture

The reference repository SHOULD contain the following packages.

```text
packages/
├── jsdl-core/
├── jsdl-source/
├── jsdl-parser/
├── jsdl-ast/
├── jsdl-module-resolver/
├── jsdl-symbols/
├── jsdl-type-system/
├── jsdl-expression/
├── jsdl-semantic/
├── jsdl-ir/
├── jsdl-diagnostics/
├── jsdl-compiler/
├── jsdl-generator-api/
├── jsdl-generator-typescript/
├── jsdl-generator-json-schema/
├── jsdl-generator-docs/
├── jsdl-model-diff/
├── jsdl-testkit/
├── jsdl-cli/
└── jsdl-bootstrap-schema/
```

Applications MAY initially use a monorepo with workspace-based package management.

---

# 6. Package Responsibilities

## 6.1 `jsdl-core`

Contains foundational compiler types shared by all packages.

Examples:

```text
SourceId
ModuleId
SemanticVersion
QualifiedName
SymbolId
DiagnosticCode
CompilerPhase
CompilationMode
```

This package SHALL not depend on parser, semantic, generator, or CLI packages.

---

## 6.2 `jsdl-source`

Responsible for:

* source-file discovery;
* file loading;
* content hashing;
* source identity;
* line and column mapping;
* source text retention;
* supported-encoding validation;
* normalized path handling.

It SHALL not parse JSDL semantics.

---

## 6.3 `jsdl-parser`

Responsible for:

* parsing YAML and JSON;
* converting parsed structures into raw JSDL syntax nodes;
* identifying unsupported fields;
* preserving source locations;
* reporting syntax and structural errors.

It SHALL not resolve semantic names or imports.

---

## 6.4 `jsdl-ast`

Defines:

* raw syntax tree nodes;
* parsed module structures;
* source-location metadata;
* discriminated unions for JSDL declarations.

The raw AST preserves authoring structure and unresolved references.

---

## 6.5 `jsdl-module-resolver`

Responsible for:

* locating imported modules;
* evaluating semantic version ranges;
* resolving module aliases;
* detecting incompatible imports;
* detecting forbidden dependency cycles;
* constructing the module dependency graph;
* selecting exact module versions.

It SHALL not perform entity-level type checking.

---

## 6.6 `jsdl-symbols`

Responsible for:

* symbol declaration;
* namespace construction;
* qualified-name resolution;
* alias handling;
* duplicate-symbol detection;
* symbol visibility;
* import/export enforcement;
* source-to-symbol mapping.

---

## 6.7 `jsdl-type-system`

Responsible for:

* primitive types;
* collection types;
* reference types;
* owned types;
* scalar aliases;
* value objects;
* entity inheritance;
* assignability;
* type compatibility;
* property constraints;
* nullability and optionality.

---

## 6.8 `jsdl-expression`

Responsible for the constrained invariant and guard expression language.

It includes:

* expression tokenizer;
* expression parser;
* expression AST;
* type checker;
* safe interpreter;
* normalized expression serializer.

It SHALL prohibit arbitrary code execution.

---

## 6.9 `jsdl-semantic`

Responsible for cross-definition professional semantic validation.

Examples:

* entities require identity;
* commands target valid aggregates;
* lifecycle transitions reference valid commands;
* emitted events exist;
* aggregate ownership does not conflict;
* permissions apply to valid commands;
* projections traverse valid relationships;
* extensions preserve canonical invariants.

---

## 6.10 `jsdl-ir`

Defines the canonical intermediate representation.

The IR SHALL:

* contain fully resolved semantic references;
* use stable symbol identifiers;
* normalize shorthand syntax;
* remove authoring ambiguity;
* preserve source mappings;
* remain independent of generation targets.

---

## 6.11 `jsdl-diagnostics`

Defines:

* diagnostic structures;
* severity;
* diagnostic codes;
* related locations;
* suggested corrections;
* formatting for terminal, JSON, and IDE use.

---

## 6.12 `jsdl-compiler`

Coordinates compiler phases.

It SHALL not contain target-specific generation logic.

---

## 6.13 `jsdl-generator-api`

Defines the interface all generators must implement.

---

## 6.14 Generator Packages

Each generator package SHALL consume the canonical IR only.

Generators SHALL NOT parse source files directly.

Initial generators:

```text
jsdl-generator-typescript
jsdl-generator-json-schema
jsdl-generator-docs
```

Later generators:

```text
jsdl-generator-openapi
jsdl-generator-postgresql
jsdl-generator-event-registry
jsdl-generator-frontend-metadata
```

---

## 6.15 `jsdl-model-diff`

Responsible for:

* comparing two canonical models;
* classifying semantic changes;
* identifying affected generated contracts;
* detecting breaking changes;
* producing human- and machine-readable compatibility reports.

---

## 6.16 `jsdl-testkit`

Provides:

* in-memory source fixtures;
* compiler harnesses;
* diagnostic assertions;
* IR snapshots;
* generator golden tests;
* invalid-model fixtures;
* compatibility-test utilities.

---

## 6.17 `jsdl-cli`

Provides the command-line interface.

It depends on the compiler and generators but SHALL contain no semantic compiler rules.

---

## 6.18 `jsdl-bootstrap-schema`

Contains the bootstrap JSON Schema for validating top-level JSDL source shape.

The bootstrap schema provides early structural feedback.

It SHALL not be treated as a substitute for semantic compilation.

---

# 7. Layer Dependency Rules

Allowed dependency direction:

```text
CLI
 ↓
Compiler
 ↓
Parser / Resolver / Symbols / Type System / Semantic / IR
 ↓
Core / Source / AST / Diagnostics
```

Generator dependency direction:

```text
Generator
 ↓
Generator API
 ↓
IR
 ↓
Core
```

Prohibited examples:

* `jsdl-core` depending on `jsdl-compiler`;
* a generator depending on `jsdl-parser`;
* the parser depending on a generator;
* the IR importing CLI types;
* semantic validation importing presentation templates.

A dependency-cycle test SHALL enforce these boundaries.

---

# 8. Source Model

Every source file SHALL be represented by:

```typescript
export interface SourceFile {
  readonly sourceId: SourceId;
  readonly absolutePath: string;
  readonly logicalPath: string;
  readonly format: "yaml" | "json";
  readonly content: string;
  readonly contentHash: string;
  readonly lineMap: LineMap;
}
```

## 8.1 Source Identity

Source identity SHALL not rely solely on an operating-system-specific path.

Logical source paths SHALL use normalized forward-slash separators.

## 8.2 Content Hashing

Content hashes SHOULD use SHA-256.

Hashes support:

* incremental compilation;
* reproducibility;
* cache validation;
* generated artifact traceability.

---

# 9. Source Location Model

Every parsed declaration and relevant property SHALL retain source location.

```typescript
export interface SourceRange {
  readonly sourceId: SourceId;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}
```

Line and column values SHOULD be one-based in user-facing diagnostics.

Offsets MAY remain zero-based internally.

## 9.1 Related Locations

Diagnostics MAY reference multiple locations.

Example:

* original symbol declaration;
* conflicting declaration;
* invalid reference;
* imported module constraint.

---

# 10. Raw Syntax Tree

The raw syntax tree represents parsed but unresolved JSDL.

## 10.1 Root Structure

```typescript
export interface RawJsdlDocument {
  readonly jsdlVersion: string;
  readonly module: RawModuleDeclaration;
  readonly imports: readonly RawImportDeclaration[];
  readonly enums: ReadonlyMap<string, RawEnumDeclaration>;
  readonly valueObjects: ReadonlyMap<string, RawValueObjectDeclaration>;
  readonly entities: ReadonlyMap<string, RawEntityDeclaration>;
  readonly relationships: ReadonlyMap<string, RawRelationshipDeclaration>;
  readonly aggregates: ReadonlyMap<string, RawAggregateDeclaration>;
  readonly lifecycles: ReadonlyMap<string, RawLifecycleDeclaration>;
  readonly commands: ReadonlyMap<string, RawCommandDeclaration>;
  readonly events: ReadonlyMap<string, RawEventDeclaration>;
  readonly invariants: ReadonlyMap<string, RawInvariantDeclaration>;
  readonly validators: ReadonlyMap<string, RawValidatorDeclaration>;
  readonly projections: ReadonlyMap<string, RawProjectionDeclaration>;
  readonly permissions: ReadonlyMap<string, RawPermissionDeclaration>;
  readonly observability: RawObservabilityDeclaration | undefined;
  readonly extensions: ReadonlyMap<string, RawExtensionDeclaration>;
  readonly sourceRange: SourceRange;
}
```

## 10.2 Raw References

Raw references retain source spelling.

```typescript
export interface RawTypeReference {
  readonly text: string;
  readonly sourceRange: SourceRange;
}
```

Example values:

```text
String
Set<Reference<cpco.Intent>>
ProfessionalObjective
```

---

# 11. Parsed Type Reference Model

The type parser SHALL convert type strings into explicit nodes.

```typescript
export type ParsedTypeReference =
  | PrimitiveTypeReference
  | NamedTypeReference
  | CollectionTypeReference
  | ReferenceTypeReference
  | OwnedTypeReference;
```

Example:

```text
Set<Reference<cpco.Intent>>
```

becomes:

```text
CollectionTypeReference(Set)
  └── ReferenceTypeReference
        └── NamedTypeReference(cpco.Intent)
```

This structure SHALL be created before semantic name resolution.

---

# 12. Module Resolution

## 12.1 Resolution Inputs

The resolver receives:

* root source modules;
* configured module search paths;
* local workspace modules;
* optional package registry metadata;
* lockfile;
* allowed version policies.

## 12.2 Deterministic Resolution

Given identical:

* source content;
* compiler version;
* configuration;
* lockfile;
* module registry state;

resolution SHALL select identical module versions.

## 12.3 Lockfile

The compiler SHOULD support:

```text
jsdl.lock.yaml
```

Example:

```yaml
lockfileVersion: 1

modules:
  janumi.foundation:
    version: 0.1.3
    source: workspace
    integrity: sha256-...

  janumi.cpco.core:
    version: 0.1.1
    source: workspace
    integrity: sha256-...
```

## 12.4 Resolution Algorithm

For each imported module:

1. parse version range;
2. locate candidate versions;
3. remove incompatible candidates;
4. apply lockfile selection where valid;
5. select highest permitted stable version unless policy specifies otherwise;
6. validate integrity;
7. register alias;
8. recursively resolve imports;
9. detect invalid cycles;
10. record exact resolved version.

## 12.5 Cycle Rules

Cycles MAY be permitted only where modules exchange declarations that can be resolved without incomplete semantic initialization.

JSDL Core v0.1 SHOULD reject all module import cycles initially.

A future version may introduce explicit interface modules or cycle-safe declaration phases.

---

# 13. Symbol Model

Every declaration SHALL receive a stable compiler symbol identifier.

```typescript
export interface Symbol {
  readonly symbolId: SymbolId;
  readonly kind: SymbolKind;
  readonly localName: string;
  readonly qualifiedName: QualifiedName;
  readonly moduleId: ModuleId;
  readonly sourceRange: SourceRange;
  readonly visibility: "public" | "module";
}
```

## 13.1 Symbol Kinds

```text
enum
enum_value
scalar
value_object
entity
relationship
aggregate
lifecycle
command
event
invariant
validator
projection
permission
metric
trace
extension
property
transition
```

## 13.2 Qualified Names

Examples:

```text
janumi.cpco.core.Intent
janumi.work.pwu.ProfessionalWorkUnit
janumi.work.pwu.PwuLifecycle.Complete
```

## 13.3 Stable Symbol IDs

A symbol ID SHOULD be derived deterministically from:

```text
module namespace
+
module major version
+
qualified semantic path
+
symbol kind
```

The exact algorithm SHALL be documented and versioned.

Symbol IDs SHALL not depend on file ordering.

---

# 14. Symbol Collection

Symbol collection occurs before reference resolution.

For every module, the compiler SHALL register top-level declaration names.

It SHALL detect:

* duplicate local names;
* duplicate qualified names;
* collisions among imported aliases;
* invalid reserved names;
* incompatible declaration replacement.

Property and nested symbols are registered after parent declarations exist.

---

# 15. Reference Resolution

Reference resolution converts raw or parsed names into stable symbol references.

## 15.1 Resolution Order

For an unqualified name:

1. local declaration;
2. explicitly imported symbol;
3. prelude or foundation symbol;
4. error.

For an alias-qualified name:

```text
cpco.Intent
```

the compiler SHALL resolve:

1. alias `cpco`;
2. imported module;
3. exported `Intent` symbol.

## 15.2 Ambiguity

If multiple imported unqualified symbols match, compilation SHALL fail.

The compiler SHALL not choose based on import order.

## 15.3 Unknown Symbol Diagnostic

Example:

```text
JSDL-E210 UNKNOWN_SYMBOL

Unable to resolve type 'ConfidnceAssessment'.
Did you mean 'ConfidenceAssessment'?
```

Suggestions MAY use edit distance and available symbol context.

---

# 16. Type System

## 16.1 Type Categories

```text
primitive
scalar_alias
enum
value_object
entity
collection
reference
owned
map
union
```

Union types MAY be deferred to JSDL v0.2 unless required by generated event or command contracts.

## 16.2 Entity Versus Value Object

Entities possess stable identity.

Value objects do not.

A direct owned property MAY embed a value object.

Entity references SHOULD use `Reference<Entity>` unless the aggregate explicitly owns the entity.

## 16.3 `Owned<T>`

`Owned<T>` indicates:

* lifecycle governed by the containing aggregate;
* no independent aggregate identity requirement;
* deletion or replacement controlled by the owner;
* generated persistence may use embedded or child-table strategies.

## 16.4 `Reference<T>`

`Reference<T>` indicates:

* externally governed identity;
* no direct mutation through the containing aggregate;
* generated contracts carry identifiers rather than embedded authoritative state unless a projection expands them.

## 16.5 Assignability Rules

Examples:

* `String` is assignable to scalar aliases based on `String` only after alias constraints validate;
* an entity subtype reference is assignable to a base entity reference;
* a base entity reference is not assignable to a subtype reference without narrowing;
* `List<T>` is not assignable to `Set<T>`;
* optional does not imply nullable;
* nullable does not imply optional.

---

# 17. Inheritance Validation

Entity inheritance SHALL be single inheritance in JSDL v0.1.

The compiler SHALL reject:

* inheritance cycles;
* identity-type changes;
* property redefinition with incompatible type;
* weakened required constraints;
* canonical invariant removal;
* subtype declarations contradicting base semantics.

Composition SHOULD be preferred when semantic specialization is not valid.

---

# 18. Aggregate Validation

The compiler SHALL verify:

1. root is an entity;
2. owned types are valid;
3. referenced types exist;
4. no entity is owned by multiple aggregates unless explicitly supported;
5. commands target the aggregate;
6. version property exists for optimistic concurrency;
7. version property is integral;
8. aggregate invariants reference available state;
9. lifecycle is reachable from the root;
10. event declarations reference valid aggregate entities.

## 18.1 Semantic Versus Transactional Boundary

The compiler SHALL permit a semantic PWU to reference entities outside the transactional PWU aggregate.

It SHALL not infer ownership merely because an entity appears in PWU projections.

---

# 19. Lifecycle Semantic Validation

The lifecycle validator SHALL check:

* initial state exists;
* all transition source and target states exist;
* terminal states do not have outgoing transitions unless explicitly permitted;
* every command-bound transition references a valid command;
* every emitted event exists;
* transition names are unique;
* unreachable states are reported;
* states with no outgoing transitions are either terminal or warned;
* duplicate transitions with indistinguishable guards are rejected;
* lifecycle property type matches the state enum or generated lifecycle state type.

## 19.1 Reachability

The compiler SHALL construct the lifecycle graph and identify:

* unreachable states;
* dead ends;
* terminal states;
* strongly connected components;
* potentially unintended transition cycles.

Cycles are valid when professional work supports reopening or iteration.

They SHOULD be disclosed in generated lifecycle documentation.

---

# 20. Command Semantic Validation

For each command, the compiler SHALL verify:

* target aggregate exists;
* payload types resolve;
* authority permission exists;
* precondition validators exist;
* emitted events exist;
* failure codes are declared;
* deterministic effects reference valid fields;
* originating projection context type is available;
* expected concurrency behavior is defined.

A command bound to a lifecycle transition SHALL be compatible with that transition.

---

# 21. Event Semantic Validation

For each event, the compiler SHALL verify:

* aggregate exists;
* payload types resolve;
* event name is globally qualified;
* event envelope fields are not redefined incompatibly;
* referenced entities are valid;
* observability category exists;
* event versioning policy is defined or inherited.

The compiler SHOULD detect events declared but never emitted.

This MAY be a warning rather than an error.

---

# 22. Permission Validation

The permission validator SHALL check:

* target command exists;
* allowed roles exist;
* conditions type-check to Boolean;
* denied conditions type-check to Boolean;
* scope references valid semantic properties;
* AI authority settings are explicit where AI roles are permitted;
* approval and exception permissions are not accidentally granted through broad wildcard roles.

High-risk permissions SHOULD generate warnings when defined without restrictive conditions.

---

# 23. Projection Validation

For each projection, the compiler SHALL verify:

* root entity exists;
* included entities exist;
* relationship traversal paths are valid;
* commands are valid;
* roles and permissions exist;
* requested temporal modes are supported by relevant entities;
* required disclosures reference supported semantic concepts;
* ordering and aggregation fields resolve;
* presentation hints do not contain prohibited technical layout semantics.

## 23.1 Relationship Path Validation

A path such as:

```text
Decision
→ ClaimJustifiesDecision
→ Claim
→ EvidenceSupportsClaim
→ Evidence
```

SHALL be type checked at every edge.

---

# 24. Extension Validation

The compiler SHALL verify that a PWA extension:

* extends a valid canonical declaration;
* uses a unique subtype name;
* does not weaken inherited invariants;
* does not replace canonical identity;
* does not alter canonical lifecycle meaning incompatibly;
* does not introduce conflicting relationship semantics;
* declares required validators for specialized professional semantics.

---

# 25. Expression Language

## 25.1 Supported Syntax

JSDL v0.1 expressions SHOULD support:

```text
and
or
not
==
!=
<
<=
>
>=
in
contains
implies
property access
list and set literals
function invocation from approved standard library
all
any
none
```

Example:

```text
self.exploratoryPurpose == true
or size(self.originatingIntentIds) >= 1
```

## 25.2 Standard Functions

Initial safe functions:

```text
size(collection)
length(string)
trim(string)
lower(string)
upper(string)
present(value)
absent(value)
all(collection, predicate)
any(collection, predicate)
none(collection, predicate)
startsWith(string, prefix)
endsWith(string, suffix)
```

## 25.3 Prohibited Capabilities

Expressions SHALL NOT:

* access files;
* access network resources;
* spawn processes;
* inspect environment variables;
* mutate state;
* call arbitrary JavaScript;
* use nondeterministic time unless time is supplied explicitly as evaluation context;
* use randomness.

## 25.4 Expression Evaluation Context

```typescript
export interface ExpressionEvaluationContext {
  readonly self: unknown;
  readonly actor?: unknown;
  readonly command?: unknown;
  readonly now?: string;
  readonly namedValues: ReadonlyMap<string, unknown>;
}
```

`now` SHALL be supplied by the runtime rather than read implicitly.

---

# 26. Canonical Intermediate Representation

The canonical IR is the normalized semantic source of truth used by generators.

## 26.1 IR Root

```typescript
export interface JsdlModelIr {
  readonly compilerModelVersion: string;
  readonly modules: readonly ModuleIr[];
  readonly symbols: ReadonlyMap<SymbolId, SymbolIr>;
  readonly entities: readonly EntityIr[];
  readonly valueObjects: readonly ValueObjectIr[];
  readonly enums: readonly EnumIr[];
  readonly relationships: readonly RelationshipIr[];
  readonly aggregates: readonly AggregateIr[];
  readonly lifecycles: readonly LifecycleIr[];
  readonly commands: readonly CommandIr[];
  readonly events: readonly EventIr[];
  readonly invariants: readonly InvariantIr[];
  readonly validators: readonly ValidatorIr[];
  readonly permissions: readonly PermissionIr[];
  readonly projections: readonly ProjectionIr[];
  readonly observability: ObservabilityIr;
  readonly extensions: readonly ExtensionIr[];
  readonly sourceMap: ModelSourceMap;
  readonly fingerprint: string;
}
```

## 26.2 IR Requirements

The IR SHALL:

* contain no unresolved semantic names;
* represent all types structurally;
* normalize default values;
* use exact resolved module versions;
* assign deterministic symbol IDs;
* include inherited properties and invariants with origin metadata;
* preserve declaration ordering only where semantically relevant;
* include stable canonical sorting keys;
* contain a model fingerprint.

---

# 27. Model Fingerprint

The compiler SHALL generate a deterministic fingerprint over canonical IR.

The fingerprint SHALL ignore:

* source-file order;
* YAML key order;
* comments;
* non-semantic formatting.

It SHALL include:

* module versions;
* semantic declarations;
* types;
* relationships;
* invariants;
* lifecycle transitions;
* commands;
* events;
* permissions;
* projections.

The fingerprint supports:

* reproducible builds;
* cache identity;
* deployment verification;
* compatibility checks.

---

# 28. Deterministic Compilation

Compilation output SHALL be deterministic.

Given the same:

* normalized source;
* exact dependency versions;
* compiler version;
* configuration;
* generator version;

the compiler SHALL produce byte-identical canonical IR and generated output, except where a target format explicitly embeds an approved build timestamp.

Build timestamps SHOULD be excluded by default.

## 28.1 Sorting

Canonical output SHALL sort declarations by stable semantic key rather than source discovery order.

## 28.2 Newlines and Encoding

Generated text SHALL use:

* UTF-8;
* normalized line endings configured consistently;
* stable indentation;
* stable key ordering.

---

# 29. Incremental Compilation

Incremental compilation MAY be introduced after the non-incremental compiler is correct.

The design SHOULD support:

* source content hashes;
* module dependency graph;
* symbol dependency graph;
* generator dependency tracking;
* invalidation by changed declaration.

Correctness SHALL take priority over incremental performance.

---

# 30. Diagnostic Model

```typescript
export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly category: DiagnosticCategory;
  readonly message: string;
  readonly primaryRange: SourceRange;
  readonly related: readonly RelatedDiagnosticLocation[];
  readonly semanticPath?: string;
  readonly suggestion?: DiagnosticSuggestion;
  readonly phase: CompilerPhase;
}
```

## 30.1 Severity

```text
error
warning
information
hint
```

## 30.2 Categories

```text
syntax
structure
module_resolution
symbol_resolution
type
inheritance
aggregate
lifecycle
command
event
invariant
validator
permission
projection
extension
versioning
generator
configuration
security
```

## 30.3 Diagnostic Code Families

```text
JSDL-E1xx Syntax and structure
JSDL-E2xx Module and symbol resolution
JSDL-E3xx Type system
JSDL-E4xx Aggregate and lifecycle
JSDL-E5xx Commands, events, and permissions
JSDL-E6xx Invariants and validators
JSDL-E7xx Projections and extensions
JSDL-E8xx Versioning and compatibility
JSDL-E9xx Generation and configuration
```

Warnings use `JSDL-W...`.

---

# 31. Diagnostic Quality Requirements

Diagnostics SHOULD answer:

* what is wrong;
* where it is wrong;
* why it is invalid;
* what related declaration is involved;
* how the author may correct it.

Example:

```text
JSDL-E421 INVALID_TERMINAL_TRANSITION

Lifecycle 'PwuLifecycle' declares state 'completed' as terminal,
but transition 'ResumeWork' leaves 'completed'.

Either remove terminal: true from 'completed' or use an explicit
reopening transition through a non-terminal 'reopened' state.

Primary: pwu.jsdl.yaml:143:7
Related: pwu.jsdl.yaml:121:9
```

---

# 32. Error Recovery

The parser and semantic compiler SHOULD recover from independent errors where practical.

A single unknown type SHOULD not prevent detection of unrelated duplicate symbols.

However, diagnostics caused solely by a prior unresolved declaration SHOULD be suppressed or marked as dependent to avoid cascades.

---

# 33. Compiler Result

```typescript
export interface CompilationResult {
  readonly success: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly model?: JsdlModelIr;
  readonly statistics: CompilationStatistics;
}
```

## 33.1 Statistics

```text
sourceCount
moduleCount
symbolCount
entityCount
commandCount
eventCount
projectionCount
warningCount
errorCount
elapsedByPhase
```

Statistics SHALL not affect deterministic semantic output.

---

# 34. Generator Interface

Every generator SHALL implement:

```typescript
export interface JsdlGenerator {
  readonly id: string;
  readonly version: string;

  plan(
    model: JsdlModelIr,
    options: GeneratorOptions
  ): Promise<GenerationPlan>;

  generate(
    model: JsdlModelIr,
    plan: GenerationPlan,
    context: GeneratorContext
  ): Promise<GenerationResult>;
}
```

## 34.1 Generation Plan

The plan identifies intended files before writing.

```typescript
export interface GenerationPlan {
  readonly outputs: readonly PlannedOutput[];
  readonly diagnostics: readonly Diagnostic[];
}
```

This allows detection of:

* path collisions;
* unsupported target features;
* accidental overwrites;
* invalid generator options.

## 34.2 Generator Isolation

Generators SHALL not:

* mutate the IR;
* resolve semantic names independently;
* silently weaken constraints;
* introduce new professional entities;
* alter lifecycle semantics;
* infer authority not present in the model.

---

# 35. Generated File Contract

Every generated file SHOULD contain metadata where the target format allows.

```text
Generated by: jsdl-generator-typescript@0.1.0
Compiler: jsdl-compiler@0.1.0
Model fingerprint: sha256-...
Source modules:
- janumi.cpco.core@0.1.0
- janumi.work.pwu@0.1.0
Do not edit manually.
```

A sidecar manifest SHALL be generated for formats that cannot include comments.

---

# 36. Output Manifest

```json
{
  "compilerVersion": "0.1.0",
  "modelFingerprint": "sha256-...",
  "generatedAt": null,
  "generators": [
    {
      "id": "typescript",
      "version": "0.1.0",
      "files": [
        {
          "path": "entities/ProfessionalWorkUnit.ts",
          "contentHash": "sha256-...",
          "sourceSymbols": [
            "symbol:janumi.work.pwu.ProfessionalWorkUnit"
          ]
        }
      ]
    }
  ]
}
```

`generatedAt` SHOULD be null or omitted in reproducible mode.

---

# 37. TypeScript Generator Architecture

The initial TypeScript generator SHALL generate:

```text
primitives/
enums/
value-objects/
entities/
relationships/
commands/
events/
validators/
permissions/
projections/
model-index.ts
```

## 37.1 Generated Type Style

The generator SHOULD use:

* readonly properties;
* discriminated unions where applicable;
* string literal unions or enums based on configuration;
* branded scalar types for semantic identifiers;
* explicit optional properties;
* no implicit `any`;
* no generated runtime behavior unless requested.

## 37.2 Entity Identifier Example

```typescript
export type EntityId = string & {
  readonly __brand: "EntityId";
};
```

## 37.3 Reference Example

```typescript
export interface EntityReference<TType extends string> {
  readonly id: EntityId;
  readonly type: TType;
  readonly version?: number;
}
```

---

# 38. JSON Schema Generator Architecture

The JSON Schema generator SHALL target a declared draft, preferably JSON Schema 2020-12.

It SHALL generate schemas for:

* entities;
* value objects;
* commands;
* events;
* projection query payloads;
* validator results.

## 38.1 Schema IDs

Schema IDs SHALL derive from module namespace and semantic version.

Example:

```text
https://janumi.example/semantic/work/pwu/0.1.0/ProfessionalWorkUnit.schema.json
```

## 38.2 Reference Handling

Cross-module references SHALL use stable `$id` and `$ref` values.

## 38.3 Semantic Limitations

Constraints not expressible in JSON Schema SHALL be documented in generated metadata and enforced through semantic validators.

Example:

* cross-aggregate authority;
* evidence sufficiency;
* parent recomposition completeness.

---

# 39. Documentation Generator

The documentation generator SHALL produce:

* module summary;
* imports and dependencies;
* entity catalog;
* property tables;
* inheritance diagrams;
* relationship catalog;
* aggregate boundaries;
* lifecycle diagrams;
* command reference;
* event reference;
* invariant catalog;
* validator catalog;
* permission matrix;
* projection catalog;
* source links.

Generated documentation SHALL clearly distinguish:

* canonical semantics;
* generated implementation notes;
* unresolved external validator contracts.

---

# 40. Bootstrap JSON Schema

The bootstrap schema SHALL validate:

* supported top-level keys;
* module declaration structure;
* imports structure;
* declaration map shapes;
* basic primitive field types;
* required `jsdl` and `module` properties.

It SHALL not attempt to validate:

* referenced symbol existence;
* lifecycle graph correctness;
* aggregate ownership;
* command-event compatibility;
* invariant type correctness;
* semantic extension safety.

Those remain compiler responsibilities.

---

# 41. CLI Architecture

## 41.1 Commands

```text
jsdl validate
jsdl compile
jsdl generate
jsdl inspect
jsdl diff
jsdl test
jsdl format
```

## 41.2 `validate`

Runs through semantic validation without generation.

Exit codes:

```text
0 success
1 compilation errors
2 configuration error
3 internal compiler failure
```

## 41.3 `compile`

Produces canonical IR.

Options:

```text
--output
--format json
--reproducible
--diagnostics json|pretty
```

## 41.4 `generate`

```text
jsdl generate typescript
jsdl generate json-schema
jsdl generate docs
jsdl generate all
```

## 41.5 `inspect`

Examples:

```text
jsdl inspect entity ProfessionalWorkUnit
jsdl inspect lifecycle PwuLifecycle
jsdl inspect command CompletePWU
jsdl inspect projection PwuDecisionProjection
```

## 41.6 `diff`

```text
jsdl diff baseline.ir.json candidate.ir.json
```

Outputs:

* change list;
* compatibility classification;
* affected consumers;
* migration recommendations.

## 41.7 `format`

Formatting SHALL preserve semantic meaning and produce stable YAML structure.

Formatter implementation MAY be deferred until after the parser and IR are stable.

---

# 42. Configuration Model

```yaml
jsdl:
  compilerVersion: 0.1.0

sources:
  include:
    - jsdl/**/*.jsdl.yaml
  exclude:
    - jsdl/**/experimental/**

moduleResolution:
  workspaceRoots:
    - jsdl
  lockfile: jsdl.lock.yaml
  rejectCycles: true

validation:
  failOnWarnings: false
  unknownFields: error
  unusedSymbols: warning

generation:
  reproducible: true
  cleanOutput: true

outputs:
  ir:
    directory: generated/ir
  typescript:
    directory: generated/typescript
  jsonSchema:
    directory: generated/json-schema
  docs:
    directory: generated/docs
```

---

# 43. Compiler API

The compiler SHALL also provide a programmatic API.

```typescript
export interface JsdlCompiler {
  compile(request: CompilationRequest): Promise<CompilationResult>;
}

export interface CompilationRequest {
  readonly sources: readonly SourceInput[];
  readonly configuration: CompilerConfiguration;
  readonly previousModel?: JsdlModelIr;
}
```

This supports:

* CI;
* IDE integration;
* Janumi Workbench semantic editing;
* test harnesses;
* future language server support.

---

# 44. Internal Compiler Failure Handling

An internal compiler failure SHALL be distinguished from a user model diagnostic.

The compiler SHALL:

* stop unsafe generation;
* return a unique incident identifier where appropriate;
* preserve a sanitized failure report;
* avoid exposing secrets or full environment contents;
* identify the failing phase;
* provide reproducible input fingerprint.

Internal failures SHALL not be presented as JSDL semantic errors.

---

# 45. Security Requirements

The compiler SHALL:

1. parse source without executing embedded content;
2. use safe YAML parsing;
3. reject YAML custom executable tags;
4. limit alias expansion to prevent YAML bombs;
5. impose configurable source-size limits;
6. impose configurable nesting limits;
7. impose expression complexity limits;
8. prohibit arbitrary runtime imports;
9. verify module integrity where applicable;
10. avoid reading outside configured workspace roots;
11. avoid following unsafe symbolic links by default;
12. write only within configured output roots;
13. avoid network access in reproducible mode;
14. sanitize diagnostics containing source excerpts;
15. treat generator plugins as trusted code requiring explicit installation.

---

# 46. Performance Requirements

The bootstrap compiler SHOULD support a model containing:

```text
100 modules
5,000 declarations
20,000 properties
10,000 relationships
2,000 commands
2,000 events
```

within practical local development latency.

Initial targets:

```text
Cold validation: under 5 seconds
Warm incremental validation: under 1 second
```

These are design targets, not semantic requirements.

Compiler correctness takes precedence over speed.

---

# 47. Testing Strategy

Testing SHALL occur at multiple levels.

## 47.1 Parser Unit Tests

Test:

* valid YAML;
* valid JSON;
* malformed documents;
* source locations;
* unknown fields;
* scalar and collection type syntax.

## 47.2 Module Resolution Tests

Test:

* exact versions;
* compatible ranges;
* incompatible versions;
* missing modules;
* duplicate aliases;
* cycles;
* lockfile behavior.

## 47.3 Symbol Tests

Test:

* local resolution;
* aliased imports;
* selective imports;
* ambiguity;
* duplicate symbols;
* qualified names.

## 47.4 Type-System Tests

Test:

* primitive types;
* aliases;
* collections;
* references;
* ownership;
* inheritance;
* optionality;
* nullability;
* invalid assignability.

## 47.5 Semantic Validation Tests

Test:

* aggregate ownership;
* lifecycle reachability;
* invalid commands;
* missing events;
* invalid permissions;
* invalid projection paths;
* weakened extensions.

## 47.6 Expression Tests

Test:

* parsing;
* type checking;
* safe evaluation;
* complexity limits;
* invalid property access;
* deterministic behavior.

## 47.7 IR Snapshot Tests

Canonical IR SHALL be snapshot-tested.

Snapshots SHALL remain stable across non-semantic source reformatting.

## 47.8 Generator Golden Tests

For each fixture:

```text
input JSDL
→ expected IR
→ expected generated files
```

Generated files SHALL be byte-compared in reproducible mode.

## 47.9 Negative Fixture Tests

Each diagnostic code SHOULD have at least one fixture demonstrating the error.

## 47.10 Property-Based Tests

Property-based testing SHOULD verify:

* source-order independence;
* deterministic output;
* parser round-trip stability where applicable;
* qualified-name uniqueness;
* valid lifecycle graph behavior.

## 47.11 Fuzz Testing

The parser and expression engine SHOULD be fuzz tested for:

* crashes;
* excessive resource consumption;
* unsafe input handling;
* invalid YAML structures;
* deeply nested type expressions.

---

# 48. Conformance Fixture Structure

```text
tests/
├── parser/
├── resolution/
├── symbols/
├── types/
├── lifecycles/
├── aggregates/
├── commands/
├── events/
├── invariants/
├── permissions/
├── projections/
├── extensions/
├── deterministic/
├── compatibility/
└── generators/
```

Fixture format:

```text
case-name/
├── input/
│   └── model.jsdl.yaml
├── expected-diagnostics.json
├── expected-ir.json
└── expected-output/
```

---

# 49. Compiler Observability

The compiler SHOULD emit structured traces for:

```text
source_load
parse
module_resolution
symbol_collection
reference_resolution
type_check
semantic_validation
ir_generation
model_diff
generator_plan
generator_execution
artifact_validation
```

Trace attributes SHOULD include:

```text
sourceCount
moduleCount
symbolCount
diagnosticCount
modelFingerprint
generatorId
cacheHit
elapsed
```

Source content and secrets SHALL not be included by default.

---

# 50. Implementation Backlog

The following backlog is ordered to minimize semantic rework.

---

## Epic 1 — Repository and Build Foundation

### JSDL-COMP-001

Create TypeScript monorepo and workspace package structure.

**Acceptance criteria**

* workspace builds;
* package boundaries compile;
* linting and type checking run;
* test runner executes;
* no circular package dependencies.

### JSDL-COMP-002

Define shared compiler core types.

Includes:

* identifiers;
* semantic versions;
* source positions;
* diagnostics;
* compiler phases.

### JSDL-COMP-003

Implement deterministic hashing utilities.

---

## Epic 2 — Source Loading

### JSDL-COMP-010

Implement source discovery from configured glob patterns.

### JSDL-COMP-011

Implement safe UTF-8 source loading.

### JSDL-COMP-012

Implement source hashes and line maps.

### JSDL-COMP-013

Reject unsafe paths and unsupported encodings.

---

## Epic 3 — Bootstrap Schema and Parsing

### JSDL-COMP-020

Create bootstrap JSON Schema for JSDL v0.1.

### JSDL-COMP-021

Integrate safe YAML parser.

### JSDL-COMP-022

Implement raw AST types.

### JSDL-COMP-023

Convert parsed YAML/JSON into raw AST with source ranges.

### JSDL-COMP-024

Implement unknown-field diagnostics.

### JSDL-COMP-025

Implement type-reference parser.

---

## Epic 4 — Module Resolution

### JSDL-COMP-030

Implement semantic-version parsing and range evaluation.

### JSDL-COMP-031

Implement workspace module index.

### JSDL-COMP-032

Implement import resolution.

### JSDL-COMP-033

Implement aliases and selective imports.

### JSDL-COMP-034

Implement cycle detection.

### JSDL-COMP-035

Implement lockfile reading and validation.

---

## Epic 5 — Symbol Table

### JSDL-COMP-040

Define symbol kinds and stable symbol IDs.

### JSDL-COMP-041

Implement top-level symbol collection.

### JSDL-COMP-042

Implement nested symbol collection.

### JSDL-COMP-043

Implement qualified-name resolution.

### JSDL-COMP-044

Implement ambiguity and duplicate diagnostics.

---

## Epic 6 — Type System

### JSDL-COMP-050

Implement primitive and scalar types.

### JSDL-COMP-051

Implement collection types.

### JSDL-COMP-052

Implement `Reference<T>` and `Owned<T>`.

### JSDL-COMP-053

Implement value-object validation.

### JSDL-COMP-054

Implement entity identity validation.

### JSDL-COMP-055

Implement inheritance and assignability.

### JSDL-COMP-056

Implement property constraints.

---

## Epic 7 — Expression Language

### JSDL-COMP-060

Define expression grammar.

### JSDL-COMP-061

Implement tokenizer and parser.

### JSDL-COMP-062

Implement expression AST.

### JSDL-COMP-063

Implement expression type checking.

### JSDL-COMP-064

Implement safe deterministic evaluator.

### JSDL-COMP-065

Implement expression complexity limits.

---

## Epic 8 — Semantic Validation

### JSDL-COMP-070

Implement aggregate validation.

### JSDL-COMP-071

Implement lifecycle graph validation.

### JSDL-COMP-072

Implement command validation.

### JSDL-COMP-073

Implement event validation.

### JSDL-COMP-074

Implement invariant and validator validation.

### JSDL-COMP-075

Implement permission validation.

### JSDL-COMP-076

Implement projection path validation.

### JSDL-COMP-077

Implement extension safety validation.

---

## Epic 9 — Canonical IR

### JSDL-COMP-080

Define canonical IR types.

### JSDL-COMP-081

Normalize resolved AST into IR.

### JSDL-COMP-082

Implement inherited-property expansion.

### JSDL-COMP-083

Implement source-map generation.

### JSDL-COMP-084

Implement canonical sorting.

### JSDL-COMP-085

Implement model fingerprinting.

### JSDL-COMP-086

Implement stable IR serialization.

---

## Epic 10 — Compiler Orchestration

### JSDL-COMP-090

Implement compiler phase pipeline.

### JSDL-COMP-091

Implement compilation result and statistics.

### JSDL-COMP-092

Implement diagnostic cascade suppression.

### JSDL-COMP-093

Implement reproducible compilation mode.

### JSDL-COMP-094

Implement internal compiler error boundary.

---

## Epic 11 — TypeScript Generator

### JSDL-COMP-100

Implement generator API.

### JSDL-COMP-101

Generate scalar aliases and identifiers.

### JSDL-COMP-102

Generate enums.

### JSDL-COMP-103

Generate value-object interfaces.

### JSDL-COMP-104

Generate entity interfaces.

### JSDL-COMP-105

Generate relationship types.

### JSDL-COMP-106

Generate command contracts.

### JSDL-COMP-107

Generate event contracts.

### JSDL-COMP-108

Generate projection metadata types.

### JSDL-COMP-109

Generate output manifest and source annotations.

---

## Epic 12 — JSON Schema Generator

### JSDL-COMP-110

Implement schema ID strategy.

### JSDL-COMP-111

Generate primitives and aliases.

### JSDL-COMP-112

Generate value-object schemas.

### JSDL-COMP-113

Generate entity schemas.

### JSDL-COMP-114

Generate command schemas.

### JSDL-COMP-115

Generate event schemas.

### JSDL-COMP-116

Generate cross-module references.

### JSDL-COMP-117

Document non-expressible semantic constraints.

---

## Epic 13 — Documentation Generator

### JSDL-COMP-120

Generate module catalog.

### JSDL-COMP-121

Generate entity and relationship reference.

### JSDL-COMP-122

Generate lifecycle diagrams.

### JSDL-COMP-123

Generate command and event reference.

### JSDL-COMP-124

Generate invariants and permissions reference.

### JSDL-COMP-125

Generate projection catalog.

---

## Epic 14 — CLI

### JSDL-COMP-130

Implement configuration loading.

### JSDL-COMP-131

Implement `jsdl validate`.

### JSDL-COMP-132

Implement `jsdl compile`.

### JSDL-COMP-133

Implement `jsdl generate`.

### JSDL-COMP-134

Implement `jsdl inspect`.

### JSDL-COMP-135

Implement structured diagnostic output.

---

## Epic 15 — Model Diff

### JSDL-COMP-140

Define semantic change taxonomy.

### JSDL-COMP-141

Compare modules and declarations.

### JSDL-COMP-142

Classify property changes.

### JSDL-COMP-143

Classify lifecycle changes.

### JSDL-COMP-144

Classify command and event changes.

### JSDL-COMP-145

Generate compatibility report.

---

## Epic 16 — Conformance and Security

### JSDL-COMP-150

Create valid reference fixture suite.

### JSDL-COMP-151

Create invalid diagnostic fixture suite.

### JSDL-COMP-152

Create deterministic build tests.

### JSDL-COMP-153

Create parser fuzzing harness.

### JSDL-COMP-154

Implement YAML expansion limits.

### JSDL-COMP-155

Implement path and output-root protections.

### JSDL-COMP-156

Create dependency-boundary test.

---

# 51. Milestone Plan

## Milestone 1 — Parse and Validate Structure

Delivers:

* source loader;
* bootstrap schema;
* YAML parser;
* raw AST;
* source locations;
* basic diagnostics.

## Milestone 2 — Resolve Semantic Types

Delivers:

* module resolution;
* symbol table;
* type-reference parser;
* entity and value-object validation.

## Milestone 3 — Validate Professional Model

Delivers:

* aggregate validation;
* lifecycle validation;
* commands;
* events;
* invariants;
* permissions;
* projections.

## Milestone 4 — Produce Canonical IR

Delivers:

* normalized IR;
* model fingerprint;
* source mapping;
* reproducible serialization.

## Milestone 5 — Generate Usable Contracts

Delivers:

* TypeScript generator;
* JSON Schema generator;
* generated manifest;
* golden tests.

## Milestone 6 — Developer Tooling

Delivers:

* CLI;
* inspect;
* documentation generator;
* compatibility diff;
* CI integration.

---

# 52. Definition of Done

The bootstrap compiler is complete when it can:

1. load the canonical JSDL module set;
2. parse all supported declaration categories;
3. resolve module imports deterministically;
4. resolve all symbols and types;
5. reject invalid aggregate boundaries;
6. validate lifecycle graphs;
7. validate commands and emitted events;
8. validate invariants and permissions;
9. validate projection relationship paths;
10. produce canonical IR;
11. generate deterministic TypeScript;
12. generate valid JSON Schema;
13. generate reference documentation;
14. report precise source-based diagnostics;
15. classify model compatibility changes;
16. pass conformance, security, and golden tests;
17. compile the canonical PWU reference module without error.

---

# 53. Coding Agent Operating Instructions

The coding agent implementing the compiler SHALL follow these rules:

1. Implement phases in dependency order.
2. Do not combine parsing, name resolution, and generation into one pass.
3. Preserve source locations throughout the pipeline.
4. Use discriminated unions and exhaustive handling.
5. Reject unknown fields by default.
6. Avoid implicit fallback semantics.
7. Never resolve ambiguity using declaration order.
8. Never allow generators to reinterpret unresolved source.
9. Keep IR independent of TypeScript-specific generation.
10. Implement diagnostics as stable public contracts.
11. Add a negative fixture for every new semantic error.
12. Add golden output tests for every generator feature.
13. Maintain deterministic output from the beginning.
14. Treat compiler crashes as defects, not model errors.
15. Avoid adding language features not required by JSDL v0.1.
16. Do not implement arbitrary expression execution.
17. Preserve semantic distinctions among entity, value object, reference, and ownership.
18. Preserve the distinction between semantic PWUs and transactional aggregates.
19. Prefer explicit failure over inferred meaning.
20. Record architecture deviations as explicit Decisions.

---

# 54. Resulting Architecture

The compiler architecture establishes a disciplined transformation boundary:

```text
JSDL Source
   │
   ▼
Raw Syntax
   │
   ▼
Resolved Semantic Model
   │
   ▼
Validated Canonical IR
   │
   ├──► TypeScript Contracts
   ├──► JSON Schemas
   ├──► Documentation
   ├──► API Definitions
   ├──► Persistence Models
   ├──► Frontend Metadata
   └──► Agent Contracts
```

No generator may bypass the validated semantic model.

No runtime may redefine professional meaning independently.

No UI may invent a conflicting local model.

The compiler therefore becomes the enforcement boundary between Janumi’s professional cognition discipline and the software artifacts implementing it.

---

# 55. Next Required Artifact

The next artifact is the **Janumi Runtime Semantic Architecture Specification**.

It shall define:

* authoritative entity and relationship storage;
* event persistence;
* command handling;
* aggregate loading;
* validation execution;
* projection building;
* reconciliation services;
* RPH execution;
* agent invocation;
* transactional boundaries;
* consistency models;
* idempotency;
* concurrency;
* audit and provenance;
* API boundaries;
* integration with generated JSDL contracts;
* initial single-node deployment profile.
