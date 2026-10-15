// app/api/profile/route.ts


import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Auto-migration to ensure avatar_url column exists
    await sql`ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';`;

    const rows = await sql`SELECT * FROM athletes WHERE email = ${email.toLowerCase().trim()} LIMIT 1;`;
    if (rows.length === 0) {
        // Auto-create default profile if doesn't exist
        const defaultName = email.split('@')[0];
        await sql`
      INSERT INTO athletes (email, display_name, bodyweight_kg, avatar_icon, avatar_url)
      VALUES (${email.toLowerCase().trim()}, ${defaultName}, 75.0, '⚡', '')
      ON CONFLICT (email) DO NOTHING;
    `;
        return NextResponse.json({
            email,
            display_name: defaultName,
            bodyweight_kg: 75.0,
            tagline: 'Gravity is just a suggestion.',
            discipline: 'Statics & Holds',
            avatar_icon: '⚡',
            avatar_url: '',
            is_masked: false
        });
    }

    return NextResponse.json(rows[0]);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { email, displayName, bodyweight, tagline, discipline, avatarIcon, avatarUrl, isMasked } = body;

    await sql`ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';`;

    await sql`
    INSERT INTO athletes (email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked)
    VALUES (${email.toLowerCase().trim()}, ${displayName}, ${bodyweight}, ${tagline || ''}, ${discipline || 'Statics & Holds'}, ${avatarIcon || '⚡'}, ${avatarUrl || ''}, ${isMasked || false})
    ON CONFLICT (email) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      bodyweight_kg = EXCLUDED.bodyweight_kg,
      tagline = EXCLUDED.tagline,
      discipline = EXCLUDED.discipline,
      avatar_icon = EXCLUDED.avatar_icon,
      avatar_url = EXCLUDED.avatar_url,
      is_masked = EXCLUDED.is_masked;
  `;

    return NextResponse.json({ success: true });
}