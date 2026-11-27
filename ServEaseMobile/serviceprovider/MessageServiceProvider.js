import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations, deleteConversation } from '../api/providerWork_api';
import { COLORS } from '../constants/theme';
import { openConversation, syncUnreadFromConversations } from '../utils/chatUnread';
import { AVATAR_URL_PATTERN, POLL_INTERVAL_MS, ROUTES, TEXT } from '../constants/messaging';

const MessageServiceProvider = ({ navigation }) => {
    // Conversations come from GET /conversations (see api/providerWorkApi.js for the shape).
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const loadConversations = useCallback(async () => {
        try {
            const data = await getConversations();
            const list = data?.conversations ?? [];
            setConversations(list);
            syncUnreadFromConversations(list); // keeps the navbar number in step with the list
            setLoadFailed(false);
        } catch (error) {
            // Keep the last known list. A 401 is already handled by api/client.
            setLoadFailed(true);
        }
    }, []);

    // Reload whenever the screen regains focus so new messages and unread dots update.
    useFocusEffect(
        useCallback(() => {
            loadConversations().finally(() => setLoading(false));
            // Keep polling while the list is on screen so new messages and unread dots
            // arrive in real time.
            const timer = setInterval(loadConversations, POLL_INTERVAL_MS);
            return () => clearInterval(timer);
        }, [loadConversations]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadConversations();
        setRefreshing(false);
    };

    // Long-press a chat to delete it for this provider only. The customer keeps their history.
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!deleteTarget || deleting) return;
        setDeleting(true);
        try {
            await deleteConversation(deleteTarget.id);
            const remaining = conversations.filter((c) => c.id !== deleteTarget.id);
            setConversations(remaining);
            syncUnreadFromConversations(remaining); // keeps the navbar number in step with the list
            setDeleteTarget(null);
        } catch (error) {
            setDeleteTarget(null);
            Alert.alert('Message not deleted', error.message || 'Something went wrong. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const modal = (
        <Modal
            visible={!!deleteTarget}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => !deleting && setDeleteTarget(null)}
        >
            <View style={styles.deleteOverlay}>
                <View style={styles.deleteCard}>
                    <Text style={styles.deletePrompt}>Delete this chat for you? The customer will still keep their copy.</Text>
                    <View style={styles.deleteButtonRow}>
                        <TouchableOpacity
                            style={[styles.deleteButton, styles.deleteNoButton]}
                            onPress={() => setDeleteTarget(null)}
                            disabled={deleting}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.deleteNoText}>No</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.deleteButton, styles.deleteYesButton]}
                            onPress={handleConfirmDelete}
                            disabled={deleting}
                            activeOpacity={0.8}
                        >
                            {deleting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.deleteYesText}>Yes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const handleOpenConversation = (conversation) => {
        // Opening a thread marks it read: its dot goes away and the navbar number drops by one.
        if (conversation.hasUnread) {
            setConversations((prev) => prev.map((c) => (c.id === conversation.id ? { ...c, hasUnread: false } : c)));
        }
        openConversation(conversation.id);
        navigation.navigate(ROUTES.CONVERSATION_PROVIDER, {
            conversationId: conversation.id,
            contactName: conversation.name,
            jobTitle: conversation.jobTitle,
            isOnline: conversation.isOnline,
            requestStatus: conversation.requestStatus,
        });
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <Text style={styles.headerTitle}>{TEXT.messagesTitle}</Text>

                {loadFailed && (
                    <TouchableOpacity style={styles.errorBanner} onPress={loadConversations}>
                        <Text style={styles.errorBannerText}>{TEXT.loadConversationsFailed}</Text>
                    </TouchableOpacity>
                )}

                {loading ? (
                    <ActivityIndicator style={styles.loader} color={COLORS.accent} />
                ) : conversations.length > 0 ? (
                    conversations.map((conversation) => (
                        <TouchableOpacity
                            key={conversation.id}
                            style={styles.conversationCard}
                            onPress={() => handleOpenConversation(conversation)}
                            onLongPress={() => setDeleteTarget(conversation)}
                            delayLongPress={400}
                            activeOpacity={0.85}
                        >
                            {AVATAR_URL_PATTERN.test(conversation.avatarUrl || '') ? (
                                <Image source={{ uri: conversation.avatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatar} />
                            )}
                            <View style={styles.conversationTextWrap}>
                                <Text style={styles.contactName}>{conversation.name}</Text>
                                {!!conversation.requestNumber && (
                    <Text style={styles.requestTag} numberOfLines={1}>
                        Request #{conversation.requestNumber}
                        {conversation.requestStatus ? ` · ${conversation.requestStatus}` : ''}
                    </Text>
                )}
                                <Text style={styles.lastMessage} numberOfLines={1}>
                                    {conversation.lastMessage}
                                </Text>
                            </View>
                            {conversation.hasUnread ? <View style={styles.unreadDot} /> : null}
                        </TouchableOpacity>
                    ))
                ) : (
                    !loadFailed && <Text style={styles.emptyStateText}>{TEXT.noMessagesYet}</Text>
                )}
            </ScrollView>
            {modal}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    // Delete-message popup (Figma: "Message - Customer - Delete message modal")
    deleteOverlay: {
        flex: 1,
        backgroundColor: 'rgba(211, 211, 211, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    deleteCard: {
        width: '100%',
        maxWidth: 337,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingTop: 43,
        paddingBottom: 48,
        alignItems: 'center',
    },
    deletePrompt: {
        width: 203,
        fontSize: 20,
        lineHeight: 23,
        color: '#414141',
    },
    deleteButtonRow: {
        flexDirection: 'row',
        marginTop: 46,
    },
    deleteButton: {
        width: 85,
        height: 35,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
    },
    deleteNoButton: {
        backgroundColor: '#FFFDFD',
    },
    deleteYesButton: {
        backgroundColor: COLORS.primary,
    },
    deleteNoText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#414141',
    },
    deleteYesText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.primary,
        marginBottom: 16,
    },
    conversationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.avatarPlaceholder,
        marginRight: 14,
    },
    conversationTextWrap: {
        flex: 1,
    },
    contactName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.ink900,
        marginBottom: 3,
    },
    requestTag: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primary,
        marginTop: 2,
    },
    lastMessage: {
        fontSize: 12,
        color: COLORS.grey500,
    },
    unreadDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: COLORS.accentSoft,
        marginLeft: 10,
    },
    loader: {
        marginTop: 30,
    },
    errorBanner: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceMuted,
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: {
        fontSize: 13,
        color: COLORS.grey700,
    },
    emptyStateText: {
        fontSize: 13,
        color: COLORS.grey400,
        textAlign: 'center',
        marginTop: 20,
    },
});

export default MessageServiceProvider;