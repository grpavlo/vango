import React, {useEffect, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import {Fonts, createColorsFromTokens, withAlpha} from '../utils/tokens';
import CameraComponent from '../components/CameraComponent';
import GalleryComponent from '../components/GalleryComponent';
import UniversalModal from '../components/UniversalModal';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useInfoCheckpoint} from "../store/infoCheckpoint";
import {serverUrlApi} from "../const/api";
import {useDesignSystem} from "../context/ThemeContext";

const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_UPLOAD_TASK';
const COMPRESSION_FACTOR = 0.3;
const VISIT_ARRIVAL_CHECK_TYPE = {
    None: 0,
    PickupSamples: 1 << 0,
    EmptyBox: 1 << 1,
    UnableFindBox: 1 << 2,
    OtherIssues: 1 << 3,
    OfficeIsOpen: 1 << 4,
    OfficeIsClosed: 1 << 5,
    TheyHaveSamples: 1 << 6,
    TheyDoNotHaveSamples: 1 << 7,
};

const uploadQueueProcess = async () => {
    try {
        const queueString = await AsyncStorage.getItem('uploadQueue');
        if (!queueString) return;
        const queue = JSON.parse(queueString);

        for (let item of queue) {
            try {
                const accessToken = await SecureStore.getItemAsync('accessToken');
                if (!accessToken) continue;

                const mediaFileIds = [];
                const uploadAsset = async (asset, index, prefix) => {
                    const compressed = await ImageManipulator.manipulateAsync(
                        asset.uri,
                        [],
                        {
                            compress: COMPRESSION_FACTOR,
                            format: ImageManipulator.SaveFormat.JPEG
                        }
                    );

                    const formData = new FormData();
                    formData.append('files[]', {
                        uri: compressed.uri,
                        name: `${prefix}${index}.jpg`,
                        type: 'image/jpeg'
                    });

                    const resp = await fetch(serverUrlApi + 'files', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        },
                        body: formData
                    });

                    if (!resp.ok) {
                        return;
                    }

                    const result = await resp.json();
                    if (Array.isArray(result) && result[0]?.id) {
                        mediaFileIds.push(result[0].id);
                    }
                };

                const samplePhotos = Array.isArray(item.photos) ? item.photos : [];
                const overallPhotos = Array.isArray(item.photosOverall) ? item.photosOverall : [];

                for (let i = 0; i < samplePhotos.length; i++) {
                    await uploadAsset(samplePhotos[i], i, 'sample');
                }

                for (let i = 0; i < overallPhotos.length; i++) {
                    await uploadAsset(overallPhotos[i], i, 'overall');
                }

                const arrivalCheckType = item.arrivalCheckType !== undefined && item.arrivalCheckType !== null
                    ? item.arrivalCheckType
                    : item.emptyBox
                        ? VISIT_ARRIVAL_CHECK_TYPE.EmptyBox
                        : VISIT_ARRIVAL_CHECK_TYPE.PickupSamples;

                const bodyData = {
                    arrivalCheckType,
                    personsName: item.personsName ?? null,
                    note: item.note ?? null,
                    items: Array.isArray(item.items) ? item.items : [],
                    itemLinks: Array.isArray(item.itemLinks) ? item.itemLinks : [],
                    mediaFileIds,
                };

                await fetch(serverUrlApi + `visits/${item.dataId}/finish`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bodyData)
                });
            } catch (e) {
                // ignore
            }
        }

        await AsyncStorage.removeItem('uploadQueue');
    } catch (e) {
        // ignore
    }
};

TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
    try {
        await uploadQueueProcess();
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

const registerBackgroundTask = async () => {
    try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
            minimumInterval: 60,
            stopOnTerminate: false,
            startOnBoot: true
        });
    } catch (err) {
        // ignore
    }
};

