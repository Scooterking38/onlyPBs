import { query } from "@/lib/db";
import { apiJson, apiOptions } from "@/lib/http";
import { getRequestUser } from "@/lib/server-auth";

export function OPTIONS(request: Request) {
  return apiOptions(request);
}

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user?.email) {
      return apiJson(request, { error: "Authentication required" }, 401);
    }

    const email = user.email.toLowerCase().trim();
    const rows = await query`
      SELECT id, email, display_name, bodyweight_kg, tagline, discipline,
             avatar_icon, avatar_url, is_masked
      FROM athletes
      WHERE email = ${email}
      LIMIT 1
    `;

    if (rows.length === 0) {
      const defaultName = user.name || email.split("@")[0];

      await query`
        INSERT INTO athletes (
          email, display_name, bodyweight_kg, tagline, discipline,
          avatar_icon, avatar_url, is_masked
        )
        VALUES (
          ${email}, ${defaultName}, 75.0, 'Gravity is just a suggestion.',
          'Statics & Holds', '⚡', ${user.picture || ""}, false
        )
        ON CONFLICT (email) DO NOTHING
      `;

      const created = await query`
        SELECT id, email, display_name, bodyweight_kg, tagline, discipline,
               avatar_icon, avatar_url, is_masked
        FROM athletes
        WHERE email = ${email}
        LIMIT 1
      `;

      return apiJson(request, created[0] ?? {
        email,
        display_name: defaultName,
        bodyweight_kg: 75,
        tagline: "Gravity is just a suggestion.",
        discipline: "Statics & Holds",
        avatar_icon: "⚡",
        avatar_url: user.picture || "",
        is_masked: false,
      });
    }

    return apiJson(request, rows[0]);
  } catch (error) {
    console.error("Profile GET error:", error);
    return apiJson(request, { error: "Failed to load profile" }, 500);
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

    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim().slice(0, 60)
        : "";
    const tagline =
      typeof body.tagline === "string" ? body.tagline.trim().slice(0, 180) : "";
    const discipline =
      typeof body.discipline === "string"
        ? body.discipline.trim().slice(0, 80)
        : "";
    const avatarIcon =
      typeof body.avatarIcon === "string" ? body.avatarIcon.slice(0, 16) : "⚡";
    const avatarUrl =
      typeof body.avatarUrl === "string" &&
      /^https:\/\//i.test(body.avatarUrl)
        ? body.avatarUrl.slice(0, 2048)
        : "";
    const bodyweight = Number(body.bodyweight);

    if (!Number.isFinite(bodyweight) || bodyweight < 20 || bodyweight > 500) {
      return apiJson(request, { error: "Bodyweight must be between 20 and 500 kg" }, 400);
    }

    await query`
      INSERT INTO athletes (
        email, display_name, bodyweight_kg, tagline, discipline,
        avatar_icon, avatar_url, is_masked
      )
      VALUES (
        ${email},
        ${displayName || user.name || email.split("@")[0]},
        ${bodyweight},
        ${tagline},
        ${discipline || "Statics & Holds"},
        ${avatarIcon},
        ${avatarUrl},
        false
      )
      ON CONFLICT (email) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bodyweight_kg = EXCLUDED.bodyweight_kg,
        tagline = EXCLUDED.tagline,
        discipline = EXCLUDED.discipline,
        avatar_icon = EXCLUDED.avatar_icon,
        avatar_url = EXCLUDED.avatar_url
    `;

    return apiJson(request, { success: true });
  } catch (error) {
    console.error("Profile POST error:", error);
    return apiJson(request, { error: "Failed to update profile" }, 500);
  }
}
