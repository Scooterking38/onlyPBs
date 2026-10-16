import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export const maxDuration = 60;

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
    } catch (err) {
        console.error("PBS POST Error:", err);
        const message = err instanceof Error ? err.message : "Failed to record PB";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        const db = await getClient();

        if (email) {
            const cleanEmail = email.toLowerCase().trim();
            const rows = await db`
                SELECT id, email, skill_id, weight, reps, duration, proof_url, is_verified, verification_status, date, bodyweight_at_time, is_public_proof
                FROM pbs
                WHERE email = ${cleanEmail}
            `;
            return NextResponse.json(rows);
        } else {
            const rows = await db`
                SELECT p.*, a.display_name, a.avatar_url, a.avatar_icon, a.is_masked
                FROM pbs p
                LEFT JOIN athletes a ON p.email = a.email
            `;
            return NextResponse.json(rows);
        }
    } catch (err) {
        console.error("PBS GET Error:", err);
        const message = err instanceof Error ? err.message : "Failed to fetch PBs";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
