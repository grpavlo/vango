import { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar, setStatusBarBackgroundColor, setStatusBarStyle } from "expo-status-bar";
import { isEdgeToEdge } from "react-native-is-edge-to-edge";
import { useDesignSystem } from "../context/ThemeContext";

let navigationBarModule;
try {
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

const ThemeSystemBridge = () => {
    const { tokens, theme, isReady } = useDesignSystem();
    const statusBarStyle = theme === "dark" ? "light" : "dark";

    useEffect(() => {
        if (!isReady) {
            return;
        }

        try {
            setStatusBarStyle(statusBarStyle, true);
            if (Platform.OS === "android") {
                setStatusBarBackgroundColor(tokens.background, true);
            }
        } catch (error) {
            console.log("Status bar sync error:", error);
        }

        if (systemUiModule?.setBackgroundColorAsync) {
            systemUiModule.setBackgroundColorAsync(tokens.background).catch((error) => {
                console.log("System UI sync error:", error);
            });
        }

        if (Platform.OS === "android" && navigationBarModule) {
            const applyNavigationBarTheme = async () => {
                const edgeToEdgeEnabled = isEdgeToEdge();
                const navStyle = theme === "dark" ? "dark" : "light";

                try {
                    if (edgeToEdgeEnabled) {
                        if (navigationBarModule.setStyle) {
                            navigationBarModule.setStyle(navStyle);
                        } else if (navigationBarModule.setButtonStyleAsync) {
                            await navigationBarModule.setButtonStyleAsync(navStyle === "dark" ? "light" : "dark");
                        }
                        return;
                    }

                    const backgroundColor = tokens.navBackground || tokens.background || "#000000";
                    await navigationBarModule.setBackgroundColorAsync(backgroundColor);
                    await navigationBarModule.setButtonStyleAsync(navStyle === "dark" ? "light" : "dark");

                    if (navigationBarModule.setBorderColorAsync) {
                        await navigationBarModule.setBorderColorAsync("transparent");
                    }

                    if (navigationBarModule.setBehaviorAsync) {
                        await navigationBarModule.setBehaviorAsync("overlay-swipe");
                    }
                } catch (error) {
                    console.log("Navigation bar sync error:", error);
                }
            };

            applyNavigationBarTheme();
        }
    }, [isReady, statusBarStyle, theme, tokens]);

    return <StatusBar style={statusBarStyle} backgroundColor={tokens.background} animated />;
};

export default ThemeSystemBridge;
