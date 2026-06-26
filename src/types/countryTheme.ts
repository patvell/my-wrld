export interface FlagPalette {
    colors: string[];
    accent?: string;
}

export interface CountryTheme {
    countryIso: string;
    sourceColors: string[];
    washColors: string[];
    accent: string;
    themeColor: string;
    effectiveBg: string;
    /** Unique gradient angle per country (degrees). */
    gradientAngle: number;
    /** Per-blob position offsets (percent) derived from country code. */
    blobOffsets: { top: number; left: number }[];
}
