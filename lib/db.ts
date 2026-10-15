import postgres, { Sql } from 'postgres';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Define your specific environment shape
interface Env {
    HYPERDRIVE: {
        connectionString: string;
    };
    [key: string]: unknown;
}

let sql: Sql | null = null;

async function getSqlClient() {
    if (!sql) {
        // Get the context
        const ctx = await getCloudflareContext();

        // Assert the type so TypeScript knows about HYPERDRIVE
        const env = ctx.env as Env;

        const connectionString =
            env.HYPERDRIVE?.connectionString ||
            process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error("Database connection string is missing.");
        }

        sql = postgres(connectionString, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
        });
    }
    return sql;
}

// Helper for simple queries
export async function query<T = any>(
    strings: TemplateStringsArray,
    ...values: any[]
): Promise<T[]> {
    const client = await getSqlClient();
    return await client(strings, ...values) as unknown as T[];
}

// Export the client getter for transactions
export async function getClient() {
    return await getSqlClient();
}