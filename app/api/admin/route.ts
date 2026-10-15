

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
    const { action, pbId, approved, reason, email, isMasked } = await req.json();

    if (action === "verify") {
        const status = approved ? "verified" : "rejected";
        await sql`UPDATE pbs SET is_verified = ${approved}, verification_status = ${status}, rejection_reason = ${reason || ''} WHERE id = ${pbId}`;
    } else if (action === "mask") {
        await sql`UPDATE athletes SET is_masked = ${isMasked} WHERE email = ${email}`;
    } else if (action === "delete_pb") {
        await sql`DELETE FROM pbs WHERE id = ${pbId}`;
    }

    return NextResponse.json({ success: true });
}