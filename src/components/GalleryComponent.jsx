import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    View,
    Image,
    TouchableOpacity,
    Modal,
    FlatList,
    Text,
    Dimensions,
    PanResponder,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts, createColorsFromTokens } from '../utils/tokens';
import { useDesignSystem } from "../context/ThemeContext";

const { width } = Dimensions.get('window');

const GalleryComponent = ({ photos, onRemovePhoto, isVisible, onClose, initialId }) => {
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(-1);
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        setSelectedPhotoIndex(initialId);
    }, [initialId, photos]);

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (evt, gestureState) => {
            if (gestureState.dx > 50) {
                // Свайп вправо
                handlePrevious();
            } else if (gestureState.dx < -50) {
                // Свайп вліво
                handleNext();
            }
        },
    });

    const handleNext = () => {
        if (selectedPhotoIndex < photos.length - 1) {
            setSelectedPhotoIndex(selectedPhotoIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (selectedPhotoIndex > 0) {
            setSelectedPhotoIndex(selectedPhotoIndex - 1);
        }
    };

    const renderThumbnail = ({ item, index }) => (
        <TouchableOpacity
            style={[
                styles.thumbnailContainer,
                selectedPhotoIndex === index && styles.selectedThumbnailContainer,
            ]}
            onPress={() => setSelectedPhotoIndex(index)}
        >
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            <Text style={styles.thumbnailLabel}>Sample {index + 1}</Text>
        </TouchableOpacity>
    );

    const handleRemovePhoto = () => {
        onRemovePhoto(selectedPhotoIndex);
        setSelectedPhotoIndex((prevIndex) => (prevIndex === 0 ? 0 : prevIndex - 1));
    };

    return (
        <View style={{flex:1}}>
            <Modal visible={isVisible} transparent={false} onRequestClose={onClose}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialCommunityIcons name="arrow-left" size={28} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleRemovePhoto} style={styles.trashButton}>
                            <MaterialCommunityIcons name="trash-can-outline" size={28} color={colors.destructive} />
                        </TouchableOpacity>
                    </View>

                    {/* Photo Viewer with PanResponder */}
                    <View style={styles.photoContainer} {...panResponder.panHandlers}>
                        <Image
                            source={{ uri: photos[selectedPhotoIndex]?.uri }}
                            style={styles.photo}
                        />
                    </View>

                    {/* Thumbnail List */}
                    <View style={styles.thumbnailList}>
                        <FlatList
                            data={photos}
                            horizontal
                            keyExtractor={(item, index) => `thumbnail-${index}`}
                            renderItem={renderThumbnail}
                            showsHorizontalScrollIndicator={false}
                            extraData={selectedPhotoIndex}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 20
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
    },
    trashButton: {
        paddingHorizontal: 10,
    },
    photoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    photo: {
        width: '100%',
        height: '90%',
        borderRadius: 8,
    },
    thumbnailList: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    thumbnailContainer: {
        marginRight: 10,
        alignItems: 'center',
    },
    selectedThumbnailContainer: {
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 8,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    thumbnailLabel: {
        marginTop: 5,
        fontSize: Fonts.f12,
        color: colors.textPrimary,
        textAlign: 'center',
    },
});

export default GalleryComponent;
