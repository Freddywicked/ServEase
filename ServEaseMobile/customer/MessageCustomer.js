import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
// Same backend endpoints the provider's Messages screen uses — GET /conversations
// is role-aware, so a customer gets their threads with service providers here.
import { getConversations, deleteConversation } from '../api/providerWork_api';
import { COLORS } from '../constants/theme';
import { openConversation, syncUnreadFromConversations } from '../utils/chatUnread';
import { POLL_INTERVAL_MS, ROUTES, TEXT } from '../constants/messaging';

const MessageCustomer = ({ navigation }) => {
    // Conversation shape (GET /conversations): { id ('SR-0007'), name, avatarUrl,
    // lastMessage, hasUnread, jobTitle, isOnline }.
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

    // Reload on focus and pull-to-refresh, so a provider's reply (and the unread
    // dot clearing after reading a thread) shows up without restarting the app.
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

    // Long-press a chat to delete it (asks first, then removes it in the backend and the list).
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
                    <Text style={styles.deletePrompt}>Do you want to delete this message?</Text>
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
        navigation.navigate(ROUTES.CONVERSATION_CUSTOMER, {
            conversationId: conversation.id,
            contactName: conversation.name,
            jobTitle: conversation.jobTitle,
            isOnline: conversation.isOnline,
            requestStatus: conversation.requestStatus,
        });
    };

    const renderMessageItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handleOpenConversation(item)}
            onLongPress={() => setDeleteTarget(item)}
            delayLongPress={400}
        >
            {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
            ) : (
                <View style={styles.avatar} />
            )}
            <View style={styles.cardContent}>
                <Text style={styles.senderName}>{item.name}</Text>
                {!!item.requestNumber && (
                    <Text style={styles.requestTag} numberOfLines={1}>
                        Request #{item.requestNumber}
                        {item.requestStatus ? ` · ${item.requestStatus}` : ''}
                    </Text>
                )}
                <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage || TEXT.aboutRequest(item.id)}
                </Text>
            </View>
            {item.hasUnread && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                ListHeaderComponent={
                    <View>
                        <Text style={styles.header}>{TEXT.messagesTitle}</Text>
                        {loadFailed && (
                            <TouchableOpacity onPress={loadConversations}>
                                <Text style={styles.errorText}>{TEXT.loadConversationsFailed}</Text>
                            </TouchableOpacity>
                        )}
                        {loading && <ActivityIndicator color={COLORS.accent} style={styles.loader} />}
                    </View>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>{TEXT.noMessagesYet}</Text>
                        </View>
                    ) : null
                }
            />
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
    listContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        flexGrow: 1,
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.primary,
        marginBottom: 20,
    },
    loader: {
        marginBottom: 12,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        backgroundColor: COLORS.white,
        padding: 16,
        marginBottom: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.avatarPlaceholder,
        marginRight: 14,
    },
    cardContent: {
        flex: 1,
    },
    senderName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.ink600,
    },
    requestTag: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primary,
        marginTop: 2,
    },
    lastMessage: {
        fontSize: 13,
        color: COLORS.grey600,
        marginTop: 2,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        marginLeft: 10,
    },
    errorText: {
        fontSize: 12,
        color: COLORS.error,
        textAlign: 'center',
        marginBottom: 12,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyStateText: {
        fontSize: 13,
        color: COLORS.grey400,
        textAlign: 'center',
    },
});

export default MessageCustomer;