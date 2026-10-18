// lib/db.ts
// AI Studio migration: Mock in-memory database with optional PostgreSQL connection

interface AthleteRow {
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

interface PBRow {
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

// In-memory data store seeded for instant functionality in AI Studio
let athleteSeq = 10;
let pbSeq = 20;

const initialAthletes: AthleteRow[] = [
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
    tagline: "Clean form or no rep.",
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
    tagline: "Rings are absolute truth.",
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

const initialPbs: PBRow[] = [
  // User PBs
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
    proof_url: "",
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
    proof_url: "",
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
    is_verified: false,
    verification_status: "pending",
    date: "2026-10-10",
  },

  // Viktor PBs
  {
    id: 6,
    email: "viktor@calisthenics.pro",
    skill_id: "pull_fl",
    bodyweight_at_time: 72.0,
    weight: 0,
    reps: 0,
    duration: 12,
    proof_url: "https://youtu.be/sample3",
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
    proof_url: "https://youtu.be/sample4",
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
    weight: 0,
    reps: 28,
    duration: 0,
    proof_url: "",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-03",
  },

  // Marcus PBs
  {
    id: 9,
    email: "marcus@ironcross.io",
    skill_id: "rings_dip",
    bodyweight_at_time: 81.0,
    weight: 15,
    reps: 20,
    duration: 0,
    proof_url: "https://youtu.be/sample5",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-28",
  },
  {
    id: 10,
    email: "marcus@ironcross.io",
    skill_id: "push_dip",
    bodyweight_at_time: 81.0,
    weight: 20,
    reps: 30,
    duration: 0,
    proof_url: "",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-29",
  },
  {
    id: 11,
    email: "marcus@ironcross.io",
    skill_id: "core_dragon",
    bodyweight_at_time: 81.0,
    weight: 0,
    reps: 12,
    duration: 0,
    proof_url: "",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-09-30",
  },

  // Elena PBs
  {
    id: 12,
    email: "elena@straddle.fit",
    skill_id: "pull_std",
    bodyweight_at_time: 58.0,
    weight: 10,
    reps: 22,
    duration: 0,
    proof_url: "https://youtu.be/sample6",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-05",
  },
  {
    id: 13,
    email: "elena@straddle.fit",
    skill_id: "pull_chin",
    bodyweight_at_time: 58.0,
    weight: 5,
    reps: 24,
    duration: 0,
    proof_url: "",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-06",
  },
  {
    id: 14,
    email: "elena@straddle.fit",
    skill_id: "push_hspu",
    bodyweight_at_time: 58.0,
    weight: 0,
    reps: 10,
    duration: 0,
    proof_url: "https://youtu.be/sample7",
    is_public_proof: true,
    is_verified: true,
    verification_status: "verified",
    date: "2026-10-07",
  },

  // Alex pending PB for Admin review
  {
    id: 15,
    email: "alex@streetworkout.org",
    skill_id: "push_planche",
    bodyweight_at_time: 68.0,
    weight: 0,
    reps: 0,
    duration: 5,
    proof_url: "https://youtube.com/watch?v=sample8",
    is_public_proof: true,
    is_verified: false,
    verification_status: "pending",
    date: "2026-10-15",
  },
];

// In-memory data store instance
const memoryStore = {
  athletes: [...initialAthletes],
  pbs: [...initialPbs],
};

function executeMockQuery<T = Record<string, unknown>>(
  sqlText: string,
  values: unknown[]
): T[] {
  const norm = sqlText.trim().replace(/\s+/g, " ");

  // 1. Health check ping: SELECT 1 as ping
  if (/SELECT\s+1\s+as\s+ping/i.test(norm)) {
    return [{ ping: 1 }] as unknown as T[];
  }

  // 2. Profile GET: SELECT ... FROM athletes WHERE email = ...
  if (/SELECT.*FROM\s+athletes\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const athlete = memoryStore.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    return (athlete ? [athlete] : []) as unknown as T[];
  }

  // 3. Check athlete exists: SELECT id FROM athletes WHERE email = ...
  if (/SELECT\s+id\s+FROM\s+athletes\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const athlete = memoryStore.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    return (athlete ? [{ id: athlete.id }] : []) as unknown as T[];
  }

  // 4. UPSERT / INSERT athletes:
  if (/INSERT\s+INTO\s+athletes/i.test(norm)) {
    // Values order from route:
    // email, displayName, bodyweight, tagline, discipline, avatarIcon, avatarUrl, isMasked
    const email = String(values[0] || "").toLowerCase().trim();
    const displayName = String(values[1] || email.split("@")[0]);
    const bodyweight = Number(values[2]) || 75.0;
    const tagline = String(values[3] || "");
    const discipline = String(values[4] || "Statics & Holds");
    const avatarIcon = String(values[5] || "⚡");
    const avatarUrl = String(values[6] || "");
    const isMasked = Boolean(values[7]);

    const existingIdx = memoryStore.athletes.findIndex(
      (a) => a.email.toLowerCase() === email
    );
    if (existingIdx >= 0) {
      memoryStore.athletes[existingIdx] = {
        ...memoryStore.athletes[existingIdx],
        display_name: displayName,
        bodyweight_kg: bodyweight,
        tagline,
        discipline,
        avatar_icon: avatarIcon,
        avatar_url: avatarUrl,
        is_masked: isMasked,
      };
      return [memoryStore.athletes[existingIdx]] as unknown as T[];
    } else {
      const newAthlete: AthleteRow = {
        id: ++athleteSeq,
        email,
        display_name: displayName,
        bodyweight_kg: bodyweight,
        tagline,
        discipline,
        avatar_icon: avatarIcon,
        avatar_url: avatarUrl,
        is_masked: isMasked,
      };
      memoryStore.athletes.push(newAthlete);
      return [newAthlete] as unknown as T[];
    }
  }

  // 5. UPDATE athletes SET bodyweight_kg = ... WHERE email = ...
  if (/UPDATE\s+athletes\s+SET\s+bodyweight_kg\s*=/i.test(norm)) {
    const bw = Number(values[0]);
    const email = String(values[1] || "").toLowerCase().trim();
    const athlete = memoryStore.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    if (athlete) athlete.bodyweight_kg = bw;
    return [] as unknown as T[];
  }

  // 6. UPDATE athletes SET is_masked = ... WHERE email = ...
  if (/UPDATE\s+athletes\s+SET\s+is_masked\s*=/i.test(norm)) {
    const isMasked = Boolean(values[0]);
    const email = String(values[1] || "").toLowerCase().trim();
    const athlete = memoryStore.athletes.find(
      (a) => a.email.toLowerCase() === email
    );
    if (athlete) athlete.is_masked = isMasked;
    return [] as unknown as T[];
  }

  // 7. INSERT INTO pbs
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

    const newPb: PBRow = {
      id: ++pbSeq,
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
    memoryStore.pbs.unshift(newPb);
    return [{ id: newPb.id }] as unknown as T[];
  }

  // 8. UPDATE pbs SET is_verified = ... WHERE id = ...
  if (/UPDATE\s+pbs\s+SET/i.test(norm)) {
    const approved = Boolean(values[0]);
    const status = String(values[1] || (approved ? "verified" : "rejected"));
    const reason = String(values[2] || "");
    const id = Number(values[3]);

    const pb = memoryStore.pbs.find((p) => p.id === id);
    if (pb) {
      pb.is_verified = approved;
      pb.verification_status = status;
      pb.rejection_reason = reason;
    }
    return [] as unknown as T[];
  }

  // 9. DELETE FROM pbs WHERE id = ...
  if (/DELETE\s+FROM\s+pbs\s+WHERE\s+id\s*=/i.test(norm)) {
    const id = Number(values[0]);
    memoryStore.pbs = memoryStore.pbs.filter((p) => p.id !== id);
    return [] as unknown as T[];
  }

  // 10. SELECT ... FROM pbs WHERE email = ... (optionally scoped to a skill)
  if (/SELECT.*FROM\s+pbs\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const hasSkillFilter = /skill_id\s*=/i.test(norm);
    const skillId = hasSkillFilter ? String(values[1] || "") : "";
    const list = memoryStore.pbs
      .filter((p) => p.email.toLowerCase() === email && (!hasSkillFilter || p.skill_id === skillId))
      .sort((a, b) => b.id - a.id);
    if (/SELECT\s+id\s+FROM\s+pbs/i.test(norm)) {
      return list.map((p) => ({ id: p.id })) as unknown as T[];
    }
    return list as unknown as T[];
  }

  // 11. SELECT ... FROM pbs, including the public leaderboard projection.
  if (/SELECT.*FROM\s+pbs/i.test(norm)) {
    const isPublicLeaderboard =
      /p\.is_verified\s*=\s*true/i.test(norm) &&
      /p\.is_public_proof\s*=\s*true/i.test(norm) &&
      /LEFT\s+JOIN\s+athletes/i.test(norm);

    if (isPublicLeaderboard) {
      const list = memoryStore.pbs
        .filter((p) => Boolean(p.is_verified) && Boolean(p.is_public_proof))
        .map((p) => {
          const a = memoryStore.athletes.find(
            (ath) => ath.email.toLowerCase() === p.email.toLowerCase()
          );
          return {
            id: p.id,
            athlete_id: a?.id,
            skill_id: p.skill_id,
            weight: p.weight,
            reps: p.reps,
            duration: p.duration,
            proof_url: p.proof_url,
            is_verified: p.is_verified,
            verification_status: p.verification_status,
            date: p.date,
            bodyweight_at_time: p.bodyweight_at_time,
            is_public_proof: p.is_public_proof,
            display_name: a?.display_name || "Athlete",
            avatar_url: a?.avatar_url || "",
            avatar_icon: a?.avatar_icon || "⚡",
            is_masked: Boolean(a?.is_masked),
          };
        })
        .sort((a, b) => b.id - a.id);
      return list as unknown as T[];
    }

    const list = memoryStore.pbs
      .map((p) => {
        const a = memoryStore.athletes.find(
          (ath) => ath.email.toLowerCase() === p.email.toLowerCase()
        );
        return {
          ...p,
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
      max: 1,
      idle_timeout: 20,
      connect_timeout: 3,
      prepare: false,
    }) as unknown as PostgresTag;
    postgresClientConnectionString = connectionString;
  }
  return postgresClient;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    if (isProduction()) throw new Error("DATABASE_URL is required in production.");
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
    console.error("[Database] PostgreSQL query failed.", error);
    throw new Error("Database query failed.");
  }
}

export async function transaction<T>(
  work: (tx: QueryFunction) => Promise<T>
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    if (isProduction()) throw new Error("DATABASE_URL is required in production.");
    // The in-memory mock does not support rollback.
    return work(query);
  }

  try {
    const client = await getPostgresClient(connectionString);
    return await client.begin((tx) => work(tx as QueryFunction));
  } catch (error) {
    console.error("[Database] PostgreSQL transaction failed.", error);
    throw new Error("Database transaction failed.");
  }
}

export async function getClient() {
  return query;
}
