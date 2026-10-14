import { AuditLog } from '../types';

export const auditService = {
  // Audit trail has been disabled per user request
  async log(_action: string, _collectionName: string, _documentId: string, _details?: string): Promise<void> {
    // No-op: do not write audit records to database
  },

  async getRecent(_limitCount = 20): Promise<AuditLog[]> {
    return [];
  },
};
