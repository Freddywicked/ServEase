import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ROUTES } from '../navigation/routes';

const NAVY = '#1B2A5C';

// History is intentionally NOT a tab anymore: it is reached from the arrow on the
// dashboard's History card. Each tab carries an active (white) and inactive (colored) icon.
const TAB_ITEMS = [
    { key: ROUTES.CUSTOMER_HOME, label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_search_white.png'), inactiveIcon: require('../assets/icon_search_colored.png') },
    { key: ROUTES.TRACK, label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

/**
 * Usage: <CustomerNavBar activeTab={ROUTES.CUSTOMER_HOME} />
 * Pass activeTab={null} on screens that live under no tab (e.g. History).
 */
const CustomerNavBar = ({ activeTab }) => {
    const navigation = useNavigation();
    const route = useRoute();

    const handlePress = (tabKey) => {
        // Compare with the screen we're actually on (not the highlighted tab), so Home
        // still works from History, where Home is highlighted but we're not on the dashboard.
        if (tabKey === route.name) return;
        navigation.navigate(tabKey);
    };

    return (
        <View style={styles.wrapper}>
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
                                <Image source={isActive ? tab.activeIcon : tab.inactiveIcon} style={styles.icon} />
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
        paddingBottom: 8,
        paddingTop: 4,
        backgroundColor: 'transparent',
    },
    bar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: '#E6E6E6',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapActive: {
        backgroundColor: NAVY,
    },
    icon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
    },
    label: {
        fontSize: 12,
        color: NAVY,
        marginTop: 2,
    },
});

export default CustomerNavBar;