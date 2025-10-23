// sendLocations.js
import * as SecureStore from 'expo-secure-store';
import { getAllLocations, clearLocationsUpToId, encodeLocationsToBase64 } from '../../locationTracker';
import {serverUrlApi} from "../const/api";

// URL вашого сервера
const SERVER_URL = serverUrlApi+'locations';

export async function sendStoredLocations() {
    try {
        const accessToken = await SecureStore.getItemAsync('accessToken');
        const routeId = await SecureStore.getItemAsync('idRoute');

        if (!accessToken || !routeId) {
            console.log('Token or routeId is missing, cannot send locations');
            return;
        }

        // Отримуємо всі точки з БД
        const locations = await getAllLocations();
        if (locations.length === 0) {
            return; // Немає що відправляти
        }

        // Кодуємо у бінарний формат => Base64
        const base64StringEncoded = encodeLocationsToBase64(locations);

        // Відправляємо
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                routeId,
                rawData: base64StringEncoded
            })
        });

        if (response.ok) {
            // Якщо успішно — видаляємо із БД всі відправлені записи
            const lastSentId = locations[locations.length - 1].id;
            await clearLocationsUpToId(lastSentId);
            console.log(`Successfully sent locations up to id=${lastSentId}, DB cleared.`);
        } else {
            console.log('Server responded with error:', response.status);
            // Якщо помилка, не видаляємо, буде повторна спроба згодом
        }
    } catch (error) {
        console.log('Error sending stored locations:', error);
    }
}
