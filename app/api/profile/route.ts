import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');

    if (!emailParam) {
        return NextResponse.json({ error: "Email parameter is required" }, { status: 400 });
    }

    const email = emailParam.toLowerCase().trim();

    try {
        // 1. Fetch the profile
        const rows = await query`
      SELECT email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked 
      FROM athletes 
      WHERE email = ${email} 
      LIMIT 1
    `;

        if (rows.length === 0) {
            // 2. Auto-create default profile using UPSERT logic
            const defaultName = email.split('@')[0];

            await query`
        INSERT INTO athletes (
          email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked
        )
        VALUES (
          ${email}, ${defaultName}, 75.0, 'Gravity is just a suggestion.', 'Statics & Holds', '⚡', '', false
        )
        ON CONFLICT (email) DO NOTHING;
      `;

            // Return the default object immediately so the UI doesn't flicker
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

    } catch (err) {
        console.error("Profile GET error:", err);
        return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, displayName, bodyweight, tagline, discipline, avatarIcon, avatarUrl, isMasked } = body;

        if (!email) {
            return NextResponse.json({ error: "Email is required for update" }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Use UPSERT (ON CONFLICT) to handle both new and existing users
        await query`
      INSERT INTO athletes (
        email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked
      )
      VALUES (
        ${cleanEmail}, 
        ${displayName || 'User'}, 
        ${bodyweight || 75.0}, 
        ${tagline || ''}, 
        ${discipline || 'Statics & Holds'}, 
        ${avatarIcon || '⚡'}, 
        ${avatarUrl || ''}, 
        ${isMasked ?? false}
      )
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

    } catch (err) {
        console.error("Profile POST error:", err);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}