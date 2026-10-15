// lib/skills.ts
export interface SkillNode {
    id: string;
    category: "Pull" | "Push" | "Control" | "Core" | "Rings" | "Legs";
    name: string;
    parentId: string | null;
    reqValue: number;
    type: "iso" | "dyn"; // iso = hold time (seconds), dyn = repetitions
    tier: 1 | 2 | 3 | 4 | 5;
    diff: number;
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
    // 1. PULL
    { id: "pull_hang", category: "Pull", name: "Dead Hang", parentId: null, reqValue: 45, type: "iso", tier: 1, diff: 0.8 },
    { id: "pull_active_hang", category: "Pull", name: "Active Hang", parentId: "pull_hang", reqValue: 30, type: "iso", tier: 1, diff: 1.0 },
    { id: "pull_row", category: "Pull", name: "Inverted Row", parentId: "pull_active_hang", reqValue: 15, type: "dyn", tier: 1, diff: 1.2 },
    { id: "pull_scap", category: "Pull", name: "Scapular Pull-Up", parentId: "pull_active_hang", reqValue: 12, type: "dyn", tier: 1, diff: 1.4 },
    { id: "pull_std", category: "Pull", name: "Pull-Up", parentId: "pull_scap", reqValue: 10, type: "dyn", tier: 2, diff: 2.0 },
    { id: "pull_chin", category: "Pull", name: "Chin-Up", parentId: "pull_std", reqValue: 12, type: "dyn", tier: 2, diff: 1.8 },
    { id: "pull_c2b", category: "Pull", name: "Chest-to-Bar Pull-Up", parentId: "pull_std", reqValue: 6, type: "dyn", tier: 3, diff: 3.8 },
    { id: "pull_high", category: "Pull", name: "Explosive High Pull-Up", parentId: "pull_c2b", reqValue: 4, type: "dyn", tier: 4, diff: 5.5 },
    { id: "pull_muscleup", category: "Pull", name: "Bar Muscle-Up", parentId: "pull_high", reqValue: 3, type: "dyn", tier: 4, diff: 6.8 },
    { id: "pull_strict_mu", category: "Pull", name: "Strict Bar Muscle-Up", parentId: "pull_muscleup", reqValue: 5, type: "dyn", tier: 5, diff: 9.5 },
    { id: "pull_slow_mu", category: "Pull", name: "Slow Tempo Muscle-Up", parentId: "pull_strict_mu", reqValue: 2, type: "dyn", tier: 5, diff: 13.0 },
    { id: "pull_fl_tuck", category: "Pull", name: "Tuck Front Lever", parentId: "pull_std", reqValue: 15, type: "iso", tier: 3, diff: 4.2 },
    { id: "pull_fl_adv", category: "Pull", name: "Adv Tuck Front Lever", parentId: "pull_fl_tuck", reqValue: 12, type: "iso", tier: 4, diff: 7.5 },
    { id: "pull_fl_straddle", category: "Pull", name: "Straddle Front Lever", parentId: "pull_fl_adv", reqValue: 7, type: "iso", tier: 5, diff: 12.5 },
    { id: "pull_fl_full", category: "Pull", name: "Front Lever", parentId: "pull_fl_straddle", reqValue: 5, type: "iso", tier: 5, diff: 15.0 },
    { id: "pull_fl_row", category: "Pull", name: "Front Lever Row", parentId: "pull_fl_full", reqValue: 3, type: "dyn", tier: 5, diff: 18.0 },
    { id: "pull_german_hang", category: "Pull", name: "German Hang", parentId: "pull_active_hang", reqValue: 30, type: "iso", tier: 2, diff: 2.0 },
    { id: "pull_bl_tuck", category: "Pull", name: "Tuck Back Lever", parentId: "pull_german_hang", reqValue: 15, type: "iso", tier: 3, diff: 3.5 },
    { id: "pull_bl_adv", category: "Pull", name: "Adv Tuck Back Lever", parentId: "pull_bl_tuck", reqValue: 12, type: "iso", tier: 3, diff: 5.5 },
    { id: "pull_bl_full", category: "Pull", name: "Back Lever", parentId: "pull_bl_adv", reqValue: 8, type: "iso", tier: 4, diff: 8.5 },
    { id: "pull_hefesto", category: "Pull", name: "Hefesto", parentId: "pull_bl_full", reqValue: 1, type: "dyn", tier: 5, diff: 19.0 },
    { id: "pull_archer", category: "Pull", name: "Archer Pull-Up", parentId: "pull_std", reqValue: 6, type: "dyn", tier: 4, diff: 6.0 },
    { id: "pull_oac", category: "Pull", name: "One-Arm Chin-Up", parentId: "pull_archer", reqValue: 1, type: "dyn", tier: 5, diff: 17.5 },

