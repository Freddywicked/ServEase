import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations } from '../api/providerWork_api';

const ACTIVE_TAB = 'Chat';

// Bottom tab definitions — identical set/route names to Job.js.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequest', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_dollar_white.png'), inactiveIcon: require('../assets/icon_dollar_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

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
        navigation.navigate('ConversationServiceProvider', {
            conversationId: conversation.id,
            contactName: conversation.name,
            jobTitle: conversation.jobTitle,
            isOnline: conversation.isOnline,
        });
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <Text style={styles.headerTitle}>Messages</Text>

                {loadFailed && (
                    <TouchableOpacity style={styles.errorBanner} onPress={loadConversations}>
                        <Text style={styles.errorBannerText}>Couldn't load your messages. Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                {loading ? (
                    <ActivityIndicator style={styles.loader} color="#0255AF" />
                ) : conversations.length > 0 ? (
                    conversations.map((conversation) => (
                        <TouchableOpacity
                            key={conversation.id}
                            style={styles.conversationCard}
                            onPress={() => handleOpenConversation(conversation)}
                            activeOpacity={0.85}
                        >
                            {/^https?:\/\//.test(conversation.avatarUrl || '') ? (
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
                    !loadFailed && <Text style={styles.emptyStateText}>No messages yet</Text>
                )}
            </ScrollView>

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => handleTabPress(tab.key)}
                        >
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image
                                    source={isActive ? tab.activeIcon : tab.inactiveIcon}
                                    style={styles.tabIcon}
                                />
                                <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}>
                                    {tab.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    conversationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E0E0E0',
        marginRight: 14,
    },
    conversationTextWrap: {
        flex: 1,
    },
    contactName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 3,
    },
    lastMessage: {
        fontSize: 12,
        color: '#888888',
    },
    unreadDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#3B6FD6',
        marginLeft: 10,
    },
    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
    },
    tabItemInactive: {
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    tabItemActive: {
        alignItems: 'center',
        backgroundColor: '#0255AF',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginHorizontal: 4,
    },
    tabIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 2,
    },
    tabLabel: {
        fontSize: 11,
        color: '#555555',
    },
    tabLabelActive: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '600',
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
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default MessageServiceProvider;