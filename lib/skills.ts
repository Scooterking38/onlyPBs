// lib/skills.ts

export interface SkillNode {
    id: string;
    category: "Pull" | "Push" | "Control" | "Core" | "Rings" | "Legs";
    name: string;
    parentId: string | null;
    reqValue: number;
    type: "iso" | "dyn"; // iso = hold time (seconds), dyn = repetitions
    tier: 1 | 2 | 3 | 4 | 5;
    diff: number; // Unit difficulty multiplier (per rep or per second)
}

export const TIER_CONFIG = {
    1: {
        label: "T1 · FOUNDATION",
        color: "#94A3B8",
        badgeBg: "rgba(148, 163, 184, 0.10)",
        border: "rgba(148, 163, 184, 0.25)",
        text: "text-slate-400"
    },
    2: {
        label: "T2 · STEEL",
        color: "#10B981",
        badgeBg: "rgba(16, 185, 129, 0.10)",
        border: "rgba(16, 185, 129, 0.25)",
        text: "text-emerald-400"
    },
    3: {
        label: "T3 · COBALT",
        color: "#38BDF8",
        badgeBg: "rgba(56, 189, 248, 0.10)",
        border: "rgba(56, 189, 248, 0.25)",
        text: "text-sky-400"
    },
    4: {
        label: "T4 · TITANIUM",
        color: "#A855F7",
        badgeBg: "rgba(168, 85, 247, 0.10)",
        border: "rgba(168, 85, 247, 0.25)",
        text: "text-purple-400"
    },
    5: {
        label: "T5 · APEX GOLD",
        color: "#F59E0B",
        badgeBg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.35)",
        text: "text-amber-400"
    }
} as const;

