import React, {useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import PropTypes from 'prop-types';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';

import {useDesignSystem} from '../context/ThemeContext';
import {Fonts} from '../utils/tokens';

const withAlpha = (hex, alpha) => {
    if (!hex || typeof hex !== 'string') {
        return hex;
    }

    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
        return hex;
    }

    return `#${normalized}${alpha}`;
};

const StopCard = ({
    title,
    subtitle,
    hoursLabel,
    infoItems,
    statusLabel,
    statusPalette,
    progressLabel,
    typeLabel,
    typeIconColors,
    flagColor,
    onNavigate,
    onStartVisit,
    disableStartVisit,
    onCallPress,
    showCallButton,
}) => {
    const {tokens, spacing, radii, theme} = useDesignSystem();

    const palette = useMemo(() => ({
        background: tokens.background,
        card: tokens.cardBackground,
        border: tokens.border,
        textPrimary: tokens.textPrimary,
        textSecondary: tokens.textSecondary,
        textMuted: tokens.textMuted || withAlpha(tokens.textSecondary, 'AA'),
        primary: tokens.primary,
        primaryForeground: tokens.primaryForeground || '#FFFFFF',
        destructive: tokens.destructive,
        shadow: theme === 'dark' ? 'rgba(0,0,0,0.45)' : tokens.navShadow || 'rgba(15,23,42,0.12)',
    }), [theme, tokens]);

    const styles = useMemo(
        () => createStyles({palette, spacing, radii, theme}),
        [palette, spacing, radii, theme],
    );

    const infoLine = Array.isArray(infoItems) ? infoItems.filter(Boolean).join(' • ') : '';
    const hasInfoLine = Boolean(infoLine);
    const hasHours = Boolean(hoursLabel && hoursLabel.trim().length > 0);
    const showProgress = Boolean(progressLabel);
    const showStatus = Boolean(statusLabel);

    const navigateHandler = () => {
        if (typeof onNavigate === 'function') {
            onNavigate();
        }
    };

    const startHandler = () => {
        if (!disableStartVisit && typeof onStartVisit === 'function') {
            onStartVisit();
        }
    };

    const callHandler = () => {
        if (showCallButton && typeof onCallPress === 'function') {
            onCallPress();
        }
    };

    const resolvedStatusBackground = statusPalette?.backgroundColor || withAlpha(palette.primary, '1F');
    const resolvedStatusText = statusPalette?.textColor || palette.primary;
    const resolvedStatusBorder = statusPalette?.borderColor || withAlpha(palette.primary, '40');

    const startButtonLabel = disableStartVisit ? 'Visit Complete' : 'Start Visit';

    const typeIconBackground = typeIconColors?.iconBackground || withAlpha(palette.primary, '1C');
    const typeIconBorder = typeIconColors?.iconBorder || withAlpha(palette.primary, '33');
    const typeIconColor = typeIconColors?.iconColor || palette.primary;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.progressSlot}>
                    {showProgress ? (
                        <View style={styles.progressBadge}>
                            <Text style={styles.progressBadgeText}>{progressLabel}</Text>
                        </View>
                    ) : null}
                </View>
                {showStatus ? (
                    <View
                        style={[
                            styles.statusBadge,
                            {
                                backgroundColor: resolvedStatusBackground,
                                borderColor: resolvedStatusBorder,
                            },
                        ]}
                    >
                        <Text style={[styles.statusBadgeText, {color: resolvedStatusText}]}>{statusLabel}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.typeRow}>
                <View
                    style={[
                        styles.typeIconWrapper,
                        {
                            backgroundColor: typeIconBackground,
                            borderColor: typeIconBorder,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={typeLabel?.toLowerCase().includes('drop') ? 'arrow-down' : 'arrow-up'}
                        size={20}
                        color={typeIconColor}
                    />
                </View>
                <View style={styles.typeMeta}>
                    <View style={styles.typeMetaRow}>
                        {typeLabel ? <Text style={styles.typeLabel}>{typeLabel}</Text> : null}
                        {flagColor ? (
                            <MaterialCommunityIcons
                                name="flag-variant"
                                size={16}
                                color={flagColor}
                                style={styles.flagIcon}
                            />
                        ) : null}
                    </View>
                </View>
            </View>

            <Text style={styles.title} numberOfLines={2}>
                {title}
            </Text>
            {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                    {subtitle}
                </Text>
            ) : null}

            {hasHours ? (
                <View style={styles.metaRow}>
                    <MaterialCommunityIcons
                        name="clock-time-five-outline"
                        size={18}
                        color={palette.primary}
                        style={styles.metaIcon}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                        {hoursLabel}
                    </Text>
                </View>
            ) : null}

            {hasInfoLine ? (
                <Text style={styles.infoText} numberOfLines={2}>
                    {infoLine}
                </Text>
            ) : null}

            {showCallButton ? (
                <TouchableOpacity style={styles.callButton} onPress={callHandler}>
                    <Ionicons name="call-outline" size={16} color={palette.primary} style={styles.callIcon} />
                    <Text style={styles.callText}>Call site</Text>
                </TouchableOpacity>
            ) : null}

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.navigateButton} onPress={navigateHandler}>
                    <Ionicons name="navigate" size={20} color={palette.primaryForeground} style={styles.buttonIcon} />
                    <Text style={styles.navigateText}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.startButton, disableStartVisit && styles.startButtonDisabled]}
                    onPress={startHandler}
                    disabled={disableStartVisit}
                >
                    <MaterialCommunityIcons
                        name={disableStartVisit ? 'check-circle' : 'checkbox-blank-circle-outline'}
                        size={20}
                        color={disableStartVisit ? palette.textSecondary : palette.primary}
                        style={styles.buttonIcon}
                    />
                    <Text
                        style={[
                            styles.startText,
                            disableStartVisit && styles.startTextDisabled,
                        ]}
                    >
                        {startButtonLabel}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

