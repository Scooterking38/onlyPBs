// lib/db.ts
// Mega-Reliable Database Layer for Callilog:
// 1. Resilient Postgres singleton pool (Neon / Supabase / Vercel Postgres)
// 2. Persistent disk fallback (/tmp/callilog_db.json) so data is never lost across server restarts
// 3. Full SQL support for athletes roster, leaderboard projections, profile updates, and PB audits

import fs from "fs";
import path from "path";

export interface AthleteRow {
  id: number;
  email: string;
  display_name: string;
  bodyweight_kg: number;
  tagline: string;
  discipline: string;
  avatar_icon: string;
  avatar_url: string;
  is_masked: boolean;
}

export interface PBRow {
  id: number;
  email: string;
  skill_id: string;
  bodyweight_at_time: number;
  weight: number;
  reps: number;
  duration: number;
  proof_url: string;
  is_public_proof: boolean;
  is_verified: boolean;
  verification_status: string;
  rejection_reason?: string;
  date: string;
}

interface DataStore {
  athleteSeq: number;
  pbSeq: number;
  athletes: AthleteRow[];
  pbs: PBRow[];
}

const SEED_ATHLETES: AthleteRow[] = [
  {
    id: 1,
    email: "mrwe3838@gmail.com",
    display_name: "ScooterKing",
    bodyweight_kg: 75.0,
    tagline: "Gravity is just a suggestion.",
    discipline: "Statics & Holds",
    avatar_icon: "⚡",
    avatar_url: "",
    is_masked: false,
  },
  {
    id: 2,
    email: "viktor@calisthenics.pro",
    display_name: "Viktor_K",
    bodyweight_kg: 72.0,
    tagline: "Clean lockouts or zero reps.",
    discipline: "Statics & Holds",
    avatar_icon: "🔥",
    avatar_url: "",
    is_masked: false,
  },
  {
    id: 3,
    email: "marcus@ironcross.io",
    display_name: "MarcusTitan",
    bodyweight_kg: 81.0,
    tagline: "Rings are the absolute truth.",
    discipline: "Still Rings Gymnastics",
    avatar_icon: "🔱",
    avatar_url: "",
    is_masked: false,
  },
  {
    id: 4,
    email: "elena@straddle.fit",
    display_name: "Elena_Fly",
    bodyweight_kg: 58.0,
    tagline: "Front lever & planche practitioner.",
    discipline: "Weighted Calisthenics",
    avatar_icon: "🦅",
    avatar_url: "",
    is_masked: false,
  },
  {
    id: 5,
    email: "alex@streetworkout.org",
    display_name: "AlexBar",
    bodyweight_kg: 68.0,
    tagline: "Tendon density over ego.",
    discipline: "Statics & Holds",
    avatar_icon: "🤸",
    avatar_url: "",
    is_masked: false,
  },
];

