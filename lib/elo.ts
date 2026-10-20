// lib/elo.ts
import { SKILL_MAP } from './skills';

export interface PBRecord {
    id: number;
    email: string;
    skill_id: string;
    weight: number;
    reps: number;
    duration: number;
    proof_url?: string;
    is_verified?: boolean;
    verification_status?: string;
    date: string;
    bodyweight_at_time?: number;
    is_public_proof?: boolean;
}

/**
 * CALIBRATED OUTPUT ENGINE:
 * 1 full rep (cadence ~3.1s) is equivalent to 3.1s of isometric hold time.
 * 1s hold is now worth 5.5 pts (less than half a rep), not 26 pts.
 */
export function calculateOutput(type: "iso" | "dyn", value: number): number {
    const safeVal = Math.max(0, Number(value || 0));
    if (type === "iso") {
        // 3.1s hold ≈ 12.0 output (1 rep equivalent)
        return Math.pow(safeVal, 0.70) * 5.5;
    }
    return safeVal * 12.0;
}

export function scoreSinglePB(pb: PBRecord, athleteBw = 75.0): number {
    const meta = SKILL_MAP.get(pb.skill_id);
    if (!meta) return 0;

    const bw = Math.max(10, athleteBw);
    const loadRatio = Math.max(0.5, (bw + Number(pb.weight || 0)) / bw);
    const rawValue = meta.type === "iso" ? pb.duration : pb.reps;
    const output = calculateOutput(meta.type, rawValue);

    const verifiedBonus = pb.is_verified ? 1.25 : 1.0;
    return Math.round(loadRatio * output * meta.diff * verifiedBonus * 10) / 10;
}

export function computeBaseScoreImpact(
    pb: { skill_id: string; weight?: number; reps?: number; duration?: number },
    athleteBw = 75.0
): number {
    const meta = SKILL_MAP.get(pb.skill_id);
    if (!meta) return 0;

    const bw = Math.max(10, athleteBw);
    const loadRatio = Math.max(0.5, (bw + Number(pb.weight || 0)) / bw);
    const rawValue = meta.type === "iso" ? Number(pb.duration || 0) : Number(pb.reps || 0);
    const output = calculateOutput(meta.type, rawValue);

    return Math.round(loadRatio * output * meta.diff * 10) / 10;
}

export function computeDualELO(pbs: PBRecord[], athleteBw = 75.0) {
    const calc = (records: PBRecord[]) => {
        const bestPerSkill = new Map<string, { cat: string; score: number }>();
        for (const r of records) {
            const meta = SKILL_MAP.get(r.skill_id);
            if (!meta) continue;
            if (!bestPerSkill.has(r.skill_id)) {
                const score = scoreSinglePB(r, athleteBw);
                bestPerSkill.set(r.skill_id, { cat: meta.category, score });
            }
        }

        const buckets: Record<string, number[]> = { Push: [], Pull: [], Core: [], Control: [] };
        for (const { cat, score } of bestPerSkill.values()) {
            if (buckets[cat]) buckets[cat].push(score);
        }

        let acc = 0;
        let activeVectors = 0;
        for (const key of Object.keys(buckets)) {
            const sorted = buckets[key].sort((a, b) => b - a).slice(0, 2);
            const sum = sorted.reduce((a, b) => a + b, 0);
            acc += sum;
            if (sum > 50) activeVectors++;
        }

        return Math.floor(1000 + acc * 0.15 + activeVectors * 50);
    };

    const verified = pbs.filter(p => p.is_verified);
    const officialELO = verified.length > 0 ? calc(verified) : 1000;
    const unofficialELO = calc(pbs);

    return { officialELO, unofficialELO };
}

export function getRankBadge(elo: number) {
    if (elo >= 2600) return { title: "MYTHIC", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
    if (elo >= 2100) return { title: "TITAN", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" };
    if (elo >= 1700) return { title: "VANGUARD", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" };
    if (elo >= 1350) return { title: "ADEPT", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
    return { title: "INITIATE", color: "text-zinc-400 border-zinc-700 bg-zinc-800/50" };
}