// app/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, login, logout } from "@/lib/firebase";
import { apiFetch, apiUrl } from "@/lib/api";
import { SKILLS, SkillNode, TIER_CONFIG, getNextStepSkill } from "@/lib/skills";
import { PBRecord, computeDualELO, getRankBadge, scoreSinglePB } from "@/lib/elo";
import { computeDiagnostics } from "@/lib/analytics";
import { computeCalisthenics1RM, getYouTubeEmbedUrl, exportFighterCardAsPng } from "@/lib/upgrades";

interface AthleteProfile {
    id?: number;
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
    athlete_id?: number;
    display_name?: string;
    avatar_url?: string;
    avatar_icon?: string;
    is_masked?: boolean;
    bodyweight_at_time?: number;
    verification_status?: string;
}

const ADMIN_NAMES_MAP: Record<string, string> = {
    "mrwe3838@gmail.com": "Admin 1",
    "elijaharagonmorgan@gmail.com": "Admin 2",
    "station3828@gmail.com": "Admin 3",
    "2morgane@queenelizabeths.derbyshire.sch.uk": "Admin 4",
};

const ADMIN_EMAILS = Object.keys(ADMIN_NAMES_MAP);

const checkIsAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

// Normalizes Google Drive, Dropbox, and Imgur links into direct image file streams
function normalizeImageUrl(url?: string): string {
    if (!url) return "";
    const clean = url.trim();

    const gDriveMatch = clean.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
    }

    if (clean.includes("dropbox.com")) {
        return clean.replace(/[?&]dl=0/, "").replace(/\?raw=1$/, "") + "?raw=1";
    }

    if (/^https?:\/\/imgur\.com\/([a-zA-Z0-9]+)$/.test(clean)) {
        return clean.replace("imgur.com", "i.imgur.com") + ".png";
    }

    return clean;
}

// Resilient Avatar Component with hotlink protection bypass
function AthleteAvatar({
    url,
    icon = "⚡",
    size = 44,
    fallbackPhoto,
}: {
    url?: string;
    icon?: string;
    size?: number;
    fallbackPhoto?: string | null;
}) {
    const rawUrl = url?.trim() ? url.trim() : (fallbackPhoto || "");
    const resolvedUrl = normalizeImageUrl(rawUrl);
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [resolvedUrl]);

    if (resolvedUrl && !imgFailed) {
        return (
            <img
                key={resolvedUrl}
                src={resolvedUrl}
                alt="Avatar"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "#181A22",
                    display: "block",
                    flexShrink: 0,
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
                flexShrink: 0,
                userSelect: "none",
            }}
        >
            {icon || "⚡"}
        </div>
    );
}