const WorkOnVisitPage = ({navigation, route}) => {
    const {routeName = '', idRoute} = route.params || {};
    const data = useInfoCheckpoint((state) => state.data);
    const {tokens} = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);


    const [photos, setPhotos] = useState([]);
    const [photosOverall, setPhotosOverall] = useState([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCameraOpenOverall, setIsCameraOpenOverall] = useState(false);
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [isGalleryVisibleOverall, setIsGalleryVisibleOverall] = useState(false);
    const [initialId, setInitialId] = useState(null);
    const [initialIdOverall, setInitialIdOverall] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalVisibleVisit, setModalVisibleVisit] = useState(false);
    const [idDelete, setIdDelete] = useState(null);
    const [idDeleteOverall, setIdDeleteOverall] = useState(null);
    const [emptyBox, setEmptyBox] = useState(false);

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', e => {
            e.preventDefault();
        });
        registerBackgroundTask();
        return unsubscribe;
    }, [navigation]);

    const handleCancel = () => {
        setModalVisible(false);
    };

    const handleCancelVisit = () => {
        setModalVisibleVisit(false);
    };

    const handleOpenCamera = () => {
        setIsCameraOpen(true);
    };

    const handleOpenCameraOverall = () => {
        setIsCameraOpenOverall(true);
    };

    const handlePhotoTaken = photoData => {
        setPhotos(prevPhotos => [...prevPhotos, photoData]);
        setIsCameraOpen(false);
    };

    const handlePhotoTakenOverall = photoDataOverall => {
        setPhotosOverall(prevPhotosOverall => [...prevPhotosOverall, photoDataOverall]);
        setIsCameraOpenOverall(false);
    };

    const handleRemovePhoto = () => {
        setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== idDelete));
        setIdDelete(null);
    };

    const handleRemovePhotoOverall = () => {
        setPhotosOverall(prevPhotosOverall => prevPhotosOverall.filter((_, i) => i !== idDeleteOverall));
        setIdDeleteOverall(null);
    };

    const handleConfirm = () => {
        if (idDelete !== null) {
            handleRemovePhoto();
        }
        if (idDeleteOverall !== null) {
            handleRemovePhotoOverall();
        }
        setModalVisible(false);
    };

    const handleEmptyBoxPress = () => {
        setEmptyBox(true);
        setModalVisibleVisit(true);
    };

    const queueUpload = async () => {
        const item = {
            emptyBox,
            photos,
            photosOverall,
            dataId: data?.id
        };

        let queueString = await AsyncStorage.getItem('uploadQueue');
        let queue = [];

        if (queueString) {
            queue = JSON.parse(queueString);
        }

        queue.push(item);
        await AsyncStorage.setItem('uploadQueue', JSON.stringify(queue));
    };

    const handleConfirmVisit = async () => {
        await queueUpload();
        setModalVisibleVisit(false);
        setEmptyBox(false);
        navigation.navigate('RouteCheckpointsPageSelect', {idRoute, idCheckpoint: data?.id});
        setTimeout(() => {
            uploadQueueProcess();
        }, 1);
    };


    if (isCameraOpen) {
        return (
            <CameraComponent
                setIsCameraOpen={setIsCameraOpen}
                onPhotoTaken={handlePhotoTaken}
                navigation={navigation}
            />
        );
    }

    if (isCameraOpenOverall) {
        return (
            <CameraComponent
                setIsCameraOpen={setIsCameraOpenOverall}
                onPhotoTaken={handlePhotoTakenOverall}
                navigation={navigation}
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topContainer}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary}/>
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.headerRow}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{routeName}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.visitInfoButton}
                        onPress={() =>
                            navigation.navigate('EntryInstructionsPage', {
                                menu: false,
                                data,
                                routeName
                            })
                        }
                    >
                        <Text style={styles.visitInfoText}>Visit Info</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.detailsContainer}>
                    <MaterialCommunityIcons
                        name='map-marker-outline'
                        size={20}
                        color={colors.destructive}
                        style={styles.icon}
                    />

                    <View style={{width: '90%'}}>
                        <Text style={styles.addressText}>Checkpoint Address</Text>
                        <Text style={styles.addressDetail}>{data?.address}</Text>

                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <View>
                                <Text style={styles.pickupTime}>PickUP time</Text>
                                <Text style={styles.pickupTimeDetail}>{data?.hours}</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.writeToDispButton}
                                onPress={() => {
                                    navigation.navigate('ChatComponent', {menu: false});
                                }}
                            >
                                <Text style={styles.writeToDispText}>Write to disp</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleOpenCamera}>
                        <Text style={styles.actionButtonText}>ADD PACKAGE</Text>
                    </TouchableOpacity>

                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>total:</Text>
                        <Text style={styles.totalValue}>{photos.length || 'null'}</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor:
                                    photosOverall.length === 0 || photos.length > 0
                                        ? withAlpha(colors.darkGray, '50')
                                        : colors.darkGray
                            }
                        ]}
                        disabled={photosOverall.length === 0 || photos.length > 0}
                        onPress={handleEmptyBoxPress}
                    >
                        <Text style={styles.actionButtonText}>EMPTY BOX</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.samplesContainer}>
                    <Text style={styles.samplesTitle}>Samples</Text>

                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                        {photos.map((photo, index) => {
                            return (
                                <View key={index} style={styles.sampleItem}>
                                    <Image source={{uri: photo.uri}} style={styles.sampleImage}/>

                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => {
                                            setIdDelete(index);
                                            setModalVisible(true);
                                        }}
                                    >
                                        <MaterialCommunityIcons
                                            name='trash-can-outline'
                                            size={20}
                                            color='#FFFFFF'
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.removeEye}
                                        onPress={() => {
                                            setInitialId(index);
                                            setIsGalleryVisible(true);
                                        }}
                                    >
                                        <Ionicons
                                            name='eye-outline'
                                            size={20}
                                            color='#FFFFFF'
                                        />
                                    </TouchableOpacity>

                                    <Text style={styles.sampleLabel}>Sample {index + 1}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.overallContainer}>
                    <Text style={styles.overallTitle}>Overall Photos</Text>
                    {photosOverall.length === 0 && (
                        <TouchableOpacity
                            style={styles.uploadContainer}
                            onPress={handleOpenCameraOverall}
                        >
                            <Text style={styles.uploadText}>+ Upload photo/video</Text>
                        </TouchableOpacity>
                    )}

                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                        {photosOverall.length !== 0 && (
                            <TouchableOpacity
                                style={styles.uploadContainerMini}
                                onPress={handleOpenCameraOverall}
                            >
                                <Text style={styles.uploadText}>+ Upload photo/video</Text>
                            </TouchableOpacity>
                        )}

                        {photosOverall.map((photo, index) => {
                            return (
                                <View key={index} style={styles.sampleItem}>
                                    <Image source={{uri: photo.uri}} style={styles.sampleImage}/>

                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => {
                                            setIdDeleteOverall(index);
                                            setModalVisible(true);
                                        }}
                                    >
                                        <MaterialCommunityIcons
                                            name='trash-can-outline'
                                            size={20}
                                            color='#FFFFFF'
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.removeEye}
                                        onPress={() => {
                                            setInitialIdOverall(index);
                                            setIsGalleryVisibleOverall(true);
                                        }}
                                    >
                                        <Ionicons
                                            name='eye-outline'
                                            size={20}
                                            color='#FFFFFF'
                                        />
                                    </TouchableOpacity>

                                    <Text style={styles.sampleLabel}>Sample {index + 1}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <TouchableOpacity
                    style={[
                        styles.markAsDoneButton,
                        {
                            backgroundColor:
                                photos.length === 0 ? withAlpha(colors.primary, '50') : colors.primary
                        }
                    ]}
                    disabled={photos.length === 0}
                    onPress={() => {
                        setEmptyBox(false);
                        setModalVisibleVisit(true);
                    }}
                >
                    <Text style={styles.markAsDoneText}>Mark as done</Text>
                </TouchableOpacity>
            </ScrollView>

            <GalleryComponent
                photos={photos}
                onRemovePhoto={index => {
                    setIdDelete(index);
                    setModalVisible(true);
                }}
                isVisible={isGalleryVisible}
                onClose={() => {
                    setInitialId(-1);
                    setIsGalleryVisible(false);
                }}
                initialId={initialId}
            />

            <GalleryComponent
                photos={photosOverall}
                onRemovePhoto={index => {
                    setIdDeleteOverall(index);
                    setModalVisible(true);
                }}
                isVisible={isGalleryVisibleOverall}
                onClose={() => {
                    setInitialIdOverall(-1);
                    setIsGalleryVisibleOverall(false);
                }}
                initialId={initialIdOverall}
            />

            <UniversalModal
                visible={modalVisible}
                title='Do you really want to delete the photo?'
                description=''
                confirmText='Confirm'
                cancelText='Cancel'
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />

            <UniversalModal
                visible={modalVisibleVisit}
                title='Do you really want to end the visit?'
                description=''
                confirmText='Confirm'
                cancelText='Cancel'
                onConfirm={handleConfirmVisit}
                onCancel={handleCancelVisit}
            />
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },
    scrollContainer: {
        padding: 20
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    title: {
        fontSize: Fonts.f20,
        color: colors.textPrimary,
        fontWeight: 'bold'
    },
    visitInfoButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6
    },
    visitInfoText: {
        color: colors.primaryForeground,
        fontSize: Fonts.f14
    },
    detailsContainer: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    icon: {
        marginRight: 10
    },
    addressText: {
        fontSize: Fonts.f14,
        color: withAlpha(colors.textPrimary, '80')
    },
    addressDetail: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        marginBottom: 10
    },
    pickupTime: {
        fontSize: Fonts.f14,
        color: withAlpha(colors.textPrimary, '80')
    },
    pickupTimeDetail: {
        fontSize: Fonts.f16,
        color: colors.textPrimary
    },
    writeToDispButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    writeToDispText: {
        color: colors.primaryForeground,
        fontSize: Fonts.f14
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    actionButton: {
        backgroundColor: colors.mutedBackground,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10
    },
    actionButtonText: {
        fontSize: Fonts.f14,
        color: colors.textPrimary
    },
    totalContainer: {
        alignItems: 'center'
    },
    totalLabel: {
        fontSize: Fonts.f14,
        color: withAlpha(colors.textPrimary, '80')
    },
    totalValue: {
        fontSize: Fonts.f16,
        fontWeight: 'bold',
        color: colors.textPrimary
    },
    samplesContainer: {
        backgroundColor: colors.mutedBackground,
        borderRadius: 8,
        padding: 10,
        marginBottom: 20
    },
    samplesTitle: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        marginBottom: 10
    },
    overallContainer: {
        backgroundColor: colors.mutedBackground,
        borderRadius: 8,
        padding: 10,
        marginBottom: 20
    },
    overallTitle: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        marginBottom: 10
    },
    uploadContainer: {
        height: 100,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    uploadContainerMini: {
        height: 100,
        width: 100,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    uploadText: {
        color: withAlpha(colors.textPrimary, '70'),
        fontSize: Fonts.f14
    },
    markAsDoneButton: {
        borderRadius: 8,
        paddingVertical: 15,
        alignItems: 'center'
    },
    markAsDoneText: {
        fontSize: Fonts.f16,
        fontWeight: 'bold',
        color: colors.primaryForeground
    },
    sampleItem: {
        width: 100,
        height: 120,
        marginRight: 10,
        marginBottom: 10,
        position: 'relative'
    },
    sampleImage: {
        width: '100%',
        height: '80%',
        borderRadius: 8
    },
    removeButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 15,
        padding: 5
    },
    removeEye: {
        position: 'absolute',
        top: 5,
        left: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 15,
        padding: 5
    },
    sampleLabel: {
        fontSize: Fonts.f12,
        color: colors.textPrimary,
        textAlign: 'center',
        marginTop: 5
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topContainer: {
        paddingTop: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
    },
});

export default WorkOnVisitPage;
