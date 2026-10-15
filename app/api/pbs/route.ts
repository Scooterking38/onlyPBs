import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, skillId, bw, weight, reps, duration, proofUrl, isPublic } = body;

        const cleanEmail = email.toLowerCase().trim();
        const status = proofUrl ? "pending" : "unverified";

        // 1. Get the client (awaiting the context initialization)
        const db = await getClient();

        // 2. Use the client's begin method
        await db.begin(async (sql) => {
            const athlete = await sql`SELECT id FROM athletes WHERE email = ${cleanEmail}`;
            if (athlete.length === 0) throw new Error("Athlete not found");

            await sql`
                INSERT INTO pbs (email, skill_id, bodyweight_at_time, weight, reps, duration, proof_url, is_public_proof, verification_status, date)
                VALUES (${cleanEmail}, ${skillId}, ${bw}, ${weight}, ${reps}, ${duration}, ${proofUrl || ''}, ${isPublic ?? true}, ${status}, CURRENT_DATE)
            `;

            await sql`UPDATE athletes SET bodyweight_kg = ${bw} WHERE email = ${cleanEmail}`;
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("PBS POST Error:", err);
        return NextResponse.json({ error: err.message || "Failed to record PB" }, { status: 400 });
    }
}