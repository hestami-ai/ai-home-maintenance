
import { Client } from 'pg'; 
import type { ConnectionConfig } from 'pg'  

interface DatabaseConfig extends ConnectionConfig {  connectionString?: string; databaseUri: string | undefined;} 

const DB_CONFIG = process.env.DATABASE_URL ? { connection String: process env DATABASE } : defaultOptions(); async function connect(client): Promise<void>
await client.connect() finally disconnect(client);
