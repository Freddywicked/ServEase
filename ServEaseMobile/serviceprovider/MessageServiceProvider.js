import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Chat';

// Bottom tab definitions — identical set/route names to Job.js.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Hardcoded per conversation — backend isn't integrated yet. Swap this out for
// a fetched/live conversation list (e.g. a Firestore query) once the API
// exists; the shape to match is:
// { id, name, lastMessage, hasUnread, jobTitle, isOnline }
const CONVERSATIONS = [
    {
        id: '1',
        name: 'Nick Duran',
        lastMessage: 'K lang.',
        hasUnread: true,
        jobTitle: 'Laptop Screen Repair',
        isOnline: true,
    },
    {
        id: '2',
        name: 'Gabriela Lim',
        lastMessage: "Hi Ma'am, sinend ko na po yung quotation.",
        hasUnread: false,
    },
];

const MessageServiceProvider = ({ navigation }) => {
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
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Messages</Text>

                {CONVERSATIONS.map((conversation) => (
                    <TouchableOpacity
                        key={conversation.id}
                        style={styles.conversationCard}
                        onPress={() => handleOpenConversation(conversation)}
                        activeOpacity={0.85}
                    >
                        <View style={styles.avatar} />
                        <View style={styles.conversationTextWrap}>
                            <Text style={styles.contactName}>{conversation.name}</Text>
                            <Text style={styles.lastMessage} numberOfLines={1}>
                                {conversation.lastMessage}
                            </Text>
                        </View>
                        {conversation.hasUnread ? <View style={styles.unreadDot} /> : null}
                    </TouchableOpacity>
                ))}
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
});

export default MessageServiceProvider;