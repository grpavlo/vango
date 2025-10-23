import { themeTokens, typography } from "./designSystem";

const defaultTheme = themeTokens.light;

export const Colors = {
    mainBlue: defaultTheme.primary,
    mainYellow: "#007AFF",
    white: defaultTheme.cardBackground,
    blackText: defaultTheme.textPrimary,
    mainRed: defaultTheme.destructive,
    mainGreen: defaultTheme.primary,
    lightGreen: "#E8F5E9",
    lightGray: defaultTheme.border,
    darkGray: "#1F2937"
};

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
