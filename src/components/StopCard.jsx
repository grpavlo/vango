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
            <View
                style={[
                    styles.iconWrapper,
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

            <View style={styles.content}>
                <View style={styles.titleRow}>
                    <View style={styles.typeLabelRow}>
                        {typeLabel ? <Text style={styles.typeLabel}>{typeLabel}</Text> : null}
                        {flagColor ? (
                            <MaterialCommunityIcons
                                name="flag-variant"
                                size={14}
                                color={flagColor}
                                style={styles.flagIcon}
                            />
                        ) : null}
                    </View>

                    {(showProgress || showStatus) && (
                        <View style={styles.badgeRow}>
                            {showProgress ? (
                                <View style={styles.progressBadge}>
                                    <Text style={styles.progressBadgeText}>{progressLabel}</Text>
                                </View>
                            ) : null}
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
                    )}
                </View>

                <Text style={styles.title} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}

                {hasHours ? (
                    <View style={styles.metaRow}>
                        <MaterialCommunityIcons
                            name="clock-time-five-outline"
                            size={16}
                            color={palette.primary}
                            style={styles.metaIcon}
                        />
                        <Text style={styles.metaText} numberOfLines={1}>
                            {hoursLabel}
                        </Text>
                    </View>
                ) : null}

                {hasInfoLine ? (
                    <Text style={styles.infoText} numberOfLines={1}>
                        {infoLine}
                    </Text>
                ) : null}

                {showCallButton ? (
                    <TouchableOpacity style={styles.callButton} onPress={callHandler}>
                        <Ionicons name="call-outline" size={14} color={palette.primary} style={styles.callIcon} />
                        <Text style={styles.callText}>Call site</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.navigateButton} onPress={navigateHandler}>
                    <Ionicons name="navigate" size={18} color={palette.primaryForeground} style={styles.buttonIcon} />
                    <Text style={styles.navigateText}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.startButton, disableStartVisit && styles.startButtonDisabled]}
                    onPress={startHandler}
                    disabled={disableStartVisit}
                >
                    <MaterialCommunityIcons
                        name={disableStartVisit ? 'check-circle' : 'checkbox-blank-circle-outline'}
                        size={18}
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
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: withAlpha(palette.border, 'C8'),
        shadowColor: palette.shadow,
        shadowOffset: {width: 0, height: theme === 'dark' ? 10 : 4},
        shadowOpacity: theme === 'dark' ? 0.35 : 0.14,
        shadowRadius: theme === 'dark' ? 20 : 10,
        elevation: theme === 'dark' ? 14 : 6,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: radii.lg,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        marginLeft: spacing.base,
        paddingRight: spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    typeLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeLabel: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    flagIcon: {
        marginLeft: spacing.xs,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
        marginLeft: spacing.xs,
    },
    statusBadgeText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    title: {
        fontSize: Fonts.f18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    subtitle: {
        fontSize: Fonts.f14,
        color: palette.textSecondary,
        marginTop: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
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
        marginTop: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.lg,
        backgroundColor: withAlpha(palette.primary, '16'),
    },
    callIcon: {
        marginRight: 6,
    },
    callText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.primary,
    },
    actions: {
        marginLeft: spacing.base,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    navigateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.primary,
        borderRadius: radii.md,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        minWidth: 112,
    },
    navigateText: {
        fontSize: Fonts.f14,
        fontWeight: '600',
        color: palette.primaryForeground,
    },
    buttonIcon: {
        marginRight: spacing.xs,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.primary,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        minWidth: 112,
        backgroundColor: withAlpha(palette.primary, '10'),
        marginTop: spacing.xs,
    },
    startButtonDisabled: {
        backgroundColor: withAlpha(palette.textSecondary, '12'),
        borderColor: withAlpha(palette.textSecondary, '32'),
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