export const SKILLS: SkillNode[] = [
    // ---------------------------------------------------------
    // 1. PULL
    // ---------------------------------------------------------
    // T1 Foundation (~1.8 - 4.2 pts at req)
    { id: "pull_hang", category: "Pull", name: "Dead Hang", parentId: null, reqValue: 45, type: "iso", tier: 1, diff: 0.04 },
    { id: "pull_active_hang", category: "Pull", name: "Active Hang", parentId: "pull_hang", reqValue: 30, type: "iso", tier: 1, diff: 0.08 },
    { id: "pull_row", category: "Pull", name: "Inverted Row", parentId: "pull_active_hang", reqValue: 15, type: "dyn", tier: 1, diff: 0.25 },
    { id: "pull_scap", category: "Pull", name: "Scapular Pull-Up", parentId: "pull_active_hang", reqValue: 12, type: "dyn", tier: 1, diff: 0.35 },

    // T2 Steel (~18 - 20 pts at req)
    { id: "pull_std", category: "Pull", name: "Pull-Up", parentId: "pull_scap", reqValue: 10, type: "dyn", tier: 2, diff: 2.0 },
    { id: "pull_chin", category: "Pull", name: "Chin-Up", parentId: "pull_std", reqValue: 12, type: "dyn", tier: 2, diff: 1.6 },
    { id: "pull_german_hang", category: "Pull", name: "German Hang", parentId: "pull_active_hang", reqValue: 30, type: "iso", tier: 2, diff: 0.6 },

    // T3 Cobalt (~40 - 50 pts at req)
    { id: "pull_c2b", category: "Pull", name: "Chest-to-Bar Pull-Up", parentId: "pull_std", reqValue: 6, type: "dyn", tier: 3, diff: 7.0 },
    { id: "pull_fl_tuck", category: "Pull", name: "Tuck Front Lever", parentId: "pull_std", reqValue: 15, type: "iso", tier: 3, diff: 3.2 },
    { id: "pull_bl_tuck", category: "Pull", name: "Tuck Back Lever", parentId: "pull_german_hang", reqValue: 15, type: "iso", tier: 3, diff: 2.6 },
    { id: "pull_bl_adv", category: "Pull", name: "Adv Tuck Back Lever", parentId: "pull_bl_tuck", reqValue: 12, type: "iso", tier: 3, diff: 4.2 },

    // T4 Titanium (~95 - 105 pts at req)
    { id: "pull_high", category: "Pull", name: "Explosive High Pull-Up", parentId: "pull_c2b", reqValue: 4, type: "dyn", tier: 4, diff: 24.0 },
    { id: "pull_muscleup", category: "Pull", name: "Bar Muscle-Up", parentId: "pull_high", reqValue: 3, type: "dyn", tier: 4, diff: 35.0 },
    { id: "pull_archer", category: "Pull", name: "Archer Pull-Up", parentId: "pull_std", reqValue: 6, type: "dyn", tier: 4, diff: 16.0 },
    { id: "pull_fl_adv", category: "Pull", name: "Adv Tuck Front Lever", parentId: "pull_fl_tuck", reqValue: 12, type: "iso", tier: 4, diff: 8.5 },
    { id: "pull_bl_full", category: "Pull", name: "Back Lever", parentId: "pull_bl_adv", reqValue: 8, type: "iso", tier: 4, diff: 12.0 },

    // T5 Apex Gold (~225 - 300 pts at req)
    { id: "pull_strict_mu", category: "Pull", name: "Strict Bar Muscle-Up", parentId: "pull_muscleup", reqValue: 5, type: "dyn", tier: 5, diff: 45.0 },
    { id: "pull_slow_mu", category: "Pull", name: "Slow Tempo Muscle-Up", parentId: "pull_strict_mu", reqValue: 2, type: "dyn", tier: 5, diff: 130.0 },
    { id: "pull_fl_straddle", category: "Pull", name: "Straddle Front Lever", parentId: "pull_fl_adv", reqValue: 7, type: "iso", tier: 5, diff: 32.0 },
    { id: "pull_fl_full", category: "Pull", name: "Front Lever", parentId: "pull_fl_straddle", reqValue: 5, type: "iso", tier: 5, diff: 50.0 },
    { id: "pull_fl_row", category: "Pull", name: "Front Lever Row", parentId: "pull_fl_full", reqValue: 3, type: "dyn", tier: 5, diff: 95.0 },
    { id: "pull_oac", category: "Pull", name: "One-Arm Chin-Up", parentId: "pull_archer", reqValue: 1, type: "dyn", tier: 5, diff: 250.0 },
    { id: "pull_hefesto", category: "Pull", name: "Hefesto", parentId: "pull_bl_full", reqValue: 1, type: "dyn", tier: 5, diff: 300.0 },

    // ---------------------------------------------------------
    // 2. PUSH
    // ---------------------------------------------------------
    // T1 Foundation (~3.0 - 10.0 pts at req)
    { id: "push_knee", category: "Push", name: "Knee Push-Up", parentId: null, reqValue: 20, type: "dyn", tier: 1, diff: 0.15 },
    { id: "push_std", category: "Push", name: "Push-Up", parentId: "push_knee", reqValue: 25, type: "dyn", tier: 1, diff: 0.40 },

    // T2 Steel (~15 - 22.5 pts at req)
    { id: "push_diamond", category: "Push", name: "Diamond Push-Up", parentId: "push_std", reqValue: 18, type: "dyn", tier: 2, diff: 0.90 },
    { id: "push_decline", category: "Push", name: "Decline Push-Up", parentId: "push_std", reqValue: 15, type: "dyn", tier: 2, diff: 1.0 },
    { id: "push_dips", category: "Push", name: "Dips", parentId: "push_diamond", reqValue: 15, type: "dyn", tier: 2, diff: 1.5 },
    { id: "push_planche_lean", category: "Push", name: "Planche Lean", parentId: "push_std", reqValue: 25, type: "iso", tier: 2, diff: 0.80 },
    { id: "push_frog_stand", category: "Push", name: "Frog Stand", parentId: "push_planche_lean", reqValue: 30, type: "iso", tier: 2, diff: 0.60 },

    // T3 Cobalt (~38 - 54 pts at req)
    { id: "push_straight_bar_dip", category: "Push", name: "Straight Bar Dip", parentId: "push_dips", reqValue: 12, type: "dyn", tier: 3, diff: 3.2 },
    { id: "push_bulgarian_dip", category: "Push", name: "Bulgarian Dip", parentId: "push_dips", reqValue: 8, type: "dyn", tier: 3, diff: 5.5 },
    { id: "push_archer", category: "Push", name: "Archer Push-Up", parentId: "push_diamond", reqValue: 8, type: "dyn", tier: 3, diff: 5.0 },
    { id: "push_pseudo", category: "Push", name: "Pseudo Planche Push-Up", parentId: "push_planche_lean", reqValue: 10, type: "dyn", tier: 3, diff: 4.5 },
    { id: "push_planche_tuck", category: "Push", name: "Tuck Planche", parentId: "push_frog_stand", reqValue: 12, type: "iso", tier: 3, diff: 4.5 },

    // T4 Titanium (~105 - 110 pts at req)
    // 2 reps OAPU = 70.0 pts (easily outscoring 50-100 knee pushups)
    { id: "push_oap", category: "Push", name: "One-Arm Push-Up", parentId: "push_archer", reqValue: 3, type: "dyn", tier: 4, diff: 35.0 },
    { id: "push_planche_adv", category: "Push", name: "Adv Tuck Planche", parentId: "push_planche_tuck", reqValue: 10, type: "iso", tier: 4, diff: 11.0 },

    // T5 Apex Gold (~250 - 360 pts at req)
    { id: "push_planche_straddle", category: "Push", name: "Straddle Planche", parentId: "push_planche_adv", reqValue: 6, type: "iso", tier: 5, diff: 42.0 },
    { id: "push_planche_full", category: "Push", name: "Full Planche", parentId: "push_planche_straddle", reqValue: 4, type: "iso", tier: 5, diff: 75.0 },
    { id: "push_planche_pushup", category: "Push", name: "Planche Push-Up", parentId: "push_planche_full", reqValue: 2, type: "dyn", tier: 5, diff: 180.0 },

    // ---------------------------------------------------------
    // 3. CONTROL
    // ---------------------------------------------------------
    // T1 Foundation (~3.5 pts at req)
    { id: "hs_pike_hold", category: "Control", name: "Pike Hold", parentId: null, reqValue: 35, type: "iso", tier: 1, diff: 0.10 },

    // T2 Steel (~19 - 22.5 pts at req)
    { id: "hs_wall", category: "Control", name: "Wall Handstand", parentId: "hs_pike_hold", reqValue: 45, type: "iso", tier: 2, diff: 0.50 },
    { id: "hs_pike_pushup", category: "Control", name: "Pike Push-Up", parentId: "hs_pike_hold", reqValue: 12, type: "dyn", tier: 2, diff: 1.6 },

    // T3 Cobalt (~42 - 56 pts at req)
    { id: "hs_free", category: "Control", name: "Handstand", parentId: "hs_wall", reqValue: 20, type: "iso", tier: 3, diff: 2.8 },
    { id: "hs_elevated_pike", category: "Control", name: "Elevated Pike Push-Up", parentId: "hs_pike_pushup", reqValue: 10, type: "dyn", tier: 3, diff: 4.2 },

    // T4 Titanium (~96 - 100 pts at req)
    { id: "hs_press", category: "Control", name: "Press to Handstand", parentId: "hs_free", reqValue: 2, type: "dyn", tier: 4, diff: 50.0 },
    { id: "hs_wall_hspu", category: "Control", name: "Wall Handstand Push-Up", parentId: "hs_elevated_pike", reqValue: 6, type: "dyn", tier: 4, diff: 16.0 },

    // T5 Apex Gold (~255 - 350 pts at req)
    { id: "hs_free_hspu", category: "Control", name: "Handstand Push-Up", parentId: "hs_free", reqValue: 3, type: "dyn", tier: 5, diff: 85.0 },
    { id: "hs_tiger_bend", category: "Control", name: "Tiger Bend HSPU", parentId: "hs_free_hspu", reqValue: 2, type: "dyn", tier: 5, diff: 145.0 },
    { id: "hs_oahs", category: "Control", name: "One-Arm Handstand", parentId: "hs_free", reqValue: 5, type: "iso", tier: 5, diff: 70.0 },

    // ---------------------------------------------------------
    // 4. CORE & FLAGS
    // ---------------------------------------------------------
    // T1 Foundation (~3.0 - 4.5 pts at req)
    { id: "core_plank", category: "Core", name: "Plank", parentId: null, reqValue: 60, type: "iso", tier: 1, diff: 0.05 },
    { id: "core_hollow", category: "Core", name: "Hollow Body Hold", parentId: "core_plank", reqValue: 45, type: "iso", tier: 1, diff: 0.10 },
    { id: "core_knee_raise", category: "Core", name: "Hanging Knee Raise", parentId: "core_hollow", reqValue: 15, type: "dyn", tier: 1, diff: 0.25 },

    // T2 Steel (~17.5 - 22.5 pts at req)
    { id: "core_leg_raise", category: "Core", name: "Hanging Leg Raise", parentId: "core_knee_raise", reqValue: 12, type: "dyn", tier: 2, diff: 1.5 },
    { id: "core_toes_to_bar", category: "Core", name: "Toes-to-Bar", parentId: "core_leg_raise", reqValue: 10, type: "dyn", tier: 2, diff: 2.0 },
    { id: "core_lsit", category: "Core", name: "L-Sit", parentId: "core_hollow", reqValue: 15, type: "iso", tier: 2, diff: 1.5 },
    { id: "core_dragon_neg", category: "Core", name: "Dragon Flag Negative", parentId: "core_hollow", reqValue: 5, type: "dyn", tier: 2, diff: 3.5 },

    // T3 Cobalt (~42 - 50 pts at req)
    { id: "core_wipers", category: "Core", name: "Windshield Wipers", parentId: "core_toes_to_bar", reqValue: 10, type: "dyn", tier: 3, diff: 4.2 },
    { id: "core_vsit", category: "Core", name: "V-Sit", parentId: "core_lsit", reqValue: 10, type: "iso", tier: 3, diff: 5.0 },
    { id: "core_dragon_flag", category: "Core", name: "Dragon Flag", parentId: "core_dragon_neg", reqValue: 6, type: "dyn", tier: 3, diff: 7.5 },
    { id: "core_flag_tuck", category: "Core", name: "Tuck Human Flag", parentId: "core_dragon_flag", reqValue: 10, type: "iso", tier: 3, diff: 5.0 },

    // T4 Titanium (~102 pts at req)
    { id: "core_flag_straddle", category: "Core", name: "Straddle Human Flag", parentId: "core_flag_tuck", reqValue: 6, type: "iso", tier: 4, diff: 17.0 },

    // T5 Apex Gold (~240 - 330 pts at req)
    { id: "core_flag_full", category: "Core", name: "Human Flag", parentId: "core_flag_straddle", reqValue: 5, type: "iso", tier: 5, diff: 48.0 },
    { id: "core_manna", category: "Core", name: "Manna", parentId: "core_vsit", reqValue: 3, type: "iso", tier: 5, diff: 110.0 },

    // ---------------------------------------------------------
    // 5. RINGS
    // ---------------------------------------------------------
    // T2 Steel (~21 pts at req)
    { id: "rings_support", category: "Rings", name: "Ring Support Hold", parentId: "push_dips", reqValue: 30, type: "iso", tier: 2, diff: 0.70 },

    // T3 Cobalt (~45 - 48 pts at req)
    { id: "rings_rto_support", category: "Rings", name: "RTO Support Hold", parentId: "rings_support", reqValue: 20, type: "iso", tier: 3, diff: 2.4 },
    { id: "rings_dip", category: "Rings", name: "Ring Dip", parentId: "rings_support", reqValue: 10, type: "dyn", tier: 3, diff: 4.5 },

    // T4 Titanium (~99 - 108 pts at req)
    { id: "rings_rto_dip", category: "Rings", name: "RTO Ring Dip", parentId: "rings_dip", reqValue: 6, type: "dyn", tier: 4, diff: 16.5 },
    { id: "rings_muscle_up", category: "Rings", name: "Ring Muscle-Up", parentId: "rings_dip", reqValue: 3, type: "dyn", tier: 4, diff: 36.0 },

    // T5 Apex Gold (~240 - 420 pts at req)
    { id: "rings_pelican", category: "Rings", name: "Ring Pelican Curl", parentId: "rings_dip", reqValue: 3, type: "dyn", tier: 5, diff: 80.0 },
    { id: "rings_iron_cross", category: "Rings", name: "Iron Cross", parentId: "rings_rto_support", reqValue: 4, type: "iso", tier: 5, diff: 90.0 },
    { id: "rings_maltese", category: "Rings", name: "Maltese", parentId: "rings_iron_cross", reqValue: 3, type: "iso", tier: 5, diff: 140.0 },

    // ---------------------------------------------------------
    // 6. LEGS
    // ---------------------------------------------------------
    // T1 Foundation (~4.5 pts at req)
    { id: "legs_squat", category: "Legs", name: "Air Squat", parentId: null, reqValue: 30, type: "dyn", tier: 1, diff: 0.15 },
    { id: "legs_horse_stance", category: "Legs", name: "Horse Stance", parentId: "legs_squat", reqValue: 45, type: "iso", tier: 1, diff: 0.10 },

    // T2 Steel (~14 - 20 pts at req)
    { id: "legs_cossack", category: "Legs", name: "Cossack Squat", parentId: "legs_squat", reqValue: 12, type: "dyn", tier: 2, diff: 1.2 },
    { id: "legs_pistol_assisted", category: "Legs", name: "Assisted Pistol Squat", parentId: "legs_cossack", reqValue: 8, type: "dyn", tier: 2, diff: 1.8 },
    { id: "legs_nordic_neg", category: "Legs", name: "Nordic Curl Negative", parentId: "legs_squat", reqValue: 5, type: "dyn", tier: 2, diff: 4.0 },

    // T3 Cobalt (~44 pts at req)
    { id: "legs_pistol", category: "Legs", name: "Pistol Squat", parentId: "legs_pistol_assisted", reqValue: 8, type: "dyn", tier: 3, diff: 5.5 },

    // T4 Titanium (~96 - 102 pts at req)
    { id: "legs_dragon_squat", category: "Legs", name: "Dragon Squat", parentId: "legs_pistol", reqValue: 4, type: "dyn", tier: 4, diff: 24.0 },
    { id: "legs_nordic", category: "Legs", name: "Nordic Curl", parentId: "legs_nordic_neg", reqValue: 3, type: "dyn", tier: 4, diff: 34.0 }
];