    // 2. PUSH
    { id: "push_knee", category: "Push", name: "Knee Push-Up", parentId: null, reqValue: 20, type: "dyn", tier: 1, diff: 0.6 },
    { id: "push_std", category: "Push", name: "Push-Up", parentId: "push_knee", reqValue: 25, type: "dyn", tier: 1, diff: 1.0 },
    { id: "push_diamond", category: "Push", name: "Diamond Push-Up", parentId: "push_std", reqValue: 18, type: "dyn", tier: 2, diff: 1.6 },
    { id: "push_decline", category: "Push", name: "Decline Push-Up", parentId: "push_std", reqValue: 15, type: "dyn", tier: 2, diff: 1.8 },
    { id: "push_dips", category: "Push", name: "Dips", parentId: "push_diamond", reqValue: 15, type: "dyn", tier: 2, diff: 2.2 },
    { id: "push_straight_bar_dip", category: "Push", name: "Straight Bar Dip", parentId: "push_dips", reqValue: 12, type: "dyn", tier: 3, diff: 3.2 },
    { id: "push_bulgarian_dip", category: "Push", name: "Bulgarian Dip", parentId: "push_dips", reqValue: 8, type: "dyn", tier: 3, diff: 4.5 },
    { id: "push_archer", category: "Push", name: "Archer Push-Up", parentId: "push_diamond", reqValue: 8, type: "dyn", tier: 3, diff: 3.5 },
    { id: "push_oap", category: "Push", name: "One-Arm Push-Up", parentId: "push_archer", reqValue: 3, type: "dyn", tier: 4, diff: 8.0 },
    { id: "push_planche_lean", category: "Push", name: "Planche Lean", parentId: "push_std", reqValue: 25, type: "iso", tier: 2, diff: 2.5 },
    { id: "push_frog_stand", category: "Push", name: "Frog Stand", parentId: "push_planche_lean", reqValue: 30, type: "iso", tier: 2, diff: 2.0 },
    { id: "push_pseudo", category: "Push", name: "Pseudo Planche Push-Up", parentId: "push_planche_lean", reqValue: 10, type: "dyn", tier: 3, diff: 4.0 },
    { id: "push_planche_tuck", category: "Push", name: "Tuck Planche", parentId: "push_frog_stand", reqValue: 12, type: "iso", tier: 3, diff: 5.0 },
    { id: "push_planche_adv", category: "Push", name: "Adv Tuck Planche", parentId: "push_planche_tuck", reqValue: 10, type: "iso", tier: 4, diff: 9.0 },
    { id: "push_planche_straddle", category: "Push", name: "Straddle Planche", parentId: "push_planche_adv", reqValue: 6, type: "iso", tier: 5, diff: 14.0 },
    { id: "push_planche_full", category: "Push", name: "Full Planche", parentId: "push_planche_straddle", reqValue: 4, type: "iso", tier: 5, diff: 18.0 },
    { id: "push_planche_pushup", category: "Push", name: "Planche Push-Up", parentId: "push_planche_full", reqValue: 2, type: "dyn", tier: 5, diff: 22.0 },

