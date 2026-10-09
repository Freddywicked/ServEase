import React, { useState, useCallback, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { getIncomingRequests, acceptServiceRequest } from '../api/servicerequest_api';
import { formatShortDate, formatAiSuggestion } from '../utils/formatters';

/* ============================================================================
 * IncomingServiceRequest (Service Provider app)
 * ----------------------------------------------------------------------------
 * The provider's side of the customer's Create Service Request flow. When a
 * customer taps "Request Quotation" in RecommendServiceProvider.js, the backend
 * creates a SERVICE_REQUEST with this provider's id — that exact row is what
 * GET /provider/service-requests returns here, including the customer's
 * description/location and the SAME AI diagnosis the customer saw.
 *
 *   List     GET  /provider/service-requests?filter=new|pending|all
 *   Approve  POST /provider/service-requests/:id/accept
 *            -> backend updates the request, notifies the customer (their
 *               dashboard's "Active Repair" card + notification update).
 *   View     opens ViewServiceRequest with { requestId } — that screen is where
 *            the provider sends the quotation (submitQuotation) or declines
 *            (declineServiceRequest); both already exist in serviceRequestApi.js.
 *
 * Reloads every time the screen is focused and on pull-to-refresh. For live
 * updates the moment a customer sends a request, see the commented Realtime
 * subscription at the bottom of the component.
 * ========================================================================== */

// Filter chips. `key` is sent to the backend as ?filter=<key>, which decides which
// request statuses each one covers — the app no longer matches status strings itself.
// 'Appointment' is intentionally left out — that feature (with its calendar and
// reschedule flow) isn't in scope yet.
const FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'pending', label: 'Pending' },
];

