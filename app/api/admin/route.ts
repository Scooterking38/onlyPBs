import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SKILL_MAP } from '@/lib/skills';
import { scoreSinglePB, type PBRecord } from '@/lib/elo';

type StoredPB = PBRecord & {
    id: number;
    bodyweight_at_time?: number;
    verification_status?: string;
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, pbId, approved, reason, email, isMasked } = body;

        if (!action || !['verify', 'mask', 'delete_pb'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        let result: unknown;

        if (action === "verify") {
            if (!pbId) throw new Error("pbId is required for verification");

            const status = approved ? "verified" : "rejected";
            const rejectionReason = reason || '';
            result = await query`
                UPDATE pbs
                SET is_verified = ${Boolean(approved)},
                    verification_status = ${status},
                    rejection_reason = ${rejectionReason}
                WHERE id = ${pbId}
            `;

            // Only approvals cascade. A verified record verifies same-athlete
            // records in the same skill category whose score is <= the approved PB.
            let cascaded = 0;
            if (approved) {
                const selectedRows = await query`
                    SELECT id, email, skill_id, weight, reps, duration, bodyweight_at_time, is_verified, verification_status, date
                    FROM pbs
                ` as StoredPB[];
                const target = selectedRows.find((p) => Number(p.id) === Number(pbId));
                const targetSkill = target ? SKILL_MAP.get(target.skill_id) : undefined;

                if (target && targetSkill) {
                    const targetScore = scoreSinglePB(target, Number(target.bodyweight_at_time) || 75);
                    for (const candidate of selectedRows) {
                        if (Number(candidate.id) === Number(target.id) ||
                            candidate.email?.toLowerCase() !== target.email?.toLowerCase()) continue;

                        const candidateSkill = SKILL_MAP.get(candidate.skill_id);
                        if (!candidateSkill || candidateSkill.category !== targetSkill.category) continue;

                        const candidateScore = scoreSinglePB(candidate, Number(candidate.bodyweight_at_time) || 75);
                        if (candidateScore <= targetScore && !candidate.is_verified) {
                            await query`
                                UPDATE pbs
                                SET is_verified = ${true},
                                    verification_status = ${"verified"},
                                    rejection_reason = ${""}
                                WHERE id = ${candidate.id}
                            `;
                            cascaded++;
                        }
                    }
                }
            }

            return NextResponse.json({ success: true, data: result, cascaded });
        } else if (action === "mask") {
            if (!email || typeof isMasked !== 'boolean') {
                throw new Error("Email and isMasked boolean are required");
            }
            result = await query`
                UPDATE athletes
                SET is_masked = ${isMasked}
                WHERE email = ${email}
            `;
        } else if (action === "delete_pb") {
            if (!pbId) throw new Error("pbId is required for deletion");
            result = await query`DELETE FROM pbs WHERE id = ${pbId}`;
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
