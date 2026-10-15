// app/api/pbs/route.ts


import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    const rows = email
        ? await sql`SELECT * FROM pbs WHERE email = ${email.toLowerCase().trim()} ORDER BY date DESC, id DESC`
        : await sql`
                SELECT p.*, a.display_name, a.avatar_icon, a.avatar_url, a.is_masked
                FROM pbs p
                         LEFT JOIN athletes a ON p.email = a.email
                ORDER BY date DESC
        `;

    return NextResponse.json(rows);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { email, skillId, bw, weight, reps, duration, proofUrl, isPublic } = body;
    const status = proofUrl ? "pending" : "unverified";

    await sql`
        INSERT INTO pbs (email, skill_id, bodyweight_at_time, weight, reps, duration, proof_url, is_public_proof, verification_status, date)
        VALUES (${email.toLowerCase().trim()}, ${skillId}, ${bw}, ${weight}, ${reps}, ${duration}, ${proofUrl || ''}, ${isPublic ?? true}, ${status}, CURRENT_DATE);
    `;
    await sql`UPDATE athletes SET bodyweight_kg = ${bw} WHERE email = ${email.toLowerCase().trim()};`;

    return NextResponse.json({ success: true });
}