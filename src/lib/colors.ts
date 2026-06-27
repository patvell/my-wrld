export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getLuminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function getLuminanceFromHex(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return getLuminance(rgb.r, rgb.g, rgb.b);
}

export function getContrastColor(hex: string): "black" | "white" {
    const rgb = hexToRgb(hex);
    if (!rgb) return "white";
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    return luminance > 0.55 ? "black" : "white";
}

/**
 * Returns the hex code for the text color that contrasts best with the given background hex.
 */
export function getContrastHex(bgHex: string): string {
    return getContrastColor(bgHex) === "black" ? "#1a1a1a" : "#FFFFFF";
}

export function isLightBackground(bgHex: string): boolean {
    return getContrastColor(bgHex) === "black";
}

/** Consistent readable text tones for UI over country gradient backgrounds. */
export function getReadableTextColors(effectiveBg: string) {
    const light = isLightBackground(effectiveBg);
    return {
        primary: light ? "#171717" : "#FFFFFF",
        secondary: light ? "rgba(23, 23, 23, 0.62)" : "rgba(255, 255, 255, 0.72)",
        muted: light ? "rgba(23, 23, 23, 0.45)" : "rgba(255, 255, 255, 0.5)",
        onFrosted: "#FFFFFF",
    };
}

export function mixWithWhite(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return "#F8F6F3";
    const t = Math.max(0, Math.min(1, amount));
    return rgbToHex(
        rgb.r + (255 - rgb.r) * t,
        rgb.g + (255 - rgb.g) * t,
        rgb.b + (255 - rgb.b) * t
    );
}

export function desaturateHex(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = Math.max(0, Math.min(1, amount));
    const grey = rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
    return rgbToHex(
        rgb.r + (grey - rgb.r) * t,
        rgb.g + (grey - rgb.g) * t,
        rgb.b + (grey - rgb.b) * t
    );
}

/** Soft pastel wash for light liquid backgrounds. Black becomes warm grey. */
export function pastelizeHex(hex: string, whiteMix = 0.75): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return "#F0EDE8";

    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    if (luminance < 0.08) {
        return "#E8E6E3";
    }

    const washed = mixWithWhite(hex, whiteMix);
    return desaturateHex(washed, 0.1);
}

/** Richer pastel for background washes — light but visibly tinted. */
export function pastelizeForBackground(hex: string): string {
    return pastelizeHex(hex, 0.64);
}

export function darkenHex(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = Math.max(0, Math.min(1, amount));
    return rgbToHex(rgb.r * (1 - t), rgb.g * (1 - t), rgb.b * (1 - t));
}

export function isNeutralFlagColor(hex: string): boolean {
    const lum = getLuminanceFromHex(hex);
    const rgb = hexToRgb(hex);
    if (!rgb) return true;
    const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
    return lum > 0.88 || spread < 18;
}

export function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(248, 246, 243, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getColorIntensity(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    return (max - min) / 255;
}

export function blendHex(a: string, b: string, ratio: number): string {
    const rgbA = hexToRgb(a);
    const rgbB = hexToRgb(b);
    if (!rgbA || !rgbB) return a;
    const t = Math.max(0, Math.min(1, ratio));
    return rgbToHex(
        rgbA.r + (rgbB.r - rgbA.r) * t,
        rgbA.g + (rgbB.g - rgbA.g) * t,
        rgbA.b + (rgbB.b - rgbA.b) * t
    );
}

const LIGHT_BASE = "#F8F6F3";

/** Approximate perceived background at the content zone (where clock/text sits). */
export function getEffectiveBackground(washColors: string[], contentVeil = 0.44): string {
    if (washColors.length === 0) return LIGHT_BASE;

    let blended = blendHex(LIGHT_BASE, washColors[0], 0.12);
    if (washColors[1]) blended = blendHex(blended, washColors[1], 0.14);
    if (washColors[2]) blended = blendHex(blended, washColors[2], 0.1);

    return blendHex(blended, LIGHT_BASE, contentVeil * 0.85);
}
