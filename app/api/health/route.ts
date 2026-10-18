import { query } from "@/lib/db";
import { apiJson, apiOptions } from "@/lib/http";

export function OPTIONS(request: Request) {
  return apiOptions(request);
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    await query`SELECT 1 AS ping`;

    return apiJson(request, {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      latency_ms: Date.now() - startTime,
    });
  } catch (error) {
    // Keep diagnostics in server logs; never expose internal DB errors publicly.
    console.error("[Health] Database connectivity check failed:", error);

    return apiJson(
      request,
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connectivity check failed",
      },
      503,
    );
  }
}
