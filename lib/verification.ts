import { query } from "@/lib/db";
import { SKILL_MAP } from "@/lib/skills";
import { scoreSinglePB, type PBRecord } from "@/lib/elo";

type StoredPB = PBRecord & {
    id: number;
    bodyweight_at_time?: number;
    verification_status?: string;
};

/**
 * Reconcile verification as derived, idempotent state.
 * A verified PB validates same-athlete PBs in the same category with an
 * equal/lower raw score. Explicitly rejected records are never revived.
 */
export async function reconcileVerification(): Promise<{ verified: number }> {
    const records = await query`
        SELECT id, email, skill_id, weight, reps, duration, bodyweight_at_time,
               is_verified, verification_status, date
        FROM pbs
    ` as StoredPB[];

    const strongestVerified = new Map<string, number>();
    for (const pb of records) {
        if (!pb.is_verified) continue;
        const skill = SKILL_MAP.get(pb.skill_id);
        if (!skill) continue;
        const key = String(pb.email || "").toLowerCase() + "::" + skill.category;
        const score = scoreSinglePB({ ...pb, is_verified: false }, Number(pb.bodyweight_at_time) || 75);
        strongestVerified.set(key, Math.max(strongestVerified.get(key) ?? 0, score));
    }

    let verified = 0;
    for (const pb of records) {
        if (pb.is_verified || pb.verification_status === "rejected") continue;
        const skill = SKILL_MAP.get(pb.skill_id);
        if (!skill) continue;
        const key = String(pb.email || "").toLowerCase() + "::" + skill.category;
        const threshold = strongestVerified.get(key);
        if (threshold === undefined) continue;
        const score = scoreSinglePB({ ...pb, is_verified: false }, Number(pb.bodyweight_at_time) || 75);
        if (score > threshold) continue;

        await query`
            UPDATE pbs
            SET is_verified = ${true},
                verification_status = ${"verified"},
                rejection_reason = ${""}
            WHERE id = ${pb.id}
        `;
        verified++;
    }

    return { verified };
}
