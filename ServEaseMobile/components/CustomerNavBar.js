import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, Keyboard, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#18315B'; // matches the design: active circle + labels

// History is NOT a tab: it is reached from the arrow on the dashboard's History card.
// Each tab carries an active (white) and inactive (colored) icon.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_search_white.png'), inactiveIcon: require('../assets/icon_search_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Which screens show the navbar, and which tab each one highlights.
// Any screen NOT listed here hides the bar.
const ACTIVE_TAB_BY_ROUTE = {
    CustomerDashboard: 'CustomerDashboard',
    FindServiceProvider: 'FindServiceProvider',
    ProviderDetails: 'FindServiceProvider', // opened from Find, so Find stays highlighted
    Track: 'Track',
    MessageCustomer: 'MessageCustomer',
    ConversationCustomer: 'MessageCustomer', // a chat thread opened from Chat, so Chat stays highlighted
    CustomerProfile: 'CustomerProfile',
    History: 'CustomerDashboard', // History lives under Home

    // Create Service Request flow (steps 1-4): bar shown with Home highlighted, per the designs.
    // Keys are the screen names registered in App.js.
    CreateServiceRequest: 'CustomerDashboard',
    AIDiagnosis: 'CustomerDashboard',
    AIResult: 'CustomerDashboard',
    RecommendServiceProvider: 'CustomerDashboard',
    SubmitServiceRequest: 'CustomerDashboard',

    // Track flow (My Requests -> Request Details -> Payment -> Ratings): Track stays highlighted.
    RequestDetails: 'Track',
    Payment: 'Track',
    Ratings: 'Track',
};

/**
 * Rendered ONCE at the app root, next to (not inside) the navigator, so it never
 * takes part in screen-transition animations. See the App.js wiring.
 *
 *   navigationRef - the ref passed to <NavigationContainer ref={...}>
 *   routeName     - name of the currently focused screen (kept in App.js state)
 */
const CustomerNavBar = ({ navigationRef, routeName }) => {
    const insets = useSafeAreaInsets();
    const activeTab = ACTIVE_TAB_BY_ROUTE[routeName];
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Hide the bar while the keyboard is open (chat input, search bar) so it doesn't
    // float above the keyboard or squeeze the screen.
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    if (!activeTab || keyboardVisible) return null;

    const handlePress = (tabKey) => {
        // Compare with the screen we're actually on (not the highlighted tab), so Home
        // still works from History, where Home is highlighted but we're not on the dashboard.
        if (tabKey === routeName || !navigationRef.isReady()) return;
        navigationRef.navigate(tabKey);
    };

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.bar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => handlePress(tab.key)}
                            accessibilityRole="button"
                            accessibilityLabel={tab.label}
                            accessibilityState={{ selected: isActive }}
                        >
                            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                                <Image source={tab.inactiveIcon} style={[styles.icon, isActive && styles.iconActive]} />
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
    // Every tab reserves the same 32px circle, so only its fill changes when active
    // (no layout shift). Active = filled navy circle with the white icon inside.
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
    label: {
        fontSize: 12,
        lineHeight: 18,
        color: NAVY,
        marginTop: 2,
    },
});

export default CustomerNavBar;