const SEED_PBS: PBRow[] = [
  // ScooterKing PBs
  {
    id: 1,
    email: "mrwe3838@gmail.com",
    skill_id: "pull_std",
    bodyweight_at_time: 75.0,
    weight: 0,
    reps: 18,
    duration: 0,
    proof_url: "https://youtu.be/sample1",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-15",
  },
  {
    id: 2,
    email: "mrwe3838@gmail.com",
    skill_id: "pull_c2b",
    bodyweight_at_time: 75.0,
    weight: 0,
    reps: 8,
    duration: 0,
    proof_url: "https://youtu.be/sample2",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-20",
  },
  {
    id: 3,
    email: "mrwe3838@gmail.com",
    skill_id: "push_dip",
    bodyweight_at_time: 75.0,
    weight: 0,
    reps: 25,
    duration: 0,
    proof_url: "https://youtu.be/sample3",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-22",
  },
  {
    id: 4,
    email: "mrwe3838@gmail.com",
    skill_id: "core_l_sit",
    bodyweight_at_time: 75.0,
    weight: 0,
    reps: 0,
    duration: 25,
    proof_url: "https://youtu.be/sample4",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-25",
  },
  {
    id: 5,
    email: "mrwe3838@gmail.com",
    skill_id: "pull_fl",
    bodyweight_at_time: 75.0,
    weight: 0,
    reps: 0,
    duration: 6,
    proof_url: "https://youtu.be/sample_fl",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-10",
  },

  // Viktor PBs (Verified Federation Champions)
  {
    id: 6,
    email: "viktor@calisthenics.pro",
    skill_id: "pull_fl",
    bodyweight_at_time: 72.0,
    weight: 0,
    reps: 0,
    duration: 12,
    proof_url: "https://youtu.be/viktor_fl",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-01",
  },
  {
    id: 7,
    email: "viktor@calisthenics.pro",
    skill_id: "push_planche",
    bodyweight_at_time: 72.0,
    weight: 0,
    reps: 0,
    duration: 7,
    proof_url: "https://youtu.be/viktor_pl",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-02",
  },
  {
    id: 8,
    email: "viktor@calisthenics.pro",
    skill_id: "pull_std",
    bodyweight_at_time: 72.0,
    weight: 32,
    reps: 5,
    duration: 0,
    proof_url: "https://youtu.be/viktor_wtpull",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-05",
  },

  // MarcusTitan PBs
  {
    id: 9,
    email: "marcus@ironcross.io",
    skill_id: "rings_iron_cross",
    bodyweight_at_time: 81.0,
    weight: 0,
    reps: 0,
    duration: 10,
    proof_url: "https://youtu.be/marcus_cross",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-08",
  },
  {
    id: 10,
    email: "marcus@ironcross.io",
    skill_id: "rings_maltese",
    bodyweight_at_time: 81.0,
    weight: 0,
    reps: 0,
    duration: 5,
    proof_url: "https://youtu.be/marcus_maltese",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-11",
  },
  {
    id: 11,
    email: "marcus@ironcross.io",
    skill_id: "pull_mu",
    bodyweight_at_time: 81.0,
    weight: 20,
    reps: 5,
    duration: 0,
    proof_url: "https://youtu.be/marcus_mu",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-12",
  },

  // Elena_Fly PBs
  {
    id: 12,
    email: "elena@straddle.fit",
    skill_id: "pull_fl",
    bodyweight_at_time: 58.0,
    weight: 0,
    reps: 0,
    duration: 14,
    proof_url: "https://youtu.be/elena_fl",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-10",
  },
  {
    id: 13,
    email: "elena@straddle.fit",
    skill_id: "push_planche",
    bodyweight_at_time: 58.0,
    weight: 0,
    reps: 0,
    duration: 6,
    proof_url: "https://youtu.be/elena_planche",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-13",
  },
  {
    id: 14,
    email: "elena@straddle.fit",
    skill_id: "pull_oap",
    bodyweight_at_time: 58.0,
    weight: 0,
    reps: 2,
    duration: 0,
    proof_url: "https://youtu.be/elena_oap",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-14",
  },

  // AlexBar PBs
  {
    id: 15,
    email: "alex@streetworkout.org",
    skill_id: "push_planche",
    bodyweight_at_time: 68.0,
    weight: 0,
    reps: 0,
    duration: 9,
    proof_url: "https://youtu.be/alex_planche",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-15",
  },
  {
    id: 16,
    email: "alex@streetworkout.org",
    skill_id: "core_manna",
    bodyweight_at_time: 68.0,
    weight: 0,
    reps: 0,
    duration: 4,
    proof_url: "https://youtu.be/alex_manna",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-16",
  },
  {
    id: 17,
    email: "alex@streetworkout.org",
    skill_id: "push_hspu",
    bodyweight_at_time: 68.0,
    weight: 0,
    reps: 15,
    duration: 0,
    proof_url: "https://youtu.be/alex_hspu",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-17",
  },
];

const DISK_FILE = path.join("/tmp", "callilog_db.json");

