import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations } from '../api/providerWork_api';
import { COLORS } from '../constants/theme';
import { AVATAR_URL_PATTERN, ROUTES, TEXT } from '../constants/messaging';

const MessageServiceProvider = ({ navigation }) => {
    // Conversations come from GET /conversations (see api/providerWorkApi.js for the shape).
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const loadConversations = useCallback(async () => {
        try {
            const data = await getConversations();
            setConversations(data?.conversations ?? []);
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
        }, [loadConversations]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadConversations();
        setRefreshing(false);
    };

    const handleOpenConversation = (conversation) => {
        navigation.navigate(ROUTES.CONVERSATION_PROVIDER, {
            conversationId: conversation.id,
            contactName: conversation.name,
            jobTitle: conversation.jobTitle,
            isOnline: conversation.isOnline,
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
                            activeOpacity={0.85}
                        >
                            {AVATAR_URL_PATTERN.test(conversation.avatarUrl || '') ? (
                                <Image source={{ uri: conversation.avatarUrl }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatar} />
                            )}
                            <View style={styles.conversationTextWrap}>
                                <Text style={styles.contactName}>{conversation.name}</Text>
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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