export const SKILL_MAP = new Map(SKILLS.map(s => [s.id, s]));

/**
 * FAIR SCORING ENGINE:
 * Calculates points for a given performance value.
 * - Up to `reqValue`: scales directly with unit difficulty.
 * - Beyond `reqValue`: applies logarithmic diminishing returns so volume spamming
 *   on low-tier exercises cannot overtake higher-tier strength skills.
 */
export function calculateSkillPoints(skillIdOrNode: string | SkillNode, value: number): number {
    const skill = typeof skillIdOrNode === "string" ? SKILL_MAP.get(skillIdOrNode) : skillIdOrNode;
    if (!skill || value <= 0) return 0;

    const baseBenchmarkPoints = skill.reqValue * skill.diff;

    if (value <= skill.reqValue) {
        return Math.round((value * skill.diff) * 10) / 10;
    }

    // Over-performance yields logarithmic diminishing returns (capped XP bonus)
    const extraRatio = (value - skill.reqValue) / skill.reqValue;
    const diminishingBonus = baseBenchmarkPoints * 0.35 * Math.log2(1 + extraRatio);
    return Math.round((baseBenchmarkPoints + diminishingBonus) * 10) / 10;
}

/**
 * NEXT-STEP RECOMMENDER:
 * Finds the direct evolution node in the tree first; if none exists,
 * falls back to the next hardest skill in the category.
 */
export function getNextStepSkill(skillId: string): SkillNode | null {
    const current = SKILL_MAP.get(skillId);
    if (!current) return null;

    // 1. Direct children in tree branch (e.g., Push-Up -> Diamond Push-Up)
    const directChildren = SKILLS
        .filter(s => s.parentId === current.id)
        .sort((a, b) => a.diff - b.diff);

    if (directChildren.length > 0) {
        return directChildren[0];
    }

    // 2. Fallback: closest harder skill in the same overall category
    const categoryHarder = SKILLS
        .filter(s => s.category === current.category && s.diff > current.diff)
        .sort((a, b) => a.diff - b.diff);

    return categoryHarder[0] || null;
}
