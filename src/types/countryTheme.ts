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
}
