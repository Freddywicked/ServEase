import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ACTIVE_TAB = 'Chat';

// Bottom tab definitions — each tab carries both its active (white) and
// inactive (colored) icon so the same list can drive the bar regardless of
// which tab is currently active.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Hardcoded thread header — once navigation params + the backend are wired
// up, this should come from route.params (e.g. route.params.conversationId)
// and a fetch call instead of being hardcoded here.
const CONVERSATION = {
    senderName: 'Nick Duran',
    subject: 'Laptop screen repair',
    isOnline: true,
};

// Hardcoded message thread — the adviser wants the coded frontend checked
// before the backend exists. Once the API is ready, drop this array and
// populate the thread via setMessages(...) from a fetch instead.
// `isSender: true` is included so sent bubbles (right-aligned, colored) can
// be told apart from received ones (left-aligned, gray) once real messages
// come in.
const MESSAGE_THREAD = [
    { id: '1', text: 'K lang.', timestamp: 'Jun 24 9:12 AM', isSender: false },
];

const ConversationCustomer = ({ navigation }) => {
    const [draft, setDraft] = useState('');

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleSend = () => {
        // TODO: send `draft` to the backend once the messaging API is ready,
        // then append the new message to MESSAGE_THREAD / clear the input.
    };

    const renderMessageItem = ({ item }) => (
        <View>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            <View style={item.isSender ? styles.bubbleSent : styles.bubbleReceived}>
                <Text style={item.isSender ? styles.bubbleTextSent : styles.bubbleTextReceived}>{item.text}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.header}>Messages</Text>
            </View>

            <FlatList
                data={MESSAGE_THREAD}
                keyExtractor={(item) => item.id}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View style={styles.conversationCard}>
                        <View style={styles.conversationTopRow}>
                            <Text style={styles.senderName}>{CONVERSATION.senderName}</Text>
                            {CONVERSATION.isOnline && (
                                <View style={styles.onlineBadge}>
                                    <Text style={styles.onlineBadgeText}>Online</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.subject}>{CONVERSATION.subject}</Text>
                        <View style={styles.divider} />
                    </View>
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

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => handleTabPress(tab.key)}>
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image source={isActive ? tab.activeIcon : tab.inactiveIcon} style={styles.tabIcon} />
                                <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}> {tab.label}</Text>
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

export default ConversationCustomer;