const IncomingServiceRequest = ({ navigation }) => {
    const [selectedFilter, setSelectedFilter] = useState('new');
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [approvingId, setApprovingId] = useState(null);
    const latestLoadRef = useRef(0);

    const loadRequests = useCallback(async ({ refresh = false } = {}) => {
        // Ignore a slow response if the provider already switched filters.
        latestLoadRef.current += 1;
        const loadId = latestLoadRef.current;
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setErrorMessage('');
        try {
            const list = await getIncomingRequests({ filter: selectedFilter });
            if (loadId === latestLoadRef.current) setRequests(list);
        } catch (error) {
            if (loadId !== latestLoadRef.current) return;
            setRequests([]);
            setErrorMessage(
                error.status === 403
                    ? 'Your Service Provider account must be verified before you can receive requests.'
                    : error.message,
            );
        } finally {
            if (loadId === latestLoadRef.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [selectedFilter]);

    // Runs on focus and whenever the filter changes (loadRequests changes with it).
    useFocusEffect(
        useCallback(() => {
            loadRequests();
        }, [loadRequests]),
    );

    // ---------------------------------------------------------------------
    // PROVIDER COMMUNICATION (comment block): live inbox. Instead of waiting for the next
    // focus / pull-to-refresh, refresh the moment a customer sends this provider a request.
    // Uncomment once serviceRequestApi.js's Realtime helpers are enabled (needs the mobile
    // Supabase client) — `providerId` is the logged-in provider's id from auth_context.
    //
    // useEffect(() => {
    //     const unsubscribe = subscribeToIncomingRequests(providerId, () => loadRequests({ refresh: true }));
    //     return unsubscribe;
    // }, [providerId, loadRequests]);
    //
    // (import { subscribeToIncomingRequests } from '../api/serviceRequestApi';)
    // The FCM push sent by the backend on request creation can call loadRequests() too.
    // ---------------------------------------------------------------------

    const handleFilterPress = (filter) => {
        setSelectedFilter(filter);
    };

    const handleViewRequest = (requestId) => {
        navigation.navigate(ROUTES.VIEW_SERVICE_REQUEST, { requestId });
    };

    const handleApproveRequest = async (requestId) => {
        if (approvingId) return;
        setApprovingId(requestId);
        try {
            await acceptServiceRequest(requestId);
            await loadRequests({ refresh: true });
            Alert.alert(
                'Request approved',
                'The customer has been notified. Send your quotation from the request details.',
                [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Send quotation', onPress: () => handleViewRequest(requestId) },
                ],
            );
        } catch (error) {
            if (error.status === 409) {
                // Customer cancelled, or the request was already handled.
                Alert.alert('Request no longer available', 'This request was cancelled or already handled.');
                loadRequests({ refresh: true });
            } else {
                Alert.alert('Could not approve the request', error.message);
            }
        } finally {
            setApprovingId(null);
        }
    };


    const renderBody = () => {
        if (isLoading) {
            return <ActivityIndicator color="#0255AF" style={styles.loadingIndicator} />;
        }
        if (errorMessage) {
            return (
                <TouchableOpacity onPress={() => loadRequests()}>
                    <Text style={styles.emptyStateText}>{errorMessage} Tap to retry.</Text>
                </TouchableOpacity>
            );
        }
        if (requests.length === 0) {
            return <Text style={styles.emptyStateText}>No requests found</Text>;
        }
        return requests.map((item) => {
            const aiSuggestion = formatAiSuggestion(item.aiDiagnosis);
            const hasDistance = item.distanceKm !== null && item.distanceKm !== undefined;
            const isApproving = approvingId === item.id;
            return (
                <View key={item.id} style={styles.requestCard}>
                    <Text style={styles.requestNumber}>Request #{item.requestNumber}</Text>
                    <Text style={styles.requestSubtitle}>{item.customerName} | {formatShortDate(item.createdAt)}</Text>

                    {aiSuggestion ? (
                        <View style={styles.aiBanner}>
                            <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                            <Text style={styles.aiBannerText}>{aiSuggestion}</Text>
                        </View>
                    ) : null}

                    {hasDistance ? (
                        <View style={styles.locationRow}>
                            <Image source={require('../assets/icon_pinloc.png')} style={styles.pinIcon} />
                            <Text style={styles.locationText}>{Number(item.distanceKm).toFixed(1)} km away</Text>
                        </View>
                    ) : null}

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.viewButton} onPress={() => handleViewRequest(item.id)}>
                            <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                        {item.canApprove ? (
                            <TouchableOpacity
                                onPress={() => handleApproveRequest(item.id)}
                                disabled={approvingId !== null}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#0255AF', '#04A5A5']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.approveButton, approvingId !== null && !isApproving && styles.approveButtonDisabled]}
                                >
                                    {isApproving ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.approveButtonText}>Approve</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            );
        });
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadRequests({ refresh: true })} />}
            >
                <Text style={styles.headerTitle}>Incoming Service Requests</Text>

                <View style={styles.filterRow}>
                    {FILTER_OPTIONS.map((filter) => {
                        const isActive = filter.key === selectedFilter;
                        return (
                            <TouchableOpacity
                                key={filter.key}
                                style={isActive ? styles.filterPillActive : styles.filterPill}
                                onPress={() => handleFilterPress(filter.key)}
                            >
                                <Text style={isActive ? styles.filterTextActive : styles.filterText}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {renderBody()}
            </ScrollView>
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
        fontSize: 22,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    filterPill: {
        borderWidth: 1,
        borderColor: '#D5D5D5',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        backgroundColor: '#FFFFFF',
    },
    filterPillActive: {
        borderWidth: 1,
        borderColor: '#0255AF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        backgroundColor: '#0255AF',
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555555',
    },
    filterTextActive: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    requestCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 16,
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    requestSubtitle: {
        fontSize: 12,
        color: '#888888',
        marginTop: 2,
        marginBottom: 12,
    },
    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    aiIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 8,
    },
    aiBannerText: {
        flex: 1,
        flexShrink: 1,
        fontSize: 12,
        color: '#FFFFFF',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    pinIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 6,
    },
    locationText: {
        fontSize: 12,
        color: '#666666',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    viewButton: {
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    viewButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    approveButton: {
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    approveButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 20,
    },
    loadingIndicator: {
        marginTop: 20,
    },
    approveButtonDisabled: {
        opacity: 0.5,
    },
});

export default IncomingServiceRequest;