import postgres, { Sql } from 'postgres';

let sql: Sql | null = null;

function getSqlClient(): Sql {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is missing.");
    }

    sql = postgres(connectionString, {
      max: 1,                // ← CRITICAL for serverless
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,        // ← CRITICAL for Supabase/Neon pooler
    });
  }
  return sql;
}

export async function query<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  const client = getSqlClient();
  return await client(strings, ...values) as unknown as T[];
}

export async function getClient() {
  return getSqlClient();
}
