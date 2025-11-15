// This file has been migrated to use PostgreSQL instead of Supabase
// Re-exporting the db module for backward compatibility
export { db as supabase, query, transaction } from './db.js';
