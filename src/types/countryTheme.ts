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
    /** Saturated country color for UI chrome (buttons, etc.) */
    chromeColor: string;
    /** Soft wash blend for globe atmosphere */
    atmosphereColor: string;
    themeColor: string;
    effectiveBg: string;
    baseTint: string;
    gradientAngle: number;
    secondaryAngle: number;
    blobConfigs: LiquidBlobConfig[];
    /** 0–1 white veil strength over the content zone for legibility */
    contentVeil: number;
}