// High-Reliability Video Modal:
// Buffers raw video file to a temporary in-memory Blob, plays in native HTML5 player,
// and deletes it from browser cache/memory as soon as the modal is closed.
function ProofVideoModal({
    url,
    onClose,
}: {
    url: string;
    onClose: () => void;
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isYouTube = Boolean(getYouTubeEmbedUrl(url));

    useEffect(() => {
        if (!url || isYouTube) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        let activeBlob: string | null = null;
        const controller = new AbortController();

        async function fetchAndBuffer() {
            try {
                const proxyUrl = apiUrl(`/api/video?url=${encodeURIComponent(url)}`);
                const response = await fetch(proxyUrl, { signal: controller.signal });

                if (!response.ok) {
                    throw new Error(
                        response.status === 403 || response.status === 401
                            ? "This file is restricted. Ensure Google Drive link sharing is set to 'Anyone with the link can view'."
                            : `Could not retrieve video stream (HTTP ${response.status})`
                    );
                }

                const blob = await response.blob();
                if (blob.size === 0 || blob.type.includes("text/html")) {
                    throw new Error("Unable to download raw video. Google Drive file might be private or require sign-in.");
                }

                activeBlob = URL.createObjectURL(blob);
                setBlobUrl(activeBlob);
                setIsLoading(false);
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    console.error("Video buffering error:", err);
                    setError(err.message || "Failed to load video proof");
                    setIsLoading(false);
                }
            }
        }

        fetchAndBuffer();

        // CLEANUP: Automatically revokes blob and wipes video from memory/cache
        return () => {
            controller.abort();
            if (activeBlob) {
                URL.revokeObjectURL(activeBlob);
            }
        };
    }, [url, isYouTube]);

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 140 }}>
            <div className="titanium-slab" style={{ width: "100%", maxWidth: "640px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#E2A73B" }}>
                            CERTIFIED PROOF PLAYBACK
                        </span>
                        {!isYouTube && !isLoading && !error && (
                            <span style={{ fontSize: "0.65rem", background: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "4px", padding: "1px 6px", fontWeight: 700 }}>
                                ⚡ BUFFERED TO MEMORY
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "none", color: "#EDEDED", cursor: "pointer", fontSize: "1.2rem", padding: "4px" }}
                    >
                        ✕
                    </button>
                </div>

                {isYouTube ? (
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                        <iframe
                            src={getYouTubeEmbedUrl(url)!}
                            title="Proof Video"
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                ) : isLoading ? (
                    <div style={{ padding: "50px 20px", textAlign: "center", background: "#0E1015", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "12px", animation: "spin 1.5s linear infinite" }}>⚡</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#EDEDED", marginBottom: "4px" }}>
                            Streaming & Buffering Proof Video...
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#6C7282" }}>
                            Bypassing Google player restrictions and loading video directly to RAM
                        </div>
                    </div>
                ) : error ? (
                    <div style={{ padding: "30px 20px", textAlign: "center", background: "#0E1015", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                        <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>⚠️</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#FCA5A5", marginBottom: "6px" }}>
                            Playback Notice
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "#9CA3AF", maxWidth: "420px", margin: "0 auto 16px auto", lineHeight: 1.5 }}>
                            {error}
                        </p>
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ display: "inline-block", padding: "8px 16px", fontSize: "0.8rem" }}
                        >
                            Open Link in New Tab ↗
                        </a>
                    </div>
                ) : blobUrl ? (
                    <div style={{ borderRadius: "8px", overflow: "hidden", background: "#000" }}>
                        <video
                            src={blobUrl}
                            controls
                            autoPlay
                            playsInline
                            style={{ width: "100%", maxHeight: "420px", display: "block" }}
                        />
                    </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "0.72rem", color: "#6C7282" }}>
                    <span>Video will be automatically flushed from device memory on close.</span>
                    <a href={url} target="_blank" rel="noreferrer" style={{ color: "#E2A73B", textDecoration: "underline" }}>
                        Original Link ↗
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function CallilogApp() {
    // Auth & Active Athlete State
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    const userEmail = (user?.email || "").toLowerCase().trim();

    // Navigation & Data
    const [activeTab, setActiveTab] = useState<"vault" | "intel" | "arena" | "admin">("vault");
    const [selectedBranch, setSelectedBranch] = useState<string>("Pull");
    const [myPbs, setMyPbs] = useState<PBRecord[]>([]);
    const [allPbs, setAllPbs] = useState<PBWithAthlete[]>([]);
    const [adminPbs, setAdminPbs] = useState<PBWithAthlete[]>([]);
    const [serverAdmin, setServerAdmin] = useState(false);
    const isAdmin = useMemo(() => checkIsAdmin(userEmail) || serverAdmin, [userEmail, serverAdmin]);
    const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

    // Arena Sort by selection
    const [arenaSortBy, setArenaSortBy] = useState<"official" | "vault" | "verified" | "feats" | "name" | "bw">("official");

    // Profile State
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

    // Search & Modals
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [activeModalSkill, setActiveModalSkill] = useState<SkillNode | null>(null);
    const [showFighterCard, setShowFighterCard] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [isExportingCard, setIsExportingCard] = useState(false);

    // Inspector Modal for any clicked athlete in the Arena
    const [inspectingAthlete, setInspectingAthlete] = useState<{
        email: string;
        athleteId?: number;
        displayName: string;
        avatarUrl: string;
        avatarIcon: string;
        isMasked: boolean;
        officialELO: number;
        unofficialELO: number;
        badge: { title: string; color: string; tier?: string; minELO?: number };
        verifiedCount: number;
        rawPbs: PBRecord[];
        bw: number;
        tagline?: string;
        discipline?: string;
        totalFeats?: number;
    } | null>(null);

    // Head-to-Head & Video Preview
    const [compareTarget, setCompareTarget] = useState<{ displayName: string; pbs: PBRecord[]; bw: number } | null>(null);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

    // Edit Profile Form State
    const [editName, setEditName] = useState("");
    const [editBw, setEditBw] = useState(75.0);
    const [editTagline, setEditTagline] = useState("");
    const [editDiscipline, setEditDiscipline] = useState("Statics & Holds");
    const [editIcon, setEditIcon] = useState("⚡");
    const [editAvatarUrl, setEditAvatarUrl] = useState("");
    const [editMasked, setEditMasked] = useState(false);

    // PB Form State
    const [repsOrDur, setRepsOrDur] = useState(10);
    const [ballast, setBallast] = useState(0);
    const [proofUrl, setProofUrl] = useState("");
    const [isPublic, setIsPublic] = useState(true);

    // Listen to Firebase Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser?.email) {
                const em = currentUser.email.toLowerCase().trim();
                if (typeof window !== "undefined") {
                    localStorage.setItem("callilog_athlete_email", em);
                }
            } else {
                if (typeof window !== "undefined") {
                    localStorage.removeItem("callilog_athlete_email");
                }
            }
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    const handleGoogleLogin = async () => {
        setIsLoggingIn(true);
        setLoginError(null);
        try {
            const result = await login();
            if (result?.user?.email) {
                const em = result.user.email.toLowerCase().trim();
                setUser(result.user);
                if (typeof window !== "undefined") {
                    localStorage.setItem("callilog_athlete_email", em);
                }
            }
        } catch (err: unknown) {
            console.error("Google sign-in error:", err);
            const msg = err instanceof Error ? err.message : "Google sign-in failed. Please verify popups are allowed and try again.";
            setLoginError(msg);
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await logout();
            setUser(null);
            if (typeof window !== "undefined") {
                localStorage.removeItem("callilog_athlete_email");
            }
            setServerAdmin(false);
            setMyPbs([]);
            setAdminPbs([]);
            setProfile({
                email: "",
                display_name: "",
                bodyweight_kg: 75.0,
                tagline: "Gravity is just a suggestion.",
                discipline: "Statics & Holds",
                avatar_icon: "⚡",
                avatar_url: "",
                is_masked: false,
            });
        } catch (err) {
            console.error("Sign-out error:", err);
        }
    };

    const fetchProfile = async () => {
        if (!userEmail) return;
        try {
            const res = await apiFetch(apiUrl(`/api/profile?email=${encodeURIComponent(userEmail)}`));
            if (res.ok) {
                const data = await res.json();
                const resolvedAvatar = data.avatar_url || data.avatarUrl || "";
                setProfile({
                    ...data,
                    avatar_url: resolvedAvatar,
                });
                const defaultFallback = ADMIN_NAMES_MAP[userEmail] || user?.displayName || userEmail.split("@")[0];
                setEditName(data.display_name || data.displayName || defaultFallback);
                setEditBw(Number(data.bodyweight_kg || data.bodyweight) || 75.0);
                setEditTagline(data.tagline || "");
                setEditDiscipline(data.discipline || "Statics & Holds");
                setEditIcon(data.avatar_icon || data.avatarIcon || (checkIsAdmin(userEmail) ? "🛡️" : "⚡"));
                setEditAvatarUrl(resolvedAvatar || user?.photoURL || "");
                setEditMasked(Boolean(data.is_masked ?? data.isMasked));
            } else {
                const defaultName = ADMIN_NAMES_MAP[userEmail] || user?.displayName || userEmail.split("@")[0];
                setEditName(defaultName);
                setProfile((prev) => ({
                    ...prev,
                    email: userEmail,
                    display_name: defaultName,
                    avatar_url: user?.photoURL || "",
                    avatar_icon: checkIsAdmin(userEmail) ? "🛡️" : "⚡",
                }));
            }
        } catch (err) {
            console.error("Failed to load profile", err);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const queryUrl = userEmail
                ? apiUrl(`/api/leaderboard?viewerEmail=${encodeURIComponent(userEmail)}`)
                : apiUrl("/api/leaderboard");
            const res = await apiFetch(queryUrl, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.leaderboard)) {
                    setLeaderboardData(data.leaderboard);
                }
            }
        } catch (err) {
            console.error("Failed to load leaderboard", err);
        }
    };

    const fetchPbs = async () => {
        if (!userEmail) return;
        try {
            const publicResponse = await apiFetch(apiUrl("/api/pbs"), { cache: "no-store" });
            if (publicResponse.ok) {
                const publicRows: PBWithAthlete[] = await publicResponse.json();
                setAllPbs(publicRows);
            }

            const mineResponse = await apiFetch(apiUrl(`/api/pbs?mine=true&email=${encodeURIComponent(userEmail)}`), { cache: "no-store" });
            if (mineResponse.ok) {
                const mineRows: PBRecord[] = await mineResponse.json();
                setMyPbs(mineRows.map((pb) => ({
                    ...pb,
                    weight: Number(pb.weight) || 0,
                    reps: Number(pb.reps) || 0,
                    duration: Number(pb.duration) || 0,
                    is_verified: Boolean(pb.is_verified),
                })));
            } else {
                setMyPbs([]);
            }
        } catch (err) {
            console.error("Failed to load records", err);
        }
    };

    const fetchAdminPbs = async () => {
        if (!userEmail || !checkIsAdmin(userEmail)) {
            setServerAdmin(false);
            setAdminPbs([]);
            return;
        }

        try {
            const response = await apiFetch(apiUrl(`/api/admin?email=${encodeURIComponent(userEmail)}`), { cache: "no-store" });
            if (!response.ok) {
                setServerAdmin(false);
                setAdminPbs([]);
                return;
            }

            const data = await response.json();
            setServerAdmin(data.isAdmin === true);
            setAdminPbs(Array.isArray(data.pending) ? data.pending : []);
        } catch (error) {
            console.error("Failed to load admin queue", error);
            setServerAdmin(false);
            setAdminPbs([]);
        }
    };

    useEffect(() => {
        if (userEmail) {
            fetchProfile();
            fetchPbs();
            fetchLeaderboard();
            fetchAdminPbs();
        } else {
            setServerAdmin(false);
            setMyPbs([]);
            setAdminPbs([]);
        }
    }, [userEmail]);

    // Keyboard shortcut listener (Ctrl/Cmd + K to search)
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

    const peaks = useMemo(() => {
        const map = new Map<string, PBRecord>();
        myPbs.forEach((p) => {
            map.set(p.skill_id, p);
        });
        return map;
    }, [myPbs]);

    const top3Feats = useMemo(() => {
        return Array.from(peaks.values())
            .map((p) => ({ ...p, score: scoreSinglePB(p, athleteBw) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }, [peaks, athleteBw]);

    const displayedSkills = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return SKILLS.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
        }
        return SKILLS.filter((s) => s.category === selectedBranch);
    }, [searchQuery, selectedBranch]);

    const live1RM = useMemo(() => {
        if (!activeModalSkill) return null;
        return computeCalisthenics1RM(athleteBw, ballast, repsOrDur);
    }, [activeModalSkill, athleteBw, ballast, repsOrDur]);

    const handleSavePb = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeModalSkill || !userEmail) return;

        const effectiveEmail = userEmail;
        const reps = activeModalSkill.type === "dyn" ? Number(repsOrDur) : 0;
        const duration = activeModalSkill.type === "iso" ? Number(repsOrDur) : 0;
        const wt = Number(ballast) || 0;
        const cleanProof = proofUrl.trim();

        // Optimistically update myPbs immediately
        setMyPbs((prev) => {
            const filtered = prev.filter((p) => p.skill_id !== activeModalSkill.id);
            const optimisticPb: PBRecord = {
                id: Date.now(),
                email: effectiveEmail,
                skill_id: activeModalSkill.id,
                weight: wt,
                reps,
                duration,
                proof_url: cleanProof,
                is_verified: false,
                verification_status: cleanProof ? "pending" : "unverified",
                date: new Date().toISOString().split("T")[0],
                bodyweight_at_time: athleteBw,
                is_public_proof: isPublic,
            };
            return [optimisticPb, ...filtered];
        });

        try {
            await apiFetch(apiUrl("/api/pbs"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-athlete-email": effectiveEmail,
                },
                body: JSON.stringify({
                    email: effectiveEmail,
                    skillId: activeModalSkill.id,
                    bw: athleteBw,
                    weight: wt,
                    reps,
                    duration,
                    proofUrl: cleanProof,
                    isPublic,
                }),
            });
        } catch (err) {
            console.error("Failed to save PB", err);
        }

        setActiveModalSkill(null);
        await Promise.all([fetchPbs(), fetchLeaderboard(), fetchAdminPbs()]);
    };

    // Delete Own Account
    const handleDeleteOwnAccount = async () => {
        if (!userEmail) return;
        const confirmDelete = window.confirm(
            "⚠️ PERMANENT ACCOUNT DELETION\n\nAre you sure you want to completely delete your account? All your personal bests, rank badges, and leaderboard entries will be permanently erased. This action CANNOT be undone."
        );
        if (!confirmDelete) return;

        try {
            const res = await apiFetch(apiUrl(`/api/profile?email=${encodeURIComponent(userEmail)}&requesterEmail=${encodeURIComponent(userEmail)}`), {
                method: "DELETE",
                headers: {
                    "x-athlete-email": userEmail,
                },
            });

            if (res.ok) {
                // Try deleting from Firebase Auth (best-effort)
                try {
                    await user?.delete();
                } catch {
                    // Firebase requires recent login for user.delete(), logout still clears session
                }
                setShowProfileModal(false);
                await handleSignOut();
                alert("Your account and records have been completely deleted.");
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete account. Please try again.");
            }
        } catch (err) {
            console.error("Failed to delete account:", err);
            alert("Error deleting account. Please check your network connection.");
        }
    };

    // Admin Delete Other Athlete's Account
    const handleAdminDeleteAthlete = async (targetEmail: string, targetName: string) => {
        if (!isAdmin || !userEmail) return;
        const confirmDelete = window.confirm(
            `🛡️ FEDERATION ADMIN ACTION\n\nAre you sure you want to permanently remove athlete "${targetName}" (${targetEmail}) from the Callilog network?\n\nAll their PBs, leaderboard entries, and profile data will be permanently purged.`
        );
        if (!confirmDelete) return;

        try {
            const res = await apiFetch(apiUrl(`/api/profile?email=${encodeURIComponent(targetEmail)}&requesterEmail=${encodeURIComponent(userEmail)}`), {
                method: "DELETE",
                headers: {
                    "x-athlete-email": userEmail,
                },
            });

            if (res.ok) {
                setInspectingAthlete(null);
                await Promise.all([fetchLeaderboard(), fetchPbs(), fetchAdminPbs()]);
                alert(`Athlete "${targetName}" has been successfully removed from the federation.`);
            } else {
                const data = await res.json();
                alert(data.error || "Admin deletion failed.");
            }
        } catch (err) {
            console.error("Admin deletion error:", err);
            alert("Network error while deleting athlete.");
        }
    };
    
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userEmail) return;
        const effectiveEmail = userEmail;
        const newBw = Number(editBw) || 75.0;
        const cleanAvatar = editAvatarUrl.trim();

        setProfile((prev) => ({
            ...prev,
            email: effectiveEmail,
            display_name: editName,
            bodyweight_kg: newBw,
            tagline: editTagline,
            discipline: editDiscipline,
            avatar_icon: editIcon,
            avatar_url: cleanAvatar,
            is_masked: editMasked,
        }));

        try {
            await apiFetch(apiUrl("/api/profile"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-athlete-email": effectiveEmail,
                },
                body: JSON.stringify({
                    email: effectiveEmail,
                    displayName: editName,
                    display_name: editName,
                    bodyweight: newBw,
                    bodyweight_kg: newBw,
                    tagline: editTagline,
                    discipline: editDiscipline,
                    avatarIcon: editIcon,
                    avatar_icon: editIcon,
                    avatarUrl: cleanAvatar,
                    avatar_url: cleanAvatar,
                    isMasked: editMasked,
                    is_masked: editMasked,
                }),
            });
        } catch (err) {
            console.error("Failed to update profile", err);
        }

        setShowProfileModal(false);
        await Promise.all([fetchProfile(), fetchPbs(), fetchLeaderboard()]);
    };

    const renderAvatar = (url?: string, icon?: string, size = 44) => {
        return <AthleteAvatar url={url} icon={icon} size={size} fallbackPhoto={user?.photoURL} />;
    };

    const getRadarPoints = (axes: { score: number }[]) => {
        const center = 100;
        const radius = 70;
        const total = axes.length;
        return axes
            .map((axis, i) => {
                const angle = ((Math.PI * 2) / total) * i - Math.PI / 2;
                const val = Math.max(10, axis.score) / 100;
                const x = center + radius * val * Math.cos(angle);
                const y = center + radius * val * Math.sin(angle);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
    };

    const radarPoints = useMemo(() => getRadarPoints(diagnostics.radarAxes), [diagnostics.radarAxes]);

    const compareDiagnostics = useMemo(() => {
        if (!compareTarget) return null;
        return computeDiagnostics(compareTarget.pbs, compareTarget.bw);
    }, [compareTarget]);

    if (authLoading) {
        return (
            <main className="app-shell" style={{ maxWidth: "600px", margin: "140px auto", textAlign: "center", padding: "0 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>⚡</div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#EDEDED", marginBottom: "8px" }}>
                    Connecting to Callilog Network...
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#6C7282" }}>
                    Synchronizing verified athlete benchmarks and strength calibrations
                </p>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="app-shell" style={{ maxWidth: "560px", margin: "60px auto 100px", padding: "0 18px" }}>
                <div className="titanium-slab" style={{ padding: "36px 30px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #E2A73B, #A78BFA, #38BDF8)" }} />

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(226, 167, 59, 0.12)", border: "1px solid rgba(226, 167, 59, 0.35)", borderRadius: "20px", padding: "4px 14px", marginBottom: "20px" }}>
                        <span style={{ fontSize: "0.75rem", color: "#E2A73B", fontWeight: 700, letterSpacing: "0.08em" }}>
                            🛡️ OFFICIAL CALISTHENICS FEDERATION
                        </span>
                    </div>

                    <h1 style={{ fontSize: "2.1rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#EDEDED", margin: "0 0 10px 0", textTransform: "uppercase" }}>
                        Callilog Arena
                    </h1>
                    <p style={{ fontSize: "0.92rem", color: "#9CA3AF", lineHeight: 1.5, margin: "0 0 28px 0" }}>
                        The official verified calisthenics benchmark arena. Sign in with your Google account to log personal records, unlock your strength-to-weight dual ELO rating, and compete on the global leaderboard.
                    </p>

                    {loginError && (
                        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "6px", padding: "12px 16px", marginBottom: "20px", textAlign: "left", fontSize: "0.82rem", color: "#FCA5A5" }}>
                            <div style={{ fontWeight: 700, marginBottom: "3px" }}>Authentication Notice</div>
                            <div>{loginError}</div>
                        </div>
                    )}

                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "12px",
                            background: "#FFFFFF",
                            color: "#111827",
                            border: "none",
                            borderRadius: "8px",
                            padding: "14px 24px",
                            fontSize: "1rem",
                            fontWeight: 700,
                            cursor: isLoggingIn ? "not-allowed" : "pointer",
                            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
                            transition: "all 0.15s ease",
                            marginBottom: "26px",
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        {isLoggingIn ? "Signing In with Google..." : "Sign in with Google"}
                    </button>

                    <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "20px", textAlign: "left" }}>
                        <div style={{ fontSize: "0.75rem", color: "#E2A73B", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "8px" }}>
                            FEDERATION ADMINISTRATOR DIRECTORY
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "#8A90A2", lineHeight: 1.5, margin: "0 0 10px 0" }}>
                            Authorized Google accounts automatically receive full administrator access upon sign-in:
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.75rem" }}>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "8px 10px" }}>
                                <div style={{ color: "#E2A73B", fontWeight: 700 }}>Admin 1</div>
                                <div style={{ color: "#9CA3AF", fontSize: "0.7rem", wordBreak: "break-all" }}>mrwe3838@gmail.com</div>
                            </div>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "8px 10px" }}>
                                <div style={{ color: "#E2A73B", fontWeight: 700 }}>Admin 2</div>
                                <div style={{ color: "#9CA3AF", fontSize: "0.7rem", wordBreak: "break-all" }}>elijaharagonmorgan@gmail.com</div>
                            </div>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "8px 10px" }}>
                                <div style={{ color: "#E2A73B", fontWeight: 700 }}>Admin 3</div>
                                <div style={{ color: "#9CA3AF", fontSize: "0.7rem", wordBreak: "break-all" }}>station3828@gmail.com</div>
                            </div>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "8px 10px" }}>
                                <div style={{ color: "#E2A73B", fontWeight: 700 }}>Admin 4</div>
                                <div style={{ color: "#9CA3AF", fontSize: "0.7rem", wordBreak: "break-all" }}>2morgane@queenelizabeths.derbyshire.sch.uk</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "16px" }}>
                    <div className="titanium-slab" style={{ padding: "16px", textAlign: "center" }}>
                        <div style={{ fontSize: "1.4rem", marginBottom: "6px" }}>⚡</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#EDEDED", marginBottom: "4px" }}>Dual ELO</div>
                        <div style={{ fontSize: "0.72rem", color: "#6C7282" }}>Real strength-to-weight calibration</div>
                    </div>
                    <div className="titanium-slab" style={{ padding: "16px", textAlign: "center" }}>
                        <div style={{ fontSize: "1.4rem", marginBottom: "6px" }}>🛡️</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#EDEDED", marginBottom: "4px" }}>Video Proofs</div>
                        <div style={{ fontSize: "0.72rem", color: "#6C7282" }}>Strict form federation review</div>
                    </div>
                    <div className="titanium-slab" style={{ padding: "16px", textAlign: "center" }}>
                        <div style={{ fontSize: "1.4rem", marginBottom: "6px" }}>🎴</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#EDEDED", marginBottom: "4px" }}>Fighter Cards</div>
                        <div style={{ fontSize: "0.72rem", color: "#6C7282" }}>High-res PNG athlete cards</div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="app-shell" style={{ paddingBottom: "80px" }}>
            {/* 1. TOP HUD */}
            <header className="titanium-slab" style={{ padding: "18px 22px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div
                            onClick={() => setShowProfileModal(true)}
                            title="Edit athlete profile"
                            role="button"
                            tabIndex={0}
                            aria-label="Edit athlete profile"
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowProfileModal(true)}
                            style={{ cursor: "pointer", position: "relative" }}
                        >
                            {renderAvatar(profile.avatar_url, profile.avatar_icon, 52)}
                            <span style={{ position: "absolute", bottom: "-2px", right: "-2px", background: "#0A0B0E", borderRadius: "50%", padding: "2px", fontSize: "10px" }}>
                                ✏️
                            </span>
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                                    {profile.display_name || user?.displayName || userEmail.split("@")[0]}
                                </span>
                                <span className="pill-badge pill-gold">{badge.title}</span>
                                {isAdmin && <span className="pill-badge pill-gold" style={{ background: "rgba(226, 167, 59, 0.2)", color: "#E2A73B", border: "1px solid rgba(226, 167, 59, 0.5)" }}>🛡️ ADMIN</span>}
                                {profile.is_masked && <span className="pill-badge pill-slate">👻 GHOST</span>}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.78rem", color: "#6C7282", flexWrap: "wrap" }}>
                                <span>{athleteBw} KG BW</span>
                                <span>•</span>
                                <span>{profile.discipline}</span>
                                <span>•</span>
                                <span style={{ color: "#9CA3AF" }}>{userEmail}</span>
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
                                    onClick={handleSignOut}
                                    style={{
                                        background: "rgba(239, 68, 68, 0.15)",
                                        color: "#F87171",
                                        border: "1px solid rgba(239, 68, 68, 0.3)",
                                        borderRadius: "4px",
                                        padding: "2px 8px",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "24px", alignItems: "baseline" }}>
                        <div>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Official ELO
                            </div>
                            <div className="num-font" style={{ fontSize: "2.1rem", fontWeight: 800, color: "#EDEDED", lineHeight: 1 }}>
                                {officialELO}
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "#6C7282" }}>Certified Verified</div>
                        </div>
                        <div style={{ borderLeft: "1px solid rgba(255, 255, 255, 0.08)", paddingLeft: "20px" }}>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6C7282", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Vault ELO
                            </div>
                            <div className="num-font" style={{ fontSize: "2.1rem", fontWeight: 700, color: "#8A90A2", lineHeight: 1 }}>
                                {unofficialELO}
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "#6C7282" }}>All Milestones</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. SEARCH FACILITY */}
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
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6C7282", cursor: "pointer" }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* 4. TAB 1: THE VAULT */}
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
                                <div key={skill.id} className="titanium-slab" style={{ padding: "14px 18px", borderLeft: `3px solid ${tierInfo.color}` }}>
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
                                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#EDEDED" }}>{skill.name}</div>
                                            {peak ? (
                                                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "3px" }}>
                                                    <span className="num-font" style={{ fontSize: "1.15rem", fontWeight: 700, color: "#EDEDED" }}>
                                                        {skill.type === "iso" ? peak.duration : peak.reps}
                                                        {unit}
                                                    </span>
                                                    {peak.weight > 0 && <span style={{ fontSize: "0.8rem", color: "#7E8494" }}>@ +{peak.weight}kg</span>}
                                                    <span style={{ fontSize: "0.7rem", color: "#525666" }}>Logged {peak.date}</span>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: "0.78rem", color: "#525666", marginTop: "3px" }}>
                                                    Unlock Target: {skill.reqValue}
                                                    {unit}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {peak?.proof_url && (
                                                <button
                                                    onClick={() => setPreviewVideoUrl(peak.proof_url ?? null)}
                                                    className="btn-action"
                                                    style={{ padding: "6px 10px", fontSize: "0.75rem", borderColor: "#E2A73B", color: "#E2A73B" }}
                                                >
                                                    ▶ Proof
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setActiveModalSkill(skill);
                                                    setRepsOrDur(peak ? (skill.type === "iso" ? peak.duration : peak.reps) : skill.reqValue);
                                                    setBallast(peak?.weight || 0);
                                                    setProofUrl(peak?.proof_url || "");
                                                    setIsPublic(peak ? peak.is_public_proof !== false : true);
                                                }}
                                                className="btn-action"
                                            >
                                                {peak ? "Update" : "Record"}
                                            </button>
                                        </div>
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
                                            <span>
                                                (Tier {nextStep.tier} · ×{nextStep.diff.toFixed(1)})
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 5. TAB 2: DEEP ANALYTICS */}
            {activeTab === "intel" && (
                <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div className="titanium-slab" style={{ padding: "16px 20px", borderLeft: "3px solid #E2A73B" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Diagnostic Specialization
                        </span>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#EDEDED", marginTop: "3px" }}>{diagnostics.archetype}</div>
                        <p style={{ fontSize: "0.82rem", color: "#8A90A2", margin: "4px 0 0 0" }}>{diagnostics.archetypeDesc}</p>
                    </div>

                    <div className="titanium-slab" style={{ padding: "20px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7E8494", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
                            Neuromuscular Vector Spider Web
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <svg width="240" height="240" viewBox="0 0 200 200">
                                {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
                                    <circle key={idx} cx="100" cy="100" r={70 * level} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
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

            {/* 6. TAB 3: THE ARENA */}
            {activeTab === "arena" && (() => {
                const myCleanEmail = userEmail.toLowerCase().trim();

                const athletesMap = new Map<string, any>();

                // 1. Seed from server leaderboard
                if (Array.isArray(leaderboardData) && leaderboardData.length > 0) {
                    leaderboardData.forEach((ath) => {
                        const key = ath.id ? String(ath.id) : (ath.email || "").toLowerCase().trim();
                        if (!key) return;
                        const athPbs = allPbs.filter((p) => (p.email || "").toLowerCase() === (ath.email || "").toLowerCase());
                        athletesMap.set(key, {
                            email: (ath.email || "").toLowerCase().trim(),
                            athleteId: ath.id,
                            displayName: ath.displayName || ath.email?.split("@")[0] || "Athlete",
                            avatarUrl: ath.avatarUrl || "",
                            avatarIcon: ath.avatarIcon || "⚡",
                            isMasked: Boolean(ath.isMasked),
                            officialELO: Number(ath.officialELO) || 0,
                            unofficialELO: Number(ath.unofficialELO) || 0,
                            badge: ath.badge || getRankBadge(ath.officialELO || 0),
                            verifiedCount: Number(ath.verifiedCount) || 0,
                            rawPbs: athPbs,
                            bw: Number(ath.bodyweightKg) || 75.0,
                            tagline: ath.tagline || "",
                            discipline: ath.discipline || "Statics & Holds",
                            topFeats: ath.topFeats || [],
                        });
                    });
                }

                // 2. Include all athletes with unverified / vault PBs from allPbs
                allPbs.forEach((p) => {
                    const athleteId = Number(p.athlete_id);
                    const key = athleteId > 0 ? String(athleteId) : (p.email || "").toLowerCase().trim();
                    if (!key) return;

                    if (!athletesMap.has(key)) {
                        athletesMap.set(key, {
                            email: (p.email || "").toLowerCase().trim(),
                            athleteId: athleteId > 0 ? athleteId : undefined,
                            displayName: p.display_name || p.email?.split("@")[0] || "Athlete",
                            avatarUrl: p.avatar_url || "",
                            avatarIcon: p.avatar_icon || "⚡",
                            isMasked: Boolean(p.is_masked),
                            officialELO: 0,
                            unofficialELO: 0,
                            badge: getRankBadge(0),
                            verifiedCount: 0,
                            rawPbs: [],
                            bw: Number(p.bodyweight_at_time) || 75.0,
                            tagline: "",
                            discipline: "Statics & Holds",
                            topFeats: [],
                        });
                    }

                    const entry = athletesMap.get(key)!;
                    if (!entry.rawPbs.some((existing: PBRecord) => existing.id === p.id)) {
                        entry.rawPbs.push(p);
                    }
                });

                // 3. Ensure the current active user is present
                if (myCleanEmail) {
                    const myKey = profile.id ? String(profile.id) : myCleanEmail;
                    if (!athletesMap.has(myKey)) {
                        athletesMap.set(myKey, {
                            email: myCleanEmail,
                            athleteId: profile.id,
                            displayName: profile.display_name || user?.displayName || myCleanEmail.split("@")[0],
                            avatarUrl: profile.avatar_url || user?.photoURL || "",
                            avatarIcon: profile.avatar_icon || "⚡",
                            isMasked: Boolean(profile.is_masked),
                            officialELO,
                            unofficialELO,
                            badge,
                            verifiedCount: myPbs.filter((p) => p.is_verified).length,
                            rawPbs: myPbs,
                            bw: athleteBw,
                            tagline: profile.tagline,
                            discipline: profile.discipline,
                            topFeats: [],
                        });
                    } else {
                        const me = athletesMap.get(myKey)!;
                        me.rawPbs = myPbs;
                        me.bw = athleteBw;
                        me.displayName = profile.display_name || me.displayName;
                        me.avatarUrl = profile.avatar_url || me.avatarUrl;
                        me.avatarIcon = profile.avatar_icon || me.avatarIcon;
                        me.isMasked = Boolean(profile.is_masked);
                        me.tagline = profile.tagline || me.tagline;
                        me.discipline = profile.discipline || me.discipline;
                    }
                }

                // 4. Calculate Dual ELOs for every athlete
                const computedAthletes = Array.from(athletesMap.values()).map((ath) => {
                    const { officialELO: calcOfficial, unofficialELO: calcVault } = computeDualELO(ath.rawPbs, ath.bw);
                    const verifiedCount = ath.rawPbs.filter((p: PBRecord) => p.is_verified).length;
                    const effOfficial = ath.officialELO || calcOfficial;
                    const effVault = ath.unofficialELO || calcVault;
                    return {
                        ...ath,
                        officialELO: effOfficial,
                        unofficialELO: effVault,
                        badge: effOfficial > 0 ? ath.badge : getRankBadge(effOfficial),
                        verifiedCount: Math.max(ath.verifiedCount, verifiedCount),
                        totalFeats: ath.rawPbs.length,
                    };
                });

                // 5. Visibility rules:
                // - Regular users CANNOT see ghost profiles (only admins or yourself)
                // - Unverified users ARE visible to everyone
                const visibleAthletes = computedAthletes.filter((ath) => {
                    const isMe = (ath.athleteId != null && ath.athleteId === profile.id) || ath.email === myCleanEmail;
                    if (isMe) return true;
                    if (ath.isMasked && !isAdmin) return false;
                    return true;
                });

                // 6. Sort according to dropdown selection
                const sortedAthletes = [...visibleAthletes].sort((a, b) => {
                    switch (arenaSortBy) {
                        case "vault":
                            return b.unofficialELO - a.unofficialELO || b.officialELO - a.officialELO;
                        case "verified":
                            return b.verifiedCount - a.verifiedCount || b.officialELO - a.officialELO;
                        case "feats":
                            return b.totalFeats - a.totalFeats || b.unofficialELO - a.unofficialELO;
                        case "name":
                            return a.displayName.localeCompare(b.displayName);
                        case "bw":
                            return b.bw - a.bw;
                        case "official":
                        default:
                            return b.officialELO - a.officialELO || b.unofficialELO - a.unofficialELO;
                    }
                });

                return (
                    <section className="titanium-slab" style={{ padding: "20px" }}>
                        {/* Arena Header & Dropdown Toolbar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
                            <div>
                                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#EDEDED" }}>
                                    🏆 The Arena // Global Leaderboard
                                </h2>
                                <div style={{ fontSize: "0.75rem", color: "#6C7282", marginTop: "3px" }}>
                                    {sortedAthletes.length} Active Athletes • Click any athlete to view their feats passport
                                    {isAdmin && <span style={{ color: "#E2A73B", marginLeft: "6px" }}>• Admin View Active</span>}
                                </div>
                            </div>

                            {/* Dropdown Selector */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <label htmlFor="arena_sort_select" style={{ fontSize: "0.72rem", color: "#8A90A2", fontWeight: 700, textTransform: "uppercase" }}>
                                    Sort By:
                                </label>
                                <select
                                    id="arena_sort_select"
                                    value={arenaSortBy}
                                    onChange={(e) => setArenaSortBy(e.target.value as any)}
                                    style={{
                                        background: "#08090C",
                                        color: "#EDEDED",
                                        border: "1px solid rgba(255, 255, 255, 0.15)",
                                        borderRadius: "6px",
                                        padding: "6px 12px",
                                        fontSize: "0.78rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        outline: "none",
                                    }}
                                >
                                    <option value="official">Official Verified ELO</option>
                                    <option value="vault">Vault ELO (All Athletes & Unverified)</option>
                                    <option value="verified">Most Certified Feats</option>
                                    <option value="feats">Total Vault Logs</option>
                                    <option value="name">Athlete Name (A → Z)</option>
                                    <option value="bw">Bodyweight (Heavy to Light)</option>
                                </select>
                            </div>
                        </div>

                        {/* Athlete Cards */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {sortedAthletes.map((ath, idx) => {
                                const isMe = (ath.athleteId != null && ath.athleteId === profile.id) || ath.email === myCleanEmail;
                                const isUnverified = ath.verifiedCount === 0;
                                const medalColors = ["#F59E0B", "#E2E8F0", "#CD7F32"];
                                const rankColor = idx < 3 && arenaSortBy === "official" ? medalColors[idx] : "#525666";

                                const displayScore = arenaSortBy === "vault" ? ath.unofficialELO : ath.officialELO;
                                const displayScoreLabel = arenaSortBy === "vault" ? "Vault ELO" : "Official ELO";

                                return (
                                    <div
                                        key={ath.athleteId ?? ath.email}
                                        onClick={() => {
                                            const athPbs = ath.rawPbs && ath.rawPbs.length > 0
                                                ? ath.rawPbs
                                                : isMe 
                                                ? myPbs 
                                                : allPbs.filter((p) => (p.email || "").toLowerCase() === (ath.email || "").toLowerCase());
                                            
                                            setInspectingAthlete({
                                                ...ath,
                                                rawPbs: athPbs,
                                            });
                                        }}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "12px 14px",
                                            borderRadius: "6px",
                                            background: isMe ? "rgba(226, 167, 59, 0.05)" : "rgba(255, 255, 255, 0.02)",
                                            border: isMe
                                                ? "1px solid rgba(226, 167, 59, 0.3)"
                                                : isUnverified
                                                ? "1px solid rgba(255, 255, 255, 0.04)"
                                                : "1px solid rgba(255, 255, 255, 0.08)",
                                            flexWrap: "wrap",
                                            gap: "10px",
                                            cursor: "pointer",
                                            transition: "border-color 0.15s ease, background 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = "rgba(226, 167, 59, 0.4)";
                                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = isMe
                                                ? "rgba(226, 167, 59, 0.3)"
                                                : isUnverified
                                                ? "1px solid rgba(255, 255, 255, 0.04)"
                                                : "1px solid rgba(255, 255, 255, 0.08)";
                                            e.currentTarget.style.background = isMe ? "rgba(226, 167, 59, 0.05)" : "rgba(255, 255, 255, 0.02)";
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <span className="num-font" style={{ fontSize: "1rem", fontWeight: 800, color: rankColor, width: "28px", textAlign: "center" }}>
                                                #{idx + 1}
                                            </span>

                                            {renderAvatar(ath.avatarUrl, ath.avatarIcon, 36)}

                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: isMe ? "#FFF" : "#EDEDED" }}>
                                                        {ath.displayName}
                                                    </span>
                                                    {isMe && <span style={{ fontSize: "0.65rem", color: "#E2A73B", fontWeight: 700 }}>(YOU)</span>}
                                                    {ath.isMasked && (
                                                        <span className="pill-badge pill-slate" style={{ fontSize: "0.6rem", color: "#A78BFA", border: "1px solid rgba(167, 139, 250, 0.4)" }}>
                                                            👻 GHOST {isAdmin && !isMe ? "(ADMIN EYE)" : ""}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: "0.68rem", color: "#6C7282" }}>🔍 View Passport</span>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
                                                    {isUnverified ? (
                                                        <span className="pill-badge pill-slate" style={{ fontSize: "0.6rem", color: "#8A90A2", padding: "1px 5px" }}>
                                                            UNVERIFIED (VAULT ONLY)
                                                        </span>
                                                    ) : (
                                                        <span className="pill-badge pill-gold" style={{ fontSize: "0.6rem", padding: "1px 5px" }}>
                                                            {ath.badge.title}
                                                        </span>
                                                    )}

                                                    <span style={{ fontSize: "0.7rem", color: ath.verifiedCount > 0 ? "#10B981" : "#6C7282" }}>
                                                        {ath.verifiedCount} certified
                                                    </span>
                                                    <span style={{ fontSize: "0.7rem", color: "#525666" }}>
                                                        • {ath.totalFeats || ath.rawPbs?.length || 0} logged • {ath.bw}kg
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                            {!isMe && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const comparePbs = ath.rawPbs && ath.rawPbs.length > 0
                                                            ? ath.rawPbs
                                                            : allPbs.filter((p) => (p.email || "").toLowerCase() === (ath.email || "").toLowerCase());
                                                        setCompareTarget({ displayName: ath.displayName, pbs: comparePbs, bw: ath.bw });
                                                    }}
                                                    style={{
                                                        background: "rgba(255, 255, 255, 0.06)",
                                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                                        color: "#EDEDED",
                                                        padding: "4px 10px",
                                                        borderRadius: "4px",
                                                        fontSize: "0.72rem",
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    ⚔️ Compare
                                                </button>
                                            )}

                                            <div style={{ textAlign: "right" }}>
                                                <div className="num-font" style={{ fontSize: "1.4rem", fontWeight: 800, color: displayScore > 0 ? "#EDEDED" : "#525666", lineHeight: 1 }}>
                                                    {displayScore}
                                                </div>
                                                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: arenaSortBy === "vault" ? "#8A90A2" : "#E2A73B", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "3px" }}>
                                                    {displayScoreLabel}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })()}

            {/* 7. TAB 4: ADMIN TERMINAL */}
            {activeTab === "admin" && isAdmin && (
                <section className="titanium-slab" style={{ padding: "18px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#EF4444", marginBottom: "14px" }}>
                        Verification Audit Queue
                    </div>
                    {adminPbs.filter((p) => p.verification_status === "pending").length === 0 ? (
                        <div style={{ fontSize: "0.85rem", color: "#525666" }}>Audit queue is empty. All submissions verified.</div>
                    ) : (
                        adminPbs
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
                                            <button
                                                onClick={() => setPreviewVideoUrl(p.proof_url || null)}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    padding: 0,
                                                    fontSize: "0.75rem",
                                                    color: "#E2A73B",
                                                    textDecoration: "underline",
                                                    cursor: "pointer",
                                                    marginTop: "4px",
                                                    display: "block",
                                                }}
                                            >
                                                ▶ Watch Video Proof In-App
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={async () => {
                                                await apiFetch(apiUrl("/api/admin"), { method: "POST", body: JSON.stringify({ action: "verify", pbId: p.id, approved: true }) });
                                                fetchAdminPbs();
                                                fetchPbs();
                                                fetchLeaderboard();
                                            }}
                                            className="btn-action"
                                            style={{ background: "#10B981", color: "#000", border: "none" }}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await apiFetch(apiUrl("/api/admin"), { method: "POST", body: JSON.stringify({ action: "verify", pbId: p.id, approved: false, reason: "Form Breakdown" }) });
                                                fetchAdminPbs();
                                                fetchPbs();
                                                fetchLeaderboard();
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

            {/* 8. MODAL: HEAD-TO-HEAD ARENA COMPARISON */}
            {compareTarget && compareDiagnostics && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 130 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "480px", padding: "24px" }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px 0", color: "#EDEDED", display: "flex", justifyContent: "space-between" }}>
                            <span>⚔️ Head-to-Head Vector Clash</span>
                            <button onClick={() => setCompareTarget(null)} style={{ background: "none", border: "none", color: "#6C7282", cursor: "pointer" }}>✕</button>
                        </h3>

                        <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "16px" }}>
                            <div style={{ textAlign: "center" }}>
                                <span style={{ fontSize: "0.8rem", color: "#E2A73B", fontWeight: 700 }}>YOU ({officialELO} ELO)</span>
                            </div>
                            <span style={{ color: "#6C7282", fontWeight: 800 }}>VS</span>
                            <div style={{ textAlign: "center" }}>
                                <span style={{ fontSize: "0.8rem", color: "#38BDF8", fontWeight: 700 }}>
                                    {compareTarget.displayName.toUpperCase()} ({computeDualELO(compareTarget.pbs, compareTarget.bw).officialELO} ELO)
                                </span>
                            </div>
                        </div>

                        {/* Overlaid Vector Web */}
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                            <svg width="240" height="240" viewBox="0 0 200 200">
                                {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
                                    <circle key={idx} cx="100" cy="100" r={70 * level} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
                                ))}
                                {diagnostics.radarAxes.map((_, i) => {
                                    const angle = ((Math.PI * 2) / diagnostics.radarAxes.length) * i - Math.PI / 2;
                                    const x2 = 100 + 70 * Math.cos(angle);
                                    const y2 = 100 + 70 * Math.sin(angle);
                                    return <line key={i} x1="100" y1="100" x2={x2} y2={y2} stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />;
                                })}
                                <polygon points={radarPoints} fill="rgba(226, 167, 59, 0.25)" stroke="#E2A73B" strokeWidth="2" />
                                <polygon points={getRadarPoints(compareDiagnostics.radarAxes)} fill="rgba(56, 189, 248, 0.25)" stroke="#38BDF8" strokeWidth="2" />
                            </svg>
                        </div>

                        <button onClick={() => setCompareTarget(null)} className="btn-primary" style={{ width: "100%", padding: "10px" }}>
                            Close Comparison
                        </button>
                    </div>
                </div>
            )}

            {/* 8.5 MODAL: ATHLETE PASSPORT & FEATS INSPECTOR */}
            {inspectingAthlete && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 125 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "520px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "24px", overflow: "hidden" }}>
                        
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                {renderAvatar(inspectingAthlete.avatarUrl, inspectingAthlete.avatarIcon, 56)}
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#EDEDED" }}>
                                            {inspectingAthlete.displayName}
                                        </h3>
                                        <span className="pill-badge pill-gold">{inspectingAthlete.badge.title}</span>
                                        {inspectingAthlete.isMasked && (
                                            <span className="pill-badge pill-slate" style={{ color: "#A78BFA", border: "1px solid rgba(167, 139, 250, 0.4)" }}>
                                                👻 GHOST
                                            </span>
                                        )}
                                    </div>

                                    {/* EMAIL DISPLAY: ONLY RENDERED IF VIEWER IS ADMIN OR LOOKING AT SELF */}
                                    {(isAdmin || inspectingAthlete.email.toLowerCase() === userEmail) && (
                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(226, 167, 59, 0.1)", border: "1px solid rgba(226, 167, 59, 0.25)", borderRadius: "4px", padding: "2px 8px", marginTop: "4px" }}>
                                            <span style={{ fontSize: "0.72rem", color: "#E2A73B", fontWeight: 700 }}>
                                                📧 {inspectingAthlete.email}
                                            </span>
                                            {isAdmin && inspectingAthlete.email.toLowerCase() !== userEmail && (
                                                <span style={{ fontSize: "0.6rem", color: "#F59E0B", fontWeight: 800 }}>• ADMIN PRIVILEGE</span>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ fontSize: "0.75rem", color: "#8A90A2", marginTop: "4px" }}>
                                        {inspectingAthlete.bw} KG BW • {inspectingAthlete.discipline || "Statics & Holds"}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setInspectingAthlete(null)}
                                style={{ background: "none", border: "none", color: "#8A90A2", fontSize: "1.2rem", cursor: "pointer", padding: "4px" }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Bio tagline if present */}
                        {inspectingAthlete.tagline && (
                            <div style={{ fontStyle: "italic", fontSize: "0.8rem", color: "#A1A7B8", background: "rgba(0,0,0,0.25)", padding: "8px 12px", borderRadius: "6px", marginBottom: "14px" }}>
                                "{inspectingAthlete.tagline}"
                            </div>
                        )}

                        {/* Dual ELO Scores */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                            <div style={{ background: "rgba(226, 167, 59, 0.08)", border: "1px solid rgba(226, 167, 59, 0.25)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", textTransform: "uppercase" }}>Official ELO</div>
                                <div className="num-font" style={{ fontSize: "1.6rem", fontWeight: 800, color: "#FFF" }}>{inspectingAthlete.officialELO}</div>
                                <div style={{ fontSize: "0.65rem", color: "#8A90A2" }}>{inspectingAthlete.verifiedCount} Certified Feats</div>
                            </div>

                            <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#8A90A2", textTransform: "uppercase" }}>Vault ELO</div>
                                <div className="num-font" style={{ fontSize: "1.6rem", fontWeight: 700, color: "#EDEDED" }}>{inspectingAthlete.unofficialELO}</div>
                                <div style={{ fontSize: "0.65rem", color: "#8A90A2" }}>All Lifetime Milestones</div>
                            </div>
                        </div>

                        {/* Feats List */}
                        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px", marginBottom: "16px" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                                Logged Personal Records & Benchmarks ({inspectingAthlete.rawPbs.length})
                            </div>

                            {inspectingAthlete.rawPbs.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "24px 0", color: "#525666", fontSize: "0.82rem" }}>
                                    No movements recorded yet in The Vault.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {inspectingAthlete.rawPbs.map((pb, idx) => {
                                        const meta = SKILLS.find((s) => s.id === pb.skill_id);
                                        const isIso = meta?.type === "iso";
                                        const unit = isIso ? "s hold" : " reps";
                                        const score = scoreSinglePB(pb, inspectingAthlete.bw);

                                        return (
                                            <div
                                                key={pb.id || idx}
                                                style={{
                                                    background: "#0D0E13",
                                                    border: "1px solid rgba(255, 255, 255, 0.06)",
                                                    borderRadius: "6px",
                                                    padding: "10px 12px",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#EDEDED" }}>
                                                        {meta?.name || pb.skill_id}
                                                    </span>
                                                    <span className="num-font" style={{ fontWeight: 800, color: "#E2A73B", fontSize: "0.95rem" }}>
                                                        {isIso ? pb.duration : pb.reps}{unit} {pb.weight > 0 ? `(+${pb.weight}kg)` : ""}
                                                    </span>
                                                </div>

                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", flexWrap: "wrap", gap: "6px" }}>
                                                    <span style={{ fontSize: "0.7rem", color: "#6C7282" }}>
                                                        Power Score: {score} • Logged: {pb.date || "Recent"}
                                                    </span>

                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        {pb.is_verified ? (
                                                            <span className="pill-badge pill-gold" style={{ fontSize: "0.58rem", padding: "1px 5px" }}>
                                                                🏅 CERTIFIED VERIFIED
                                                            </span>
                                                        ) : pb.verification_status === "pending" ? (
                                                            <span className="pill-badge pill-slate" style={{ fontSize: "0.58rem", color: "#F59E0B", padding: "1px 5px" }}>
                                                                ⏳ AUDIT PENDING
                                                            </span>
                                                        ) : (
                                                            <span className="pill-badge pill-slate" style={{ fontSize: "0.58rem", padding: "1px 5px" }}>
                                                                VAULT RECORD
                                                            </span>
                                                        )}

                                                        {pb.proof_url && (
                                                            <button
                                                                onClick={() => setPreviewVideoUrl(pb.proof_url ?? null)}
                                                                className="btn-action"
                                                                style={{ padding: "2px 8px", fontSize: "0.68rem", color: "#E2A73B", borderColor: "#E2A73B" }}
                                                            >
                                                                ▶ Proof
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                                {inspectingAthlete.email.toLowerCase() !== userEmail && (
                                    <button
                                        onClick={() => {
                                            const target = {
                                                displayName: inspectingAthlete.displayName,
                                                pbs: inspectingAthlete.rawPbs,
                                                bw: inspectingAthlete.bw,
                                            };
                                            setInspectingAthlete(null);
                                            setCompareTarget(target);
                                        }}
                                        className="btn-action"
                                        style={{ flex: 1, padding: "10px", borderColor: "#38BDF8", color: "#38BDF8", fontWeight: 700 }}
                                    >
                                        ⚔️ Clash in Head-to-Head
                                    </button>
                                )}
                                <button
                                    onClick={() => setInspectingAthlete(null)}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: "10px" }}
                                >
                                    Close Passport
                                </button>
                            </div>

                            {/* Admin Account Removal Button */}
                            {isAdmin && inspectingAthlete.email.toLowerCase() !== userEmail && (
                                <button
                                    onClick={() => handleAdminDeleteAthlete(inspectingAthlete.email, inspectingAthlete.displayName)}
                                    style={{
                                        background: "rgba(239, 68, 68, 0.12)",
                                        border: "1px solid rgba(239, 68, 68, 0.4)",
                                        color: "#EF4444",
                                        borderRadius: "6px",
                                        padding: "8px 12px",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    🛡️ Admin: Purge Athlete & All Records
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 9. MODAL: IN-APP VIDEO PROOF PLAYER (Auto-buffered & auto-purged from memory) */}
            {previewVideoUrl && (
                <ProofVideoModal
                    url={previewVideoUrl}
                    onClose={() => setPreviewVideoUrl(null)}
                />
            )}

            {/* 10. MODAL: EXPORTABLE HD FIGHTER CARD */}
            {showFighterCard && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 110 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "340px", padding: "20px", textAlign: "center" }}>
                        <div id="fighter-card-export" style={{ background: "#0A0B0E", padding: "20px", borderRadius: "10px", border: "1px solid rgba(226, 167, 59, 0.4)" }}>
                            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#E2A73B", letterSpacing: "0.1em" }}>CERTIFIED ATHLETE PASSPORT</span>

                            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 6px 0" }}>
                                {renderAvatar(profile.avatar_url, profile.avatar_icon, 72)}
                            </div>

                            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#EDEDED", margin: 0 }}>{profile.display_name}</h2>
                            <div style={{ fontSize: "0.75rem", color: "#8A90A2", marginBottom: "14px" }}>
                                {athleteBw}kg · {profile.discipline}
                            </div>

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

                            <div style={{ fontSize: "0.6rem", color: "#525666" }}>{profile.tagline || "CALLILOG VERIFIED // NO COMPROMISE"}</div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                            <button
                                disabled={isExportingCard}
                                onClick={async () => {
                                    setIsExportingCard(true);
                                    await exportFighterCardAsPng("fighter-card-export", profile.display_name || "athlete");
                                    setIsExportingCard(false);
                                }}
                                className="btn-primary"
                                style={{ flex: 1, padding: "10px", background: "#E2A73B", color: "#000" }}
                            >
                                {isExportingCard ? "Generating PNG..." : "📥 Save Card Image"}
                            </button>
                            <button onClick={() => setShowFighterCard(false)} className="btn-action" style={{ padding: "10px 14px" }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 11. MODAL: EDIT PROFILE */}
            {showProfileModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 120 }}>
                    <div className="titanium-slab" style={{ width: "100%", maxWidth: "420px", padding: "24px" }}>
                        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 16px 0", color: "#EDEDED" }}>Edit Athlete Identity</h3>
                        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: "8px" }}>
                                {renderAvatar(editAvatarUrl, editIcon, 56)}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#EDEDED" }}>{editName || "Athlete"}</div>
                                    <div style={{ fontSize: "0.72rem", color: "#7E8494" }}>{editAvatarUrl ? "Live Image Preview" : "Using Default Icon"}</div>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>PROFILE PICTURE URL</label>
                                <input
                                    type="url"
                                    placeholder="https://... (Google Drive, Imgur, or direct image)"
                                    value={editAvatarUrl}
                                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>DISPLAY NAME</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        required
                                        style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>BODYWEIGHT (KG)</label>
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
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>DISCIPLINE SPECIALIZATION</label>
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
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A90A2", display: "block", marginBottom: "4px" }}>MANTRA / BIO TAGLINE</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Lever & planche practitioner"
                                    value={editTagline}
                                    onChange={(e) => setEditTagline(e.target.value)}
                                    style={{ width: "100%", background: "#08090C", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "8px 12px", color: "#FFF", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                <input type="checkbox" id="ghost_toggle" checked={editMasked} onChange={(e) => setEditMasked(e.target.checked)} />
                                <label htmlFor="ghost_toggle" style={{ fontSize: "0.75rem", color: "#A78BFA", cursor: "pointer" }}>
                                    👻 Ghost Mode (Hide from public Leaderboard)
                                </label>
                            </div>

                            {/* Danger Zone: Delete Own Account */}
                            <div style={{ borderTop: "1px solid rgba(239, 68, 68, 0.2)", paddingTop: "14px", marginTop: "4px" }}>
                                <div style={{ fontSize: "0.72rem", color: "#EF4444", fontWeight: 700, marginBottom: "6px" }}>
                                    DANGER ZONE
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDeleteOwnAccount}
                                    style={{
                                        width: "100%",
                                        background: "rgba(239, 68, 68, 0.08)",
                                        border: "1px solid rgba(239, 68, 68, 0.3)",
                                        color: "#F87171",
                                        borderRadius: "6px",
                                        padding: "8px 12px",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    🗑️ Permanently Delete My Account & Records
                                </button>
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

            {/* 12. MODAL: LOG/UPDATE BENCHMARK (WITH 1RM CALISTHENICS CALCULATOR) */}
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

                            {/* Relative 1RM Load Feedback */}
                            {live1RM && ballast > 0 && activeModalSkill.type === "dyn" && (
                                <div style={{ background: "rgba(226, 167, 59, 0.08)", border: "1px solid rgba(226, 167, 59, 0.2)", padding: "10px 12px", borderRadius: "6px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                                        <span style={{ color: "#8A90A2" }}>Total System Mass:</span>
                                        <span style={{ color: "#EDEDED", fontWeight: 700 }}>{live1RM.totalLoad} kg</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginTop: "4px" }}>
                                        <span style={{ color: "#E2A73B", fontWeight: 700 }}>Estimated 1RM Ballast:</span>
                                        <span style={{ color: "#E2A73B", fontWeight: 800 }}>+{live1RM.est1RM} kg</span>
                                    </div>
                                </div>
                            )}

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
                                <input type="checkbox" id="is_public_cb" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
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

            {/* 13. NATIVE iOS FROSTED BOTTOM BAR */}
            <div
                style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(10, 11, 14, 0.85)",
                    backdropFilter: "blur(20px)",
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "8px 16px max(8px, env(safe-area-inset-bottom))",
                    display: "flex",
                    justifyContent: "space-around",
                    alignItems: "center",
                    zIndex: 90,
                }}
            >
                {[
                    { id: "vault", icon: "🏛️", label: "Vault" },
                    { id: "intel", icon: "🕸️", label: "Intel" },
                    { id: "arena", icon: "🏆", label: "Arena" },
                    { id: "admin", icon: "⚡", label: "Audit" },
                ].map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            style={{
                                background: "none",
                                border: "none",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "2px",
                                color: isActive ? "#E2A73B" : "#6C7282",
                                cursor: "pointer",
                                padding: "4px 12px",
                            }}
                        >
                            <span style={{ fontSize: "1.15rem" }}>{item.icon}</span>
                            <span style={{ fontSize: "0.68rem", fontWeight: isActive ? 800 : 600 }}>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </main>
    );
}
