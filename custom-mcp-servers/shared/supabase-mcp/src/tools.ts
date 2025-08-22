import { z } from 'zod';

// Tool 1: List tables
export const listTablesSchema = z.object({});

// Tool 2: Describe table
export const describeTableSchema = z.object({
  tableName: z.string().describe('Name of the table to describe')
});

// Tool 3: Query table
export const queryTableSchema = z.object({
  tableName: z.string().describe('Name of the table to query'),
  select: z.string().optional().describe('Comma-separated list of columns to select (default: all columns)'),
  where: z.string().optional().describe('WHERE clause for filtering (e.g., "id = 1 AND status = \'active\'")'),
  orderBy: z.string().optional().describe('ORDER BY clause (e.g., "created_at DESC")'),
  limit: z.number().optional().describe('Maximum number of rows to return (default: 100)').default(100),
  offset: z.number().optional().describe('Number of rows to skip (default: 0)').default(0)
});

// Tool 4: Insert data
export const insertDataSchema = z.object({
  tableName: z.string().describe('Name of the table to insert data into'),
  data: z.string().describe('JSON string containing the data to insert (e.g., \'{"name": "John", "email": "john@example.com"}\')')
});

// Tool 5: Update data
export const updateDataSchema = z.object({
  tableName: z.string().describe('Name of the table to update data in'),
  where: z.string().describe('WHERE clause to identify records to update (e.g., "id = 1")'),
  data: z.string().describe('JSON string containing the data to update (e.g., \'{"status": "completed"}\')')
});

// Tool 6: Delete data
export const deleteDataSchema = z.object({
  tableName: z.string().describe('Name of the table to delete data from'),
  where: z.string().describe('WHERE clause to identify records to delete (e.g., "id = 1")')
});

// Tool 7: Count records
export const countRecordsSchema = z.object({
  tableName: z.string().describe('Name of the table to count records in'),
  where: z.string().optional().describe('WHERE clause for filtering (e.g., "status = \'active\'")')
});

// Tool 8: Get database info
export const getDatabaseInfoSchema = z.object({});

// LibreChat tool descriptions
export const toolDescriptions = {
  supabase_list_tables: 'List all tables in the Supabase database. Use this to explore the database structure.',
  supabase_describe_table: 'Get detailed information about a specific table including columns, data types, and constraints.',
  supabase_query_table: 'Query data from a specific table with filtering, sorting, and pagination options.',
  supabase_insert_data: 'Insert new data into a table. Use this to add records to your database.',
  supabase_update_data: 'Update existing data in a table. Use this to modify records in your database.',
  supabase_delete_data: 'Delete data from a table. Use this to remove records from your database.',
  supabase_count_records: 'Count the number of records in a table with optional filtering.',
  supabase_get_database_info: 'Get information about the Supabase database including version, size, and connection details.'
};
