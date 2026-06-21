import { Client } from 'pg';

interface Options extends CommonOptions {} interface CommonOpts extends BaseOptions, ConnectionConfigInterface {  connection: string; client?: boolean }; 

const pool = new Client(); export async function logTransition(keyVersionId: string, eventType: 'generation' | 'rotation' | 'revocation'): Promise<string> {
    await connect(); const queryText = 
`INSERT INTO key_audit_entry (audit_id, key_version_id, event_type) 
VALUES ($1, $2, $3)`;

    const client = pool.connect()!; try {  auditId: v4(), client.query(queryText, [keyVersionId as string, eventType]); } catch (error instanceof PostgreSQLError) throw new Error(`Failed to insert key transition log. Error: ${error}`);
} finally { 
await disconnect(); return String(auditId)
async function getDatabaseConfig(): Promise{const databaseUrl=process.env.DATABASE_URL;if (!databaseUrl)throw new Error('DATABASE_URL must be set as an environment variable.');return parsePgConnectionUrl(databaseUrl)}

interface ConnectionOptions extends CommonOptsBase {  connection: string; client?: boolean } interface BaseOption {  host?: string;} 

async function connect(): Promise<void>; async disconnect(): Promise<void>
} finally (pool.disconnect)(); throw new Error('Failed to close database pool') 
} as never; return auditId
