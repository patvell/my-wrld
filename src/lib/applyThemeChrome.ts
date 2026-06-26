import { CountryTheme } from "@/types/countryTheme";

/** Push theme chrome colors to CSS variables and browser UI (no React re-render). */
export function applyThemeChrome(theme: CountryTheme) {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    root.style.setProperty("--country-chrome", theme.chromeColor);
    root.style.setProperty("--dynamic-background", theme.themeColor);
    root.style.backgroundColor = theme.themeColor;
    document.body.style.backgroundColor = theme.themeColor;

    let metaThemeColor = document.querySelector(
        'meta[name="theme-color"]'
    ) as HTMLMetaElement | null;

    if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.name = "theme-color";
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = theme.themeColor;
}
