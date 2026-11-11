import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/auth_context';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { getActiveRepair, getMyServiceRequests } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';
import NotificationsModal from '../components/NotificationsModal';
import { DashboardSection, DashboardItem, DashboardEmpty } from '../components/DashboardSection';

const PREVIEW_LIMIT = 2; // Each container previews up to two rows

// Formatter to match Figma design: "Category | #SR-0000"
const formatRequestTitle = (item) => {
    if (!item) return '';
    const category = item.category || item.categoryName || 'Service Request';
    const id = item.id || item.requestId || '0000';
    return `${category} | #${id}`;
};

const CustomerDashboard = ({ navigation, route }) => {
    const { user, provider, refreshUser } = useAuth();
    const resetDraft = useServiceRequestDraftStore((state) => state.resetDraft);
    const customerName = user?.name || 'Customer';
    const applicationStatus = provider?.verification_status ?? null;

    const [activeRepairs, setActiveRepairs] = useState([]);
    const [recentHistory, setRecentHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const scrollRef = useRef(null);

    const loadDashboardData = useCallback(async () => {
        setLoadFailed(false);
        const [repairResult, historyResult] = await Promise.allSettled([
            getActiveRepair(),
            getMyServiceRequests(),
        ]);

        if (repairResult.status === 'fulfilled' && repairResult.value) {
            // Support both an array of active repairs or a single object response
            const activeData = Array.isArray(repairResult.value)
                ? repairResult.value
                : [repairResult.value];
            setActiveRepairs(activeData.slice(0, PREVIEW_LIMIT));
        } else {
            setActiveRepairs([]);
        }

        if (historyResult.status === 'fulfilled' && historyResult.value) {
            setRecentHistory(historyResult.value.slice(0, PREVIEW_LIMIT));
        }

        if (repairResult.status === 'rejected' || historyResult.status === 'rejected') {
            setLoadFailed(true);
        }
        setIsLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [loadDashboardData])
    );

    useEffect(() => {
        if (route?.params?.pendingApproval && applicationStatus == null) {
            refreshUser().catch(() => {});
        }
    }, [route?.params?.pendingApproval, applicationStatus, refreshUser]);

    const handleCreateServiceRequest = () => {
        resetDraft();
        navigation.navigate(ROUTES.CREATE_SERVICE_REQUEST);
    };

    const handleNotificationsPress = () => {
        if (!notificationsVisible) scrollRef.current?.scrollTo({ y: 0, animated: false });
        setNotificationsVisible((visible) => !visible);
    };

    const goToTrack = () => navigation.navigate(ROUTES.TRACK);
    const goToHistory = () => navigation.navigate('History');

    // Format active items to match Figma: Title + Summary text
    const activeItems = activeRepairs.map((item) => ({
        id: item.id || item.requestId,
        title: formatRequestTitle(item),
        summary: item.summary || item.description || item.problemDescription || 'No summary available.',
    }));

    const historyItems = recentHistory.map((item) => ({
        id: item.id,
        title: formatRequestTitle(item),
        summary: `${item.status} · ${formatTimeAgo(item.createdAt)}`,
    }));

    const emptyMessage = (fallback) => (loadFailed ? "Couldn't load. Tap to retry." : fallback);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.welcomeText} numberOfLines={1} adjustsFontSizeToFit>
                            Welcome, {customerName}!
                        </Text>
                        <Text style={styles.subtitle}>What needs fixing today?</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleNotificationsPress}
                        style={styles.bellButton}
                        accessibilityRole="button"
                        accessibilityLabel="Notifications"
                    >
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

                <TouchableOpacity onPress={handleCreateServiceRequest} activeOpacity={0.85}>
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

                {/* Active Repair Section matching Figma layout */}
                <DashboardSection title="Active Repair" onActionPress={goToTrack} style={[styles.firstSection, styles.sectionHeight]}>
                    {isLoading || activeItems.length === 0 ? (
                        <DashboardEmpty
                            loading={isLoading}
                            message={emptyMessage('No Active Repair')}
                            onPress={loadFailed ? loadDashboardData : undefined}
                        />
                    ) : (
                        activeItems.map((item, index) => (
                            <DashboardItem
                                key={item.id}
                                isFirst={index === 0}
                                title={item.title}
                                summary={item.summary}
                                onPress={goToTrack}
                            />
                        ))
                    )}
                </DashboardSection>

                {/* History Section */}
                <DashboardSection title="History" onActionPress={goToHistory} style={[styles.nextSection, styles.sectionHeight]}>
                    {isLoading || historyItems.length === 0 ? (
                        <DashboardEmpty
                            loading={isLoading}
                            message={emptyMessage('No history yet')}
                            onPress={loadFailed ? loadDashboardData : undefined}
                        />
                    ) : (
                        historyItems.map((item, index) => (
                            <DashboardItem
                                key={item.id}
                                isFirst={index === 0}
                                title={item.title}
                                summary={item.summary}
                                onPress={goToHistory}
                            />
                        ))
                    )}
                </DashboardSection>
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
        paddingHorizontal: 25,
        paddingTop: 29,
        paddingBottom: 32,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 22,
    },
    headerTextWrap: {
        flex: 1,
        marginRight: 12,
    },
    welcomeText: {
        fontSize: 35,
        lineHeight: 42,
        fontWeight: '700',
        color: '#021E79',
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 16,
        fontWeight: '700',
        color: '#000000',
        opacity: 0.7,
        marginTop: 8,
    },
    bellButton: {
        marginTop: 6,
        marginRight: 10,
    },
    bellIcon: {
        width: 27,
        height: 27,
        resizeMode: 'contain',
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
    createRequestButton: {
        height: 46,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.3)',
        marginHorizontal: -1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createRequestText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        marginTop: 23,
    },
    sectionHeight: {
        minHeight: 148,
    },
    firstSection: {
        marginTop: 32,
    },
    nextSection: {
        marginTop: 10,
    },
});

export default CustomerDashboard;