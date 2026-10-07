import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/auth_context';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { getActiveRepair, getNotifications } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';

const ACTIVE_TAB = ROUTES.CUSTOMER_HOME;
const NOTIFICATION_LIMIT = 5; // how many recent notifications the dashboard card shows

// Bottom tab definitions — each tab carries both its active (white) and
// inactive (colored) icon so the same list can drive the bar regardless of
// which tab is currently active.
const TAB_ITEMS = [
    { key: ROUTES.CUSTOMER_HOME, label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: ROUTES.TRACK, label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const CustomerDashboard = ({ navigation, route }) => {
    // `user` and `provider` come from auth_context: populated on login (LoginScreen calls
    // setUser/setProvider with /auth/login's response) and kept in sync afterwards via
    // refreshUser(). `user.name` matches the backend's registration field (see client.js's
    // toRegistrationPayload); `provider` is null until an application exists, and then
    // looks like { verification_status }, e.g. 'pending' or 'verified'.
    const { user, provider, refreshUser } = useAuth();
    const resetDraft = useServiceRequestDraftStore((state) => state.resetDraft);
    const customerName = user?.name || 'Customer';
    const applicationStatus = provider?.verification_status ?? null; // null | 'pending' | 'verified' | 'rejected'

    const [activeRepair, setActiveRepair] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    // Loads the logged-in customer's active repair + recent notifications from the backend.
    // Runs every time the dashboard regains focus, so a request just sent from the
    // Create Service Request flow shows up as soon as the customer lands back here.
    const loadDashboardData = useCallback(async () => {
        setLoadFailed(false);
        const [repairResult, notificationsResult] = await Promise.allSettled([
            getActiveRepair(),
            getNotifications({ limit: NOTIFICATION_LIMIT }),
        ]);
        if (repairResult.status === 'fulfilled') setActiveRepair(repairResult.value);
        if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value);
        if (repairResult.status === 'rejected' || notificationsResult.status === 'rejected') setLoadFailed(true);
        setIsLoading(false);
    }, []);

    // Location is collected per-request in the Create Service Request flow
    // (CreateServiceRequest.js -> draft.location), not here on the dashboard.
    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [loadDashboardData]),
    );

    useEffect(() => {
        // Coming straight from submitting a Service Provider application —
        // ServiceProviderVerificationRequirements.js already calls refreshUser() right
        // after a successful submit, so this is just a safety net in case this screen
        // mounted before that refresh resolved.
        if (route?.params?.pendingApproval && applicationStatus == null) {
            refreshUser().catch(() => {
                // Non-fatal: the banner just won't show until the next refreshUser() call.
            });
        }

        // ---------------------------------------------------------------------
        // BACKEND-READY: poll (or subscribe via Firebase Cloud Messaging) for this
        // user's Service Provider application status so the pending banner below
        // clears on its own once the admin approves it from the web dashboard —
        // not just right after submitting.
        //
        // Example (uncomment and adjust once this needs to run on an interval):
        //
        // const interval = setInterval(() => {
        //   refreshUser().catch(() => {});
        // }, 30000);
        // return () => clearInterval(interval);
        // ---------------------------------------------------------------------
    }, [route?.params?.pendingApproval, applicationStatus, refreshUser]);

    // ---------------------------------------------------------------------
    // PROVIDER COMMUNICATION (comment block): live updates when the provider responds.
    // Instead of waiting for the next focus, subscribe to the customer's active request so
    // the "Active Repair" card and notifications refresh the moment the provider submits a
    // QUOTATION or declines. Uncomment once serviceRequestApi.js's Realtime helpers are
    // enabled (needs your mobile Supabase client).
    //
    // useEffect(() => {
    //     if (!activeRepair?.requestId) return undefined;
    //     const unsubscribe = subscribeToServiceRequest(activeRepair.requestId, () => {
    //         loadDashboardData();
    //     });
    //     return unsubscribe;
    // }, [activeRepair?.requestId, loadDashboardData]);
    //
    // (import { subscribeToServiceRequest } from '../api/serviceRequestApi';)
    // ---------------------------------------------------------------------

    const handleCreateServiceRequest = () => {
        // Always start a new request from a clean draft.
        resetDraft();
        navigation.navigate(ROUTES.CREATE_SERVICE_REQUEST);
    };

    const handleNotificationsPress = () => {
        // TODO: point this to a full notifications screen once it exists
        navigation.navigate(ROUTES.NOTIFICATIONS);
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const renderCardMessage = (message) => (
        <TouchableOpacity onPress={loadDashboardData} disabled={!loadFailed}>
            <Text style={styles.emptyStateText}>{message}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.welcomeText}>Welcome, {customerName}!</Text>
                        <Text style={styles.subtitle}>What needs fixing today?</Text>
                    </View>
                    <TouchableOpacity onPress={handleNotificationsPress}>
                        <Image source={require('../assets/icon_ringbell.png')} style={styles.bellIcon} />
                    </TouchableOpacity>
                </View>

                {applicationStatus === 'pending' && (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerText}>
                            Your Service Provider application is under review. We'll notify you once it's approved.
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionLabel}>QUICK START</Text>
                <TouchableOpacity onPress={handleCreateServiceRequest}>
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
                    {isLoading ? (
                        <ActivityIndicator color="#0255AF" />
                    ) : activeRepair ? (
                        <TouchableOpacity onPress={() => navigation.navigate(ROUTES.TRACK)}>
                            <Text style={styles.activeRepairText}>{activeRepair.statusLabel ?? activeRepair.requestStatus}</Text>
                        </TouchableOpacity>
                    ) : (
                        renderCardMessage(loadFailed ? "Couldn't load. Tap to retry." : 'No Active Repair')
                    )}
                </View>

                <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
                <View style={styles.card}>
                    {isLoading ? (
                        <ActivityIndicator color="#0255AF" />
                    ) : notifications.length > 0 ? (
                        notifications.map((item) => (
                            <View key={item.id} style={styles.notificationItem}>
                                <Text style={styles.notificationMessage}>{item.message}</Text>
                                <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
                            </View>
                        ))
                    ) : (
                        renderCardMessage(loadFailed ? "Couldn't load. Tap to retry." : 'No notifications yet')
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