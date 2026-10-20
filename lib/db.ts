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

const DISK_FILE = path.join("/tmp", "callilog_db.json");
const LOCAL_BACKUP_FILE = path.join(process.cwd(), "callilog_db.json");

const ADMIN_NAMES_MAP: Record<string, string> = {
  "mrwe3838@gmail.com": "Admin 1",
  "elijaharagonmorgan@gmail.com": "Admin 2",
  "station3828@gmail.com": "Admin 3",
  "2morgane@queenelizabeths.derbyshire.sch.uk": "Admin 4",
};

function loadStore(): DataStore {
  try {
    const targetFile = fs.existsSync(LOCAL_BACKUP_FILE)
      ? LOCAL_BACKUP_FILE
      : fs.existsSync(DISK_FILE)
      ? DISK_FILE
      : null;

    if (targetFile) {
      const content = fs.readFileSync(targetFile, "utf-8");
      const parsed = JSON.parse(content) as DataStore;
      if (Array.isArray(parsed.athletes) && Array.isArray(parsed.pbs)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[Database] Initializing fresh local store:", err);
  }

  const fresh: DataStore = {
    athleteSeq: 0,
    pbSeq: 0,
    athletes: [],
    pbs: [],
  };
  saveStore(fresh);
  return fresh;
}

function saveStore(store: DataStore): void {
  try {
    const payload = JSON.stringify(store, null, 2);
    try {
      fs.writeFileSync(LOCAL_BACKUP_FILE, payload, "utf-8");
    } catch {}
    try {
      fs.writeFileSync(DISK_FILE, payload, "utf-8");
    } catch {}
  } catch (err) {
    console.warn("[Database] Could not persist store to disk:", err);
  }
}

let storeInstance: DataStore = loadStore();

function executeMockQuery<T = Record<string, unknown>>(
  sqlText: string,
  values: unknown[] = []
): T[] {
  storeInstance = loadStore();
  const norm = sqlText.trim().replace(/\s+/g, " ");

  // Health check
  if (/SELECT\s+1/i.test(norm) || /pg_advisory/i.test(norm)) {
    return [{ ping: 1 }] as unknown as T[];
  }

  // 1. SELECT single athlete by email
  if (/SELECT.*FROM\s+athletes\s+WHERE\s+LOWER\(email\)\s*=\s*LOWER\(\$1\)/i.test(norm) ||
      /SELECT.*FROM\s+athletes\s+WHERE\s+email\s*=/i.test(norm)) {
    const email = String(values[0] || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find((a) => a.email.toLowerCase() === email);
    if (/SELECT\s+id\s+FROM/i.test(norm)) {
      return (athlete ? [{ id: athlete.id }] : []) as unknown as T[];
    }
    return (athlete ? [athlete] : []) as unknown as T[];
  }

  // 2. SELECT all athletes
  if (/SELECT.*FROM\s+athletes/i.test(norm)) {
    return [...storeInstance.athletes] as unknown as T[];
  }

  // 3. UPSERT / INSERT / UPDATE athletes
  if (/INSERT\s+INTO\s+athletes/i.test(norm)) {
    // Collect params regardless of position
    let email = "";
    let displayName = "";
    let bw = 75.0;
    let tagline = "Gravity is just a suggestion.";
    let discipline = "Statics & Holds";
    let avatarIcon = "⚡";
    let avatarUrl = "";
    let isMasked = false;

    for (const v of values) {
      if (typeof v === "string") {
        if (v.includes("@")) email = v.toLowerCase().trim();
        else if (v.startsWith("http")) avatarUrl = v.trim();
        else if (["Statics & Holds", "Weighted Calisthenics", "Endurance Sets", "Still Rings Gymnastics", "Freestyle Dynamic"].includes(v)) {
          discipline = v;
        } else if (v.length <= 4) {
          avatarIcon = v;
        } else if (!displayName) {
          displayName = v;
        } else if (!tagline) {
          tagline = v;
        }
      } else if (typeof v === "number") {
        if (v >= 30 && v <= 250) bw = v;
      } else if (typeof v === "boolean") {
        isMasked = v;
      }
    }

    if (!displayName && email) {
      displayName = ADMIN_NAMES_MAP[email] || email.split("@")[0];
    }

    const idx = storeInstance.athletes.findIndex((a) => a.email.toLowerCase() === email);
    let saved: AthleteRow;

    if (idx >= 0) {
      storeInstance.athletes[idx] = {
        ...storeInstance.athletes[idx],
        display_name: displayName || storeInstance.athletes[idx].display_name,
        bodyweight_kg: bw || storeInstance.athletes[idx].bodyweight_kg,
        tagline: tagline || storeInstance.athletes[idx].tagline,
        discipline: discipline || storeInstance.athletes[idx].discipline,
        avatar_icon: avatarIcon || storeInstance.athletes[idx].avatar_icon,
        avatar_url: avatarUrl !== undefined ? avatarUrl : storeInstance.athletes[idx].avatar_url,
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

  // 4. General UPDATE athletes
  if (/UPDATE\s+athletes\s+SET/i.test(norm)) {
    const emailVal = values.find((v) => typeof v === "string" && v.includes("@"));
    const email = String(emailVal || "").toLowerCase().trim();
    const athlete = storeInstance.athletes.find((a) => a.email.toLowerCase() === email);

    if (athlete) {
      for (const v of values) {
        if (typeof v === "number" && v >= 30 && v <= 250) athlete.bodyweight_kg = v;
        if (typeof v === "boolean") athlete.is_masked = v;
        if (typeof v === "string" && v.startsWith("http")) athlete.avatar_url = v.trim();
      }
      saveStore(storeInstance);
      return [athlete] as unknown as T[];
    }
    return [] as unknown as T[];
  }

  // 5. INSERT INTO pbs
  if (/INSERT\s+INTO\s+pbs/i.test(norm)) {
    let email = "";
    let skillId = "";
    let bw = 75.0;
    let weight = 0;
    let reps = 0;
    let duration = 0;
    let proofUrl = "";
    let isPublic = true;
    let status = "unverified";

    for (const v of values) {
      if (typeof v === "string") {
        if (v.includes("@")) email = v.toLowerCase().trim();
        else if (v.startsWith("http")) {
          proofUrl = v.trim();
          status = "pending";
        } else if (["verified", "pending", "unverified", "rejected"].includes(v)) {
          status = v;
        } else if (!skillId && v.length > 0) {
          skillId = v;
        }
      } else if (typeof v === "number") {
        if (v >= 40 && v <= 200 && bw === 75.0) bw = v;
        else if (reps === 0 && duration === 0) reps = v;
        else weight = v;
      } else if (typeof v === "boolean") {
        isPublic = v;
      }
    }

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

  // 6. UPDATE pbs
  if (/UPDATE\s+pbs\s+SET/i.test(norm)) {
    const approved = Boolean(values[0]);
    const id = Number(values[values.length - 1]);
    const pb = storeInstance.pbs.find((p) => p.id === id);
    if (pb) {
      pb.is_verified = approved;
      pb.verification_status = approved ? "verified" : "rejected";
      saveStore(storeInstance);
    }
    return [] as unknown as T[];
  }

  // 7. SELECT pbs
  if (/SELECT.*FROM\s+pbs/i.test(norm)) {
    const emailParam = values.find((v) => typeof v === "string" && v.includes("@"));
    let list = storeInstance.pbs;

    if (emailParam) {
      const email = String(emailParam).toLowerCase().trim();
      list = list.filter((p) => p.email.toLowerCase() === email);
    }

    return list.map((p) => {
      const ath = storeInstance.athletes.find((a) => a.email.toLowerCase() === p.email.toLowerCase());
      return {
        ...p,
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
        email VARCHAR(255) UNIQUE NOT NULL,
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
    console.warn("[Database] Could not verify/initialize Postgres tables:", err);
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

  // Normalise raw query string and values
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
    console.warn("[Database] Postgres error, falling back to local store:", error);
    return executeMockQuery<T>(rawSql, finalValues);
  }
}

export async function transaction<T>(work: (tx: QueryFunction) => Promise<T>): Promise<T> {
  return work(query);
}

export async function getClient() {
  return query;
}
