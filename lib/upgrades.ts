// lib/upgrades.ts
import { toPng } from "html-to-image";

/**
 * 1. True 1RM & Relative Strength Calculator for Calisthenics
 * Uses an adapted Epley/Brzycki formula accounting for total system mass (BW + ballast).
 */
export function computeCalisthenics1RM(bodyweightKg: number, ballastKg: number, reps: number) {
    if (reps <= 0) return { totalLoad: bodyweightKg, est1RM: ballastKg, relativeRatio: 1.0 };
    if (reps === 1) {
        const total = bodyweightKg + ballastKg;
        return {
            totalLoad: total,
            est1RM: ballastKg,
            relativeRatio: Number((total / bodyweightKg).toFixed(2)),
        };
    }

    const totalMass = bodyweightKg + ballastKg;
    // Total 1RM system mass moved
    const estTotal1RM = totalMass * (1 + reps / 30);
    // Ballast equivalent at 1RM
    const estBallast1RM = Math.max(0, estTotal1RM - bodyweightKg);
    const relativeRatio = Number((estTotal1RM / bodyweightKg).toFixed(2));

    return {
        totalLoad: Number(totalMass.toFixed(1)),
        est1RM: Number(estBallast1RM.toFixed(1)),
        relativeRatio,
    };
}

/**
 * 2. YouTube URL to Embed Converter
 */
export function getYouTubeEmbedUrl(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
}

/**
 * 3. Fighter Card PNG Exporter (Instagram / Discord ready)
 */
export async function exportFighterCardAsPng(elementId: string, athleteName: string) {
    const node = document.getElementById(elementId);
    if (!node) return;

    try {
        const dataUrl = await toPng(node, {
            cacheBust: true,
            pixelRatio: 3, // Crisp 3x retina resolution for high-end phones
            backgroundColor: "#0A0B0E",
        });

        const link = document.createElement("a");
        link.download = `${athleteName.toLowerCase().replace(/\s+/g, "_")}_fighter_card.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error("Failed to generate Fighter Card image", err);
    }
}