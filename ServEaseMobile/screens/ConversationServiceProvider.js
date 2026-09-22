import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Chat';

// Bottom tab definitions — identical set/route names to ServiceProviderChat.js.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'Requests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Hardcoded thread — backend isn't integrated yet. Swap this out for a live
// message list (e.g. a Firestore onSnapshot on this conversation's messages
// subcollection) once that's wired up; the shape to match is:
// { id, text, sender ('provider' | 'customer'), timestamp }
const INITIAL_MESSAGES = [
    {
        id: 'm1',
        text: 'Hi! Matatagalan pa to since sa Manila pa kukuning yung screen.',
        sender: 'provider',
        timestamp: 'Jun 24 9:12 AM',
    },
];

const ConversationServiceProvider = ({ navigation, route }) => {
    const contactName = route?.params?.contactName || 'Nick Duran';
    const jobTitle = route?.params?.jobTitle || 'Laptop Screen Repair';
    const isOnline = route?.params?.isOnline ?? true;

    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [messageText, setMessageText] = useState('');

    const handleBack = () => {
        navigation.goBack();
    };

    const handleSendMessage = () => {
        const trimmed = messageText.trim();
        if (!trimmed) return;
        setMessages((prev) => [
            ...prev,
            { id: String(prev.length + 1), text: trimmed, sender: 'provider', timestamp: 'Just now' },
        ]);
        setMessageText('');
        // TODO: call the send-message endpoint (or Firestore write) once the backend exists
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
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
                    <Text style={styles.jobSubtitle}>{jobTitle}</Text>
                    <View style={styles.cardDivider} />

                    <ScrollView style={styles.messagesScroll} contentContainerStyle={styles.messagesContent}>
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
                                    <Text style={styles.timestampText}>{message.timestamp}</Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.messageInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#AAAAAA"
                        value={messageText}
                        onChangeText={setMessageText}
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>

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

export default ConversationServiceProvider;