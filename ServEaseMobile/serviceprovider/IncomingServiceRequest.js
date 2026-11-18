import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ROUTES } from '../navigation/routes';
import { ROUTES as CHAT_ROUTES } from '../constants/messaging';
import { getIncomingRequests } from '../api/servicerequest_api';
import { formatShortDate, formatAiSuggestion } from '../utils/formatters';
import { subscribeToProviderTabActivity } from '../utils/providerTabBadges';
import LinearGradient from 'react-native-linear-gradient';

/* ============================================================================
 * IncomingServiceRequest (Service Provider app)
 * ----------------------------------------------------------------------------
 * The provider's side of the customer's Create Service Request flow.
 *
 *   List     GET  /provider/service-requests?filter=all|new|pending
 *   Accept   opens ViewServiceRequest with the quotation modal already open
 *            ("Service Request Approved - send a pre-repair quotation"). The request
 *            is accepted AND quoted in one step by submitQuotation, and from then on
 *            the backend returns it under the Pending tab with its quotation.
 *   View     opens ViewServiceRequest (details, attachments, Decline / Accept).
 *   Message  (Pending tab) opens the provider's conversation for that request.
 *
 * Opening the Requests tab always starts on "All". Coming BACK from a request's
 * details keeps the tab and search the provider was on.
 *
 * Live inbox: the nav bar polls the backend for new requests (utils/providerTabBadges.js)
 * and, while this screen is open, calls the listener below so the list reloads by itself.
 * The FCM push sent on request creation can call refreshProviderBadgeCounts() for instant updates.
 * ========================================================================== */

// Filter chips. `key` is sent to the backend as ?filter=<key>, which decides which
// request statuses each one covers — the app does not match status strings itself.
// 'Appointment' is intentionally left out — that feature isn't in scope yet.
const FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'pending', label: 'Pending' },
];

const DEFAULT_FILTER = 'all';

// ---------------------------------------------------------------------------
// Fonts from the Figma (put the .ttf files in assets/fonts; a missing font falls back to the system font).
// Roboto Bold = title (Android's system font already is Roboto); Quicksand Medium = chips, search, status pill.
// ---------------------------------------------------------------------------
const FONT_ROBOTO_BOLD = Platform.OS === 'ios' ? { fontFamily: 'Roboto-Bold' } : { fontWeight: '700' };
const FONT_QUICKSAND_MEDIUM = { fontFamily: 'Quicksand-Medium' };

