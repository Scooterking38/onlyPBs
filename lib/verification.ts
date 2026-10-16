import { query } from "@/lib/db";
import { SKILL_MAP } from "@/lib/skills";
import { scoreSinglePB, type PBRecord } from "@/lib/elo";

type StoredPB = PBRecord & {
    id: number;
    bodyweight_at_time?: number | null;
    verification_status?: string | null;
    rejection_reason?: string | null;
};

type CleanupStats = { duplicatesRemoved: number; invalidRemoved: number };

/**
 * Remove malformed PB rows and collapse duplicate athlete/skill rows before
 * deriving verification state. Highest ID wins among valid duplicates because
 * the submission endpoint replaces the PB and IDs are monotonically increasing.
 */
async function cleanPBRecords(records: StoredPB[]): Promise<{ records: StoredPB[] } & CleanupStats> {
    const valid: StoredPB[] = [];
    let invalidRemoved = 0;
    let duplicatesRemoved = 0;

    for (const pb of records) {
        const skill = SKILL_MAP.get(String(pb.skill_id || ""));
        const reps = Number(pb.reps ?? 0);
        const duration = Number(pb.duration ?? 0);
        const weight = Number(pb.weight ?? 0);
        const bodyweight = pb.bodyweight_at_time == null ? null : Number(pb.bodyweight_at_time);
        const hasValidIdentity = Number.isFinite(Number(pb.id)) && String(pb.email || "").trim().includes("@");
        const hasValidNumbers =
            Number.isFinite(reps) && Number.isFinite(duration) && Number.isFinite(weight) &&
            reps >= 0 && duration >= 0 &&
            (bodyweight === null || (Number.isFinite(bodyweight) && bodyweight > 0 && bodyweight <= 500)) &&
            (bodyweight === null || weight >= -bodyweight);
        const hasCorrectMeasurement =
            !!skill &&
            (skill.type === "dyn" ? reps > 0 && duration === 0 : duration > 0 && reps === 0);
        const hasValidDate = !pb.date || Number.isFinite(Date.parse(String(pb.date)));
        const proof = String(pb.proof_url || "").trim();
        const hasValidProof = !proof || /^https?:\/\//i.test(proof);

        if (!skill || !hasValidIdentity || !hasValidNumbers || !hasCorrectMeasurement || !hasValidDate || !hasValidProof) {
            await query`DELETE FROM pbs WHERE id = ${pb.id}`;
            invalidRemoved++;
            continue;
        }
        valid.push({ ...pb, reps, duration, weight });
    }

    // Keep the latest valid submission for each athlete + skill.
    // Process IDs descending so the newest row is retained.
    valid.sort((a, b) => Number(b.id) - Number(a.id));
    const seen = new Set<string>();
    const deduplicated: StoredPB[] = [];
    for (const pb of valid) {
        const key = String(pb.email).trim().toLowerCase() + "::" + pb.skill_id;
        if (seen.has(key)) {
            await query`DELETE FROM pbs WHERE id = ${pb.id}`;
            duplicatesRemoved++;
            continue;
        }
        seen.add(key);
        deduplicated.push(pb);
    }

    return { records: deduplicated, invalidRemoved, duplicatesRemoved };
}

/**
 * Idempotent self-healing pass. Runs data hygiene first, then verifies eligible
 * records from the strongest already-verified performance in the same category.
 */
export async function reconcileVerification(): Promise<{
    verified: number;
    duplicatesRemoved: number;
    invalidRemoved: number;
}> {
    const rawRecords = await query`
        SELECT id, email, skill_id, weight, reps, duration, proof_url, is_verified,
               verification_status, rejection_reason, bodyweight_at_time, date
        FROM pbs
    ` as StoredPB[];

    const cleaned = await cleanPBRecords(rawRecords);
    const records = cleaned.records;
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

    return { verified, duplicatesRemoved: cleaned.duplicatesRemoved, invalidRemoved: cleaned.invalidRemoved };
}
