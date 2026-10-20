// app/api/[...route]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query, AthleteRow, PBRow } from "@/lib/db";
import { computeDualELO, getRankBadge, scoreSinglePB, PBRecord } from "@/lib/elo";
import { SKILLS } from "@/lib/skills";

const ADMIN_NAMES_MAP: Record<string, string> = {
  "mrwe3838@gmail.com": "Admin 1",
  "elijaharagonmorgan@gmail.com": "Admin 2",
  "station3828@gmail.com": "Admin 3",
  "2morgane@queenelizabeths.derbyshire.sch.uk": "Admin 4",
};

const ADMIN_EMAILS = Object.keys(ADMIN_NAMES_MAP);

function checkIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// ==========================================
// 1. GET DISPATCHER
// ==========================================
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ route: string[] }> | { route: string[] } }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const endpoint = (resolvedParams?.route?.[0] || "").toLowerCase();
  const { searchParams } = new URL(req.url);

  try {
    // ----------------------------------------------------
    // GET /api/debug -> Verify DB connection & counts
    // ----------------------------------------------------
    if (endpoint === "debug") {
      const athletes = await query<AthleteRow>("SELECT * FROM athletes");
      const pbs = await query<PBRow>("SELECT * FROM pbs");
      const pendingPbs = pbs.filter((p) => p.verification_status === "pending");
      const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

      return NextResponse.json({
        status: "online",
        databaseType: hasDbUrl ? "PostgreSQL (Shared Cloud Database)" : "Local File (callilog_db.json)",
        note: hasDbUrl
          ? "Connected to cloud database. All users share the same records."
          : "Using local JSON file. If deployed on Vercel, add DATABASE_URL in Vercel Project Settings so all devices see each other.",
        totalAthletes: athletes.length,
        totalPbs: pbs.length,
        pendingAuditCount: pendingPbs.length,
        registeredAthletes: athletes.map((a) => ({ id: a.id, email: a.email, name: a.display_name, bw: a.bodyweight_kg })),
      });
    }

    // ----------------------------------------------------
    // GET /api/profile?email=...
    // ----------------------------------------------------
    if (endpoint === "profile") {
      const email = searchParams.get("email")?.toLowerCase().trim();
      if (!email) {
        return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
      }

      let rows = await query<AthleteRow>(
        "SELECT * FROM athletes WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [email]
      );

      // AUTO-REGISTER: The moment any real user logs in, persist them into the database
      if (rows.length === 0) {
        const fallbackName = ADMIN_NAMES_MAP[email] || email.split("@")[0];
        const icon = checkIsAdmin(email) ? "🛡️" : "⚡";

        await query(
          `INSERT INTO athletes (email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked)
           VALUES ($1, $2, 75.0, 'Gravity is just a suggestion.', 'Statics & Holds', $3, '', false)`,
          [email, fallbackName, icon]
        );

        rows = await query<AthleteRow>(
          "SELECT * FROM athletes WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [email]
        );
      }

      return NextResponse.json(rows[0]);
    }

    // ----------------------------------------------------
    // GET /api/pbs?mine=true&email=...
    // ----------------------------------------------------
    if (endpoint === "pbs") {
      const isMine = searchParams.get("mine") === "true";
      const email = searchParams.get("email")?.toLowerCase().trim();

      if (isMine && email) {
        const rows = await query<PBRow>(
          "SELECT * FROM pbs WHERE LOWER(email) = LOWER($1) ORDER BY id DESC",
          [email]
        );
        return NextResponse.json(rows);
      }

      // Public PBs joined with athlete information
      const rows = await query<any>(`
        SELECT 
          p.*,
          a.id as athlete_id,
          a.display_name,
          a.avatar_url,
          a.avatar_icon,
          a.is_masked
        FROM pbs p
        LEFT JOIN athletes a ON LOWER(a.email) = LOWER(p.email)
        ORDER BY p.id DESC
      `);
      return NextResponse.json(rows);
    }

    // ----------------------------------------------------
    // GET /api/leaderboard?viewerEmail=...
    // ----------------------------------------------------
    if (endpoint === "leaderboard") {
      const viewerEmail = searchParams.get("viewerEmail")?.toLowerCase().trim() || "";
      const isViewerAdmin = checkIsAdmin(viewerEmail);

      const athletes = await query<AthleteRow>("SELECT * FROM athletes");
      const pbs = await query<PBRow>("SELECT * FROM pbs");

      // Group PBs by athlete email
      const pbsByEmail = new Map<string, PBRow[]>();
      pbs.forEach((pb) => {
        const em = pb.email.toLowerCase().trim();
        if (!pbsByEmail.has(em)) pbsByEmail.set(em, []);
        pbsByEmail.get(em)!.push(pb);
      });

      // Also ensure any email found in PBs is represented even if athletes table missed it
      const athleteEmails = new Set(athletes.map((a) => a.email.toLowerCase().trim()));
      pbsByEmail.forEach((_, email) => {
        if (!athleteEmails.has(email)) {
          athletes.push({
            id: 0,
            email,
            display_name: ADMIN_NAMES_MAP[email] || email.split("@")[0],
            bodyweight_kg: 75.0,
            tagline: "",
            discipline: "Statics & Holds",
            avatar_icon: checkIsAdmin(email) ? "🛡️" : "⚡",
            avatar_url: "",
            is_masked: false,
          });
        }
      });

      const leaderboard = athletes
        .filter((ath) => {
          const isMe = ath.email.toLowerCase().trim() === viewerEmail;
          if (isMe) return true;
          // Ghost profiles are strictly visible only to Admins
          if (ath.is_masked && !isViewerAdmin) return false;
          return true;
        })
        .map((ath) => {
          const cleanEmail = ath.email.toLowerCase().trim();
          const athPbs = (pbsByEmail.get(cleanEmail) || []).map((p) => ({
            ...p,
            weight: Number(p.weight) || 0,
            reps: Number(p.reps) || 0,
            duration: Number(p.duration) || 0,
            is_verified: Boolean(p.is_verified),
          })) as PBRecord[];

          const bw = Number(ath.bodyweight_kg) || 75.0;
          const { officialELO, unofficialELO } = computeDualELO(athPbs, bw);
          const badge = getRankBadge(officialELO);
          const verifiedCount = athPbs.filter((p) => p.is_verified).length;

          const topFeats = athPbs
            .map((p) => {
              const meta = SKILLS.find((s) => s.id === p.skill_id);
              return {
                skillId: p.skill_id,
                skillName: meta?.name || p.skill_id,
                score: scoreSinglePB(p, bw),
                weight: p.weight,
                reps: p.reps,
                duration: p.duration,
              };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

          return {
            id: ath.id,
            email: ath.email,
            displayName: ath.display_name || ADMIN_NAMES_MAP[cleanEmail] || cleanEmail.split("@")[0],
            bodyweightKg: bw,
            tagline: ath.tagline,
            discipline: ath.discipline,
            avatarIcon: ath.avatar_icon,
            avatarUrl: ath.avatar_url,
            isMasked: ath.is_masked,
            officialELO,
            unofficialELO,
            badge,
            verifiedCount,
            topFeats,
          };
        })
        .sort((a, b) => b.officialELO - a.officialELO);

      return NextResponse.json({ leaderboard });
    }

    // ----------------------------------------------------
    // GET /api/admin?email=...
    // ----------------------------------------------------
    if (endpoint === "admin") {
      const email = searchParams.get("email")?.toLowerCase().trim();
      const isAdmin = checkIsAdmin(email);

      if (!isAdmin) {
        return NextResponse.json({ isAdmin: false, pending: [] }, { status: 403 });
      }

      // Return all submissions waiting for video proof review
      const pending = await query<any>(`
        SELECT 
          p.*,
          a.id as athlete_id,
          a.display_name,
          a.avatar_url,
          a.avatar_icon
        FROM pbs p
        LEFT JOIN athletes a ON LOWER(a.email) = LOWER(p.email)
        WHERE p.verification_status = 'pending'
        ORDER BY p.id ASC
      `);

      return NextResponse.json({ isAdmin: true, pending });
    }

    return NextResponse.json({ error: `Not found: /api/${endpoint}` }, { status: 404 });
  } catch (error: any) {
    console.error(`[API GET /api/${endpoint}] Error:`, error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// ==========================================
// 2. POST DISPATCHER
// ==========================================
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ route: string[] }> | { route: string[] } }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const endpoint = (resolvedParams?.route?.[0] || "").toLowerCase();

  try {
    const body = await req.json().catch(() => ({}));

    // ----------------------------------------------------
    // POST /api/profile
    // ----------------------------------------------------
    if (endpoint === "profile") {
      const email = String(body.email || req.headers.get("x-athlete-email") || "").toLowerCase().trim();
      if (!email) {
        return NextResponse.json({ error: "Missing email" }, { status: 400 });
      }

      const displayName = String(body.displayName || body.display_name || ADMIN_NAMES_MAP[email] || email.split("@")[0]);
      const bw = Number(body.bodyweight || body.bodyweight_kg) || 75.0;
      const tagline = String(body.tagline || "");
      const discipline = String(body.discipline || "Statics & Holds");
      const avatarIcon = String(body.avatarIcon || body.avatar_icon || (checkIsAdmin(email) ? "🛡️" : "⚡"));
      const avatarUrl = String(body.avatarUrl || body.avatar_url || "").trim();
      const isMasked = Boolean(body.isMasked ?? body.is_masked);

      const existing = await query<AthleteRow>(
        "SELECT id FROM athletes WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [email]
      );

      if (existing.length > 0) {
        await query(
          `UPDATE athletes 
           SET display_name = $2, bodyweight_kg = $3, tagline = $4, discipline = $5, avatar_icon = $6, avatar_url = $7, is_masked = $8
           WHERE LOWER(email) = LOWER($1)`,
          [email, displayName, bw, tagline, discipline, avatarIcon, avatarUrl, isMasked]
        );
      } else {
        await query(
          `INSERT INTO athletes (email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [email, displayName, bw, tagline, discipline, avatarIcon, avatarUrl, isMasked]
        );
      }

      const updated = await query<AthleteRow>("SELECT * FROM athletes WHERE LOWER(email) = LOWER($1)", [email]);
      return NextResponse.json({ success: true, profile: updated[0] });
    }

    // ----------------------------------------------------
    // POST /api/pbs
    // ----------------------------------------------------
    if (endpoint === "pbs") {
      const email = String(body.email || req.headers.get("x-athlete-email") || "").toLowerCase().trim();
      const skillId = String(body.skillId || body.skill_id || "");

      if (!email || !skillId) {
        return NextResponse.json({ error: "Missing email or skillId" }, { status: 400 });
      }

      const bw = Number(body.bw || body.bodyweight_at_time) || 75.0;
      const weight = Number(body.weight) || 0;
      const reps = Number(body.reps) || 0;
      const duration = Number(body.duration) || 0;
      const proofUrl = String(body.proofUrl || body.proof_url || "").trim();
      const isPublic = body.isPublic !== false && body.is_public_proof !== false;
      
      // If proof URL is provided, it goes to the admin verification queue!
      const status = proofUrl ? "pending" : "unverified";

      // 1. Ensure athlete row exists
      const ath = await query<AthleteRow>("SELECT id FROM athletes WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
      if (ath.length === 0) {
        await query(
          `INSERT INTO athletes (email, display_name, bodyweight_kg, tagline, discipline, avatar_icon, avatar_url, is_masked)
           VALUES ($1, $2, $3, '', 'Statics & Holds', $4, '', false)`,
          [email, ADMIN_NAMES_MAP[email] || email.split("@")[0], bw, checkIsAdmin(email) ? "🛡️" : "⚡"]
        );
      } else {
        await query("UPDATE athletes SET bodyweight_kg = $1 WHERE LOWER(email) = LOWER($2)", [bw, email]);
      }

      // 2. Remove prior record for this skill
      await query("DELETE FROM pbs WHERE LOWER(email) = LOWER($1) AND skill_id = $2", [email, skillId]);

      // 3. Insert new PB (status = 'pending' if proof URL was provided)
      const result = await query<{ id: number }>(
        `INSERT INTO pbs (email, skill_id, bodyweight_at_time, weight, reps, duration, proof_url, is_public_proof, is_verified, verification_status, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, CURRENT_DATE)
         RETURNING id`,
        [email, skillId, bw, weight, reps, duration, proofUrl, isPublic, status]
      );

      return NextResponse.json({ success: true, pbId: result[0]?.id, status });
    }

    // ----------------------------------------------------
    // POST /api/admin
    // ----------------------------------------------------
    if (endpoint === "admin") {
      const { action, pbId, approved, reason } = body;

      if (action === "verify" && pbId) {
        const isApproved = Boolean(approved);
        const status = isApproved ? "verified" : "rejected";

        await query(
          `UPDATE pbs 
           SET is_verified = $1, verification_status = $2, rejection_reason = $3 
           WHERE id = $4`,
          [isApproved, status, reason || "", Number(pbId)]
        );

        return NextResponse.json({ success: true, status });
      }

      return NextResponse.json({ error: "Invalid admin action" }, { status: 400 });
    }

    return NextResponse.json({ error: `Not found: /api/${endpoint}` }, { status: 404 });
  } catch (error: any) {
    console.error(`[API POST /api/${endpoint}] Error:`, error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
