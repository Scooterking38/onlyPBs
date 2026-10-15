import { NextResponse } from 'next/server';
import { query } from '@/lib/db'; // Assuming you named the export 'query' in db.ts

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, pbId, approved, reason, email, isMasked } = body;

        // 1. Basic Input Validation
        if (!action || !['verify', 'mask', 'delete_pb'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        let result;

        if (action === "verify") {
            if (!pbId) throw new Error("pbId is required for verification");

            const status = approved ? "verified" : "rejected";
            const rejectionReason = reason || '';

            result = await query`
        UPDATE pbs 
        SET is_verified = ${approved}, 
            verification_status = ${status}, 
            rejection_reason = ${rejectionReason} 
        WHERE id = ${pbId}
      `;
        }
        else if (action === "mask") {
            if (!email || typeof isMasked !== 'boolean') {
                throw new Error("Email and isMasked boolean are required");
            }

            result = await query`
        UPDATE athletes 
        SET is_masked = ${isMasked} 
        WHERE email = ${email}
      `;
        }
        else if (action === "delete_pb") {
            if (!pbId) throw new Error("pbId is required for deletion");

            result = await query`
        DELETE FROM pbs 
        WHERE id = ${pbId}
      `;
        }

        return NextResponse.json({ success: true, data: result });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}