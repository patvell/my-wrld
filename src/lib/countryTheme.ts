import { AIRPORTS } from "@/data/airports";
import { FLAG_PALETTES } from "@/data/flagPalettes";
import {
    blendHex,
    darkenHex,
    getEffectiveBackground,
    getLuminanceFromHex,
    isNeutralFlagColor,
    mixWithWhite,
    pastelizeForBackground,
    pastelizeHex,
} from "@/lib/colors";
import { CountryTheme, FlagPalette } from "@/types/countryTheme";

const LIGHT_BASE = "#F8F6F3";
const DEFAULT_ISO = "AE";
const DEFAULT_ACCENT = "#D71921";

function uniqueColors(colors: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const color of colors) {
        const key = color.toUpperCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(color);
        }
    }
    return result;
}

function hashCountryIso(iso: string): number {
    let hash = 0;
    for (let i = 0; i < iso.length; i++) {
        hash = (hash * 31 + iso.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function buildBlobOffsets(iso: string): { top: number; left: number }[] {
    const hash = hashCountryIso(iso);
    return [0, 1, 2].map((index) => ({
        top: ((hash >> (index * 3)) & 7) * 3 - 6,
        left: ((hash >> (index * 3 + 1)) & 7) * 3 - 8,
    }));
}

function deriveFallbackPalette(flagColor: string): FlagPalette {
    return {
        colors: uniqueColors([
            mixWithWhite(flagColor, 0.35),
            flagColor,
            mixWithWhite(flagColor, 0.55),
        ]),
    };
}

function pickAccent(sourceColors: string[], override?: string): string {
    if (override) return override;

    let best = sourceColors[0] ?? DEFAULT_ACCENT;
    let bestScore = -1;

    for (const color of sourceColors) {
        const luminance = getLuminanceFromHex(color);
        if (luminance < 0.12 || luminance > 0.92) continue;

        const saturationProxy = Math.max(
            Math.abs(hexToChannelSpread(color)),
            0
        );
        const score = saturationProxy * (1 - Math.abs(luminance - 0.45));
        if (score > bestScore) {
            bestScore = score;
            best = color;
        }
    }

    return best;
}

function hexToChannelSpread(hex: string): number {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return 0;
    const channels = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
    return Math.max(...channels) - Math.min(...channels);
}

/** Build 3 distinct wash tones, skipping white/grey stripes that flatten every country. */
function buildWashColors(sourceColors: string[]): string[] {
    const chromatic = uniqueColors(sourceColors).filter((c) => !isNeutralFlagColor(c));
    const pool = chromatic.length > 0 ? chromatic : uniqueColors(sourceColors);

    if (pool.length >= 3) {
        return pool.slice(0, 3).map(pastelizeForBackground);
    }

    if (pool.length === 2) {
        return [
            pastelizeForBackground(pool[0]),
            pastelizeForBackground(pool[1]),
            pastelizeForBackground(blendHex(pool[0], pool[1], 0.5)),
        ];
    }

    const base = pool[0] ?? DEFAULT_ACCENT;
    return [
        pastelizeForBackground(base),
        pastelizeForBackground(darkenHex(base, 0.12)),
        pastelizeHex(base, 0.68),
    ];
}

function buildTheme(countryIso: string, palette: FlagPalette): CountryTheme {
    const sourceColors = uniqueColors(palette.colors);
    const washColors = buildWashColors(sourceColors);
    const hash = hashCountryIso(countryIso);

    const accent = pickAccent(sourceColors, palette.accent);
    const effectiveBg = getEffectiveBackground(washColors);
    const themeColor = blendHex(LIGHT_BASE, washColors[1] ?? washColors[0], 0.42);
    const gradientAngle = 110 + (hash % 140);

    return {
        countryIso,
        sourceColors,
        washColors,
        accent,
        themeColor,
        effectiveBg,
        gradientAngle,
        blobOffsets: buildBlobOffsets(countryIso),
    };
}

const themeCache = new Map<string, CountryTheme>();

export function getCountryTheme(airportCode: string): CountryTheme {
    const airport = AIRPORTS[airportCode];
    const countryIso = airport?.countryIso ?? DEFAULT_ISO;

    const cached = themeCache.get(countryIso);
    if (cached) return cached;

    const palette =
        FLAG_PALETTES[countryIso] ??
        deriveFallbackPalette(airport?.flagColor ?? DEFAULT_ACCENT);

    const theme = buildTheme(countryIso, palette);
    themeCache.set(countryIso, theme);
    return theme;
}

export function getAirportColor(code: string): string {
    return getCountryTheme(code).accent;
}
