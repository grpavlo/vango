// src/services/SignalRService.js
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Vibration } from 'react-native';
import * as signalR from '@microsoft/signalr';
import { useRouteStore } from '../store/useRouteStore';
import {serverUrlApi, serverUrlSignalR} from "../const/api";
import axios from "axios";

const SIGNALR_TASK = 'SIGNALR_BACKGROUND_TASK';

export async function initSignalR() {
    const accessToken = await SecureStore.getItemAsync('accessToken');

    const hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(serverUrlSignalR, {
            accessTokenFactory: () => accessToken,
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    hubConnection.on('ReceiveRouteChanges', async (routeChange) => {
        let message = '';

        if (routeChange.fieldIdentifiers && routeChange.fieldIdentifiers.length > 0) {
            const changes = routeChange.fieldIdentifiers.map((id) => {
                switch (id) {
                    case 1:
                        return 'Schedule changed';
                    case 2:
                        return 'Start time changed';
                    case 3:
                        return 'End time changed';
                    case 4:
                        return 'Pickup/Drop-off changed';
                    case 5:
                        return 'Priority changed';
                    default:
                        return 'Field updated';
                }
            });

            if (routeChange.checkpointName) {
                message = `Checkpoint "${routeChange.checkpointName}" on route ${routeChange.routeName}: ${changes.join(', ')}`;
            } else {
                message = `On route ${routeChange.routeName}: ${changes.join(', ')}`;
            }
        } else {
            switch (routeChange.reason) {
                case 1:
                    await SecureStore.setItemAsync('idNewVisit',routeChange.visitId);
                    message = `New visit added on route ${routeChange.routeName}`;
                    break;
                case 2:
                    message = `Visit removed from route ${routeChange.routeName}`;
                    break;
                case 3:
                    message = `Route updated: ${routeChange.routeName}`;
                    break;
                case 4:
                    message = `Visit order updated on route ${routeChange.routeName}`;
                    break;
                default:
                    message = `Route changed: ${routeChange.routeName}`;
                    break;
            }
        }

        useRouteStore.getState().setRouteChangeReason(routeChange.reason);
        setTimeout(() => {
            useRouteStore.getState().setRouteChangeReason(null);
        }, 5);

        Notifications.scheduleNotificationAsync({
            content: {
                title: 'Route Change',
                body: `${message} ${routeChange.checkpointAddress && 'Address: ' + routeChange.checkpointAddress}`,
                sound: 'default',
                data: {routeChange},
            },
            trigger: null,
        });
        Vibration.vibrate();
        axios.patch(
            serverUrlApi + `route-changes/${routeChange.id}`,
            {
                "status": 1
            },
            {
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                }
            }
        );
    });


    await hubConnection.start();
    return hubConnection;
}

// Визначення фонової задачі, що використовує initSignalR
TaskManager.defineTask(SIGNALR_TASK, async () => {
    console.log('TaskManager: Background task triggered');
    try {
        await initSignalR();
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('TaskManager: Error in background task', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

// Реєстрація фонової задачі для SignalR
export async function registerSignalRBackgroundTask() {
    try {
        console.log('registerSignalRBackgroundTask: Registering task');
        await BackgroundFetch.registerTaskAsync(SIGNALR_TASK, {
            stopOnTerminate: false,
            startOnBoot: true,
        });
        console.log('registerSignalRBackgroundTask: Task registered successfully');
    } catch (error) {
        console.error('registerSignalRBackgroundTask: Error registering task', error);
    }
}
