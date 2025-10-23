import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Fonts } from "../utils/tokens";
import { useDesignSystem } from "../context/ThemeContext";
import * as SecureStore from "expo-secure-store";

const withAlpha = (hex, alpha) => {
    if (typeof hex !== 'string' || !hex.startsWith('#')) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

const createCheckpointItemPalette = (tokens) => ({
    card: tokens.cardBackground,
    border: tokens.border,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    mutedBackground: tokens.mutedBackground,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground || '#FFFFFF',
    destructive: tokens.destructive,
    destructiveForeground: tokens.destructiveForeground || '#FFFFFF',
    badgeBackground: tokens.badgeBackground || tokens.primary,
    badgeText: tokens.badgeText || tokens.primaryForeground || '#FFFFFF',
});

const deriveAttentionCount = (checkpoint) => {
    if (!checkpoint) {
        return 0;
    }

    const numericFields = [
        'attentionCount',
        'notificationsCount',
        'alertsCount',
        'issuesCount',
        'pendingSamplesCount',
        'pendingDocumentsCount',
    ];

    for (const field of numericFields) {
        if (checkpoint[field] !== undefined && checkpoint[field] !== null) {
            const numeric = Number(checkpoint[field]);
            if (!Number.isNaN(numeric) && numeric > 0) {
                return numeric;
            }
        }
    }

    const arrayFields = ['alerts', 'notifications', 'issues'];
    for (const field of arrayFields) {
        if (Array.isArray(checkpoint[field]) && checkpoint[field].length > 0) {
            return checkpoint[field].length;
        }
    }

    return 0;
};

const sanitizeHours = (value) => {
    if (!value || typeof value !== 'string') {
        return '';
    }
    return value.replace(/^open hours:\s*/i, '').trim();
};

const resolvePriorityLabel = (checkpoint) => {
    if (!checkpoint) {
        return null;
    }

    if (typeof checkpoint.priorityLabel === 'string' && checkpoint.priorityLabel.trim().length > 0) {
        return checkpoint.priorityLabel.trim();
    }

    if (typeof checkpoint.stat === 'string' && checkpoint.stat.trim().length > 0) {
        return checkpoint.stat.trim();
    }

    if (checkpoint.priority === true) {
        return 'STAT';
    }

    if (typeof checkpoint.priority === 'string' && checkpoint.priority.trim().length > 0) {
        return checkpoint.priority.trim();
    }

    return null;
};

const resolveDisplayIndex = (checkpoint, fallbackIndex) => {
    if (!checkpoint) {
        return fallbackIndex;
    }

    const fields = ['count', 'order', 'sequence', 'sequenceNumber', 'position'];
    for (const field of fields) {
        if (checkpoint[field] !== undefined && checkpoint[field] !== null) {
            const numeric = Number(checkpoint[field]);
            if (!Number.isNaN(numeric)) {
                return numeric;
            }
        }
    }

    return fallbackIndex;
};

const typeConfigFor = (type, palette) => {
    if (type === 'unloading') {
        return {
            icon: 'arrow-down',
            color: palette.destructive,
            background: withAlpha(palette.destructive, '1F'),
        };
    }

    return {
        icon: 'arrow-up',
        color: palette.primary,
        background: withAlpha(palette.primary, '1F'),
    };
};

const CheckpointItem = ({
    checkpoint,
    index,
    disabled = true,
    onPress = () => {},
}) => {
    const { tokens } = useDesignSystem();
    const palette = useMemo(() => createCheckpointItemPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);
    const [highlightVisitId, setHighlightVisitId] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const readVisitId = async () => {
            try {
                const storedId = await SecureStore.getItemAsync('idNewVisit');
                if (isMounted) {
                    setHighlightVisitId(storedId);
                }
                if (storedId) {
                    setTimeout(() => {
                        SecureStore.deleteItemAsync('idNewVisit').catch(() => {});
                    }, 100);
                }
            } catch {
                // Ignore SecureStore issues
            }
        };

        readVisitId();

        return () => {
            isMounted = false;
        };
    }, []);

    const isHighlighted =
        highlightVisitId &&
        checkpoint &&
        checkpoint.id !== undefined &&
        String(highlightVisitId) === String(checkpoint.id);

    const displayIndex = resolveDisplayIndex(checkpoint, index);
    const visitName = checkpoint?.name || 'Checkpoint';
    const address = checkpoint?.address || '';
    const schedule = sanitizeHours(checkpoint?.hours);
    const priorityLabel = resolvePriorityLabel(checkpoint);
    const attentionCount = deriveAttentionCount(checkpoint);
    const attentionLabel =
        attentionCount > 99 ? '99+' : attentionCount > 9 ? '9+' : String(attentionCount);
    const defaultFlagColor = palette.textSecondary;
    const flagColor =
        checkpoint?.flagColor && checkpoint.flagColor !== defaultFlagColor
            ? checkpoint.flagColor
            : null;
    const typeConfig = typeConfigFor(checkpoint?.type, palette);
    const metaIconColor = withAlpha(palette.textPrimary, '60');

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isHighlighted && styles.cardHighlighted,
            ]}
            activeOpacity={disabled ? 1 : 0.85}
            onPress={onPress}
            disabled={disabled}
        >
            <View style={styles.leading}>
                <View
                    style={[
                        styles.iconWrapper,
                        { backgroundColor: typeConfig.background },
                        isHighlighted && styles.iconWrapperHighlighted,
                    ]}
                >
                    <Ionicons name={typeConfig.icon} size={16} color={typeConfig.color} />
                </View>
            </View>
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.titleText} numberOfLines={1}>
                        {displayIndex ? `${displayIndex}. ` : ''}
                        {visitName}
                    </Text>
                    {priorityLabel ? (
                        <View style={styles.priorityBadge}>
                            <Text style={styles.priorityBadgeText}>{priorityLabel}</Text>
                        </View>
                    ) : null}
                </View>
                {address ? (
                    <Text style={styles.addressText} numberOfLines={2}>
                        {address}
                    </Text>
                ) : null}
                {schedule ? (
                    <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={14} color={metaIconColor} />
                        <Text style={styles.metaText}>{schedule}</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.trailing}>
                {attentionCount > 0 ? (
                    <View style={styles.attentionBadge}>
                        <Text style={styles.attentionBadgeText}>{attentionLabel}</Text>
                    </View>
                ) : null}
                {flagColor ? (
                    <View style={styles.flagWrapper}>
                        <MaterialIcons name="flag" size={18} color={flagColor} />
                    </View>
                ) : null}
                <View style={styles.trailingIcon}>
                    <Ionicons name="refresh" size={18} color={withAlpha(palette.textPrimary, '40')} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const createStyles = (palette) => StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: withAlpha(palette.textPrimary, '10'),
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    cardHighlighted: {
        borderColor: palette.primary,
        shadowColor: withAlpha(palette.primary, '30'),
        shadowOpacity: 0.2,
        elevation: 4,
    },
    leading: {
        alignItems: 'center',
        marginRight: 16,
    },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapperHighlighted: {
        borderWidth: 1,
        borderColor: palette.primary,
    },
    body: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleText: {
        flexShrink: 1,
        fontSize: Fonts.f14,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    priorityBadge: {
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: palette.badgeBackground,
    },
    priorityBadgeText: {
        fontSize: Fonts.f10,
        fontWeight: '700',
        color: palette.badgeText,
    },
    addressText: {
        marginTop: 6,
        fontSize: Fonts.f12,
        color: withAlpha(palette.textPrimary, '80'),
    },
    metaRow: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        marginLeft: 4,
        fontSize: Fonts.f12,
        color: withAlpha(palette.textPrimary, '80'),
    },
    trailing: {
        alignItems: 'flex-end',
        marginLeft: 12,
    },
    attentionBadge: {
        minWidth: 24,
        paddingHorizontal: 6,
        height: 20,
        borderRadius: 10,
        backgroundColor: palette.destructive,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    attentionBadgeText: {
        fontSize: Fonts.f10,
        fontWeight: '700',
        color: palette.destructiveForeground,
    },
    flagWrapper: {
        marginBottom: 12,
    },
    trailingIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: palette.mutedBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CheckpointItem;