// ---------------------------------------------------------------------------
// Display helpers (they only format what the backend sends)
// ---------------------------------------------------------------------------
// The backend's request `id` IS the reference ("SR-0001", Request.formatRequestId), and it is
// also what the provider endpoints take in their URLs. `requestNumber` is sent as well once the
// backend patch is in; until then `id` is used. A bare number becomes SR-0001, a "#" is dropped.
const getRequestNumber = (item, fallback = '') => {
    const raw = item?.requestNumber ?? item?.request_number ?? item?.referenceNumber ?? item?.reference ?? item?.id;
    const text = raw === null || raw === undefined ? '' : String(raw).replace(/^#/, '').trim();
    if (text) return /^\d+$/.test(text) ? `SR-${text.padStart(4, '0')}` : text;
    return fallback ? String(fallback) : '';
};

// "AI suggests capacitor failure (82% confidence)". The provider list sends aiDiagnosis as the
// probable-cause text plus aiConfidence; other endpoints send an object. Both are understood.
const getAiSuggestion = (item) => {
    const ai = item?.aiDiagnosis ?? item?.ai;
    let diagnosis = null;
    let confidence = item?.aiConfidence ?? null;
    if (typeof ai === 'string') {
        diagnosis = ai;
    } else if (ai && typeof ai === 'object') {
        diagnosis = ai.probableCause ?? ai.diagnosis ?? null;
        confidence = ai.confidencePercent ?? ai.confidence ?? confidence;
    }
    if (!diagnosis) return null;
    const percent = Number(confidence);
    return confidence !== null && confidence !== undefined && Number.isFinite(percent)
        ? `AI suggests ${diagnosis} (${Math.round(percent)}% confidence)`
        : `AI suggests ${diagnosis}`;
};

// 2800 -> "2,800", 800.5 -> "800.50"
const formatPeso = (value) => {
    const amount = Number(value) || 0;
    const [whole, decimals] = amount.toFixed(2).split('.');
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimals === '00' ? withCommas : `${withCommas}.${decimals}`;
};

// 2 -> "2", 1.24 -> "1.2" (Figma: "2 km away", "1.2 km away")
const formatDistance = (km) => {
    if (km === null || km === undefined || km === '') return null;
    const value = Number(km);
    return Number.isFinite(value) ? String(Number(value.toFixed(1))) : null;
};

// The provider's quotation on a request, or null when none was sent yet.
const getQuote = (item) => {
    const quotation = item?.quotation || item?.quote || {};
    const labor = quotation.laborCost ?? quotation.labor ?? item?.laborCost;
    const parts = quotation.partsCost ?? quotation.parts ?? item?.partsCost;
    if (labor === null || labor === undefined) {
        if (parts === null || parts === undefined) return null;
    }
    const laborValue = Number(labor) || 0;
    const partsValue = Number(parts) || 0;
    const total = quotation.total ?? item?.quotationTotal;
    return {
        labor: laborValue,
        parts: partsValue,
        total: total !== null && total !== undefined ? Number(total) || 0 : laborValue + partsValue,
    };
};


const IncomingServiceRequest = ({ navigation }) => {
    const [selectedFilter, setSelectedFilter] = useState(DEFAULT_FILTER);
    const [searchText, setSearchText] = useState('');
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const latestLoadRef = useRef(0);
    const returningFromDetailRef = useRef(false);

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

    // Opening the screen from the Requests tab (or any route other than a request's details)
    // starts on "All" with an empty search.
    useFocusEffect(
        useCallback(() => {
            if (!returningFromDetailRef.current) {
                setSelectedFilter(DEFAULT_FILTER);
                setSearchText('');
            }
            returningFromDetailRef.current = false;
        }, []),
    );

    // Runs on focus and whenever the filter changes (loadRequests changes with it).
    useFocusEffect(
        useCallback(() => {
            loadRequests();
        }, [loadRequests]),
    );

    // New requests that arrive while this screen is open: reload quietly.
    useEffect(
        () => subscribeToProviderTabActivity('requests', () => loadRequests({ refresh: true })),
        [loadRequests],
    );

    const openRequest = (item, extraParams = {}) => {
        returningFromDetailRef.current = true;
        navigation.navigate(ROUTES.VIEW_SERVICE_REQUEST, {
            requestId: item.id,
            requestNumber: getRequestNumber(item),
            ...extraParams,
        });
    };

    const handleViewRequest = (item) => openRequest(item);

    // Accept = send the pre-repair quotation (Figma "Service Request Approved" modal).
    const handleAcceptRequest = (item) => openRequest(item, { openQuotation: true });

    // The chat thread id IS the request reference ("SR-0001"); the conversation screen loads the
    // customer's messages, the request indicator and the status from it.
    const handleMessageCustomer = (item) => {
        navigation.navigate(CHAT_ROUTES.CONVERSATION_PROVIDER, {
            conversationId: item.id,
            contactName: item.customerName,
        });
    };

    // Search runs over the requests the backend returned for the active tab.
    const visibleRequests = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return requests;
        return requests.filter((item) =>
            [
                getRequestNumber(item),
                item.customerName,
                getAiSuggestion(item) || formatAiSuggestion(item.aiDiagnosis),
                item.title,
                item.category,
                item.concern,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [requests, searchText]);

    const renderRequestCard = (item) => {
        const aiSuggestion = getAiSuggestion(item) || formatAiSuggestion(item.aiDiagnosis);
        const distance = formatDistance(item.distanceKm);
        // BACKEND: send serviceLocationType ('home' | 'shop') on each incoming request.
        const locationTypeLabel =
            item.serviceLocationType === 'home' ? 'Home-based' : item.serviceLocationType === 'shop' ? 'Shop-based' : null;
        const locationLine = [locationTypeLabel, distance !== null ? `${distance} km away` : null].filter(Boolean).join(' ');

        const quote = getQuote(item);
        const isQuoted = !!quote || item.status === 'quoted';
        const statusLabel = item.statusLabel || 'Quoted';
        // Accept is offered while the request is still waiting on this provider.
        const canAccept = item.canApprove ?? item.status === 'new';

        return (
            <View key={item.id} style={styles.requestCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.requestNumber}>Request #{getRequestNumber(item)}</Text>
                        <Text style={styles.requestSubtitle}>
                            {item.customerName || 'Customer'} | {formatShortDate(item.createdAt)}
                        </Text>
                        {locationLine ? (
                            <View style={styles.locationRow}>
                                <Image source={require('../assets/icon_pinloc.png')} style={styles.pinIcon} />
                                <Text style={styles.locationText}>{locationLine}</Text>
                            </View>
                        ) : null}
                    </View>
                    {isQuoted ? (
                        <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>{statusLabel}</Text>
                        </View>
                    ) : null}
                </View>

                {aiSuggestion ? (
                    <View style={styles.aiBanner}>
                        <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                        <Text style={styles.aiBannerText}>{aiSuggestion}</Text>
                    </View>
                ) : null}

                {isQuoted ? (
                    <>
                        <View style={styles.divider} />
                        {quote ? (
                            <>
                                <Text style={styles.quoteText}>
                                    Quote sent: {formatPeso(quote.labor)} pesos (Labor), {formatPeso(quote.parts)} pesos (Parts)
                                </Text>
                                <Text style={styles.totalText}>TOTAL: {formatPeso(quote.total)}</Text>
                            </>
                        ) : null}
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => handleMessageCustomer(item)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <Text style={styles.messageButtonText}>Message Customer</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() => handleViewRequest(item)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                        {canAccept ? (
                            <TouchableOpacity
                                style={styles.acceptButton}
                                onPress={() => handleAcceptRequest(item)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                            >
                                <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                                <Text style={styles.acceptButtonText}>Accept</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}
            </View>
        );
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
        if (visibleRequests.length === 0) {
            return (
                <Text style={styles.emptyStateText}>
                    {searchText.trim() ? 'No requests match your search' : 'No requests found'}
                </Text>
            );
        }
        return visibleRequests.map(renderRequestCard);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadRequests({ refresh: true })} />}
            >
                <Text style={styles.headerTitle}>Incoming Service Requests</Text>

                <View style={styles.searchBar}>
                    <Image source={require('../assets/icon_search_colored.png')} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search request details"
                        placeholderTextColor="#727272"
                        value={searchText}
                        onChangeText={setSearchText}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.filterRow}>
                    {FILTER_OPTIONS.map((filter, index) => {
                        const isActive = filter.key === selectedFilter;
                        return (
                            <TouchableOpacity
                                key={filter.key}
                                style={[
                                    isActive ? styles.filterPillActive : styles.filterPill,
                                    index < FILTER_OPTIONS.length - 1 && styles.filterPillSpacing,
                                ]}
                                onPress={() => setSelectedFilter(filter.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                            >
                                <Text style={isActive ? styles.filterTextActive : styles.filterText}>{filter.label}</Text>
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
        fontSize: 24,
        lineHeight: 28,
        ...FONT_ROBOTO_BOLD,
        color: '#021E79',
        marginBottom: 14,
    },

    // Search bar: 346 x 37, 1px #9E9898, radius 10
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 37,
        borderWidth: 1,
        borderColor: '#9E9898',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    searchIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        tintColor: '#9A9A9A',
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 0,
        ...FONT_QUICKSAND_MEDIUM,
        fontSize: 10,
        color: '#292727',
    },

    // Filter chips: equal width, 32 high, pill, 1px #B1A8A8
    filterRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    filterPill: {
        flex: 1,
        height: 32,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterPillActive: {
        flex: 1,
        height: 32,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        backgroundColor: '#021E79',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterPillSpacing: {
        marginRight: 7,
    },
    filterText: {
        ...FONT_QUICKSAND_MEDIUM,
        fontSize: 10,
        lineHeight: 17,
        color: '#414141',
        textAlign: 'center',
    },
    filterTextActive: {
        ...FONT_QUICKSAND_MEDIUM,
        fontSize: 10,
        lineHeight: 17,
        color: '#FFFFFF',
        textAlign: 'center',
    },

    // Request card: 1px #818080, radius 10
    requestCard: {
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingTop: 8,
        paddingHorizontal: 12,
        paddingBottom: 13,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    cardHeaderText: {
        flex: 1,
        marginRight: 8,
    },
    requestNumber: {
        fontSize: 13,
        lineHeight: 22,
        fontWeight: '700',
        color: '#292727',
    },
    requestSubtitle: {
        fontSize: 9,
        lineHeight: 15,
        color: '#5B5959',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pinIcon: {
        width: 10,
        height: 10,
        resizeMode: 'contain',
        marginRight: 4,
    },
    locationText: {
        fontSize: 9,
        lineHeight: 15,
        color: '#5B5959',
    },
    statusPill: {
        width: 79,
        height: 21,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        backgroundColor: '#BBAE57',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    statusPillText: {
        ...FONT_QUICKSAND_MEDIUM,
        fontSize: 10,
        color: '#FFFFFF',
    },
    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 35,
        backgroundColor: '#262728',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginTop: 8,
    },
    aiIcon: {
        width: 10,
        height: 10,
        resizeMode: 'contain',
        marginRight: 6,
    },
    aiBannerText: {
        flex: 1,
        flexShrink: 1,
        fontSize: 9,
        lineHeight: 15,
        color: '#FFFFFF',
    },

    // New tab: View + Accept (95 x 35)
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 22,
    },
    viewButton: {
        width: 95,
        height: 35,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    viewButtonText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#414141',
    },
    // Figma gradient button: the LinearGradient fills it, the label sits on top.
    acceptButton: {
        width: 95,
        height: 35,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButtonText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // Pending tab: quotation summary + Message Customer
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        marginTop: 12,
        marginBottom: 3,
    },
    quoteText: {
        fontSize: 9,
        lineHeight: 15,
        fontWeight: '700',
        color: '#5B5959',
    },
    totalText: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#5B5959',
        textAlign: 'right',
        marginTop: 4,
    },
    messageButton: {
        alignSelf: 'center',
        width: '82%',
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 22,
    },
    messageButtonText: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#414141',
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
});

export default IncomingServiceRequest;