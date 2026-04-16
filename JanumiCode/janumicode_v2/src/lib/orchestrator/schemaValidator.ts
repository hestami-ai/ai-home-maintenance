/**
 * SchemaValidator — validates artifact JSON against JSON Schema files.
 * Based on JanumiCode Spec v2.3, §7.8 and §12.
 *
 * Uses ajv (v8) with JSON Schema 2020-12 support.
 * Schemas are loaded from .janumicode/schemas/artifacts/*.schema.json.
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { getLogger } from '../logging';

export interface ValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  artifact_type: string;
  schema_version: string;
}

export interface SchemaValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

export class SchemaValidator {
  private ajv: Ajv;
  private validators = new Map<string, ValidateFunction>();
  private readonly schemaDirs: string[];

  constructor(workspacePath: string) {
    const baseDir = join(workspacePath, '.janumicode', 'schemas');
    // Load from both artifacts/ (phase outputs) and memory/ (DMR records)
    this.schemaDirs = [
      join(baseDir, 'artifacts'),
      join(baseDir, 'memory'),
    ];

    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      verbose: true,
    });
    addFormats(this.ajv);

    this.loadSchemas();
  }

  /**
   * Discover and compile all schema files at startup from every registered
   * schema directory.
   */
  private loadSchemas(): void {
    for (const dir of this.schemaDirs) {
      if (!existsSync(dir)) continue;

      const files = readdirSync(dir)
        .filter(f => f.endsWith('.schema.json'));

      for (const file of files) {
        const artifactType = basename(file, '.schema.json');
        try {
          const schemaJson = readFileSync(join(dir, file), 'utf-8');
          const schema = JSON.parse(schemaJson);
          const validate = this.ajv.compile(schema);
          this.validators.set(artifactType, validate);
        } catch (err) {
          getLogger().warn('validation', `Failed to load schema file`, {
            file,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  /**
   * Validate an artifact's content against its schema.
   */
  validate(artifactType: string, content: Record<string, unknown>): ValidationResult {
    const validate = this.validators.get(artifactType);

    if (!validate) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `No schema found for artifact type: ${artifactType}`,
          keyword: 'schema_missing',
          params: { artifactType },
        }],
        artifact_type: artifactType,
        schema_version: 'unknown',
      };
    }

    const valid = validate(content) as boolean;
    const errors: SchemaValidationError[] = [];

    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        errors.push(this.mapError(err));
      }
    }

    // Extract schema_version from the schema's $id (format: "janumicode:type:version")
    const schemaId = (validate.schema as Record<string, unknown>)?.$id as string ?? '';
    const idParts = schemaId.split(':');
    const schemaVersion = idParts.length >= 3 ? idParts[idParts.length - 1] : '1.0';

    return {
      valid,
      errors,
      artifact_type: artifactType,
      schema_version: schemaVersion,
    };
  }

  /**
   * Check if a schema exists for the given artifact type.
   */
  hasSchema(artifactType: string): boolean {
    return this.validators.has(artifactType);
  }

  /**
   * Get list of all loaded schema artifact types.
   */
  getLoadedSchemas(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Add a schema programmatically (for testing).
   */
  addSchema(artifactType: string, schema: Record<string, unknown>): void {
    const validate = this.ajv.compile(schema);
    this.validators.set(artifactType, validate);
  }

  private mapError(err: ErrorObject): SchemaValidationError {
    return {
      path: err.instancePath || '/',
      message: err.message ?? 'Unknown validation error',
      keyword: err.keyword,
      params: err.params as Record<string, unknown>,
    };
  }
}
