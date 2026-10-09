import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getConversationMessages, sendConversationMessage } from '../api/providerWork_api';
import { formatDateTime } from '../utils/provider_formatters';

// How often the open thread checks for new messages (ms). Replace the polling with a
// realtime subscription (Supabase Realtime / Firestore onSnapshot) once that is enabled.
const POLL_INTERVAL_MS = 5000;

const ConversationServiceProvider = ({ navigation, route }) => {
    const conversationId = route?.params?.conversationId;
    const contactName = route?.params?.contactName || 'Conversation';
    const jobTitle = route?.params?.jobTitle || '';
    const isOnline = route?.params?.isOnline ?? false;

    // Messages come from GET /conversations/:id/messages.
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    const loadMessages = useCallback(async () => {
        if (!conversationId) {
            setLoadFailed(true);
            return;
        }
        try {
            const data = await getConversationMessages(conversationId);
            setMessages(data?.messages ?? []);
            setLoadFailed(false);
        } catch (error) {
            // Keep the last known messages. A 401 is already handled by api/client.
            setLoadFailed(true);
        }
    }, [conversationId]);

    // Load when the screen is focused and keep checking for new messages while it is.
    useFocusEffect(
        useCallback(() => {
            loadMessages().finally(() => setLoading(false));
            const timer = setInterval(loadMessages, POLL_INTERVAL_MS);
            return () => clearInterval(timer);
        }, [loadMessages]),
    );

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [messages.length]);

    const handleBack = () => {
        navigation.goBack();
    };

    const handleSendMessage = async () => {
        const trimmed = messageText.trim();
        if (!trimmed || sending || !conversationId) return;

        // Show the message right away, then swap in the saved one from the backend.
        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: tempId, text: trimmed, sender: 'provider', createdAt: new Date().toISOString() },
        ]);
        setMessageText('');
        setSending(true);
        try {
            const data = await sendConversationMessage(conversationId, trimmed);
            if (data?.message) {
                setMessages((prev) => prev.map((item) => (item.id === tempId ? data.message : item)));
            } else {
                loadMessages();
            }
        } catch (error) {
            setMessages((prev) => prev.filter((item) => item.id !== tempId));
            setMessageText(trimmed);
            Alert.alert('Message not sent', 'Please check your connection and try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Messages</Text>
                <View style={styles.headerDivider} />

                <View style={styles.conversationCard}>
                    <View style={styles.contactRow}>
                        <Text style={styles.contactName}>{contactName}</Text>
                        <View style={[styles.statusBadge, !isOnline && styles.statusBadgeOffline]}>
                            <Text style={styles.statusBadgeText}>{isOnline ? 'Online' : 'Offline'}</Text>
                        </View>
                    </View>
                    {jobTitle ? <Text style={styles.jobSubtitle}>{jobTitle}</Text> : null}
                    <View style={styles.cardDivider} />

                    {loading ? (
                        <ActivityIndicator style={styles.loader} color="#0255AF" />
                    ) : (
                        <ScrollView
                            ref={scrollRef}
                            style={styles.messagesScroll}
                            contentContainerStyle={styles.messagesContent}
                        >
                            {loadFailed && messages.length === 0 ? (
                                <TouchableOpacity onPress={loadMessages}>
                                    <Text style={styles.errorBannerText}>Couldn't load messages. Tap to retry.</Text>
                                </TouchableOpacity>
                            ) : null}
                            {messages.map((message) => {
                                const isOutgoing = message.sender === 'provider';
                                return (
                                    <View
                                        key={message.id}
                                        style={isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming}
                                    >
                                        <View style={[styles.messageBubble, isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
                                            <Text style={isOutgoing ? styles.bubbleTextOutgoing : styles.bubbleTextIncoming}>
                                                {message.text}
                                            </Text>
                                        </View>
                                        <Text style={styles.timestampText}>{formatDateTime(message.createdAt)}</Text>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.messageInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#AAAAAA"
                        value={messageText}
                        onChangeText={setMessageText}
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={sending}>
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 12,
    },
    backButton: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    backArrow: {
        fontSize: 30,
        color: '#111111',
        fontWeight: '400',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 12,
    },
    headerDivider: {
        height: 1,
        backgroundColor: '#E5E5E5',
        marginBottom: 16,
    },
    conversationCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    contactName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    statusBadge: {
        backgroundColor: '#2FAE60',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    statusBadgeOffline: {
        backgroundColor: '#9E9E9E',
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    jobSubtitle: {
        fontSize: 12,
        color: '#888888',
        marginTop: 3,
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#EDEDED',
        marginVertical: 12,
    },
    messagesScroll: {
        flex: 1,
    },
    messagesContent: {
        paddingBottom: 8,
    },
    messageRowOutgoing: {
        alignItems: 'flex-end',
        marginBottom: 14,
    },
    messageRowIncoming: {
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    messageBubble: {
        maxWidth: '78%',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    bubbleOutgoing: {
        backgroundColor: '#3B6FD6',
        borderBottomRightRadius: 4,
    },
    bubbleIncoming: {
        backgroundColor: '#F0F0F0',
        borderBottomLeftRadius: 4,
    },
    bubbleTextOutgoing: {
        fontSize: 13,
        color: '#FFFFFF',
    },
    bubbleTextIncoming: {
        fontSize: 13,
        color: '#222222',
    },
    timestampText: {
        fontSize: 10,
        color: '#999999',
        marginTop: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 13,
        color: '#111111',
        marginRight: 10,
    },
    sendButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 22,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
    },
    sendButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    loader: {
        marginTop: 30,
    },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: {
        fontSize: 13,
        color: '#555555',
    },
});

export default ConversationServiceProvider;