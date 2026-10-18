import { NextResponse } from "next/server";
import { getClient, transaction } from "@/lib/db";
import { getRequestUser } from "@/lib/server-auth";
import { apiJson, apiOptions } from "@/lib/http";
import { SKILL_MAP } from "@/lib/skills";
import { reconcileVerification } from "@/lib/verification";

export const maxDuration = 60;

export function OPTIONS(request: Request) {
  return apiOptions(request);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "true";
    const db = await getClient();

    if (mine) {
      const user = await getRequestUser(request);
      if (!user?.email) {
        return apiJson(request, { error: "Authentication required" }, 401);
      }

      const email = user.email.toLowerCase().trim();
      const rows = await db`
        SELECT id, email, skill_id, weight, reps, duration, proof_url,
               is_verified, verification_status, rejection_reason, date,
               bodyweight_at_time, is_public_proof
        FROM pbs
        WHERE email = ${email}
        ORDER BY id DESC
      `;
      return apiJson(request, rows);
    }

    // Public rankings expose only verified, explicitly public PBs.
    // A public GET must not trigger database-wide cleanup or writes.
    const rows = await db`
      SELECT p.id, a.id AS athlete_id, p.skill_id, p.weight, p.reps, p.duration,
             p.proof_url, p.is_verified, p.verification_status, p.date,
             p.bodyweight_at_time, p.is_public_proof,
             a.display_name, a.avatar_url, a.avatar_icon, a.is_masked
      FROM pbs p
      LEFT JOIN athletes a ON p.email = a.email
      WHERE p.is_verified = true
        AND p.is_public_proof = true
      ORDER BY p.id DESC
    `;

    return apiJson(request, rows);
  } catch (error) {
    console.error("PBS GET error:", error);
    return apiJson(request, { error: "Failed to fetch PBs" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.email) {
      return apiJson(request, { error: "Authentication required" }, 401);
    }

    const body = await request.json();
    const email = user.email.toLowerCase().trim();
    const skillId = typeof body.skillId === "string" ? body.skillId : "";

    if (!SKILL_MAP.has(skillId)) {
      return apiJson(request, { error: "Unknown skill" }, 400);
    }

    const bw = Number(body.bw);
    const weight = Number(body.weight);
    const reps = Number(body.reps);
    const duration = Number(body.duration);
    const proofUrl =
      typeof body.proofUrl === "string" ? body.proofUrl.trim() : "";

    if (
      !Number.isFinite(bw) || bw < 20 || bw > 500 ||
      !Number.isFinite(weight) || !Number.isFinite(reps) ||
      !Number.isFinite(duration) || weight < -bw ||
      reps < 0 || duration < 0 ||
      (reps > 0 && duration > 0) ||
      (reps === 0 && duration === 0)
    ) {
      return apiJson(request, { error: "Invalid PB measurements" }, 400);
    }

    if (proofUrl && !/^https:\/\//i.test(proofUrl)) {
      return apiJson(request, { error: "Proof URL must use HTTPS" }, 400);
    }

    const skill = SKILL_MAP.get(skillId)!;
    if (
      (skill.type === "dyn" && (reps <= 0 || duration !== 0)) ||
      (skill.type === "iso" && (duration <= 0 || reps !== 0))
    ) {
      return apiJson(request, { error: "Measurements do not match this skill" }, 400);
    }

    const isPublic = body.isPublic !== false;
    const status = proofUrl ? "pending" : "unverified";
    const db = await getClient();

    const athlete = await db`
      SELECT id FROM athletes WHERE email = ${email}
    `;

    if (athlete.length === 0) {
      return apiJson(request, { error: "Athlete profile not found" }, 404);
    }

    // Keep replacement, bodyweight update, and reconciliation atomic in PostgreSQL.
    const replaced = await transaction(async (tx) => {
      // Serialize replacements for this athlete and skill across server instances.
      const lockKey = `${email}::${skillId}`;
      await tx`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `;

      const existing = await tx`
        SELECT id FROM pbs
        WHERE email = ${email} AND skill_id = ${skillId}
      `;

      for (const row of existing) {
        await tx`DELETE FROM pbs WHERE id = ${row.id}`;
      }

      await tx`
        INSERT INTO pbs (
          email, skill_id, bodyweight_at_time, weight, reps, duration,
          proof_url, is_public_proof, verification_status, date
        )
        VALUES (
          ${email}, ${skillId}, ${bw}, ${weight}, ${reps}, ${duration},
          ${proofUrl}, ${isPublic}, ${status}, CURRENT_DATE
        )
      `;

      await tx`
        UPDATE athletes SET bodyweight_kg = ${bw} WHERE email = ${email}
      `;

      await reconcileVerification(tx);
      return existing.length > 0;
    });

    return apiJson(request, { success: true, replaced });
  } catch (error) {
    console.error("PBS POST error:", error);
    return apiJson(request, { error: "Failed to record PB" }, 500);
  }
}
