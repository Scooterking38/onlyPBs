// lib/db.ts
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

const LOCAL_FILE = path.join(process.cwd(), "callilog_db.json");
const TMP_FILE = path.join("/tmp", "callilog_db.json");

function loadStore(): DataStore {
  try {
    const file = fs.existsSync(LOCAL_FILE)
      ? LOCAL_FILE
      : fs.existsSync(TMP_FILE)
      ? TMP_FILE
      : null;

    if (file) {
      const content = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(content) as DataStore;
      if (Array.isArray(parsed.athletes) && Array.isArray(parsed.pbs)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[Database] Could not read local file, creating fresh store:", err);
  }

  const fresh: DataStore = { athleteSeq: 0, pbSeq: 0, athletes: [], pbs: [] };
  saveStore(fresh);
  return fresh;
}

function saveStore(store: DataStore): void {
  try {
    const payload = JSON.stringify(store, null, 2);
    try { fs.writeFileSync(LOCAL_FILE, payload, "utf-8"); } catch {}
    try { fs.writeFileSync(TMP_FILE, payload, "utf-8"); } catch {}
  } catch (err) {
    console.warn("[Database] Could not save store:", err);
  }
}

let storeInstance: DataStore = loadStore();

function executeMockQuery<T = Record<string, unknown>>(
  sqlText: string,
  values: unknown[] = []
): T[] {
  storeInstance = loadStore();
  const norm = sqlText.trim().replace(/\s+/g, " ");

  // 1. Health checks
  if (/SELECT\s+1/i.test(norm) || /pg_advisory/i.test(norm)) {
    return [{ ping: 1 }] as unknown as T[];
  }

  // 2. SELECT athletes by email
  if (/SELECT.*FROM\s+athletes\s+WHERE.*email/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find((a) => a.email.toLowerCase() === email);
    if (/SELECT\s+id\s+FROM/i.test(norm)) {
      return (athlete ? [{ id: athlete.id }] : []) as unknown as T[];
    }
    return (athlete ? [athlete] : []) as unknown as T[];
  }

  // 3. SELECT all athletes
  if (/SELECT.*FROM\s+athletes/i.test(norm)) {
    return [...storeInstance.athletes] as unknown as T[];
  }

  // 4. INSERT athletes
  if (/INSERT\s+INTO\s+athletes/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const displayName = String(values[1] || email.split("@")[0]);
    const bw = Number(values[2]) || 75.0;
    const tagline = String(values[3] || "");
    const discipline = String(values[4] || "Statics & Holds");
    const avatarIcon = String(values[5] || "⚡");
    const avatarUrl = String(values[6] || "").trim();
    const isMasked = Boolean(values[7]);

    const idx = storeInstance.athletes.findIndex((a) => a.email.toLowerCase() === email);
    let saved: AthleteRow;

    if (idx >= 0) {
      storeInstance.athletes[idx] = {
        ...storeInstance.athletes[idx],
        display_name: displayName,
        bodyweight_kg: bw,
        tagline,
        discipline,
        avatar_icon: avatarIcon,
        avatar_url: avatarUrl,
        is_masked: isMasked,
      };
      saved = storeInstance.athletes[idx];
    } else {
      saved = {
        id: ++storeInstance.athleteSeq,
        email,
        display_name: displayName,
        bodyweight_kg: bw,
        tagline,
        discipline,
        avatar_icon: avatarIcon,
        avatar_url: avatarUrl,
        is_masked: isMasked,
      };
      storeInstance.athletes.push(saved);
    }

    saveStore(storeInstance);
    return [saved] as unknown as T[];
  }

  // 5. UPDATE athletes
  if (/UPDATE\s+athletes\s+SET/i.test(norm)) {
    const email = String(values[values.length - 1] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find((a) => a.email.toLowerCase() === email);
    if (athlete) {
      if (/display_name\s*=/i.test(norm)) {
        athlete.display_name = String(values[1] || athlete.display_name);
        athlete.bodyweight_kg = Number(values[2]) || athlete.bodyweight_kg;
        athlete.tagline = String(values[3] || athlete.tagline);
        athlete.discipline = String(values[4] || athlete.discipline);
        athlete.avatar_icon = String(values[5] || athlete.avatar_icon);
        athlete.avatar_url = String(values[6] || "").trim();
        athlete.is_masked = Boolean(values[7]);
      } else if (/bodyweight_kg\s*=/i.test(norm)) {
        athlete.bodyweight_kg = Number(values[0]) || athlete.bodyweight_kg;
      }
      saveStore(storeInstance);
      return [athlete] as unknown as T[];
    }
    return [] as unknown as T[];
  }

  // 6. DELETE pbs
  if (/DELETE\s+FROM\s+pbs/i.test(norm)) {
    if (/skill_id/i.test(norm)) {
      const email = String(values[0] || "").toLowerCase().trim();
      const skillId = String(values[1] || "");
      storeInstance.pbs = storeInstance.pbs.filter(
        (p) => !(p.email.toLowerCase() === email && p.skill_id === skillId)
      );
    } else if (/id\s*=/i.test(norm)) {
      const id = Number(values[0]);
      storeInstance.pbs = storeInstance.pbs.filter((p) => p.id !== id);
    }
    saveStore(storeInstance);
    return [] as unknown as T[];
  }

  // 7. INSERT pbs
  if (/INSERT\s+INTO\s+pbs/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const skillId = String(values[1] || "");
    const bw = Number(values[2]) || 75.0;
    const weight = Number(values[3]) || 0;
    const reps = Number(values[4]) || 0;
    const duration = Number(values[5]) || 0;
    const proofUrl = String(values[6] || "").trim();
    const isPublic = values[7] !== false;
    const status = String(values[8] || (proofUrl ? "pending" : "unverified"));

    storeInstance.pbs = storeInstance.pbs.filter(
      (p) => !(p.email.toLowerCase() === email && p.skill_id === skillId)
    );

    const newPb: PBRow = {
      id: ++storeInstance.pbSeq,
      email,
      skill_id: skillId,
      bodyweight_at_time: bw,
      weight,
      reps,
      duration,
      proof_url: proofUrl,
      is_public_proof: isPublic,
      is_verified: status === "verified",
      verification_status: status,
      date: new Date().toISOString().split("T")[0],
    };

    storeInstance.pbs.unshift(newPb);

    const ath = storeInstance.athletes.find((a) => a.email.toLowerCase() === email);
    if (ath) ath.bodyweight_kg = bw;

    saveStore(storeInstance);
    return [{ id: newPb.id }] as unknown as T[];
  }

  // 8. UPDATE pbs (verify/reject)
  if (/UPDATE\s+pbs\s+SET/i.test(norm)) {
    const approved = Boolean(values[0]);
    const status = String(values[1] || (approved ? "verified" : "rejected"));
    const reason = String(values[2] || "");
    const id = Number(values[3] || values[values.length - 1]);

    const pb = storeInstance.pbs.find((p) => p.id === id);
    if (pb) {
      pb.is_verified = approved;
      pb.verification_status = status;
      pb.rejection_reason = reason;
      saveStore(storeInstance);
      return [pb] as unknown as T[];
    }
    return [] as unknown as T[];
  }

  // 9. SELECT pbs
  if (/SELECT.*FROM\s+pbs/i.test(norm)) {
    let list = storeInstance.pbs;

    if (/pending/i.test(norm)) {
      list = list.filter((p) => p.verification_status === "pending");
    } else if (/WHERE.*email/i.test(norm)) {
      const email = String(values[0] || "").toLowerCase().trim();
      list = list.filter((p) => p.email.toLowerCase() === email);
    }

    return list.map((p) => {
      const ath = storeInstance.athletes.find((a) => a.email.toLowerCase() === p.email.toLowerCase());
      return {
        ...p,
        athlete_id: ath?.id,
        display_name: ath?.display_name || p.email.split("@")[0],
        avatar_url: ath?.avatar_url || "",
        avatar_icon: ath?.avatar_icon || "⚡",
        is_masked: Boolean(ath?.is_masked),
      };
    }) as unknown as T[];
  }

  return [] as unknown as T[];
}

export type QueryFunction = <T = Record<string, unknown>>(
  strings: TemplateStringsArray | string,
  ...values: unknown[]
) => Promise<T[]>;

let postgresClient: any = null;
let initializedTables = false;

async function initPostgresTables(client: any) {
  if (initializedTables) return;
  try {
    await client`
      CREATE TABLE IF NOT EXISTS athletes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        bodyweight_kg NUMERIC(5,2) DEFAULT 75.0,
        tagline VARCHAR(255) DEFAULT '',
        discipline VARCHAR(100) DEFAULT 'Statics & Holds',
        avatar_icon VARCHAR(10) DEFAULT '⚡',
        avatar_url TEXT DEFAULT '',
        is_masked BOOLEAN DEFAULT false
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS pbs (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        skill_id VARCHAR(100) NOT NULL,
        bodyweight_at_time NUMERIC(5,2) DEFAULT 75.0,
        weight NUMERIC(5,2) DEFAULT 0,
        reps INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        proof_url TEXT DEFAULT '',
        is_public_proof BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        verification_status VARCHAR(50) DEFAULT 'unverified',
        rejection_reason TEXT DEFAULT '',
        date DATE DEFAULT CURRENT_DATE
      );
    `;
    initializedTables = true;
  } catch (err) {
    console.error("[Database] Table initialization error:", err);
  }
}

async function getPostgresClient(connectionString: string) {
  if (!postgresClient) {
    const postgres = (await import("postgres")).default;
    const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    postgresClient = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      ssl: isLocal ? false : "require",
      prepare: false,
    });
    await initPostgresTables(postgresClient);
  }
  return postgresClient;
}

export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray | string,
  ...values: unknown[]
): Promise<T[]> {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  let rawSql = "";
  let finalValues = values;

  if (typeof strings === "string") {
    rawSql = strings;
    if (values.length === 1 && Array.isArray(values[0])) {
      finalValues = values[0];
    }
  } else {
    rawSql = strings.reduce(
      (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
  }

  if (!connectionString) {
    return executeMockQuery<T>(rawSql, finalValues);
  }

  try {
    const client = await getPostgresClient(connectionString);
    if (typeof strings === "string") {
      return (await client.unsafe(rawSql, finalValues)) as T[];
    }
    return (await client(strings, ...values)) as T[];
  } catch (error) {
    console.error("[Database Postgres Error - falling back to local file]:", error);
    return executeMockQuery<T>(rawSql, finalValues);
  }
}

export async function transaction<T>(work: (tx: QueryFunction) => Promise<T>): Promise<T> {
  return work(query);
}

export async function getClient() {
  return query;
}