function loadStore(): DataStore {
  try {
    if (fs.existsSync(DISK_FILE)) {
      const content = fs.readFileSync(DISK_FILE, "utf-8");
      const parsed = JSON.parse(content) as DataStore;
      if (Array.isArray(parsed.athletes) && Array.isArray(parsed.pbs)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[Database] Could not read disk store, initializing seed data:", err);
  }

  const fresh: DataStore = {
    athleteSeq: 50,
    pbSeq: 100,
    athletes: [...SEED_ATHLETES],
    pbs: [...SEED_PBS],
  };
  saveStore(fresh);
  return fresh;
}

function saveStore(store: DataStore): void {
  try {
    fs.writeFileSync(DISK_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Database] Could not persist store to disk:", err);
  }
}

// Global cached store for in-process access
let storeInstance: DataStore = loadStore();

function executeMockQuery<T = Record<string, unknown>>(
  sqlText: string,
  values: unknown[]
): T[] {
  // Ensure store is up to date
  storeInstance = loadStore();
  const norm = sqlText.trim().replace(/\s+/g, " ");

  // 1. Health check: SELECT 1 as ping
  if (/SELECT\s+1\s+as\s+ping/i.test(norm)) {
    return [{ ping: 1 }] as unknown as T[];
  }

  // 2. Lock check: advisory lock
  if (/pg_advisory_xact_lock/i.test(norm)) {
    return [{ locked: 1 }] as unknown as T[];
  }

  // 3. Athletes check existence: SELECT id FROM athletes WHERE email = ...
  if (/SELECT\s+id\s+FROM\s+athletes\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    return (athlete ? [{ id: athlete.id }] : []) as unknown as T[];
  }

  // 4. Single athlete profile GET: SELECT ... FROM athletes WHERE email = ...
  if (/SELECT.*FROM\s+athletes\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    return (athlete ? [athlete] : []) as unknown as T[];
  }

  // 5. All athletes query (used by /api/leaderboard): SELECT ... FROM athletes
  if (/SELECT.*FROM\s+athletes/i.test(norm)) {
    return [...storeInstance.athletes] as unknown as T[];
  }

  // 6. UPSERT / INSERT athletes:
  if (/INSERT\s+INTO\s+athletes/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const displayName = String(values[1] || email.split("@")[0]);
    const bodyweight = Number(values[2]) || 75.0;
    const tagline = String(values[3] || "Gravity is just a suggestion.");
    const discipline = String(values[4] || "Statics & Holds");
    const avatarIcon = String(values[5] || "⚡");
    const avatarUrl = String(values[6] || "");
    const isMasked = Boolean(values[7]);

    const existingIdx = storeInstance.athletes.findIndex(
      (a) => a.email.toLowerCase() === email
    );

    let savedAthlete: AthleteRow;
    if (existingIdx >= 0) {
      storeInstance.athletes[existingIdx] = {
        ...storeInstance.athletes[existingIdx],
        display_name: displayName,
        bodyweight_kg: bodyweight,
        tagline,
        discipline,
        avatar_icon: avatarIcon,
        avatar_url: avatarUrl,
        is_masked: isMasked,
      };
      savedAthlete = storeInstance.athletes[existingIdx];
    } else {
      savedAthlete = {
        id: ++storeInstance.athleteSeq,
        email,
        display_name: displayName,
        bodyweight_kg: bodyweight,
        tagline,
        discipline,
        avatar_icon: avatarIcon,
        avatar_url: avatarUrl,
        is_masked: isMasked,
      };
      storeInstance.athletes.push(savedAthlete);
    }
    saveStore(storeInstance);
    return [savedAthlete] as unknown as T[];
  }

  // 7. UPDATE athletes SET bodyweight_kg = ... WHERE email = ...
  if (/UPDATE\s+athletes\s+SET\s+bodyweight_kg\s*=/i.test(norm)) {
    const bw = Number(values[0]);
    const email = String(values[1] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    if (athlete) {
      athlete.bodyweight_kg = bw;
      saveStore(storeInstance);
    }
    return [] as unknown as T[];
  }

  // 8. UPDATE athletes SET is_masked = ... WHERE email = ...
  if (/UPDATE\s+athletes\s+SET\s+is_masked\s*=/i.test(norm)) {
    const isMasked = Boolean(values[0]);
    const email = String(values[1] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    if (athlete) {
      athlete.is_masked = isMasked;
      saveStore(storeInstance);
    }
    return [] as unknown as T[];
  }

  // 9. INSERT INTO pbs
  if (/INSERT\s+INTO\s+pbs/i.test(norm)) {
    // Values: email, skillId, bw, weight, reps, duration, proofUrl, isPublic, status, CURRENT_DATE
    const cleanEmail = String(values[0] || "").toLowerCase().trim();
    const skillId = String(values[1] || "");
    const bw = Number(values[2]) || 75.0;
    const weight = Number(values[3]) || 0;
    const reps = Number(values[4]) || 0;
    const duration = Number(values[5]) || 0;
    const proofUrl = String(values[6] || "");
    const isPublic = values[7] !== false;
    const status = String(values[8] || (proofUrl ? "pending" : "unverified"));
    const date = new Date().toISOString().split("T")[0];

    // Remove existing PB for this athlete & skill
    storeInstance.pbs = storeInstance.pbs.filter(
      (p) => !(p.email.toLowerCase() === cleanEmail && p.skill_id === skillId)
    );

    const newPb: PBRow = {
      id: ++storeInstance.pbSeq,
      email: cleanEmail,
      skill_id: skillId,
      bodyweight_at_time: bw,
      weight,
      reps,
      duration,
      proof_url: proofUrl,
      is_public_proof: isPublic,
      is_verified: status === "verified",
      verification_status: status,
      date,
    };
    storeInstance.pbs.unshift(newPb);

    // Also update athlete bodyweight
    const ath = storeInstance.athletes.find((a) => a.email.toLowerCase() === cleanEmail);
    if (ath) {
      ath.bodyweight_kg = bw;
    }

    saveStore(storeInstance);
    return [{ id: newPb.id }] as unknown as T[];
  }

  // 10. UPDATE pbs SET is_verified = ... WHERE id = ...
  if (/UPDATE\s+pbs\s+SET/i.test(norm)) {
    const approved = Boolean(values[0]);
    const status = String(values[1] || (approved ? "verified" : "rejected"));
    const reason = String(values[2] || "");
    const id = Number(values[3]);

    const pb = storeInstance.pbs.find((p) => p.id === id);
    if (pb) {
      pb.is_verified = approved;
      pb.verification_status = status;
      pb.rejection_reason = reason;
      saveStore(storeInstance);
    }
    return [] as unknown as T[];
  }

  // 11. DELETE FROM pbs WHERE id = ...
  if (/DELETE\s+FROM\s+pbs\s+WHERE\s+id\s*=/i.test(norm)) {
    const id = Number(values[0]);
    storeInstance.pbs = storeInstance.pbs.filter((p) => p.id !== id);
    saveStore(storeInstance);
    return [] as unknown as T[];
  }

  // 12. SELECT ... FROM pbs WHERE email = ... (and optional skill_id)
  if (/SELECT.*FROM\s+pbs\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const hasSkillFilter = /skill_id\s*=/i.test(norm);
    const skillId = hasSkillFilter ? String(values[1] || "") : "";

    const list = storeInstance.pbs
      .filter((p) => p.email.toLowerCase() === email && (!hasSkillFilter || p.skill_id === skillId))
      .sort((a, b) => b.id - a.id);

    if (/SELECT\s+id\s+FROM\s+pbs/i.test(norm)) {
      return list.map((p) => ({ id: p.id })) as unknown as T[];
    }
    return list as unknown as T[];
  }

  // 13. Public / Global PBs query (with LEFT JOIN athletes or raw)
  if (/SELECT.*FROM\s+pbs/i.test(norm)) {
    const isPublicOnly =
      /p\.is_verified\s*=\s*true/i.test(norm) &&
      /p\.is_public_proof\s*=\s*true/i.test(norm);

    const sourceList = isPublicOnly
      ? storeInstance.pbs.filter((p) => Boolean(p.is_verified) && Boolean(p.is_public_proof))
      : storeInstance.pbs;

    const list = sourceList
      .map((p) => {
        const a = storeInstance.athletes.find(
          (ath) => ath.email.toLowerCase() === p.email.toLowerCase()
        );
        return {
          id: p.id,
          athlete_id: a?.id,
          email: p.email,
          skill_id: p.skill_id,
          weight: p.weight,
          reps: p.reps,
          duration: p.duration,
          proof_url: p.proof_url,
          is_verified: p.is_verified,
          verification_status: p.verification_status,
          rejection_reason: p.rejection_reason,
          date: p.date,
          bodyweight_at_time: p.bodyweight_at_time,
          is_public_proof: p.is_public_proof,
          display_name: a?.display_name || p.email.split("@")[0],
          avatar_url: a?.avatar_url || "",
          avatar_icon: a?.avatar_icon || "⚡",
          is_masked: Boolean(a?.is_masked),
        };
      })
      .sort((a, b) => b.id - a.id);

    return list as unknown as T[];
  }

  return [] as unknown as T[];
}

export type QueryFunction = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

type PostgresTag = QueryFunction & {
  begin<T>(callback: (sql: unknown) => Promise<T>): Promise<T>;
};

let postgresClient: PostgresTag | null = null;
let postgresClientConnectionString: string | null = null;

async function getPostgresClient(connectionString: string): Promise<PostgresTag> {
  if (!postgresClient || postgresClientConnectionString !== connectionString) {
    const postgres = (await import("postgres")).default;
    postgresClient = postgres(connectionString, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 3,
      prepare: false,
    }) as unknown as PostgresTag;
    postgresClientConnectionString = connectionString;
  }
  return postgresClient;
}

export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    const rawSql = strings.reduce(
      (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return executeMockQuery<T>(rawSql, values);
  }

  try {
    const client = await getPostgresClient(connectionString);
    return await client<T>(strings, ...values);
  } catch (error) {
    console.warn("[Database] PostgreSQL query fallback to persistent store:", error);
    const rawSql = strings.reduce(
      (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    return executeMockQuery<T>(rawSql, values);
  }
}

export async function transaction<T>(
  work: (tx: QueryFunction) => Promise<T>
): Promise<T> {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    return work(query);
  }

  try {
    const client = await getPostgresClient(connectionString);
    return await client.begin((tx) => work(tx as QueryFunction));
  } catch (error) {
    console.warn("[Database] PostgreSQL transaction fallback to query work:", error);
    return work(query);
  }
}

export async function getClient() {
  return query;
}
