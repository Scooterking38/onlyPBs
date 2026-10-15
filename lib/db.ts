// lib/db.ts
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

export const sql = ((strings: TemplateStringsArray, ...values: any[]) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is missing in environment variables.");
    }

    // Create a fresh HTTP fetch client for this specific query
    // to prevent hanging promises across Cloudflare worker isolate freezes
    const client = neon(connectionString);
    return client(strings, ...values);
}) as unknown as NeonQueryFunction<false, false>;