StopCard.propTypes = {
    title: PropTypes.string,
    subtitle: PropTypes.string,
    hoursLabel: PropTypes.string,
    infoItems: PropTypes.arrayOf(PropTypes.string),
    statusLabel: PropTypes.string,
    statusPalette: PropTypes.shape({
        backgroundColor: PropTypes.string,
        textColor: PropTypes.string,
        borderColor: PropTypes.string,
    }),
    progressLabel: PropTypes.string,
    typeLabel: PropTypes.string,
    typeIconColors: PropTypes.shape({
        iconBackground: PropTypes.string,
        iconBorder: PropTypes.string,
        iconColor: PropTypes.string,
    }),
    flagColor: PropTypes.string,
    onNavigate: PropTypes.func,
    onStartVisit: PropTypes.func,
    disableStartVisit: PropTypes.bool,
    onCallPress: PropTypes.func,
    showCallButton: PropTypes.bool,
};

StopCard.defaultProps = {
    title: 'Checkpoint',
    subtitle: '',
    hoursLabel: '',
    infoItems: [],
    statusLabel: '',
    statusPalette: null,
    progressLabel: '',
    typeLabel: '',
    typeIconColors: null,
    flagColor: null,
    onNavigate: undefined,
    onStartVisit: undefined,
    disableStartVisit: false,
    onCallPress: undefined,
    showCallButton: false,
};

const createStyles = ({palette, spacing, radii, theme}) => StyleSheet.create({
    container: {
        backgroundColor: palette.card,
        borderRadius: radii.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: withAlpha(palette.border, 'C8'),
        shadowColor: palette.shadow,
        shadowOffset: {width: 0, height: theme === 'dark' ? 12 : 6},
        shadowOpacity: theme === 'dark' ? 0.4 : 0.16,
        shadowRadius: theme === 'dark' ? 24 : 12,
        elevation: theme === 'dark' ? 18 : 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    progressSlot: {
        flex: 1,
        minHeight: spacing.md,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    progressBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: withAlpha(palette.primary, '18'),
    },
    progressBadgeText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.primary,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    typeIconWrapper: {
        height: 44,
        width: 44,
        borderRadius: radii.lg,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeMeta: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    typeMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeLabel: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    flagIcon: {
        marginLeft: spacing.xs,
    },
    title: {
        fontSize: Fonts.f20,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    subtitle: {
        fontSize: Fonts.f14,
        color: palette.textSecondary,
        marginTop: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    metaIcon: {
        marginRight: spacing.xs,
    },
    metaText: {
        fontSize: Fonts.f12,
        color: palette.textSecondary,
    },
    infoText: {
        fontSize: Fonts.f12,
        color: palette.textMuted,
        marginTop: spacing.xs,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.lg,
        backgroundColor: withAlpha(palette.primary, '18'),
    },
    callIcon: {
        marginRight: 6,
    },
    callText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.primary,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    navigateButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primary,
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
        marginRight: spacing.sm,
    },
    navigateText: {
        fontSize: Fonts.f14,
        fontWeight: '600',
        color: palette.primaryForeground,
    },
    buttonIcon: {
        marginRight: 8,
    },
    startButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.primary,
        paddingVertical: spacing.md,
        backgroundColor: withAlpha(palette.primary, '12'),
    },
    startButtonDisabled: {
        backgroundColor: withAlpha(palette.textSecondary, '14'),
        borderColor: withAlpha(palette.textSecondary, '30'),
    },
    startText: {
        fontSize: Fonts.f14,
        fontWeight: '600',
        color: palette.primary,
    },
    startTextDisabled: {
        color: withAlpha(palette.textSecondary, '88'),
    },
});

export default StopCard;
