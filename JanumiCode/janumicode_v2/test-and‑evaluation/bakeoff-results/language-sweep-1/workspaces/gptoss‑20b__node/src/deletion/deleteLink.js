// Updated src/deletion/deleteLink.js with async audit log via simple in-memory map
import { linkMapping, clickData } from './store.js';
import crypto from 'node:crypto';
import { addAuditLog } from './store.js';

/**
 * Handle deleting a link.
 * @param {{ slug:string }} args - The slug of the link to delete.
 * @returns {Promise<{status:number}>}
 */
export async function deleteLinkHandler({slug}){
  const existed = linkMapping.has(slug);
  // idempotent: whether or not existed, we return 204 if deletion performed
  if (existed){
    linkMapping.delete(slug);
    clickData.delete(slug);
    const auditEntry={id:crypto.randomUUID(),slug,actor_id:'system',deleted_at:new Date()};
    addAuditLog(auditEntry);
      return {status:204};
  }
   // if not existed, still idempotent behavior; spec says DELETE returns 204
   return {status:204};
}
export default deleteLinkHandler;
