import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';
import { getProviderProfile } from '../api/client';

// Must match the `key` of the Home tab below so it is highlighted.
const ACTIVE_TAB = 'ServiceProviderDashboard';

// Bottom tab definitions — each tab carries both its active (white) and
// inactive (colored) icon so the same list can drive the bar regardless of
// which tab is currently active. Same icon set as the Customer Home screen.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequest', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const EMPTY_STATS = { activeJobs: 0, jobsThisMonth: 0, rating: 0 };

// Specializations are saved as one list (categories + chosen services); these
// are the category names, used to pick the provider's title.
const SERVICE_CATEGORIES = [
    'IT-Related Device Repair',
    'Phone Repair',
    'Automotive Services',
    'Home Repair Services',
];

const ServiceProviderDashboard = ({ navigation }) => {
    // `user` (name, email, ...) and `provider` ({ verification_status }) come from
    // auth_context. The provider's own details (years, specializations, ...) come
    // from GET /api/providers/me. Once the admin approves the application on the
    // web dashboard, refreshUser() returns 'verified' and the screen updates.
    const { user, provider, refreshUser } = useAuth();
    const isVerified = provider?.verification_status === VERIFIED_STATUS;

    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(EMPTY_STATS);
    const [activeRepair, setActiveRepair] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);

    const providerName = user?.name || 'Provider';
    const categories = (profile?.specializations || []).filter((item) => SERVICE_CATEGORIES.includes(item));
    const providerTitle = categories[0] ? `${categories[0]} Provider` : 'Service Provider';

    const loadProfile = useCallback(async () => {
        try {
            const data = await getProviderProfile();
            setProfile(data?.provider ?? null);
        } catch (error) {
            // Keep the last known data. A 401 is already handled by api/client
            // (token cleared + setOnUnauthorized callback).
        }
    }, []);

    useEffect(() => {
        // TODO: stats, active repair, notifications and pending requests need
        // backend endpoints (there is no service-request/jobs API yet). When
        // they exist, fetch them here and call setStats / setActiveRepair /
        // setNotifications / setPendingRequests. Empty states show until then.
        loadProfile();
    }, [loadProfile]);

    // Re-sync whenever this screen comes into focus, so an admin approval shows
    // up without logging out and back in.
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', async () => {
            try {
                await refreshUser();
            } catch (error) {
                // Non-fatal: keep showing the last known data.
            }
            loadProfile();
        });
        return unsubscribe;
    }, [navigation, refreshUser, loadProfile]);

    const handleManageCalendar = () => {
        // TODO: point this to the actual calendar management screen once it exists
        navigation.navigate('ManageCalendar');
    };

    const handleNotificationsPress = () => {
        // TODO: point this to a full notifications screen once it exists
        navigation.navigate('Notifications');
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.welcomeText}>Welcome, {providerName}!</Text>
                        <Text style={styles.subtitle}>{providerTitle}</Text>
                    </View>
                    <TouchableOpacity onPress={handleNotificationsPress}>
                        <Image source={require('../assets/icon_ringbell.png')} style={styles.bellIcon} />
                    </TouchableOpacity>
                </View>

                {!isVerified && (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerText}>
                            {provider?.verification_status === 'rejected'
                                ? 'Your Service Provider application was not approved.'
                                : 'Your Service Provider application is under review. Your details will appear here once the admin approves it.'}
                        </Text>
                    </View>
                )}

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.activeJobs}</Text>
                        <Text style={styles.statLabel}>Active jobs</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.jobsThisMonth}</Text>
                        <Text style={styles.statLabel}>This month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.rating.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>Rating</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={handleManageCalendar} activeOpacity={0.85}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.calendarButton}
                    >
                        <Text style={styles.calendarButtonText}>Manage your Calendar</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>ACTIVE REPAIR</Text>
                <View style={styles.card}>
                    {activeRepair ? (
                        <Text style={styles.activeRepairText}>{activeRepair.status}</Text>
                    ) : (
                        <Text style={styles.emptyStateText}>No Active Repair</Text>
                    )}
                </View>

                <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
                <View style={styles.card}>
                    {notifications.length > 0 ? (
                        notifications.map((item) => (
                            <View key={item.id} style={styles.notificationItem}>
                                <Text style={styles.notificationMessage}>{item.message}</Text>
                                <Text style={styles.notificationTime}>{item.timeAgo}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyStateText}>No Notifications</Text>
                    )}
                </View>

                <Text style={styles.sectionLabel}>PENDING REQUESTS</Text>
                <View style={styles.card}>
                    {pendingRequests.length > 0 ? (
                        pendingRequests.map((item) => (
                            <View key={item.id} style={styles.notificationItem}>
                                <Text style={styles.notificationMessage}>{item.summary}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyStateText}>No Pending Requests</Text>
                    )}
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headerTextWrap: {
        flex: 1,
        marginRight: 12,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
        marginTop: 6,
    },
    bellIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        marginTop: 4,
    },
    pendingBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginTop: 4,
    },
    pendingBannerText: {
        fontSize: 13,
        color: '#555555',
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 10,
        paddingVertical: 14,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    statLabel: {
        fontSize: 11,
        color: '#666666',
        marginTop: 4,
        textAlign: 'center',
    },
    calendarButton: {
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    calendarButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginTop: 20,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888888',
        letterSpacing: 1,
        marginTop: 20,
        marginBottom: 10,
    },
    card: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        minHeight: 90,
        justifyContent: 'center',
    },
    activeRepairText: {
        fontSize: 14,
        color: '#333333',
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
    },
    notificationItem: {
        marginBottom: 10,
    },
    notificationMessage: {
        fontSize: 13,
        color: '#333333',
    },
    notificationTime: {
        fontSize: 11,
        color: '#999999',
        marginTop: 2,
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

export default ServiceProviderDashboard;