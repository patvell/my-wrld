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
export function pastelizeHex(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return "#F0EDE8";

    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    if (luminance < 0.08) {
        return "#E8E6E3";
    }

    const washed = mixWithWhite(hex, 0.75);
    return desaturateHex(washed, 0.15);
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

/** Approximate the perceived background after layering pastel washes on off-white. */
export function getEffectiveBackground(washColors: string[]): string {
    if (washColors.length === 0) return LIGHT_BASE;

    let blended = LIGHT_BASE;
    for (const color of washColors) {
        blended = blendHex(blended, color, 0.22);
    }
    return blended;
}
