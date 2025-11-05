import React, { useState, useEffect, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Linking,
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Autolink from 'react-native-autolink';
import * as Clipboard from 'expo-clipboard';
import { Colors, Fonts } from '../utils/tokens';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as signalR from '@microsoft/signalr';
import { serverUrlApi, serverUrlSignalR } from '../const/api';
import { useAppAlert } from '../hooks/useAppAlert';

const ChatComponent = ({ navigation, route }) => {
    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState([]);
    const [hubConnection, setHubConnection] = useState(null);
    const [userId, setUserId] = useState(null);
    const flatListRef = useRef(null);
    const insets = useSafeAreaInsets();
    const routeIdParam = (route?.params && route.params.idRoute) || null;
    const [routeId, setRouteId] = useState(routeIdParam ? String(routeIdParam) : null);
    const { showAlert } = useAppAlert();

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    useEffect(() => {
        const loadPrerequisites = async () => {
            try {
                const uid = await SecureStore.getItemAsync('userId');
                setUserId(uid);
            } catch (error) {
                console.log('Error loading userId:', error);
            }

            if (!routeIdParam) {
                try {
                    const storedRouteId = await SecureStore.getItemAsync('idRoute');
                    if (storedRouteId) {
                        setRouteId(String(storedRouteId));
                    }
                } catch (error) {
                    console.log('Error loading routeId:', error);
                }
            }
        };
        loadPrerequisites();
    }, [routeIdParam]);

    useEffect(() => {
        if (!userId || !routeId) return;

        const createHubConnection = async () => {
            try {
                const accessToken = await SecureStore.getItemAsync('accessToken');
                if (!accessToken) {
                    return;
                }

                const connection = new signalR.HubConnectionBuilder()
                    .withUrl(serverUrlSignalR, {
                        accessTokenFactory: () => accessToken,
                    })
                    .configureLogging(signalR.LogLevel.Information)
                    .build();

                connection.on('receiveroutecomment', (comment) => {
                    const newMsg = {
                        text: comment.content,
                        timestamp: formatDate(comment.created),
                        isUser: comment.createdByUser?.id === userId,
                        id: comment.id,
                        senderName: comment.createdByUser?.fullName,
                    };
                    setMessages((prev) => {
                        if (!prev.some((m) => m.id === newMsg.id)) {
                            return [...prev, newMsg];
                        }
                        return prev;
                    });
                });

                await connection.start();
                setHubConnection(connection);
            } catch (error) {
                console.log('SignalR Connection Error:', error);
            }
        };

        const fetchComments = async () => {
            if (!routeId) {
                return;
            }

            try {
                const accessToken = await SecureStore.getItemAsync('accessToken');
                if (!accessToken) {
                    return;
                }

                const response = await fetch(`${serverUrlApi}route-comments?routeId=${routeId}`, {
                    method: 'GET',
                    headers: {
                        accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch comments');
                }

                const data = await response.json();

                const mapped = data.map((item) => ({
                    text: item.content,
                    timestamp: formatDate(item.created),
                    isUser: item.createdByUser?.id === userId,
                    id: item.id,
                    senderName: item.createdByUser?.fullName,
                }));

                setMessages((prev) => {
                    const existingIDs = new Set(prev.map((m) => m.id));
                    const filtered = mapped.filter((m) => !existingIDs.has(m.id));
                    return [...prev, ...filtered];
                });
            } catch (err) {
                console.log(err);
            }
        };

        createHubConnection();
        fetchComments();
    }, [userId, routeId]);

    const handleSend = async () => {
        if (!inputText.trim()) return;
        try {
            const idRouteValue =
                routeId || (await SecureStore.getItemAsync('idRoute'));
            if (!idRouteValue) {
                return;
            }
            if (!routeId) {
                setRouteId(String(idRouteValue));
            }
            const body = {
                routeId: String(idRouteValue),
                content: inputText,
            };
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                return;
            }

            const response = await fetch(`${serverUrlApi}route-comments`, {
                method: 'POST',
                headers: {
                    accept: '*/*',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error('Failed to post comment');
            }

            setInputText('');

            const newComment = await response.json();

            const userMsg = {
                text: newComment.content,
                timestamp: formatDate(newComment.created),
                isUser: true,
                id: newComment.id,
                senderName: newComment.createdByUser?.fullName,
            };
            setMessages((prev) => {
                if (!prev.some((m) => m.id === userMsg.id)) {
                    return [...prev, userMsg];
                }
                return prev;
            });

            setInputText('');
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    }, [messages]);

    useEffect(() => {
        setTimeout(() => {
            if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false });
            }
        }, 500);
    }, []);

    const copyMessage = async (text) => {
        await Clipboard.setStringAsync(text);
        showAlert({
            title: 'Copied',
            message: 'The message has been copied to the clipboard.',
            variant: 'success',
        });
    };

    const renderMessage = ({ item }) => (
        <TouchableOpacity
            onLongPress={() => copyMessage(item.text)}
            activeOpacity={0.8}
            style={[
                styles.messageBubble,
                item.isUser ? styles.userMessage : styles.receiverMessage,
            ]}
        >
            <Autolink
                text={item.text}
                style={styles.messageText}
                linkStyle={{ color: 'blue', textDecorationLine: 'underline' }}
                onPress={(url) => Linking.openURL(url)}
            />
            <Text style={styles.messageTimestamp}>
                {item.timestamp}
                {item.senderName ? ` | ${item.senderName}` : ''}
            </Text>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView
            style={styles.keyboardAvoider}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.blackText} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item, index) =>
                        item.id ? item.id.toString() : index.toString()
                    }
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messagesContainer}
                    keyboardShouldPersistTaps="handled"
                    style={styles.messagesList}
                />

                <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 16 }]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your message..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        textAlignVertical="top"
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    keyboardAvoider: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.blackText + '50',
    },
    backButton: {
        marginRight: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        fontSize: Fonts.f14,
        color: Colors.blackText,
    },
    messagesList: {
        flex: 1,
    },
    messagesContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    messageBubble: {
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        maxWidth: '75%',
    },
    userMessage: {
        backgroundColor: Colors.lightGreen,
        alignSelf: 'flex-end',
    },
    receiverMessage: {
        backgroundColor: Colors.blackText + '50',
        alignSelf: 'flex-start',
    },
    messageText: {
        fontSize: Fonts.f14,
        color: Colors.blackText,
    },
    messageTimestamp: {
        fontSize: Fonts.f12,
        color: Colors.blackText,
        marginTop: 5,
        textAlign: 'right',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: Colors.blackText + '50',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.blackText + '50',
        borderRadius: 20,
        padding: 10,
        marginRight: 10,
        fontSize: Fonts.f14,
        backgroundColor: Colors.white,
        minHeight: 40,
        maxHeight: 120,
    },
    sendButton: {
        backgroundColor: Colors.mainBlue,
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    sendButtonText: {
        color: Colors.white,
        fontSize: Fonts.f14,
    },
});

export default ChatComponent;
