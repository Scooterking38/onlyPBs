import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, skillId, bw, weight, reps, duration, proofUrl, isPublic } = body;

        const cleanEmail = email.toLowerCase().trim();
        const status = proofUrl ? "pending" : "unverified";

        const db = await getClient();

        // Check athlete exists
        const athlete = await db`SELECT id FROM athletes WHERE email = ${cleanEmail}`;
        if (athlete.length === 0) {
            return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
        }

        // Insert PB
        await db`
            INSERT INTO pbs (email, skill_id, bodyweight_at_time, weight, reps, duration, proof_url, is_public_proof, verification_status, date)
            VALUES (${cleanEmail}, ${skillId}, ${bw}, ${weight}, ${reps}, ${duration}, ${proofUrl || ''}, ${isPublic ?? true}, ${status}, CURRENT_DATE)
        `;

        // Update athlete bodyweight
        await db`UPDATE athletes SET bodyweight_kg = ${bw} WHERE email = ${cleanEmail}`;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("PBS POST Error:", err);
        return NextResponse.json({ error: err.message || "Failed to record PB" }, { status: 400 });
    }
}
