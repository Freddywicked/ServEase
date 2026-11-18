import React, { useEffect, useState } from 'react';
import { View, Image, Text, TouchableOpacity, Keyboard, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatUnreadCount, useChatUnreadPolling } from '../utils/chatUnread';
import {
    useProviderBadgeCounts,
    useProviderBadgePolling,
    markProviderTabSeen,
    setProviderViewingTab,
} from '../utils/providerTabBadges';

const NAVY = '#18315B';

// Figma: the Requests icon is 24 x 23 (the other tab icons use the default 20 x 20).
const REQUEST_ICON_SIZE = { width: 24, height: 23 };

// Earnings is NOT a tab: it is reached from the Earnings container on the dashboard.
// Each tab carries an active (white, inside a navy circle) and an inactive (colored) icon.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequest', label: 'Requests', activeIcon: require('../assets/icon_request_white.png'), inactiveIcon: require('../assets/icon_request_colored.png'), iconStyle: REQUEST_ICON_SIZE },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Which screens show the navbar, and which tab each one highlights.
// Any screen NOT listed here (conversation, job detail screens, etc.) hides the bar.
const ACTIVE_TAB_BY_ROUTE = {
    ServiceProviderDashboard: 'ServiceProviderDashboard',
    IncomingServiceRequest: 'IncomingServiceRequest',
    ViewServiceRequest: 'IncomingServiceRequest', // opened from Requests
    Jobs: 'Jobs',
    MessageServiceProvider: 'MessageServiceProvider',
    ServiceProviderProfile: 'ServiceProviderProfile',
    Earnings: 'ServiceProviderDashboard', // Earnings lives under Home
    JobUpdateStatus: 'Jobs', // opened from Jobs
    JobAdditionalParts: 'Jobs', // opened from Jobs
    ConversationServiceProvider: 'MessageServiceProvider', // opened from Chat
};

// Tabs whose badge is a "new since you last looked" counter kept by the backend
// (key = the backend's tab name). The chat badge keeps using the chat-unread hook.
const SEEN_KEY_BY_TAB = {
    IncomingServiceRequest: 'requests',
    Jobs: 'jobs',
};

// The badge is "seen" only when the provider is ON the tab's own screen (a detail screen
// such as ViewServiceRequest highlights Requests but does not clear it).
const SEEN_KEY_BY_ROUTE = {
    IncomingServiceRequest: 'requests',
    Jobs: 'jobs',
};

/**
 * Rendered ONCE at the app root, next to (not inside) the navigator, so it never
 * takes part in screen-transition animations. See the App.js wiring.
 *
 *   navigationRef - the ref passed to <NavigationContainer ref={...}>
 *   routeName     - name of the currently focused screen (kept in App.js state)
 */
const ServiceProviderNavBar = ({ navigationRef, routeName }) => {
    const insets = useSafeAreaInsets();
    const activeTab = ACTIVE_TAB_BY_ROUTE[routeName];

    // Real-time unread-conversation count, polled from the backend (see utils/chatUnread.js).
    // Polls only while the bar is visible (i.e. the user is signed in on a tab screen).
    useChatUnreadPolling(!!activeTab);
    const unreadChatCount = useChatUnreadCount();

    // Unread Requests / Jobs counters from the backend (see utils/providerTabBadges.js).
    useProviderBadgePolling(!!activeTab);
    const { requests: newRequestCount, jobs: newJobCount } = useProviderBadgeCounts();

    // While the provider is on the Requests or Jobs screen nothing counts as unseen,
    // however they got there (tab tap, dashboard card, back button).
    useEffect(() => {
        setProviderViewingTab(SEEN_KEY_BY_ROUTE[routeName] || null);
    }, [routeName]);

    // Add more tabs here later without touching the render code.
    const badgeCounts = {
        IncomingServiceRequest: newRequestCount,
        Jobs: newJobCount,
        MessageServiceProvider: unreadChatCount,
    };
    const badgeWord = { MessageServiceProvider: 'unread' }; // everything else reads "new"

    // Hide the bar while the keyboard is open (chat, notes and cost inputs), so it
    // doesn't ride up on top of the keyboard.
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    if (!activeTab || keyboardVisible) return null;

    const handlePress = (tabKey) => {
        // Tapping Requests/Jobs clears its badge right away, even when we're already on it.
        const seenKey = SEEN_KEY_BY_TAB[tabKey];
        if (seenKey) markProviderTabSeen(seenKey);

        // Compare with the screen we're actually on (not the highlighted tab), so Home
        // still works from Earnings, where Home is highlighted but we're not on the dashboard.
        if (tabKey === routeName || !navigationRef.isReady()) return;
        navigationRef.navigate(tabKey);
    };

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.bar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    const badgeCount = badgeCounts[tab.key] || 0;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => handlePress(tab.key)}
                            accessibilityRole="button"
                            accessibilityLabel={badgeCount > 0 ? `${tab.label}, ${badgeCount} ${badgeWord[tab.key] || 'new'}` : tab.label}
                            accessibilityState={{ selected: isActive }}
                        >
                            <View style={styles.iconSlot}>
                                <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                                    <Image source={tab.inactiveIcon} style={[styles.icon, tab.iconStyle, isActive && styles.iconActive]} />
                                </View>
                                {badgeCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.label}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 16,
        paddingTop: 4,
        backgroundColor: '#FFFFFF',
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 77,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderTopWidth: 1,
        borderTopColor: '#CCCCCC',
        paddingHorizontal: 6,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden', // clips the fill to a true circle
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapActive: {
        backgroundColor: NAVY,
    },
    icon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    // Active = the same glyph tinted white on the navy circle (instead of a separate *_white.png,
    // which can carry its own square background and show up as a square behind the circle).
    iconActive: {
        tintColor: '#FFFFFF',
    },
    // Red unread badge, sits on the top-right of the icon circle (outside the clipped circle).
    iconSlot: {
        width: 32,
        height: 32,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -9,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        backgroundColor: '#C62828',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        zIndex: 2,
    },
    badgeText: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    label: {
        fontFamily: 'Poppins-Regular', // Figma font; assets/fonts/Poppins-Regular.ttf (falls back to the system font if missing)
        fontSize: 12,
        lineHeight: 18,
        color: NAVY,
        marginTop: 2,
    },
});

export default ServiceProviderNavBar;