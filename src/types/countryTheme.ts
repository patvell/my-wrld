export interface FlagPalette {
    colors: string[];
    accent?: string;
}

export interface LiquidBlobConfig {
    color: string;
    top: number;
    left: number;
    size: number;
    opacity: number;
    duration: number;
    delay: number;
}

export interface CountryTheme {
    countryIso: string;
    sourceColors: string[];
    washColors: string[];
    accent: string;
    themeColor: string;
    effectiveBg: string;
    baseTint: string;
    gradientAngle: number;
    secondaryAngle: number;
    blobConfigs: LiquidBlobConfig[];
    /** 0–1 white veil strength over the content zone for legibility */
    contentVeil: number;
}
