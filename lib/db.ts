// lib/db.ts
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export const sql = ((strings: TemplateStringsArray, ...values: any[]) => {
    if (!_sql) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL is missing in environment variables.");
        }
        _sql = neon(connectionString);
    }
    return _sql(strings, ...values);
}) as unknown as NeonQueryFunction<false, false>;