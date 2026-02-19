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

export function getLuminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function getContrastColor(hex: string): "black" | "white" {
    const rgb = hexToRgb(hex);
    if (!rgb) return "white"; // Default to white if invalid hex
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    return luminance > 0.5 ? "black" : "white";
}

/**
 * Returns the hex code for the text color that contrasts best with the given background hex.
 * @param bgHex Background hex color
 * @returns "#000000" or "#FFFFFF"
 */
export function getContrastHex(bgHex: string): string {
    return getContrastColor(bgHex) === "black" ? "#000000" : "#FFFFFF";
}
