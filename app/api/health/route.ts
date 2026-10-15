// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db'; // Import your postgres client

export async function GET() {
    const startTime = Date.now();

    try {
        // A lightweight query to test the Hyperdrive connection
        await query`SELECT 1 as ping`;

        const latency = Date.now() - startTime;

        return NextResponse.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            database: "connected",
            latency_ms: latency
        });
    } catch (error) {
        return NextResponse.json({
            status: "degraded",
            timestamp: new Date().toISOString(),
            database: "disconnected",
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 503 }); // 503 Service Unavailable
    }
}