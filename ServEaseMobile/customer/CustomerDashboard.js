import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/auth_context';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { getActiveRepair, getMyServiceRequests } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';
import NotificationsModal from '../components/NotificationsModal';

const HISTORY_PREVIEW_LIMIT = 3; // how many recent history entries the dashboard card previews

const CustomerDashboard = ({ navigation, route }) => {
    // `user` and `provider` come from auth_context (populated on login, kept in sync via
    // refreshUser()). `provider` is null until an application exists, then looks like
    // { verification_status }, e.g. 'pending' or 'verified'.
    const { user, provider, refreshUser } = useAuth();
    const resetDraft = useServiceRequestDraftStore((state) => state.resetDraft);
    const customerName = user?.name || 'Customer';
    const applicationStatus = provider?.verification_status ?? null; // null | 'pending' | 'verified' | 'rejected'

    const [activeRepair, setActiveRepair] = useState(null);
    const [recentHistory, setRecentHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);

    // Loads the active repair + a short preview of the customer's history from the backend.
    // Runs every time the dashboard regains focus, so a request just sent from the
    // Create Service Request flow shows up as soon as the customer lands back here.
    // (Notifications are fetched by NotificationsModal when it opens.)
    const loadDashboardData = useCallback(async () => {
        setLoadFailed(false);
        const [repairResult, historyResult] = await Promise.allSettled([
            getActiveRepair(),
            getMyServiceRequests(), // newest first
        ]);
        if (repairResult.status === 'fulfilled') setActiveRepair(repairResult.value);
        if (historyResult.status === 'fulfilled') setRecentHistory(historyResult.value.slice(0, HISTORY_PREVIEW_LIMIT));
        if (repairResult.status === 'rejected' || historyResult.status === 'rejected') setLoadFailed(true);
        setIsLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [loadDashboardData]),
    );

    useEffect(() => {
        // Coming straight from submitting a Service Provider application —
        // ServiceProviderVerificationRequirements.js already calls refreshUser() after a
        // successful submit, so this is just a safety net.
        if (route?.params?.pendingApproval && applicationStatus == null) {
            refreshUser().catch(() => {
                // Non-fatal: the banner just won't show until the next refreshUser() call.
            });
        }

        // BACKEND-READY: poll (or subscribe via Firebase Cloud Messaging) for the Service
        // Provider application status so the pending banner clears once the admin approves.
        //
        // const interval = setInterval(() => {
        //   refreshUser().catch(() => {});
        // }, 30000);
        // return () => clearInterval(interval);
    }, [route?.params?.pendingApproval, applicationStatus, refreshUser]);

    // PROVIDER COMMUNICATION (comment block): subscribe to the customer's active request so
    // the "Active Repair" card refreshes the moment the provider submits a QUOTATION or
    // declines. Uncomment once serviceRequestApi.js's Realtime helpers are enabled.
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

    const handleCreateServiceRequest = () => {
        // Always start a new request from a clean draft.
        resetDraft();
        navigation.navigate(ROUTES.CREATE_SERVICE_REQUEST);
    };

    const renderCardMessage = (message) => (
        <TouchableOpacity onPress={loadDashboardData} disabled={!loadFailed}>
            <Text style={styles.emptyStateText}>{message}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.welcomeText}>Welcome, {customerName}!</Text>
                        <Text style={styles.subtitle}>What needs fixing today?</Text>
                    </View>
                    <TouchableOpacity onPress={() => setNotificationsVisible(true)}>
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
                <View style={styles.activeCard}>
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

                <Text style={styles.sectionLabel}>HISTORY</Text>
                {/* The whole card is tappable -> full History screen (its list is fetched from the backend) */}
                <TouchableOpacity
                    style={styles.historyCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('History')}
                    accessibilityRole="button"
                    accessibilityLabel="View full history"
                >
                    {isLoading ? (
                        <ActivityIndicator color="#0255AF" style={styles.historyLoader} />
                    ) : recentHistory.length > 0 ? (
                        recentHistory.map((item) => (
                            <View key={item.id} style={styles.historyItem}>
                                <Text style={styles.historyMessage}>
                                    {item.category} · {item.status}
                                </Text>
                                <Text style={styles.historyTime}>{formatTimeAgo(item.createdAt)}</Text>
                                <View style={styles.historyLine} />
                            </View>
                        ))
                    ) : (
                        <View style={styles.historyEmpty}>
                            {renderCardMessage(loadFailed ? "Couldn't load. Tap to retry." : 'No history yet')}
                        </View>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
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
        borderRadius: 8,
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
        backgroundColor: '#8A8A8A',
        marginTop: 20,
    },
    activeCard: {
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        height: 110,
        justifyContent: 'center',
    },
    activeRepairText: {
        fontSize: 14,
        color: '#333333',
        textAlign: 'center',
    },
    historyCard: {
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        minHeight: 160,
    },
    historyLoader: {
        marginTop: 16,
    },
    historyItem: {
        marginBottom: 8,
    },
    historyMessage: {
        fontSize: 12,
        color: '#333333',
    },
    historyTime: {
        fontSize: 10,
        fontWeight: '600',
        color: '#666666',
        marginTop: 2,
        marginBottom: 8,
    },
    historyLine: {
        height: 1,
        backgroundColor: '#8A8A8A',
    },
    historyEmpty: {
        paddingVertical: 24,
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
    },
});

export default CustomerDashboard;