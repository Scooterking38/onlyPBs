// app/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, login, logout } from "@/lib/firebase";
import { SKILLS, SkillNode, TIER_CONFIG, getNextStepSkill } from "@/lib/skills";
import { PBRecord, computeDualELO, getRankBadge, scoreSinglePB } from "@/lib/elo";
import { computeDiagnostics } from "@/lib/analytics";

interface AthleteProfile {
    email: string;
    display_name: string;
    bodyweight_kg: number;
    tagline: string;
    discipline: string;
    avatar_icon: string;
    avatar_url: string;
    is_masked: boolean;
}

interface PBWithAthlete extends PBRecord {
    display_name?: string;
    avatar_url?: string;
    avatar_icon?: string;
    is_masked?: boolean;
    bodyweight_at_time?: number;
    verification_status?: string;
}

export default function CallilogApp() {
    // --- Auth State ---
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const userEmail = user?.email || "";

    const [activeTab, setActiveTab] = useState<"vault" | "intel" | "arena" | "admin">("vault");
    const [selectedBranch, setSelectedBranch] = useState<string>("Pull");
    const [myPbs, setMyPbs] = useState<PBRecord[]>([]);
    const [allPbs, setAllPbs] = useState<PBWithAthlete[]>([]);

    // Profile state
    const [profile, setProfile] = useState<AthleteProfile>({
        email: "",
        display_name: "",
        bodyweight_kg: 75.0,
        tagline: "Gravity is just a suggestion.",
        discipline: "Statics & Holds",
        avatar_icon: "⚡",
        avatar_url: "",
        is_masked: false,
    });

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Modal states
    const [activeModalSkill, setActiveModalSkill] = useState<SkillNode | null>(null);
    const [showFighterCard, setShowFighterCard] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Edit Profile Form State
    const [editName, setEditName] = useState(profile.display_name);
    const [editBw, setEditBw] = useState(profile.bodyweight_kg);
    const [editTagline, setEditTagline] = useState(profile.tagline);
    const [editDiscipline, setEditDiscipline] = useState(profile.discipline);
    const [editIcon, setEditIcon] = useState(profile.avatar_icon);
    const [editAvatarUrl, setEditAvatarUrl] = useState(profile.avatar_url);
    const [editMasked, setEditMasked] = useState(profile.is_masked);

    // PB Form State
    const [repsOrDur, setRepsOrDur] = useState(10);
    const [ballast, setBallast] = useState(0);
    const [proofUrl, setProofUrl] = useState("");
    const [isPublic, setIsPublic] = useState(true);

    // 1. Firebase Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchProfile = async () => {
        if (!userEmail) return;
        try {
            const res = await fetch(`/api/profile?email=${encodeURIComponent(userEmail)}`);
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setEditName(data.display_name || user?.displayName || userEmail.split("@")[0]);
                setEditBw(Number(data.bodyweight_kg) || 75.0);
                setEditTagline(data.tagline || "");
                setEditDiscipline(data.discipline || "Statics & Holds");
                setEditIcon(data.avatar_icon || "⚡");
                setEditAvatarUrl(data.avatar_url || user?.photoURL || "");
                setEditMasked(Boolean(data.is_masked));
            } else {
                const defaultName = user?.displayName || userEmail.split("@")[0];
                setEditName(defaultName);
                setProfile((prev) => ({
                    ...prev,
                    email: userEmail,
                    display_name: defaultName,
                    avatar_url: user?.photoURL || "",
                }));
            }
        } catch (err) {
            console.error("Failed to load profile", err);
        }
    };

    const fetchPbs = async () => {
        try {
            const res = await fetch("/api/pbs", { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch PB records");

            const snapshot: PBWithAthlete[] = await res.json();
            setAllPbs(snapshot);

            if (userEmail) {
                setMyPbs(
                    snapshot
                        .filter((pb) => String(pb.email || "").toLowerCase() === userEmail.toLowerCase())
                        .map((pb) => ({
                            ...pb,
                            weight: Number(pb.weight) || 0,
                            reps: Number(pb.reps) || 0,
                            duration: Number(pb.duration) || 0,
                            is_verified: Boolean(pb.is_verified),
                        }))
                );
            } else {
                setMyPbs([]);
            }
        } catch (err) {
            console.error("Failed to load and reconcile records", err);
        }
    };

    useEffect(() => {
        if (userEmail) {
            fetchProfile();
            fetchPbs();
        } else {
            fetchPbs();
        }
    }, [userEmail]);

    // Keyboard shortcut listener for Cmd + K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const athleteBw = Number(profile.bodyweight_kg) || 75.0;
    const { officialELO, unofficialELO } = computeDualELO(myPbs, athleteBw);
    const badge = getRankBadge(officialELO);
    const diagnostics = computeDiagnostics(myPbs, athleteBw);

    // =========================================================================
    // PEAK PR LOGIC (FIXED):
    // Latest log unconditionally overwrites older entries so corrections work.
    // =========================================================================
    const peaks = useMemo(() => {
        const map = new Map<string, PBRecord>();
        myPbs.forEach((p) => {
            map.set(p.skill_id, p);
        });
        return map;
    }, [myPbs]);

    // Top 3 Feats for Fighter Card
    const top3Feats = useMemo(() => {
        return Array.from(peaks.values())
            .map((p) => ({ ...p, score: scoreSinglePB(p, athleteBw) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }, [peaks, athleteBw]);

    // Filter skills based on search or category
    const displayedSkills = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return SKILLS.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
        }
        return SKILLS.filter((s) => s.category === selectedBranch);
    }, [searchQuery, selectedBranch]);

    const handleSavePb = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeModalSkill || !userEmail) return;

        await fetch("/api/pbs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: userEmail,
                skillId: activeModalSkill.id,
                bw: athleteBw,
                weight: ballast,
                reps: activeModalSkill.type === "dyn" ? repsOrDur : 0,
                duration: activeModalSkill.type === "iso" ? repsOrDur : 0,
                proofUrl,
                isPublic,
            }),
        });

        setActiveModalSkill(null);
        fetchPbs();
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userEmail) return;

        await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: userEmail,
                displayName: editName,
                bodyweight: editBw,
                tagline: editTagline,
                discipline: editDiscipline,
                avatarIcon: editIcon,
                avatarUrl: editAvatarUrl,
                isMasked: editMasked,
            }),
        });

        setShowProfileModal(false);
        fetchProfile();
        fetchPbs();
    };

    // Helper Avatar Renderer
    const renderAvatar = (url?: string, icon?: string, size = 44) => {
        const resolvedUrl = url || user?.photoURL;
        if (resolvedUrl && resolvedUrl.trim()) {
            return (
                <img
                    src={resolvedUrl.trim()}
                    alt="Avatar"
                    style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "#181A22",
                    }}
                    onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                    }}
                />
            );
        }
        return (
            <div
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: "50%",
                    background: "#161822",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: `${size * 0.45}px`,
                }}
            >
                {icon || "⚡"}
            </div>
        );
    };

    // SVG Radar Coordinates
    const radarPoints = useMemo(() => {
        const center = 100;
        const radius = 70;
        const total = diagnostics.radarAxes.length;
        return diagnostics.radarAxes
            .map((axis, i) => {
                const angle = ((Math.PI * 2) / total) * i - Math.PI / 2;
                const val = Math.max(10, axis.score) / 100;
                const x = center + radius * val * Math.cos(angle);
                const y = center + radius * val * Math.sin(angle);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
    }, [diagnostics.radarAxes]);

    if (authLoading) {
        return (
            <main className="app-shell" style={{ maxWidth: "880px", margin: "100px auto", textAlign: "center", color: "#6C7282" }}>
                Connecting to Callilog Network...
            </main>
        );
    }

    return (
        <main className="app-shell">
            {/* ===================================================================
        1. TOP HUD (AVATAR + PROFILE TRIGGER + DUAL ELO)
        =================================================================== */}
            <header className="titanium-slab" style={{ padding: "18px 22px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        {/* Clickable Avatar */}
                        <div
                            onClick={() => user && setShowProfileModal(true)}
                            title={user ? "Edit profile" : "Sign in required"}
                            role="button"
                            tabIndex={0}
                            aria-label="Edit athlete profile"
                            onKeyDown={(event) => {
                                if (user && (event.key === "Enter" || event.key === " ")) {
                                    event.preventDefault();
                                    setShowProfileModal(true);
                                }
                            }}
                            style={{ cursor: user ? "pointer" : "default", position: "relative" }}
                        >
                            {renderAvatar(profile.avatar_url, profile.avatar_icon, 52)}
                            {user && (
                                <span style={{ position: "absolute", bottom: "-2px", right: "-2px", background: "#0A0B0E", borderRadius: "50%", padding: "2px", fontSize: "10px" }}>
                  ✏️
                </span>
                            )}
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {user ? profile.display_name || user.displayName || userEmail.split("@")[0] : "Guest Athlete"}
                </span>
                                {user && <span className="pill-badge pill-gold">{badge.title}</span>}
                                {profile.is_masked && <span className="pill-badge pill-slate">👻 GHOST</span>}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.78rem", color: "#6C7282" }}>
                                {user ? (
                                    <>
                                        <span>{athleteBw} KG BW</span>
                                        <span>•</span>
                                        <span>{profile.discipline}</span>
                                        <span>•</span>
                                        <button
                                            onClick={() => setShowProfileModal(true)}
                                            style={{ background: "none", border: "none", color: "#A78BFA", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
                                        >
                                            Edit Profile
                                        </button>
                                        <span>•</span>
                                        <button
                                            onClick={() => setShowFighterCard(true)}
                                            style={{
                                                background: "rgba(245, 158, 11, 0.15)",
                                                color: "#F59E0B",
                                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                                borderRadius: "4px",
                                                padding: "2px 8px",
                                                fontSize: "0.7rem",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            🎴 FIGHTER CARD
                                        </button>
                                        <span>•</span>
                                        <button
                                            onClick={logout}
                                            style={{ background: "none", border: "none", color: "#EF4444", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
                                        >
                                            Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={login}
                                        className="btn-primary"
                                        style={{ padding: "4px 12px", fontSize: "0.78rem" }}
                                    >
                                        Sign in with Google
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "24px", alignItems: "baseline" }}>
                        <div>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Official ELO
                            </div>
                            <div className="num-font" style={{ fontSize: "2.1rem", fontWeight: 800, color: "#EDEDED", lineHeight: 1 }}>
                                {user ? officialELO : 0}
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "#6C7282" }}>Certified Verified</div>
                        </div>
                        <div style={{ borderLeft: "1px solid rgba(255, 255, 255, 0.08)", paddingLeft: "20px" }}>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6C7282", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Vault ELO
                            </div>
                            <div className="num-font" style={{ fontSize: "2.1rem", fontWeight: 700, color: "#8A90A2", lineHeight: 1 }}>
                                {user ? unofficialELO : 0}
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "#6C7282" }}>All Milestones</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ===================================================================
        2. SEARCH FACILITY (CMD + K SUPPORT)
        =================================================================== */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
                <input
                    ref={searchInputRef}
                    type="text"
                    aria-label="Search movements"
                    placeholder="Search movements across all branches… (Ctrl/⌘ K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: "100%",
                        background: "#0E1015",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        fontSize: "0.85rem",
                        color: "#EDEDED",
                        boxSizing: "border-box",
                        outline: "none",
                    }}
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            color: "#6C7282",
                            cursor: "pointer",
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* ===================================================================
        3. MASTER NAVIGATION
        =================================================================== */}
            <nav aria-label="Main sections" className="recessed-tray app-navigation" style={{ display: "flex", padding: "4px", gap: "4px", marginBottom: "16px" }}>
                {(["vault", "intel", "arena", "admin"] as const).map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        aria-pressed={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            borderRadius: "6px",
                            border: activeTab === tab ? "1px solid rgba(255, 255, 255, 0.16)" : "1px solid transparent",
                            background: activeTab === tab ? "linear-gradient(180deg, #1E202B 0%, #151722 100%)" : "transparent",
                            color: activeTab === tab ? "#EDEDED" : "#6C7282",
                            cursor: "pointer",
                        }}
                    >
                        {tab === "vault" && "The Vault"}
                        {tab === "intel" && "Deep Analytics"}
                        {tab === "arena" && "The Arena"}
                        {tab === "admin" && "Admin"}
                    </button>
                ))}
            </nav>

            {/* ===================================================================
        4. TAB 1: THE VAULT
        =================================================================== */}
            {activeTab === "vault" && (
                <section>
                    {!searchQuery && (
                        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "10px", marginBottom: "12px" }}>
                            {["Pull", "Push", "Control", "Core", "Rings", "Legs"].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedBranch(cat)}
                                    style={{
                                        padding: "6px 14px",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        borderRadius: "20px",
                                        border: selectedBranch === cat ? "1px solid #EDEDED" : "1px solid rgba(255, 255, 255, 0.08)",
                                        background: selectedBranch === cat ? "#EDEDED" : "#0D0E13",
                                        color: selectedBranch === cat ? "#0A0B0E" : "#7E8494",
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {cat.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {displayedSkills.map((skill) => {
                            const peak = peaks.get(skill.id);
                            const unit = skill.type === "iso" ? "s hold" : " reps";
                            const tierInfo = TIER_CONFIG[skill.tier];
                            const nextStep = getNextStepSkill(skill.id);

                            return (
                                <div
                                    key={skill.id}
                                    className="titanium-slab"
                                    style={{
                                        padding: "14px 18px",
                                        borderLeft: `3px solid ${tierInfo.color}`,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span
                        style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            color: tierInfo.color,
                            background: tierInfo.badgeBg,
                            border: `1px solid ${tierInfo.border}`,
                            padding: "2px 6px",
                            borderRadius: "4px",
                        }}
                    >
                      {tierInfo.label} &nbsp;•&nbsp; ×{skill.diff.toFixed(1)}
                    </span>
                                        {peak?.is_verified ? (
                                            <span className="pill-badge pill-gold">🏅 OFFICIAL VERIFIED</span>
                                        ) : peak ? (
                                            <span className="pill-badge pill-slate">VAULT LOGGED</span>
                                        ) : (
                                            <span className="pill-badge pill-slate" style={{ color: "#525666" }}>
                        UNRECORDED
                      </span>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#EDEDED" }}>
                                                {skill.name}
                                            </div>
                                            {peak ? (
                                                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "3px" }}>
                          <span className="num-font" style={{ fontSize: "1.15rem", fontWeight: 700, color: "#EDEDED" }}>
                            {skill.type === "iso" ? peak.duration : peak.reps}
                              {unit}
                          </span>
                                                    {peak.weight > 0 && (
                                                        <span style={{ fontSize: "0.8rem", color: "#7E8494" }}>@ +{peak.weight}kg</span>
                                                    )}
                                                    <span style={{ fontSize: "0.7rem", color: "#525666" }}>Logged {peak.date}</span>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: "0.78rem", color: "#525666", marginTop: "3px" }}>
                                                    Unlock Target: {skill.reqValue}
                                                    {unit}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (!user) {
                                                    login();
                                                    return;
                                                }
                                                setActiveModalSkill(skill);
                                                setRepsOrDur(peak ? (skill.type === "iso" ? peak.duration : peak.reps) : skill.reqValue);
                                                setBallast(peak?.weight || 0);
                                                setProofUrl(peak?.proof_url || "");
                                            }}
                                            className="btn-action"
                                        >
                                            {peak ? "Update" : "Record"}
                                        </button>
                                    </div>

                                    {nextStep && (
                                        <div
                                            style={{
                                                marginTop: "10px",
                                                paddingTop: "8px",
                                                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                                                fontSize: "0.72rem",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                color: "#7E8494",
                                            }}
                                        >
                                            <span style={{ color: "#E2A73B", fontWeight: 700 }}>NEXT EVOLUTION →</span>
                                            <span style={{ color: "#EDEDED", fontWeight: 600 }}>{nextStep.name}</span>
                                            <span>(Tier {nextStep.tier} · ×{nextStep.diff.toFixed(1)})</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ===================================================================
        5. TAB 2: DEEP ANALYTICS + RADAR WEB
        =================================================================== */}
            {activeTab === "intel" && (
                <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div className="titanium-slab" style={{ padding: "16px 20px", borderLeft: "3px solid #E2A73B" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Diagnostic Specialization
            </span>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#EDEDED", marginTop: "3px" }}>
                            {diagnostics.archetype}
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#8A90A2", margin: "4px 0 0 0" }}>{diagnostics.archetypeDesc}</p>
                    </div>

                    <div className="titanium-slab" style={{ padding: "20px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7E8494", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
                            Neuromuscular Vector Spider Web
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <svg width="240" height="240" viewBox="0 0 200 200">
                                {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
                                    <circle
                                        key={idx}
                                        cx="100"
                                        cy="100"
                                        r={70 * level}
                                        fill="none"
                                        stroke="rgba(255, 255, 255, 0.08)"
                                        strokeWidth="1"
                                    />
                                ))}
                                {diagnostics.radarAxes.map((_, i) => {
                                    const angle = ((Math.PI * 2) / diagnostics.radarAxes.length) * i - Math.PI / 2;
                                    const x2 = 100 + 70 * Math.cos(angle);
                                    const y2 = 100 + 70 * Math.sin(angle);
                                    return <line key={i} x1="100" y1="100" x2={x2} y2={y2} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />;
                                })}
                                <polygon points={radarPoints} fill="rgba(226, 167, 59, 0.25)" stroke="#E2A73B" strokeWidth="2" />
                                {diagnostics.radarAxes.map((axis, i) => {
                                    const angle = ((Math.PI * 2) / diagnostics.radarAxes.length) * i - Math.PI / 2;
                                    const x = 100 + 85 * Math.cos(angle);
                                    const y = 100 + 85 * Math.sin(angle);
                                    return (
                                        <text key={i} x={x} y={y + 3} fontSize="8" fontWeight="700" fill="#7E8494" textAnchor="middle">
                                            {axis.label}
                                        </text>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="titanium-slab" style={{ padding: "16px" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6C7282", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Push / Pull Balance Ratio
              </span>
                            <div className="num-font" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#EDEDED", marginTop: "4px" }}>
                                {diagnostics.pushPullRatio}×
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "#7E8494", margin: "4px 0 0 0" }}>
                                {diagnostics.pushPullRatio > 1.15 ? "Press Dominant" : diagnostics.pushPullRatio < 0.85 ? "Pull Dominant" : "Equilibrium"}
                            </p>
                        </div>

                        <div className="titanium-slab" style={{ padding: "16px" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#EF4444", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Weak-Link Bottleneck
              </span>
                            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#EDEDED", marginTop: "4px" }}>
                                {diagnostics.bottleneck.toUpperCase()}
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "#7E8494", margin: "4px 0 0 0" }}>Focus priority volume here</p>
                        </div>
                    </div>
                </section>
            )}

            {/* ===================================================================
        6. TAB 3: THE ARENA (RANKED STRICTLY BY OFFICIAL ELO)
        =================================================================== */}
            {activeTab === "arena" && (() => {
                const athletesMap = new Map<
                    string,
                    {
                        email: string;
                        displayName: string;
                        avatarUrl: string;
                        avatarIcon: string;
                        isMasked: boolean;
                        pbs: PBRecord[];
                        bw: number;
                    }
                >();

                const myCleanEmail = userEmail.toLowerCase().trim();
                if (myCleanEmail) {
                    athletesMap.set(myCleanEmail, {
                        email: myCleanEmail,
                        displayName: profile.display_name || user?.displayName || myCleanEmail.split("@")[0],
                        avatarUrl: profile.avatar_url || user?.photoURL || "",
                        avatarIcon: profile.avatar_icon || "⚡",
                        isMasked: Boolean(profile.is_masked),
                        pbs: myPbs,
                        bw: athleteBw,
                    });
                }

                allPbs.forEach((p) => {
                    const em = (p.email || "").toLowerCase().trim();
                    if (!em) return;
                    if (!athletesMap.has(em)) {
                        athletesMap.set(em, {
                            email: em,
                            displayName: p.display_name || em.split("@")[0],
                            avatarUrl: p.avatar_url || "",
                            avatarIcon: p.avatar_icon || "⚡",
                            isMasked: Boolean(p.is_masked),
                            pbs: [],
                            bw: Number(p.bodyweight_at_time) || 75.0,
                        });
                    }
                    athletesMap.get(em)!.pbs.push(p);
                });

                const leaderboard = Array.from(athletesMap.values())
                    .filter((ath) => {
                        const isMe = ath.email === myCleanEmail;
                        return !ath.isMasked || isMe;
                    })
                    .map((ath) => {
                        const { officialELO, unofficialELO } = computeDualELO(ath.pbs, ath.bw);
                        const rankBadge = getRankBadge(officialELO);
                        const verifiedCount = ath.pbs.filter((p) => p.is_verified).length;
                        return {
                            email: ath.email,
                            displayName: ath.displayName,
                            avatarUrl: ath.avatarUrl,
                            avatarIcon: ath.avatarIcon,
                            isMasked: ath.isMasked,
                            officialELO,
                            unofficialELO,
                            badge: rankBadge,
                            verifiedCount,
                        };
                    })
                    .sort((a, b) => b.officialELO - a.officialELO);

                return (
                    <section className="titanium-slab" style={{ padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
                            <div>
                                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#EDEDED" }}>
                                    🏆 The Arena // Official ELO Leaderboard
                                </h2>
                                <div style={{ fontSize: "0.75rem", color: "#6C7282", marginTop: "2px" }}>
                                    Ranked strictly by verified competitive power scores.
                                </div>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#8A90A2", fontWeight: 600 }}>
                                {leaderboard.length} Ranked Athletes
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {leaderboard.map((ath, idx) => {
                                const isMe = ath.email === myCleanEmail;
                                const medalColors = ["#F59E0B", "#E2E8F0", "#CD7F32"];
                                const rankColor = idx < 3 ? medalColors[idx] : "#525666";

                                return (
                                    <div
                                        key={ath.email}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "12px 14px",
                                            borderRadius: "6px",
                                            background: isMe ? "rgba(226, 167, 59, 0.05)" : "rgba(255, 255, 255, 0.02)",
                                            border: isMe ? "1px solid rgba(226, 167, 59, 0.3)" : "1px solid rgba(255, 255, 255, 0.04)",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className="num-font" style={{ fontSize: "1rem", fontWeight: 800, color: rankColor, width: "28px", textAlign: "center" }}>
                        #{idx + 1}
                      </span>

                                            {renderAvatar(ath.avatarUrl, ath.avatarIcon, 36)}

                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: isMe ? "#FFF" : "#EDEDED" }}>
                            {ath.displayName}
                          </span>
                                                    {isMe && <span style={{ fontSize: "0.65rem", color: "#E2A73B", fontWeight: 700 }}>(YOU)</span>}
                                                    {ath.isMasked && <span style={{ fontSize: "0.65rem", color: "#A78BFA", fontWeight: 700 }}>👻 GHOST</span>}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          <span className="pill-badge pill-gold" style={{ fontSize: "0.6rem", padding: "1px 5px" }}>
                            {ath.badge.title}
                          </span>
                                                    <span style={{ fontSize: "0.7rem", color: "#6C7282" }}>
                            {ath.verifiedCount} {ath.verifiedCount === 1 ? "feat" : "feats"} verified
                          </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: "right" }}>
                                            <div className="num-font" style={{ fontSize: "1.4rem", fontWeight: 800, color: "#EDEDED", lineHeight: 1 }}>
                                                {ath.officialELO}
                                            </div>
                                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "3px" }}>
                                                Official ELO
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })()}

            {/* ===================================================================
        7. TAB 4: ADMIN TERMINAL
        =================================================================== */}
            {activeTab === "admin" && (
                <section className="titanium-slab" style={{ padding: "18px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#EF4444", marginBottom: "14px" }}>
                        Verification Audit Queue
                    </div>
                    {allPbs.filter((p) => p.verification_status === "pending").length === 0 ? (
                        <div style={{ fontSize: "0.85rem", color: "#525666" }}>Audit queue is empty. All submissions verified.</div>
                    ) : (
                        allPbs
                            .filter((p) => p.verification_status === "pending")
                            .map((p) => (
                                <div
                                    key={p.id}
                                    style={{
                                        border: "1px solid rgba(255, 255, 255, 0.08)",
                                        borderRadius: "6px",
                                        padding: "12px",
                                        marginBottom: "10px",
                                        background: "#0D0E13",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            {renderAvatar(p.avatar_url, p.avatar_icon, 24)}
                                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#EDEDED" }}>
                        {p.display_name || p.email} - {p.skill_id}
                      </span>
                                        </div>
                                        <div className="num-font" style={{ fontSize: "0.8rem", color: "#7E8494", marginTop: "2px" }}>
                                            {p.reps || p.duration} {p.duration ? "s" : "r"} @ +{p.weight}kg ballast
                                        </div>
                                        {p.proof_url && (
                                            <a href={p.proof_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#E2A73B", textDecoration: "underline", display: "inline-block", marginTop: "4px" }}>
                                                View Video Proof ↗
                                            </a>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={async () => {
                                                await fetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "verify", pbId: p.id, approved: true }) });
                                                fetchPbs();
                                            }}
                                            className="btn-action"
                                            style={{ background: "#10B981", color: "#000", border: "none" }}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await fetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "verify", pbId: p.id, approved: false, reason: "Form Breakdown" }) });
                                                fetchPbs();
                                            }}
                                            className="btn-action"
                                            style={{ background: "#EF4444", color: "#FFF", border: "none" }}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))
                    )}
                </section>
            )}

            {/* ===================================================================
        8. EDIT PROFILE MODAL (WITH PFP URL & LIVE PREVIEW)
        =================================================================== */}
            {showProfileModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 120 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "420px", padding: "24px" }}>
                        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px 0", color: "#EDEDED" }}>
                            Edit Athlete Identity
                        </h3>
                        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: "8px" }}>
                                {renderAvatar(editAvatarUrl, editIcon, 56)}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#EDEDED" }}>{editName || "Athlete"}</div>
                                    <div style={{ fontSize: "0.72rem", color: "#7E8494" }}>{editAvatarUrl ? "Live Image Preview" : "Using Default Icon"}</div>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                    PROFILE PICTURE URL (IMGUR, DISCORD, DRIVE, WEB)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://i.imgur.com/... or any image link"
                                    value={editAvatarUrl}
                                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                        DISPLAY NAME
                                    </label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        required
                                        style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                        BODYWEIGHT (KG)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editBw}
                                        onChange={(e) => setEditBw(Number(e.target.value))}
                                        required
                                        style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                    DISCIPLINE SPECIALIZATION
                                </label>
                                <select
                                    value={editDiscipline}
                                    onChange={(e) => setEditDiscipline(e.target.value)}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                >
                                    <option value="Statics & Holds">Statics & Holds</option>
                                    <option value="Weighted Calisthenics">Weighted Calisthenics</option>
                                    <option value="Endurance Sets">Endurance Sets</option>
                                    <option value="Still Rings Gymnastics">Still Rings Gymnastics</option>
                                    <option value="Freestyle Dynamic">Freestyle Dynamic</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                    MANTRA / BIO TAGLINE
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Lever & planche practitioner"
                                    value={editTagline}
                                    onChange={(e) => setEditTagline(e.target.value)}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                <input
                                    type="checkbox"
                                    id="ghost_toggle"
                                    checked={editMasked}
                                    onChange={(e) => setEditMasked(e.target.checked)}
                                />
                                <label htmlFor="ghost_toggle" style={{ fontSize: "0.75rem", color: "#A78BFA", cursor: "pointer" }}>
                                    👻 Ghost Mode (Hide from public Leaderboard)
                                </label>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                                <button type="button" onClick={() => setShowProfileModal(false)} className="btn-action" style={{ flex: 1, padding: "10px" }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, padding: "10px" }}>
                                    Save Profile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===================================================================
        9. SHAREABLE FIGHTER CARD MODAL (WITH PFP)
        =================================================================== */}
            {showFighterCard && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 110 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "340px", padding: "24px", textAlign: "center", border: "1px solid rgba(226, 167, 59, 0.4)" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.1em" }}>
              CERTIFIED ATHLETE PASSPORT
            </span>

                        <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 6px 0" }}>
                            {renderAvatar(profile.avatar_url, profile.avatar_icon, 72)}
                        </div>

                        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#EDEDED", margin: 0 }}>{profile.display_name}</h2>
                        <div style={{ fontSize: "0.75rem", color: "#8A90A2", marginBottom: "14px" }}>{athleteBw}kg · {profile.discipline}</div>

                        <div style={{ display: "flex", justifyContent: "center", gap: "20px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.6rem", color: "#E2A73B", fontWeight: 700 }}>OFFICIAL ELO</div>
                                <div className="num-font" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#FFF" }}>{officialELO}</div>
                            </div>
                            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "16px" }}>
                                <div style={{ fontSize: "0.6rem", color: "#6C7282", fontWeight: 700 }}>DIVISION</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#EDEDED", marginTop: "4px" }}>{badge.title}</div>
                            </div>
                        </div>

                        <div style={{ textAlign: "left", marginBottom: "16px" }}>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6C7282", textTransform: "uppercase", marginBottom: "6px" }}>Signature Feats</div>
                            {top3Feats.map((f, idx) => {
                                const meta = SKILLS.find((s) => s.id === f.skill_id);
                                const unit = meta?.type === "iso" ? "s" : "r";
                                return (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <span style={{ color: "#EDEDED", fontWeight: 600 }}>{meta?.name}</span>
                                        <span className="num-font" style={{ color: "#E2A73B", fontWeight: 700 }}>
                      {f.reps || f.duration}{unit} {f.weight > 0 ? `(+${f.weight}kg)` : ""}
                    </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ fontSize: "0.6rem", color: "#525666", marginBottom: "14px" }}>
                            {profile.tagline || "CALLILOG VERIFIED // NO COMPROMISE"}
                        </div>

                        <button onClick={() => setShowFighterCard(false)} className="btn-primary" style={{ width: "100%", padding: "10px" }}>
                            Close Card
                        </button>
                    </div>
                </div>
            )}

            {/* ===================================================================
        10. LOG & UPDATE MODAL
        =================================================================== */}
            {activeModalSkill && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 100 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "380px", padding: "24px" }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0", color: "#EDEDED" }}>
                            Record: {activeModalSkill.name}
                        </h3>
                        <form onSubmit={handleSavePb} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                    {activeModalSkill.type === "iso" ? "HOLD DURATION (SECONDS)" : "REPETITIONS"}
                                </label>
                                <input
                                    type="number"
                                    value={repsOrDur}
                                    onChange={(e) => setRepsOrDur(Number(e.target.value))}
                                    required
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                    ADDED BALLAST (+KG)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={ballast}
                                    onChange={(e) => setBallast(Number(e.target.value))}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>
                                    PROOF URL (YOUTUBE / GOOGLE DRIVE)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://youtube.com/... or Google Drive"
                                    value={proofUrl}
                                    onChange={(e) => setProofUrl(e.target.value)}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                    type="checkbox"
                                    id="is_public_cb"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                />
                                <label htmlFor="is_public_cb" style={{ fontSize: "0.75rem", color: "#8A90A2", cursor: "pointer" }}>
                                    Public benchmark & proof
                                </label>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                <button type="button" onClick={() => setActiveModalSkill(null)} className="btn-action" style={{ flex: 1, padding: "10px" }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, padding: "10px" }}>
                                    Save Benchmark
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}