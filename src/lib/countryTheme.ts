import { AIRPORTS } from "@/data/airports";
import { FLAG_PALETTES } from "@/data/flagPalettes";
import {
    blendHex,
    darkenHex,
    getColorIntensity,
    getEffectiveBackground,
    getLuminanceFromHex,
    isNeutralFlagColor,
    mixWithWhite,
    pastelizeForBackground,
    pastelizeHex,
} from "@/lib/colors";
import { CountryTheme, FlagPalette, LiquidBlobConfig } from "@/types/countryTheme";

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

        const saturationProxy = Math.max(hexToChannelSpread(color), 0);
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

function tintedNeutralWash(chromatic: string[]): string {
    if (chromatic.length === 0) return "#EDEAE6";
    return blendHex("#EDEAE6", pastelizeForBackground(chromatic[0]), 0.4);
}

/** Build 3 distinct wash tones; dark/white stripes become tints of the chromatic colors. */
function buildWashColors(sourceColors: string[]): string[] {
    const unique = uniqueColors(sourceColors);
    const chromatic = unique.filter((c) => !isNeutralFlagColor(c));
    const hasDarkStripe = unique.some((c) => getLuminanceFromHex(c) < 0.08);
    const pool = chromatic.length > 0 ? chromatic : unique;

    let washes: string[];

    if (pool.length >= 3) {
        washes = pool.slice(0, 3).map(pastelizeForBackground);
    } else if (pool.length === 2) {
        washes = [
            pastelizeForBackground(pool[0]),
            pastelizeForBackground(pool[1]),
            pastelizeHex(pool[0], 0.7),
        ];
    } else {
        const base = pool[0] ?? DEFAULT_ACCENT;
        washes = [
            pastelizeForBackground(base),
            pastelizeForBackground(darkenHex(base, 0.1)),
            pastelizeHex(base, 0.72),
        ];
    }

    if (hasDarkStripe && chromatic.length > 0) {
        washes[0] = tintedNeutralWash(chromatic);
    }

    return washes;
}

function buildBlobConfigs(iso: string, washColors: string[]): LiquidBlobConfig[] {
    const hash = hashCountryIso(iso);
    const anchors = [
        { top: 8, left: 6 },
        { top: 22, left: 68 },
        { top: 64, left: 18 },
        { top: 48, left: 78 },
    ];

    return anchors.map((anchor, index) => {
        const color = washColors[index % washColors.length];
        const nudge = (shift: number) => ((hash >> shift) & 7) * 2.5 - 6;

        return {
            color,
            top: anchor.top + nudge(index * 3),
            left: anchor.left + nudge(index * 3 + 1),
            size: 44 + ((hash >> (index * 2)) & 15),
            opacity: 0.22 + (getColorIntensity(color) * 0.12),
            duration: 20 + ((hash >> (index + 2)) % 14),
            delay: index * 3 + (hash % 4),
        };
    });
}

function computeContentVeil(washColors: string[]): number {
    const intensity =
        washColors.reduce((sum, color) => sum + getColorIntensity(color), 0) /
        washColors.length;
    return Math.min(0.52, Math.max(0.36, 0.36 + intensity * 0.28));
}

function buildTheme(countryIso: string, palette: FlagPalette): CountryTheme {
    const sourceColors = uniqueColors(palette.colors);
    const washColors = buildWashColors(sourceColors);
    const hash = hashCountryIso(countryIso);
    const contentVeil = computeContentVeil(washColors);

    const accent = pickAccent(sourceColors, palette.accent);
    const effectiveBg = getEffectiveBackground(washColors, contentVeil);
    const baseTint = blendHex(LIGHT_BASE, washColors[0], 0.18);
    const themeColor = blendHex(LIGHT_BASE, washColors[1] ?? washColors[0], 0.38);
    const gradientAngle = 100 + (hash % 160);
    const secondaryAngle = (gradientAngle + 55 + (hash % 50)) % 360;
    const blobConfigs = buildBlobConfigs(countryIso, washColors);

    return {
        countryIso,
        sourceColors,
        washColors,
        accent,
        themeColor,
        effectiveBg,
        baseTint,
        gradientAngle,
        secondaryAngle,
        blobConfigs,
        contentVeil,
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