    // 3. CONTROL
    { id: "hs_pike_hold", category: "Control", name: "Pike Hold", parentId: null, reqValue: 35, type: "iso", tier: 1, diff: 1.1 },
    { id: "hs_wall", category: "Control", name: "Wall Handstand", parentId: "hs_pike_hold", reqValue: 45, type: "iso", tier: 2, diff: 2.0 },
    { id: "hs_free", category: "Control", name: "Handstand", parentId: "hs_wall", reqValue: 20, type: "iso", tier: 3, diff: 4.8 },
    { id: "hs_press", category: "Control", name: "Press to Handstand", parentId: "hs_free", reqValue: 2, type: "dyn", tier: 4, diff: 8.5 },
    { id: "hs_oahs", category: "Control", name: "One-Arm Handstand", parentId: "hs_free", reqValue: 5, type: "iso", tier: 5, diff: 20.0 },
    { id: "hs_pike_pushup", category: "Control", name: "Pike Push-Up", parentId: "hs_pike_hold", reqValue: 12, type: "dyn", tier: 2, diff: 2.2 },
    { id: "hs_elevated_pike", category: "Control", name: "Elevated Pike Push-Up", parentId: "hs_pike_pushup", reqValue: 10, type: "dyn", tier: 3, diff: 3.5 },
    { id: "hs_wall_hspu", category: "Control", name: "Wall Handstand Push-Up", parentId: "hs_elevated_pike", reqValue: 6, type: "dyn", tier: 4, diff: 6.5 },
    { id: "hs_free_hspu", category: "Control", name: "Handstand Push-Up", parentId: "hs_free", reqValue: 3, type: "dyn", tier: 5, diff: 13.0 },
    { id: "hs_tiger_bend", category: "Control", name: "Tiger Bend HSPU", parentId: "hs_free_hspu", reqValue: 2, type: "dyn", tier: 5, diff: 16.0 },

    // 4. CORE & FLAGS
    { id: "core_plank", category: "Core", name: "Plank", parentId: null, reqValue: 60, type: "iso", tier: 1, diff: 0.8 },
    { id: "core_hollow", category: "Core", name: "Hollow Body Hold", parentId: "core_plank", reqValue: 45, type: "iso", tier: 1, diff: 1.3 },
    { id: "core_knee_raise", category: "Core", name: "Hanging Knee Raise", parentId: "core_hollow", reqValue: 15, type: "dyn", tier: 1, diff: 1.2 },
    { id: "core_leg_raise", category: "Core", name: "Hanging Leg Raise", parentId: "core_knee_raise", reqValue: 12, type: "dyn", tier: 2, diff: 2.2 },
    { id: "core_toes_to_bar", category: "Core", name: "Toes-to-Bar", parentId: "core_leg_raise", reqValue: 10, type: "dyn", tier: 2, diff: 3.0 },
    { id: "core_wipers", category: "Core", name: "Windshield Wipers", parentId: "core_toes_to_bar", reqValue: 10, type: "dyn", tier: 3, diff: 4.5 },
    { id: "core_lsit", category: "Core", name: "L-Sit", parentId: "core_hollow", reqValue: 15, type: "iso", tier: 2, diff: 2.8 },
    { id: "core_vsit", category: "Core", name: "V-Sit", parentId: "core_lsit", reqValue: 10, type: "iso", tier: 3, diff: 6.0 },
    { id: "core_manna", category: "Core", name: "Manna", parentId: "core_vsit", reqValue: 3, type: "iso", tier: 5, diff: 21.0 },
    { id: "core_dragon_neg", category: "Core", name: "Dragon Flag Negative", parentId: "core_hollow", reqValue: 5, type: "dyn", tier: 2, diff: 2.5 },
    { id: "core_dragon_flag", category: "Core", name: "Dragon Flag", parentId: "core_dragon_neg", reqValue: 6, type: "dyn", tier: 3, diff: 5.0 },
    { id: "core_flag_tuck", category: "Core", name: "Tuck Human Flag", parentId: "core_dragon_flag", reqValue: 10, type: "iso", tier: 3, diff: 5.5 },
    { id: "core_flag_straddle", category: "Core", name: "Straddle Human Flag", parentId: "core_flag_tuck", reqValue: 6, type: "iso", tier: 4, diff: 9.5 },
    { id: "core_flag_full", category: "Core", name: "Human Flag", parentId: "core_flag_straddle", reqValue: 5, type: "iso", tier: 5, diff: 14.5 },

