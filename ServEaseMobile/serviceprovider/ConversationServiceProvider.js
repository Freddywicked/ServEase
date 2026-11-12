import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, TextInput, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
// Same thread endpoints the customer's chat uses — the backend is role-aware and
// marks the thread read for whichever side opens it.
import { getConversationMessages, sendConversationMessage } from '../api/providerWork_api';
import { formatDateTime } from '../utils/provider_formatters';
import { COLORS } from '../constants/theme';
import { closeConversation, openConversation } from '../utils/chatUnread';
import { POLL_INTERVAL_MS, SENDER, TEXT } from '../constants/messaging';

const ConversationServiceProvider = ({ navigation, route }) => {
    // Passed by the provider's message list: the thread id is the request reference ("SR-0007").
    const conversationId = route?.params?.conversationId;
    const contactName = route?.params?.contactName || TEXT.defaultConversationName;
    const subject = route?.params?.jobTitle || '';
    const isOnline = route?.params?.isOnline ?? false;

    // Message shape (GET /conversations/:id/messages): { id, text, sender, senderId, createdAt }.
    // `sender === SENDER.PROVIDER` is this user — the right-aligned bubble.
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
            // Keep the last known messages. A 401 is already handled by api/client.
            setLoadFailed(true);
        }
    }, [conversationId]);

    // Load on focus and keep polling while the thread is open, so the customer's
    // replies appear without leaving the screen.
    useFocusEffect(
        useCallback(() => {
            // This thread is now being read: it no longer counts as unread, and replies
            // that arrive while it is open are not counted either.
            openConversation(conversationId);
            loadMessages().finally(() => setLoading(false));
            const timer = setInterval(loadMessages, POLL_INTERVAL_MS);
            return () => {
                clearInterval(timer);
                closeConversation(conversationId);
            };
        }, [loadMessages, conversationId]),
    );

    useEffect(() => {
        listRef.current?.scrollToEnd({ animated: true });
    }, [messages.length]);

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || sending || !conversationId) return;

        // Show the message right away, then swap in the saved one from the backend.
        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [...prev, { id: tempId, text, sender: SENDER.PROVIDER, createdAt: new Date().toISOString() }]);
        setDraft('');
        setSending(true);
        try {
            const data = await sendConversationMessage(conversationId, text);
            if (data?.message) {
                setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
            } else {
                loadMessages();
            }
        } catch (error) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            setDraft(text);
            Alert.alert(TEXT.messageNotSentTitle, error.message || TEXT.messageNotSentFallback);
        } finally {
            setSending(false);
        }
    };

    const renderMessageItem = ({ item }) => {
        const isSent = item.sender === SENDER.PROVIDER;
        return (
            <View>
                <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>
                <View style={isSent ? styles.bubbleSent : styles.bubbleReceived}>
                    <Text style={isSent ? styles.bubbleTextSent : styles.bubbleTextReceived}>{item.text}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.header}>{TEXT.messagesTitle}</Text>
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
                                    <Text style={styles.onlineBadgeText}>{TEXT.online}</Text>
                                </View>
                            )}
                        </View>
                        {!!subject && <Text style={styles.subject}>{subject}</Text>}
                        {loadFailed && (
                            <TouchableOpacity onPress={loadMessages}>
                                <Text style={styles.loadErrorText}>{TEXT.loadMessagesFailed}</Text>
                            </TouchableOpacity>
                        )}
                        {loading && <ActivityIndicator color={COLORS.accent} style={styles.loader} />}
                        <View style={styles.divider} />
                    </View>
                }
                ListEmptyComponent={
                    !loading && !loadFailed ? <Text style={styles.emptyThreadText}>{TEXT.noMessagesSayHi}</Text> : null
                }
            />

            <View style={styles.inputBar}>
                <TextInput
                    style={styles.textInput}
                    placeholder={TEXT.messagePlaceholder}
                    placeholderTextColor={COLORS.placeholder}
                    value={draft}
                    onChangeText={setDraft}
                />
                <TouchableOpacity onPress={handleSend} activeOpacity={0.8} disabled={sending}>
                    <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryGradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sendButton}
                    >
                        <Text style={styles.sendButtonText}>{TEXT.send}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loadErrorText: {
        fontSize: 12,
        color: COLORS.error,
        textAlign: 'center',
        marginVertical: 8,
    },
    emptyThreadText: {
        fontSize: 13,
        color: COLORS.grey400,
        textAlign: 'center',
        marginTop: 24,
    },
    loader: {
        marginVertical: 8,
    },
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
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
        color: COLORS.primary,
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
        color: COLORS.ink800,
    },
    onlineBadge: {
        backgroundColor: COLORS.online,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    onlineBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.white,
    },
    subject: {
        fontSize: 13,
        color: COLORS.grey600,
        marginTop: 4,
        marginBottom: 14,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
    },
    timestamp: {
        fontSize: 11,
        color: COLORS.placeholder,
        textAlign: 'center',
        marginTop: 14,
        marginBottom: 8,
    },
    bubbleReceived: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.bubbleIncomingCustomer,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        maxWidth: '75%',
    },
    bubbleSent: {
        alignSelf: 'flex-end',
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        maxWidth: '75%',
    },
    bubbleTextReceived: {
        fontSize: 14,
        color: COLORS.ink800,
    },
    bubbleTextSent: {
        fontSize: 14,
        color: COLORS.white,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.borderInput,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.ink600,
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
        color: COLORS.white,
    },
});

export default ConversationServiceProvider;