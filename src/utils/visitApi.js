import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import { serverUrlApi } from '../const/api';

export const VISIT_ARRIVAL_CHECK_TYPE = {
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

export const VISIT_RESULT_ITEM_TYPE = {
    Sample: 1,
    Package: 2,
};

const COMPRESSION_FACTOR = 0.4;

const isVideoAsset = (asset) => {
    const type = (asset?.type || '').toString().toLowerCase();
    if (type.includes('video')) {
        return true;
    }
    const uri = (asset?.uri || '').toLowerCase();
    return uri.endsWith('.mp4') || uri.endsWith('.mov') || uri.endsWith('.m4v');
};

export const combineArrivalFlags = (flags, fallback = []) => {
    const source = Array.isArray(flags) && flags.length ? flags : fallback;
    if (!source.length) {
        return VISIT_ARRIVAL_CHECK_TYPE.None;
    }
    return source.reduce((acc, value) => acc | Number(value || 0), 0);
};

export const uploadVisitFiles = async (assets, accessToken) => {
    if (!assets || assets.length === 0) {
        return [];
    }

    const mediaFileIds = [];

    for (let i = 0; i < assets.length; i += 1) {
        const asset = assets[i];
        const isVideo = isVideoAsset(asset);
        if (!asset?.uri) {
            continue;
        }

        let uploadUri = asset.uri;
        if (!isVideo) {
            try {
                const compressed = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [],
                    {
                        compress: COMPRESSION_FACTOR,
                        format: ImageManipulator.SaveFormat.JPEG,
                    },
                );
                uploadUri = compressed?.uri || uploadUri;
            } catch (error) {
                // ignore compression errors, fallback to original uri
            }
        }

        const formData = new FormData();
        formData.append('files[]', {
            uri: uploadUri,
            name: `visit-${Date.now()}-${i}.${isVideo ? 'mp4' : 'jpg'}`,
            type: isVideo ? 'video/mp4' : 'image/jpeg',
        });

        const response = await fetch(`${serverUrlApi}files`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const message = await response.text().catch(() => 'UPLOAD_FAILED');
            throw new Error(message || 'UPLOAD_FAILED');
        }

        const result = await response.json();
        if (Array.isArray(result)) {
            const uploadedId = result[0]?.id || result[0]?.fileId;
            if (uploadedId) {
                mediaFileIds.push(uploadedId);
            }
        } else if (result?.id) {
            mediaFileIds.push(result.id);
        }
    }

    return mediaFileIds;
};

export const finishVisit = async ({
    visitId,
    arrivalCheckType,
    personsName = null,
    note = null,
    items = [],
    itemLinks = [],
    mediaAssets = [],
    accessToken: tokenOverride = null,
}) => {
    const accessToken = tokenOverride || (await SecureStore.getItemAsync('accessToken'));
    if (!accessToken) {
        throw new Error('AUTH_MISSING');
    }
    if (!visitId) {
        throw new Error('VISIT_ID_MISSING');
    }



    const mediaFileIds = await uploadVisitFiles(mediaAssets, accessToken);

    const payload = {
        arrivalCheckType,
        personsName: personsName?.trim?.() ? personsName.trim() : null,
        note: note?.trim?.() ? note.trim() : null,
        items: Array.isArray(items) ? items : [],
        itemLinks: Array.isArray(itemLinks) ? itemLinks : [],
        mediaFileIds,
    };

    
    const response = await fetch(`${serverUrlApi}visits/${visitId}/finish`, {
        method: 'PATCH',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const message = await response.text().catch(() => 'FINISH_FAILED');
        throw new Error(message || 'FINISH_FAILED');
    }

    return true;
};
