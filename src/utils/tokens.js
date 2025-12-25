import { useMemo } from "react";
import { useDesignSystem } from "../context/ThemeContext";
import { themeTokens, typography } from "./designSystem";

const withAlpha = (hex, alpha) => {
    if (typeof hex !== "string" || !hex.startsWith("#")) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

export const createColorsFromTokens = (tokens = themeTokens.light) => ({
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground || "#FFFFFF",
    destructive: tokens.destructive,
    destructiveForeground: tokens.destructiveForeground || "#FFFFFF",
    background: tokens.background,
    surface: tokens.cardBackground,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    textMuted: tokens.textMuted || withAlpha(tokens.textPrimary, "80"),
    border: tokens.border,
    outline: tokens.outline,
    mutedBackground: tokens.mutedBackground,
    mainBlue: tokens.primary,
    mainYellow: "#007AFF",
    white: tokens.cardBackground,
    blackText: tokens.textPrimary,
    mainRed: tokens.destructive,
    mainGreen: tokens.primary,
    lightGreen: withAlpha(tokens.primary, "20"),
    lightGray: tokens.border,
    darkGray: tokens.textSecondary || "#1F2937"
});

export const useThemeColors = () => {
    const { tokens } = useDesignSystem();
    return useMemo(() => createColorsFromTokens(tokens), [tokens]);
};

export const Colors = createColorsFromTokens(themeTokens.light);

export const Fonts = {
    f10: typography.sizes.micro,
    f12: typography.sizes.caption,
    f14: typography.sizes.label,
    f16: typography.sizes.body,
    f18: typography.sizes.subtitle,
    f20: typography.sizes.title,
    f23: 23,
    f28: typography.sizes.display,
    f32: typography.sizes.hero,
    f36: 36,
    f42: 42
};

export { withAlpha };
