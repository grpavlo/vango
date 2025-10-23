// BottomSheetSelect.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Animated,
    Easing,
    PanResponder,
    Dimensions
} from "react-native";

import { useDesignSystem } from "../context/ThemeContext";

const SCREEN_HEIGHT = Dimensions.get("window").height;

const withAlpha = (hex, alpha) => {
    if (typeof hex !== "string" || !hex.startsWith("#")) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

const createStyles = (tokens, theme) =>
    StyleSheet.create({
        container: {
            width: "100%"
        },
        selector: {
            padding: 16,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 12,
            backgroundColor: tokens.inputBackground || tokens.cardBackground
        },
        placeholder: {
            color: tokens.textSecondary,
            fontSize: 16
        },
        selectedText: {
            color: tokens.textPrimary,
            fontSize: 16,
            fontWeight: "500"
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: tokens.overlay || "rgba(0,0,0,0.45)",
            justifyContent: "flex-end"
        },
        bottomSheet: {
            backgroundColor: tokens.cardBackground,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: "70%",
            overflow: "hidden",
            borderTopWidth: 1,
            borderTopColor: withAlpha(tokens.border, "B3")
        },
        handleBarContainer: {
            alignItems: "center",
            paddingVertical: 10
        },
        handleBar: {
            width: 44,
            height: 5,
            borderRadius: 3,
            backgroundColor: withAlpha(tokens.textPrimary, theme === "dark" ? "55" : "25")
        },
        listContent: {
            backgroundColor: tokens.cardBackground,
            paddingBottom: 20
        },
        item: {
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: withAlpha(tokens.border, "80"),
            backgroundColor: tokens.cardBackground
        },
        itemText: {
            fontSize: 16,
            color: tokens.textPrimary
        }
    });

const BottomSheetSelect = ({
                               data,
                               onSelect,
                               placeholder,
                               selectedValue
                           }) => {
    const [isVisible, setIsVisible] = useState(false);
    const { tokens, theme } = useDesignSystem();
    const styles = useMemo(() => createStyles(tokens, theme), [tokens, theme]);

    // �?�?�-�?�?�?���?�� �?��>��ؐ�?�� �?�>�? ����?��?�-�%��?�?�? �>��?�'��
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // �?�?����ő-�? �'�?�?����?�?�?, ���?�'�?�-�+�?�� �?�>�? PanResponder
    const lastGestureDy = useRef(0);

    // �'��?�?�'�� �>��?�'�� ���-�?�>�? �?��?�?��?��?�?�?
    const [contentHeight, setContentHeight] = useState(0);

    // PanResponder �?�>�? ���?�'�-�?
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                translateY.stopAnimation();
                lastGestureDy.current = translateY.__getValue();
            },
            onPanResponderMove: (evt, gestureState) => {
                const newTranslateY = lastGestureDy.current + gestureState.dy;
                // �?�+�?���?�"�?�? �?�?�: �>��?�'��, �%�?�+ �?�� ���-�?�?�-�?���?�?�? �?��%�� 0
                translateY.setValue(Math.max(newTranslateY, 0));
            },
            onPanResponderRelease: (evt, gestureState) => {
                const threshold = contentHeight * 0.3;
                if (translateY.__getValue() > threshold) {
                    // ����%�? ���?�?�'�?�?�?�?�>�� �?�?�?�'���'�?�?�? �?�?��� - ������?��?���"�?�?
                    closeSheet();
                } else {
                    // ����%�? �?�- - ���?�?��?�'���"�?�? �?�?�?�?�?
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true
                    }).start();
                }
            }
        })
    ).current;

    const openSheet = () => {
        setIsVisible(true);
    };

    const closeSheet = () => {
        Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true
        }).start(() => {
            setIsVisible(false);
        });
    };

    useEffect(() => {
        if (isVisible) {
            // �?�?�� �?�-�?��?��'�'�- ���?�-�?�?�"�?�? ���?����? �?�?�?�?�?
            Animated.timing(translateY, {
                toValue: 0,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true
            }).start();
        }
    }, [isVisible, translateY]);

    const handleSelectItem = (item) => {
        onSelect && onSelect(item);
        closeSheet();
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.item} onPress={() => handleSelectItem(item)}>
            <Text style={styles.itemText}>{item.label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.selector} onPress={openSheet} activeOpacity={0.85}>
                <Text style={selectedValue ? styles.selectedText : styles.placeholder}>
                    {selectedValue || placeholder}
                </Text>
            </TouchableOpacity>

            <Modal
                visible={isVisible}
                transparent
                animationType="none"
                onRequestClose={closeSheet}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeSheet} activeOpacity={1} />
                    {/* �?�?�-�?�?�?���?��� �>��?�' */}
                    <Animated.View
                        style={[styles.bottomSheet, { transform: [{ translateY }] }]}
                        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
                        {...panResponder.panHandlers}
                    >
                        <View style={styles.handleBarContainer}>
                            <View style={styles.handleBar} />
                        </View>
                        <FlatList
                            data={data}
                            keyExtractor={(item) => item.key.toString()}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            keyboardShouldPersistTaps="handled"
                        />
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};

export default BottomSheetSelect;