    // 5. RINGS
    { id: "rings_support", category: "Rings", name: "Ring Support Hold", parentId: "push_dips", reqValue: 30, type: "iso", tier: 2, diff: 2.0 },
    { id: "rings_rto_support", category: "Rings", name: "RTO Support Hold", parentId: "rings_support", reqValue: 20, type: "iso", tier: 3, diff: 4.0 },
    { id: "rings_dip", category: "Rings", name: "Ring Dip", parentId: "rings_support", reqValue: 10, type: "dyn", tier: 3, diff: 3.8 },
    { id: "rings_rto_dip", category: "Rings", name: "RTO Ring Dip", parentId: "rings_dip", reqValue: 6, type: "dyn", tier: 4, diff: 6.5 },
    { id: "rings_muscle_up", category: "Rings", name: "Ring Muscle-Up", parentId: "rings_dip", reqValue: 3, type: "dyn", tier: 4, diff: 8.5 },
    { id: "rings_pelican", category: "Rings", name: "Ring Pelican Curl", parentId: "rings_dip", reqValue: 3, type: "dyn", tier: 5, diff: 12.0 },
    { id: "rings_iron_cross", category: "Rings", name: "Iron Cross", parentId: "rings_rto_support", reqValue: 4, type: "iso", tier: 5, diff: 22.0 },
    { id: "rings_maltese", category: "Rings", name: "Maltese", parentId: "rings_iron_cross", reqValue: 3, type: "iso", tier: 5, diff: 25.0 },

    // 6. LEGS
    { id: "legs_squat", category: "Legs", name: "Air Squat", parentId: null, reqValue: 30, type: "dyn", tier: 1, diff: 0.6 },
    { id: "legs_horse_stance", category: "Legs", name: "Horse Stance", parentId: "legs_squat", reqValue: 45, type: "iso", tier: 1, diff: 1.2 },
    { id: "legs_cossack", category: "Legs", name: "Cossack Squat", parentId: "legs_squat", reqValue: 12, type: "dyn", tier: 2, diff: 1.5 },
    { id: "legs_pistol_assisted", category: "Legs", name: "Assisted Pistol Squat", parentId: "legs_cossack", reqValue: 8, type: "dyn", tier: 2, diff: 2.0 },
    { id: "legs_pistol", category: "Legs", name: "Pistol Squat", parentId: "legs_pistol_assisted", reqValue: 8, type: "dyn", tier: 3, diff: 3.8 },
    { id: "legs_dragon_squat", category: "Legs", name: "Dragon Squat", parentId: "legs_pistol", reqValue: 4, type: "dyn", tier: 4, diff: 6.0 },
    { id: "legs_nordic_neg", category: "Legs", name: "Nordic Curl Negative", parentId: "legs_squat", reqValue: 5, type: "dyn", tier: 2, diff: 2.8 },
    { id: "legs_nordic", category: "Legs", name: "Nordic Curl", parentId: "legs_nordic_neg", reqValue: 3, type: "dyn", tier: 4, diff: 7.5 }
];

export const SKILL_MAP = new Map(SKILLS.map(s => [s.id, s]));

/**
 * NEXT-STEP RECOMMENDER:
 * Finds the immediate next hardest exercise in the same branch by difficulty.
 */
export function getNextStepSkill(skillId: string): SkillNode | null {
    const current = SKILL_MAP.get(skillId);
    if (!current) return null;

    const branchSkills = SKILLS
        .filter(s => s.category === current.category && s.diff > current.diff)
        .sort((a, b) => a.diff - b.diff);

    return branchSkills[0] || null;
}