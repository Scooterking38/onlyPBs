import { NextResponse } from "next/server";
import { reconcileVerification } from "@/lib/verification";

export const maxDuration = 60;

/**
 * Scheduled self-healing pass. Configure CRON_SECRET in deployment settings;
 * the scheduler sends it as a Bearer token.
 */
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    const authorization = req.headers.get("authorization");

    if (!secret || authorization !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await reconcileVerification();
        return NextResponse.json({
            success: true,
            reconciledAt: new Date().toISOString(),
            verified: result.verified
        });
    } catch (error) {
        console.error("Verification reconciliation failed:", error);
        return NextResponse.json(
            { success: false, error: "Verification reconciliation failed" },
            { status: 500 }
        );
    }
}
