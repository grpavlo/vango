// /components/CameraComponent.js

import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import {Camera, CameraView} from 'expo-camera';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const CameraComponent = ({ navigation, onPhotoTaken, setIsCameraOpen }) => {
    const [hasPermission, setHasPermission] = useState(null);
    const cameraRef = useRef(null);

    useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    if (hasPermission === null) {
        return <View />;
    }
    if (hasPermission === false) {
        return <Text>No access to camera</Text>;
    }

    const handleTakePhoto = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync();
                if (onPhotoTaken) {
                    onPhotoTaken(photo);
                }
                if (setIsCameraOpen) {
                    setIsCameraOpen(false);
                }
            } catch (error) {
                console.error("Error taking photo:", error);
            }
        }
    };

    return (
        <View style={styles.container}>
            <CameraView  style={styles.camera} ref={cameraRef}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => {setIsCameraOpen(false)}} style={styles.backButton}>
                        <Text style={styles.backText}>{'< Back'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
                        <MaterialIcons name="camera" size={36} color="white" />
                    </TouchableOpacity>
                </View>
            </CameraView >
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    headerRow: {
        position: 'absolute',
        top: 40,
        left: 20,
    },
    backButton: {
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 8,
    },
    backText: {
        color: 'white',
        fontSize: 16,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 30,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',

    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CameraComponent;
