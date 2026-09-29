import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ACTIVE_TAB = 'CustomerHome';

// Bottom tab definitions — each tab carries both its active (white) and
// inactive (colored) icon so the same list can drive the bar regardless of
// which tab is currently active.
const TAB_ITEMS = [
    { key: 'CustomerHome', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const CustomerDashboard = ({ navigation, route }) => {
    const [customerName, setCustomerName] = useState('');
    const [activeRepair, setActiveRepair] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [applicationStatus, setApplicationStatus] = useState(null); // null | 'pending' | 'approved'

    useEffect(() => {
        // TODO: fetch the logged-in customer's name, active repair status, and
        // notifications from the backend once the API is integrated.

        // Coming straight from submitting a Service Provider application —
        // reflect the "under review" state right away while waiting on the
        // backend/admin.
        if (route?.params?.pendingApproval) {
            setApplicationStatus('pending');
        }

        // ---------------------------------------------------------------------
        // BACKEND-READY: fetch this user's Service Provider application status
        // so the banner below reflects "pending" / "approved" / "rejected" on
        // its own (not just right after submitting), and updates once the
        // admin approves it from the web dashboard — e.g. via polling or a
        // Firebase Cloud Messaging push notification.
        //
        // Example (uncomment and adjust once the API is ready):
        //
        // const fetchApplicationStatus = async () => {
        //   const response = await fetch(`${API_BASE_URL}/api/service-provider/applications/me`, {
        //     headers: { Authorization: `Bearer ${userAuthToken}` },
        //   });
        //   const data = await response.json();
        //   setApplicationStatus(data.status); // 'pending' | 'approved' | 'rejected' | null
        // };
        // fetchApplicationStatus();
        // ---------------------------------------------------------------------
    }, [route?.params?.pendingApproval]);

    const handleCreateServiceRequest = () => {
        // TODO: point this to the actual create-service-request screen once it exists
        navigation.navigate('CreateServiceRequest');
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

    const handleSwitchToServiceProvider = () => {
        // ---------------------------------------------------------------------
        // BACKEND-READY: persist the user's active mode as "service_provider"
        // (e.g. PATCH /api/users/me { activeMode: 'service_provider' }) so the
        // account opens in Service Provider mode on future logins too. A
        // single account holds both roles, so this only flips which side of
        // the app is shown — it does not create a separate account.
        // ---------------------------------------------------------------------

        // Reset the stack so the whole app switches to the Service Provider
        // side rather than pushing one screen on top of the customer flow.
        navigation.reset({
            index: 0,
            routes: [{ name: 'ServiceProviderDashboard' }],
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.welcomeText}>Welcome, {customerName || 'Customer'}!</Text>
                        <Text style={styles.subtitle}>What needs fixing today?</Text>
                    </View>
                    <TouchableOpacity onPress={handleNotificationsPress}>
                        <Image source={require('../assets/icon_ringbell.png')} style={styles.bellIcon} />
                    </TouchableOpacity>
                </View>

                {applicationStatus === 'approved' && (
                    <TouchableOpacity onPress={handleSwitchToServiceProvider}>
                        <LinearGradient
                            colors={['#0255AF', '#04A5A5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.approvalBanner}
                        >
                            <Text style={styles.approvalBannerTitle}>You're approved as a Service Provider!</Text>
                            <Text style={styles.approvalBannerSubtitle}>Tap to switch to Service Provider mode</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {applicationStatus === 'pending' && (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerText}>
                            Your Service Provider application is under review. We'll notify you once it's approved.
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionLabel}>QUICK START</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CreateServiceRequest')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.createRequestButton}
                    >
                        <Text style={styles.createRequestText}>Create Service Request</Text>
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
                        <Text style={styles.emptyStateText}>No notifications yet</Text>
                    )}
                </View>
            </ScrollView>

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => handleTabPress(tab.key)}>
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image source={isActive ? tab.activeIcon : tab.inactiveIcon} style={styles.tabIcon}/>
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
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
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
    approvalBanner: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    approvalBannerTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    approvalBannerSubtitle: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
    },
    pendingBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    pendingBannerText: {
        fontSize: 13,
        color: '#555555',
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888888',
        letterSpacing: 1,
        marginTop: 20,
        marginBottom: 10,
    },
    createRequestButton: {
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    createRequestText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginTop: 20,
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

export default CustomerDashboard;