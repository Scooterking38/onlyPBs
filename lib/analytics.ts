// lib/analytics.ts
import { SKILL_MAP } from './skills';
import { PBRecord, calculateOutput } from './elo';

export function computeDiagnostics(pbs: PBRecord[], athleteBw = 75.0) {
    const branchPoints: Record<string, number> = {
        Pull: 0, Push: 0, Control: 0, Core: 0, Rings: 0, Legs: 0
    };
    let isoSeconds = 0;
    let dynReps = 0;

    const peaks = new Map<string, PBRecord>();
    for (const pb of pbs) {
        const meta = SKILL_MAP.get(pb.skill_id);
        if (!meta) continue;
        const val = meta.type === "iso" ? Number(pb.duration || 0) : Number(pb.reps || 0);
        const prev = peaks.get(pb.skill_id);
        const prevVal = prev ? (meta.type === "iso" ? Number(prev.duration || 0) : Number(prev.reps || 0)) : -1;
        if (val > prevVal) {
            peaks.set(pb.skill_id, pb);
        }
    }

    for (const pb of peaks.values()) {
        const m = SKILL_MAP.get(pb.skill_id)!;
        const rawVal = m.type === "iso" ? Number(pb.duration || 0) : Number(pb.reps || 0);
        const loadRatio = (athleteBw + (Number(pb.weight) || 0)) / athleteBw;

        // USES CALIBRATED OUTPUT: Duration is no longer raw seconds
        const output = calculateOutput(m.type, rawVal);
        const pts = output * loadRatio * m.diff;

        branchPoints[m.category] = (branchPoints[m.category] || 0) + pts;
        if (m.type === "iso") isoSeconds += rawVal;
        else dynReps += rawVal;
    }

    // Push / Pull Symmetry Calculation
    const pullPts = Math.max(1, branchPoints.Pull);
    const pushPts = Math.max(1, branchPoints.Push);
    const pushPullRatio = Math.round((pushPts / pullPts) * 100) / 100;

    // Normalized Radar Scores (0 to 100 per axis)
    const radarAxes = [
        { label: "PULL", score: Math.min(100, Math.round(branchPoints.Pull / 3.5)) },
        { label: "PUSH", score: Math.min(100, Math.round(branchPoints.Push / 3.5)) },
        { label: "CONTROL", score: Math.min(100, Math.round(branchPoints.Control / 3.0)) },
        { label: "CORE", score: Math.min(100, Math.round(branchPoints.Core / 2.5)) },
        { label: "RINGS", score: Math.min(100, Math.round(branchPoints.Rings / 3.0)) },
        { label: "LEGS", score: Math.min(100, Math.round(branchPoints.Legs / 2.0)) },
    ];

    // Weak-Link Bottleneck
    const activeKeys = ["Pull", "Push", "Core", "Control"];
    const bottleneck = activeKeys.reduce((min, cat) => (branchPoints[cat] < branchPoints[min] ? cat : min), activeKeys[0]);

    let archetype = "All-Round Calisthenics Athlete";
    let archetypeDesc = "Balanced capacity between dynamic reps and straight-arm static tension.";
    const totalVol = isoSeconds + dynReps || 1;
    if (isoSeconds / totalVol > 0.55) {
        archetype = "Isometric / Static Specialist 🗿";
        archetypeDesc = "High tendon density and straight-arm lever tension dominate your profile.";
    } else if ((branchPoints.Rings || 0) > 40) {
        archetype = "Still Rings Aerialist ⭕";
        archetypeDesc = "Unstable plane mastery and superior connective tissue shoulder stability.";
    }

    return { pushPullRatio, bottleneck, archetype, archetypeDesc, branchPoints, radarAxes, isoSeconds, dynReps };
}