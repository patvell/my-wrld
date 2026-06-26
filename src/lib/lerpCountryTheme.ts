import { blendHex } from "@/lib/colors";
import { CountryTheme } from "@/types/countryTheme";

/** Interpolate UI-facing theme fields for synchronized transitions. */
export function lerpCountryTheme(
    from: CountryTheme,
    to: CountryTheme,
    progress: number
): CountryTheme {
    const t = Math.max(0, Math.min(1, progress));

    if (t === 0) return from;
    if (t === 1) return to;

    return {
        ...to,
        washColors: to.washColors,
        sourceColors: to.sourceColors,
        blobConfigs: to.blobConfigs,
        gradientAngle: from.gradientAngle + (to.gradientAngle - from.gradientAngle) * t,
        secondaryAngle: from.secondaryAngle + (to.secondaryAngle - from.secondaryAngle) * t,
        contentVeil: from.contentVeil + (to.contentVeil - from.contentVeil) * t,
        baseTint: blendHex(from.baseTint, to.baseTint, t),
        chromeColor: blendHex(from.chromeColor, to.chromeColor, t),
        atmosphereColor: blendHex(from.atmosphereColor, to.atmosphereColor, t),
        themeColor: blendHex(from.themeColor, to.themeColor, t),
        effectiveBg: blendHex(from.effectiveBg, to.effectiveBg, t),
        accent: blendHex(from.accent, to.accent, t),
    };
}
