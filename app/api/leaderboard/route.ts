// app/api/leaderboard/route.ts
// Official ELO Leaderboard endpoint:
// Computes dual-ELO, verified feats, and rankings for all registered and seeded calisthenics athletes.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeDualELO, getRankBadge, scoreSinglePB, PBRecord } from '@/lib/elo';
import { SKILL_MAP } from '@/lib/skills';


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerEmail = (searchParams.get('viewerEmail') || '').toLowerCase().trim();

    // 1. Fetch all athletes
    const athletes = await query<Record<string, unknown>>`
      SELECT id, email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked
      FROM athletes
    `;

    // 2. Fetch all PBs
    const pbs = await query<Record<string, unknown>>`
      SELECT id, email, skill_id, weight, reps, duration, proof_url, is_verified, verification_status, date, bodyweight_at_time, is_public_proof
      FROM pbs
    `;

    // Group PBs by lowercased email
    const pbsByEmail = new Map<string, PBRecord[]>();
    for (const p of pbs) {
      const em = String(p.email || '').toLowerCase().trim();
      if (!em) continue;
      if (!pbsByEmail.has(em)) {
        pbsByEmail.set(em, []);
      }
      pbsByEmail.get(em)!.push({
        id: Number(p.id),
        email: em,
        skill_id: String(p.skill_id),
        weight: Number(p.weight || 0),
        reps: Number(p.reps || 0),
        duration: Number(p.duration || 0),
        proof_url: String(p.proof_url || ''),
        is_verified: Boolean(p.is_verified),
        verification_status: String(p.verification_status || 'unverified'),
        date: String(p.date || ''),
        bodyweight_at_time: Number(p.bodyweight_at_time || 75.0),
        is_public_proof: p.is_public_proof !== false,
      });
    }

    // 3. Compute rankings for all athletes
    const leaderboard = athletes
      .filter((ath) => {
        const em = String(ath.email || '').toLowerCase().trim();
        const isMasked = Boolean(ath.is_masked);
        const isMe = viewerEmail && em === viewerEmail;
        // Hidden if ghost-mode masked, unless viewing own card
        return !isMasked || isMe;
      })
      .map((ath) => {
        const em = String(ath.email || '').toLowerCase().trim();
        const bw = Number(ath.bodyweight_kg) || 75.0;
        const athPbs = pbsByEmail.get(em) || [];

        const { officialELO, unofficialELO } = computeDualELO(athPbs, bw);
        const badge = getRankBadge(officialELO);
        const verifiedPbs = athPbs.filter((p) => p.is_verified);

        // Deduplicate latest PRs per skill for top signature feats
        const prMap = new Map<string, PBRecord>();
        athPbs.forEach((p) => {
          if (!prMap.has(p.skill_id)) prMap.set(p.skill_id, p);
        });

        const topFeats = Array.from(prMap.values())
          .map((p) => {
            const meta = SKILL_MAP.get(p.skill_id);
            return {
              skillId: p.skill_id,
              skillName: meta?.name || p.skill_id,
              tier: meta?.tier || 1,
              category: meta?.category || 'Static',
              score: scoreSinglePB(p, bw),
              reps: p.reps,
              duration: p.duration,
              weight: p.weight,
              isVerified: p.is_verified,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        return {
          id: Number(ath.id),
          email: em,
          displayName: String(ath.display_name || em.split('@')[0]),
          bodyweightKg: bw,
          tagline: String(ath.tagline || ''),
          discipline: String(ath.discipline || 'Statics & Holds'),
          avatarIcon: String(ath.avatar_icon || '⚡'),
          avatarUrl: String(ath.avatar_url || ''),
          isMasked: Boolean(ath.is_masked),
          officialELO,
          unofficialELO,
          badge,
          verifiedCount: verifiedPbs.length,
          totalLogged: athPbs.length,
          topFeats,
        };
      })
      .sort((a, b) => b.officialELO - a.officialELO);

    return NextResponse.json({
      leaderboard,
      totalCount: leaderboard.length,
    });
  } catch (err) {
    console.error('[Leaderboard API Error]:', err);
    return NextResponse.json(
      { error: 'Failed to calculate leaderboard' },
      { status: 500 }
    );
  }
}
