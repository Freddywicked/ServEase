import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, TextInput, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
// Same thread endpoints the provider's chat uses — the backend is role-aware and
// marks the thread read for whichever side opens it.
import { getConversationMessages, sendConversationMessage } from '../api/providerWork_api';

// How often the open thread checks for new messages (ms). Replace the polling with a
// realtime subscription (Supabase Realtime / FCM) once that is enabled.
const POLL_INTERVAL_MS = 5000;

const formatTimestamp = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    })}`;
};

const ConversationCustomer = ({ navigation, route }) => {
    // Passed by MessageCustomer.js: the thread id is the request reference ("SR-0007").
    const conversationId = route?.params?.conversationId;
    const contactName = route?.params?.contactName || 'Service provider';
    const subject = route?.params?.jobTitle || '';
    const isOnline = route?.params?.isOnline ?? false;

    // Message shape (GET /conversations/:id/messages): { id, text, sender, senderId, createdAt }.
    // `sender === 'customer'` is this user — the right-aligned bubble.
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [sending, setSending] = useState(false);
    const listRef = useRef(null);

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
            setLoadFailed(true);
        }
    }, [conversationId]);

    // Load on focus and keep polling while the thread is open, so the provider's
    // replies appear without leaving the screen.
    useFocusEffect(
        useCallback(() => {
            loadMessages().finally(() => setLoading(false));
            const timer = setInterval(loadMessages, POLL_INTERVAL_MS);
            return () => clearInterval(timer);
        }, [loadMessages]),
    );

    useEffect(() => {
        listRef.current?.scrollToEnd({ animated: true });
    }, [messages.length]);

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || sending || !conversationId) return;

        // Show the message right away, then swap in the saved one from the backend.
        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [...prev, { id: tempId, text, sender: 'customer', createdAt: new Date().toISOString() }]);
        setDraft('');
        setSending(true);
        try {
            const data = await sendConversationMessage(conversationId, text);
            const saved = data?.message;
            setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
        } catch (error) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            setDraft(text);
            Alert.alert('Message not sent', error.message);
        } finally {
            setSending(false);
        }
    };

    const renderMessageItem = ({ item }) => (
        <View>
            <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
            <View style={item.sender === 'customer' ? styles.bubbleSent : styles.bubbleReceived}>
                <Text style={item.sender === 'customer' ? styles.bubbleTextSent : styles.bubbleTextReceived}>
                    {item.text}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.header}>Messages</Text>
            </View>

            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View style={styles.conversationCard}>
                        <View style={styles.conversationTopRow}>
                            <Text style={styles.senderName}>{contactName}</Text>
                            {isOnline && (
                                <View style={styles.onlineBadge}>
                                    <Text style={styles.onlineBadgeText}>Online</Text>
                                </View>
                            )}
                        </View>
                        {!!subject && <Text style={styles.subject}>{subject}</Text>}
                        {loadFailed && (
                            <TouchableOpacity onPress={loadMessages}>
                                <Text style={styles.loadErrorText}>Couldn't load messages. Tap to retry.</Text>
                            </TouchableOpacity>
                        )}
                        {loading && <ActivityIndicator color="#0255AF" style={{ marginVertical: 8 }} />}
                        <View style={styles.divider} />
                    </View>
                }
                ListEmptyComponent={
                    !loading && !loadFailed ? <Text style={styles.emptyThreadText}>No messages yet — say hi!</Text> : null
                }
            />

            <View style={styles.inputBar}>
                <TextInput
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#9AA0AE"
                    value={draft}
                    onChangeText={setDraft}
                />
                <TouchableOpacity onPress={handleSend} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#1B2A8C', '#4A7FBF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sendButton}
                    >
                        <Text style={styles.sendButtonText}>Send</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loadErrorText: {
        fontSize: 12,
        color: '#B00020',
        textAlign: 'center',
        marginVertical: 8,
    },
    emptyThreadText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 24,
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    topBar: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 4,
    },
    backIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 12,
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    listContent: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 24,
        flexGrow: 1,
    },
    conversationCard: {
        marginBottom: 16,
    },
    conversationTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    senderName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    onlineBadge: {
        backgroundColor: '#4CAF50',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    onlineBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    subject: {
        fontSize: 13,
        color: '#777777',
        marginTop: 4,
        marginBottom: 14,
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    timestamp: {
        fontSize: 11,
        color: '#9AA0AE',
        textAlign: 'center',
        marginTop: 14,
        marginBottom: 8,
    },
    bubbleReceived: {
        alignSelf: 'flex-start',
        backgroundColor: '#E5E5EA',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        maxWidth: '75%',
    },
    bubbleSent: {
        alignSelf: 'flex-end',
        backgroundColor: '#1B2A8C',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        maxWidth: '75%',
    },
    bubbleTextReceived: {
        fontSize: 14,
        color: '#1A1A1A',
    },
    bubbleTextSent: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#D9DDE4',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        color: '#333333',
        marginRight: 10,
    },
    sendButton: {
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default ConversationCustomer;