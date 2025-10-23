import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { setStatusBarBackgroundColor, setStatusBarStyle } from "expo-status-bar";
import {
    THEME_OPTIONS,
    THEME_PREFERENCE_STORAGE_KEY,
    typography,
    spacing,
    radii,
    getThemeTokens
} from "../utils/designSystem";

let cachedPreference = "auto";
const preferenceListeners = new Set();

let navigationBarModule;
try {
    // Lazy-load to keep web bundles lean and avoid crashes if the module is unavailable
    navigationBarModule = require("expo-navigation-bar");
} catch (error) {
    navigationBarModule = null;
}

let systemUiModule;
try {
    systemUiModule = require("expo-system-ui");
} catch (error) {
    systemUiModule = null;
}

const notifyPreferenceChange = (value) => {
    preferenceListeners.forEach((listener) => listener(value));
};

const ThemeContext = createContext({
    theme: "light",
    preference: "auto",
    tokens: getThemeTokens("light"),
    typography,
    spacing,
    radii,
    setThemePreference: () => Promise.resolve(),
    isReady: false
});

export const ThemeProvider = ({ children }) => {
    const colorScheme = useColorScheme();
    const [preference, setPreference] = useState(cachedPreference);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const storedPreference = await SecureStore.getItemAsync(THEME_PREFERENCE_STORAGE_KEY);
                if (storedPreference && THEME_OPTIONS.includes(storedPreference) && isMounted) {
                    cachedPreference = storedPreference;
                    setPreference(storedPreference);
                }
            } catch (error) {
                console.log("Theme preference load error:", error);
            } finally {
                if (isMounted) {
                    setIsReady(true);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const handlePreferenceChange = (value) => {
            cachedPreference = value;
            setPreference((current) => (current === value ? current : value));
        };

        preferenceListeners.add(handlePreferenceChange);
        return () => {
            preferenceListeners.delete(handlePreferenceChange);
        };
    }, []);

    const resolvedTheme = preference === "auto"
        ? (colorScheme === "dark" ? "dark" : "light")
        : preference;

    const tokens = useMemo(() => getThemeTokens(resolvedTheme), [resolvedTheme]);

    useEffect(() => {
        if (!isReady) {
            return;
        }

        const statusBarStyle = resolvedTheme === "dark" ? "light" : "dark";

        try {
            setStatusBarStyle(statusBarStyle, true);
            if (Platform.OS === "android") {
                setStatusBarBackgroundColor(tokens.background, true);
            }
        } catch (error) {
            console.log("Status bar update error:", error);
        }

        if (systemUiModule?.setBackgroundColorAsync) {
            systemUiModule.setBackgroundColorAsync(tokens.background).catch((error) => {
                console.log("System UI background update error:", error);
            });
        }

        if (Platform.OS === "android" && navigationBarModule) {
            const applyNavigationBarTheme = async () => {
                try {
                    const backgroundColor = tokens.navBackground || tokens.background || "#000000";
                    await navigationBarModule.setBackgroundColorAsync(backgroundColor);
                    await navigationBarModule.setButtonStyleAsync(statusBarStyle);
                    if (navigationBarModule.setBorderColorAsync) {
                        await navigationBarModule.setBorderColorAsync("transparent");
                    }
                    if (navigationBarModule.setBehaviorAsync) {
                        await navigationBarModule.setBehaviorAsync("overlay-swipe");
                    }
                } catch (error) {
                    console.log("Navigation bar update error:", error);
                }
            };

            applyNavigationBarTheme();
        }
    }, [isReady, resolvedTheme, tokens]);

    const setThemePreference = useCallback(async (value) => {
        if (!THEME_OPTIONS.includes(value)) {
            return;
        }

        cachedPreference = value;
        setPreference(value);
        try {
            await SecureStore.setItemAsync(THEME_PREFERENCE_STORAGE_KEY, value);
        } catch (error) {
            console.log("Theme preference save error:", error);
        }
        notifyPreferenceChange(value);
    }, []);

    const contextValue = useMemo(() => ({
        theme: resolvedTheme,
        preference,
        tokens,
        typography,
        spacing,
        radii,
        setThemePreference,
        isReady
    }), [preference, resolvedTheme, tokens, setThemePreference, isReady]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useDesignSystem = () => useContext(ThemeContext);
