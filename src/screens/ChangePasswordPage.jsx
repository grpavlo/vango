import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { serverUrlApi } from "../const/api";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";
import { useAppAlert } from "../hooks/useAppAlert";

const createStyles = ({ tokens, spacing, radii, typography }) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: tokens.background
        },
        scrollContent: {
            paddingHorizontal: spacing.base,
            paddingTop: 0,
            paddingBottom: spacing.xxl
        },
        topPanel: {
            backgroundColor: tokens.cardBackground,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.base,
            marginHorizontal: -spacing.base,
            marginBottom: spacing.base,
            borderBottomWidth: 1,
            borderBottomColor: tokens.border
        },
        header: {
            flexDirection: "row",
            alignItems: "center"
        },
        headerLeft: {
            flexDirection: "row",
            alignItems: "center"
        },
        backButton: {
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xs,
            borderRadius: radii.md
        },
        headerTitle: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.primary,
            marginLeft: spacing.sm
        },
        formCard: {
            backgroundColor: "transparent",
            borderRadius: 0,
            borderWidth: 0,
            borderColor: "transparent",
            padding: spacing.base,
            shadowColor: "transparent",
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: 0
        },
        fieldGroup: {
            marginBottom: spacing.lg
        },
        fieldLabel: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginBottom: spacing.xs
        },
        inputWrapper: {
            position: "relative"
        },
        input: {
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radii.md,
            backgroundColor: tokens.inputBackground,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.base,
            paddingRight: spacing.xl,
            fontSize: typography.sizes.body,
            color: tokens.textPrimary
        },
        eyeButton: {
            position: "absolute",
            right: spacing.sm,
            top: "50%",
            marginTop: -16,
            height: 32,
            width: 32,
            alignItems: "center",
            justifyContent: "center"
        },
        errorText: {
            fontSize: typography.sizes.caption,
            color: tokens.destructive,
            marginTop: spacing.xs / 1.5
        },
        submitButton: {
            marginTop: spacing.base,
            backgroundColor: tokens.primary,
            borderRadius: radii.md,
            paddingVertical: spacing.md,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: spacing.sm
        },
        submitButtonDisabled: {
            backgroundColor: `${tokens.primary}30`
        },
        submitLabel: {
            fontSize: typography.sizes.button,
            fontWeight: typography.weights.semibold,
            color: tokens.primaryForeground,
            letterSpacing: 0.5
        },
        helperText: {
            fontSize: typography.sizes.caption,
            color: tokens.textSecondary,
            marginTop: spacing.sm
        }
    });

const ChangePasswordPageContent = ({ navigation }) => {
    const { tokens, spacing, radii, typography } = useDesignSystem();
    const styles = useMemo(
        () => createStyles({ tokens, spacing, radii, typography }),
        [tokens, spacing, radii, typography]
    );
    const { showAlert } = useAppAlert();

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState("");

    const validate = () => {
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            setFormError("Please complete all fields before submitting.");
            return false;
        }
        if (newPassword !== confirmNewPassword) {
            setFormError("New password and confirmation must match.");
            return false;
        }
        if (newPassword.length < 8) {
            setFormError("Password must be at least 8 characters long.");
            return false;
        }
        setFormError("");
        return true;
    };

    const handleSubmit = async () => {
        if (!validate()) {
            return;
        }

        setIsLoading(true);

        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                showAlert({
                    title: "Authentication Error",
                    message: "Session expired. Please sign in again.",
                    variant: "error",
                });
                setIsLoading(false);
                return;
            }

            const response = await fetch(`${serverUrlApi}users/me/password`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword
                })
            });

            if (response.ok) {
                showAlert({
                    title: "Password Updated",
                    message: "Your password was updated successfully.",
                    variant: "success",
                });
                setOldPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
            } else {
                const errorData = await response.json();
                showAlert({
                    title: "Update Failed",
                    message: errorData?.message || "Unable to update password.",
                    variant: "error",
                });
            }
        } catch (error) {
            showAlert({
                title: "Unexpected Error",
                message: "Something went wrong. Please try again.",
                variant: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const showBackButton = navigation?.canGoBack?.();
    const disableSubmit =
        isLoading ||
        !oldPassword ||
        !newPassword ||
        !confirmNewPassword ||
        newPassword !== confirmNewPassword;

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.topPanel}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            {showBackButton && (
                                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                                    <Ionicons name="chevron-back" size={20} color={tokens.textSecondary} />
                                </TouchableOpacity>
                            )}
                            <Text style={styles.headerTitle}>Settings</Text>
                        </View>
                    </View>
                    {/* <Text style={styles.headerSubtitle}>Update your login password.</Text> */}
                </View>

                <View style={styles.formCard}>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Old password</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={oldPassword}
                                onChangeText={setOldPassword}
                                secureTextEntry={!showOldPassword}
                                placeholder="Enter your current password"
                                placeholderTextColor={tokens.textMuted}
                                style={styles.input}
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="password"
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowOldPassword((prev) => !prev)}
                            >
                                <Ionicons
                                    name={showOldPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={tokens.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>New password</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNewPassword}
                                placeholder="Create a new password"
                                placeholderTextColor={tokens.textMuted}
                                style={styles.input}
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="newPassword"
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowNewPassword((prev) => !prev)}
                            >
                                <Ionicons
                                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={tokens.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Confirm new password</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={confirmNewPassword}
                                onChangeText={setConfirmNewPassword}
                                secureTextEntry={!showConfirmNewPassword}
                                placeholder="Re-enter new password"
                                placeholderTextColor={tokens.textMuted}
                                style={styles.input}
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="newPassword"
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowConfirmNewPassword((prev) => !prev)}
                            >
                                <Ionicons
                                    name={showConfirmNewPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={tokens.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!!formError && <Text style={styles.errorText}>{formError}</Text>}

                    <TouchableOpacity
                        style={[styles.submitButton, disableSubmit && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={disableSubmit}
                    >
                        {isLoading && <ActivityIndicator color={tokens.primaryForeground} />}
                        <Text style={styles.submitLabel}>SUBMIT</Text>
                    </TouchableOpacity>

                    {/* <Text style={styles.helperText}>
                        Use at least 8 characters, including a number and a symbol for a strong password.
                    </Text> */}
                </View>
            </ScrollView>

            <BottomNavigationMenu navigation={navigation} activeTab="Settings" />
        </View>
    );
};

const ChangePasswordPage = (props) => (
    <ThemeProvider>
        <ChangePasswordPageContent {...props} />
    </ThemeProvider>
);

export default ChangePasswordPage;
