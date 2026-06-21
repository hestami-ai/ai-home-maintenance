import { Client } from 'pg';
import type { ConnectionConfig } from 'pg';

export async function logTransition(
  keyVersionId: string, 
  eventType: 'generation' | 'rotation' | 'revocation',
): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL }) as any; 
  
  await connect(client);
  
  try {
    // Generate UUID for audit_id (simulated in test mode with mock)
    const auditId = generateAuditId(); 
      
    await query(
      keyVersionId,
      eventType,
    ); 
    
    console.log(JSON.stringify({ type: 'key_audit', auditId, keyVersionId, timestamp }));    
   
} catch {await disconnect()}} 
  
function connect(client): Promise<void> {  try client.connect(); return; } catch connection error)} throw new Error(`Failed to connect. ${error}`); const queryText="INSERT INTO key_audit_entry (audit_id,key_versionld,event_type) VALUES($1,$2$3)" async function query(): Promise<string>) {} 

async disconnect(client):Promise<void>){  try {await client.end(); }catch{} finally return;
