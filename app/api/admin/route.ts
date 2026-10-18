import { query } from "@/lib/db";
import { getRequestUser, isAdminEmail } from "@/lib/server-auth";
import { apiJson, apiOptions } from "@/lib/http";
import { reconcileVerification } from "@/lib/verification";

export function OPTIONS(request: Request) {
  return apiOptions(request);
}

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.email || !isAdminEmail(user.email)) {
      return apiJson(request, { error: "Administrator access required" }, 403);
    }

    const pending = await query`
      SELECT p.id, p.email, p.skill_id, p.weight, p.reps, p.duration,
             p.proof_url, p.is_verified, p.verification_status,
             p.rejection_reason, p.date, p.bodyweight_at_time,
             p.is_public_proof, a.display_name, a.avatar_url,
             a.avatar_icon, a.is_masked
      FROM pbs p
      LEFT JOIN athletes a ON p.email = a.email
      WHERE p.verification_status = 'pending'
      ORDER BY p.id DESC
    `;

    return apiJson(request, {
      isAdmin: true,
      pending,
    });
  } catch (error) {
    console.error("Admin GET error:", error);
    return apiJson(request, { error: "Unable to load admin queue" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.email || !isAdminEmail(user.email)) {
      return apiJson(request, { error: "Administrator access required" }, 403);
    }

    const body = await request.json();
    const { action } = body;

    if (!["verify", "mask", "delete_pb"].includes(action)) {
      return apiJson(request, { error: "Invalid action" }, 400);
    }

    if (action === "verify") {
      const pbId = Number(body.pbId);
      if (!Number.isSafeInteger(pbId) || pbId <= 0 || typeof body.approved !== "boolean") {
        return apiJson(request, { error: "Valid pbId and approved boolean are required" }, 400);
      }

      const status = body.approved ? "verified" : "rejected";
      const reason =
        typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

      await query`
        UPDATE pbs
        SET is_verified = ${body.approved},
            verification_status = ${status},
            rejection_reason = ${reason}
        WHERE id = ${pbId}
      `;

      const reconciliation = body.approved
        ? await reconcileVerification()
        : { verified: 0 };

      return apiJson(request, {
        success: true,
        reconciled: reconciliation.verified,
      });
    }

    if (action === "mask") {
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!email || typeof body.isMasked !== "boolean") {
        return apiJson(request, { error: "Email and isMasked are required" }, 400);
      }

      await query`
        UPDATE athletes
        SET is_masked = ${body.isMasked}
        WHERE email = ${email}
      `;

      return apiJson(request, { success: true });
    }

    const pbId = Number(body.pbId);
    if (!Number.isSafeInteger(pbId) || pbId <= 0) {
      return apiJson(request, { error: "Valid pbId is required" }, 400);
    }

    await query`DELETE FROM pbs WHERE id = ${pbId}`;
    await reconcileVerification();

    return apiJson(request, { success: true });
  } catch (error) {
    console.error("Admin POST error:", error);
    return apiJson(request, { error: "Admin action failed" }, 500);
  }
}
