export const THEME_PREFERENCE_STORAGE_KEY = "settingsThemePreference";

export const THEME_OPTIONS = ["light", "dark", "auto"];

export const THEME_LABELS = {
    light: "Light",
    dark: "Dark",
    auto: "Auto"
};

export const typography = {
    family: "Montserrat",
    sizes: {
        hero: 32,
        display: 28,
        title: 20,
        subtitle: 18,
        body: 16,
        button: 16,
        label: 14,
        caption: 12,
        micro: 10
    },
    weights: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700"
    }
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32
};

export const radii = {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 20,
    pill: 9999
};

export const themeTokens = {
    light: {
        background: "#FAFAFA",
        cardBackground: "#FFFFFF",
        cardForeground: "#171717",
        textPrimary: "#171717",
        textSecondary: "#667085",
        textMuted: "#98A2B3",
        textLabel: "#52525B",
        border: "#E5E7EB",
        outline: "#E2E8F0",
        mutedBackground: "#F4F4F5",
        inputBackground: "#F5F5F5",
        overlay: "rgba(12, 12, 34, 0.45)",
        primary: "#4CAF50",
        primaryForeground: "#FFFFFF",
        switchTrackOff: "#D0D5DD",
        switchThumb: "#FFFFFF",
        destructive: "#F04438",
        destructiveForeground: "#FFFFFF",
        badgeBackground: "#F04438",
        badgeText: "#FFFFFF",
        navBackground: "#FFFFFF",
        navBorder: "#E5E7EB",
        navActive: "#4CAF50",
        navInactive: "#667085",
        navShadow: "rgba(15, 23, 42, 0.12)",
        modalShadow: "rgba(15, 23, 42, 0.2)"
    },
    dark: {
        background: "#111111",
        cardBackground: "#1E1E1E",
        cardForeground: "#F2F2F2",
        textPrimary: "#F2F2F2",
        textSecondary: "#C1C8D1",
        textMuted: "#8E9196",
        textLabel: "#D1D5DB",
        border: "#2A2A2A",
        outline: "#2F3135",
        mutedBackground: "#1F2937",
        inputBackground: "#1F2937",
        overlay: "rgba(0, 0, 0, 0.65)",
        primary: "#4CAF50",
        primaryForeground: "#FFFFFF",
        switchTrackOff: "#3F3F46",
        switchThumb: "#E5E7EB",
        destructive: "#F04438",
        destructiveForeground: "#FFFFFF",
        badgeBackground: "#F04438",
        badgeText: "#FFFFFF",
        navBackground: "#151515",
        navBorder: "#242424",
        navActive: "#4CAF50",
        navInactive: "#98A2B3",
        navShadow: "rgba(0, 0, 0, 0.4)",
        modalShadow: "rgba(0, 0, 0, 0.5)"
    }
};

export const getThemeTokens = (themeKey = "light") =>
    themeTokens[themeKey] || themeTokens.light;
