import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Profile';

// Bottom tab definitions — identical set/route names to ServiceProviderDashboard.js
// and IncomingServiceRequest.js, with Profile as the active tab this time.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequest', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const ServiceProviderProfile = ({ navigation }) => {
    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleEditProfile = () => {
        // TODO: point this to the actual edit-profile screen once it exists
        navigation.navigate('EditProfile');
    };

    const handleLogout = () => {
        // TODO: hook this up to real sign-out logic (clear auth/session) once auth is integrated
        navigation.reset({
            index: 0,
            routes: [{ name: 'LoginScreen' }],
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Profile</Text>

                <View style={styles.profileHeader}>
                    <Image source={require('../assets/icon_ellipse.png')} style={styles.avatar} />
                    <Text style={styles.name}>Sylvia Lee</Text>
                    <Text style={styles.role}>Automotive Repair Service Provider</Text>

                    <View style={styles.verifiedRow}>
                        <View style={styles.verifiedBadge}>
                            <View style={styles.checkCircle}>
                                <Image source={require('../assets/icon_check.png')} style={styles.checkIcon} />
                            </View>
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                        <Text style={styles.experienceText}>5 years experience</Text>
                    </View>
                </View>

                <View style={styles.detailsBlock}>
                    <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>Specialities: </Text>
                        IT and Phone Repair
                    </Text>
                    <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>Location: </Text>
                        Naga City · 2.5 km away
                    </Text>
                    <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>Available: </Text>
                        Mon-Fri, 8AM-6PM
                    </Text>
                </View>

                <View style={styles.aiSection}>
                    <Text style={styles.aiHeading}>AI Summary Insights</Text>
                    <Text style={styles.aiFeedback}>92% Positive Feedback</Text>
                    <View style={styles.tagRow}>
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>Professional</Text>
                        </View>
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>Always on Time</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.menuList}>
                    <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
                        <Image source={require('../assets/icon_edit_profile.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                        <Image source={require('../assets/icon_exit.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Log out</Text>
                    </TouchableOpacity>
                </View>
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
        fontSize: 26,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 20,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 14,
        backgroundColor: '#E5E5E5',
    },
    name: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 2,
    },
    role: {
        fontSize: 13,
        color: '#555555',
        marginBottom: 10,
        textAlign: 'center',
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E6F0FC',
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 10,
        marginRight: 10,
    },
    checkCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#0255AF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    checkIcon: {
        width: 9,
        height: 9,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0255AF',
    },
    experienceText: {
        fontSize: 12,
        color: '#666666',
    },
    detailsBlock: {
        marginTop: 18,
        marginBottom: 20,
    },
    detailLine: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 6,
        lineHeight: 19,
    },
    detailLabel: {
        fontWeight: '700',
        color: '#111111',
    },
    aiSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    aiHeading: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 6,
    },
    aiFeedback: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 12,
    },
    tagRow: {
        flexDirection: 'row',
    },
    tag: {
        borderWidth: 1,
        borderColor: '#D5D5D5',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 14,
        marginHorizontal: 5,
    },
    tagText: {
        fontSize: 12,
        color: '#444444',
        fontWeight: '600',
    },
    menuList: {
        marginTop: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    menuIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginRight: 16,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#222222',
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

export default ServiceProviderProfile;