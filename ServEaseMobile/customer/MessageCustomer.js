import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
// Same backend endpoints the provider's Messages screen uses — GET /conversations
// is role-aware, so a customer gets their threads with service providers here.
import { getConversations } from '../api/providerWork_api';

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
            setConversations(data?.conversations ?? []);
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
        }, [loadConversations]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadConversations();
        setRefreshing(false);
    };

    const renderMessageItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() =>
                navigation.navigate('ConversationCustomer', {
                    conversationId: item.id,
                    contactName: item.name,
                    jobTitle: item.jobTitle,
                    isOnline: item.isOnline,
                })
            }
        >
            {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
            ) : (
                <View style={styles.avatar} />
            )}
            <View style={styles.cardContent}>
                <Text style={styles.senderName}>{item.name}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage || `About your request ${item.id}`}
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
                        <Text style={styles.header}>Messages</Text>
                        {loadFailed && (
                            <TouchableOpacity onPress={loadConversations}>
                                <Text style={styles.errorText}>Couldn't load your messages. Tap to retry.</Text>
                            </TouchableOpacity>
                        )}
                        {loading && <ActivityIndicator color="#0255AF" style={{ marginBottom: 12 }} />}
                    </View>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No Messages yet</Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
        color: '#1B2A8C',
        marginBottom: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E0E0E0',
        marginRight: 14,
    },
    cardContent: {
        flex: 1,
    },
    senderName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333333',
    },
    lastMessage: {
        fontSize: 13,
        color: '#777777',
        marginTop: 2,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#0255AF',
        marginLeft: 10,
    },
    errorText: {
        fontSize: 12,
        color: '#B00020',
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
        color: '#999999',
        textAlign: 'center',
    },
});

export default MessageCustomer;