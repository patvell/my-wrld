import { AIRPORTS } from "@/data/airports";
import { FLAG_PALETTES } from "@/data/flagPalettes";
import {
    blendHex,
    getEffectiveBackground,
    getLuminanceFromHex,
    mixWithWhite,
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
    return result.slice(0, 3);
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

function buildTheme(countryIso: string, palette: FlagPalette): CountryTheme {
    const sourceColors = uniqueColors(palette.colors);
    const washColors = sourceColors.map(pastelizeHex);
  while (washColors.length < 3) {
        washColors.push(washColors[washColors.length - 1] ?? LIGHT_BASE);
    }

    const accent = pickAccent(sourceColors, palette.accent);
    const effectiveBg = getEffectiveBackground(washColors);
    const themeColor = blendHex(LIGHT_BASE, washColors[0], 0.35);

    return {
        countryIso,
        sourceColors,
        washColors,
        accent,
        themeColor,
        effectiveBg,
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
