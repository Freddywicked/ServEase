import React, { useState, useCallback } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProviderJobs, acceptNegotiation, rejectNegotiation } from '../api/providerWork_api';
import { formatPeso, formatShortDate } from '../utils/provider_formatters';
import { ROUTES as CHAT_ROUTES } from '../constants/messaging';
import LinearGradient from 'react-native-linear-gradient';

/* ============================================================================
 * Jobs (Service Provider) — "Active Jobs"
 * ----------------------------------------------------------------------------
 * Everything comes from GET /provider/jobs (see api/providerWork_api.js):
 *   jobs       -> the On-going cards (stages, current step, AI suggestion, ...)
 *   quotations -> customer price negotiations waiting for the provider's answer
 * Accept / Decline on a quotation call POST /provider/negotiations/:id/accept|reject.
 * Nothing on this screen is hard-coded data; only labels of the UI itself are static.
 * ========================================================================== */

// Fonts from the Figma (same convention as IncomingServiceRequest.js).
const FONT_ROBOTO_BOLD = Platform.OS === 'ios' ? { fontFamily: 'Roboto-Bold' } : { fontWeight: '700' };
const FONT_QUICKSAND_MEDIUM = { fontFamily: 'Quicksand-Medium' };

const FILTER_OPTIONS = [
    { key: 'All', label: 'All' },
    { key: 'Active', label: 'Active' },
    { key: 'Done', label: 'Completed' },
];
const SECTIONS = [
    { key: 'ongoing', label: 'On-going' },
    { key: 'quotations', label: 'Quotations' },
];

const Jobs = ({ navigation }) => {
    const [jobs, setJobs] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('Active');
    const [section, setSection] = useState('ongoing');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals: `acceptedNotice` is the "Price Negotiated" confirmation; `rejectTarget` is the
    // quotation being declined (its "Reason for Rejection" modal).
    const [busyId, setBusyId] = useState(null);
    const [acceptedNotice, setAcceptedNotice] = useState(false);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [sendingReject, setSendingReject] = useState(false);

    const loadJobs = useCallback(async () => {
        try {
            const data = await getProviderJobs();
            setJobs(data?.jobs ?? []);
            setQuotations(data?.quotations ?? []);
            setLoadFailed(false);
        } catch (error) {
            // Keep the last known data. A 401 is already handled by api/client.
            setLoadFailed(true);
        }
    }, []);

    // Load on mount and whenever the screen regains focus, so a status update pushed from
    // JobUpdateStatus (or a new negotiation) shows up when the provider comes back.
    useFocusEffect(
        useCallback(() => {
            loadJobs().finally(() => setLoading(false));
        }, [loadJobs]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadJobs();
        setRefreshing(false);
    };

    const handleUpdateStatus = (jobId) => navigation.navigate('JobUpdateStatus', { jobId });
    const handleNotifyAdditionalParts = (jobId) => navigation.navigate('JobAdditionalParts', { jobId });

    // The chat thread id IS the request reference ("SR-0001"), as in IncomingServiceRequest.js.
    const handleMessageCustomer = (quotation) =>
        navigation.navigate(CHAT_ROUTES.CONVERSATION_PROVIDER, {
            conversationId: quotation.jobId,
            contactName: quotation.customerName,
        });

    const handleAccept = async (quotation) => {
        if (busyId) return;
        setBusyId(quotation.id);
        try {
            await acceptNegotiation(quotation.paymentRequestId);
            setAcceptedNotice(true);
            await loadJobs();
        } catch (error) {
            Alert.alert('Unable to accept', error?.message || 'Please check your connection and try again.');
            await loadJobs();
        } finally {
            setBusyId(null);
        }
    };

    const handleOpenReject = (quotation) => {
        setRejectReason('');
        setRejectTarget(quotation);
    };

    const handleCloseReject = () => {
        if (sendingReject) return;
        setRejectTarget(null);
        setRejectReason('');
    };

    const handleSendReject = async () => {
        if (sendingReject || !rejectTarget) return;
        const reason = rejectReason.trim();
        if (!reason) {
            Alert.alert('Reason required', 'State a proper reason for rejection.');
            return;
        }
        setSendingReject(true);
        try {
            await rejectNegotiation(rejectTarget.paymentRequestId, reason);
            setRejectTarget(null);
            setRejectReason('');
            await loadJobs();
        } catch (error) {
            Alert.alert('Unable to send', error?.message || 'Please check your connection and try again.');
            await loadJobs();
        } finally {
            setSendingReject(false);
        }
    };

    const query = searchQuery.trim().toLowerCase();
    const matches = (...values) => !query || values.some((v) => String(v || '').toLowerCase().includes(query));

    const statusFiltered = jobs.filter((job) => {
        if (selectedFilter === 'All') return true;
        if (selectedFilter === 'Active') return job.status === 'Active';
        return job.status === 'Done';
    });
    const visibleJobs = statusFiltered.filter((job) =>
        matches(job.requestNumber, job.customerName, job.currentStepLabel, job.statusLabel),
    );
    const visibleQuotations = quotations.filter((q) => matches(q.requestNumber, q.customerName, q.customerMessage));

    const showSections = selectedFilter === 'Active';
    const showQuotations = showSections && section === 'quotations';

    // ----- cards -----
    const renderStepBar = (job) => {
        const stages = job.stages || [];
        if (stages.length === 0) return null;
        const isDone = job.status === 'Done';
        return (
            <View style={styles.stepRow}>
                {stages.map((stage, index) => {
                    let segmentStyle = styles.stepSegmentUpcoming;
                    if (isDone || (job.started && index < job.currentStepIndex)) segmentStyle = styles.stepSegmentDone;
                    else if (job.started && index === job.currentStepIndex) segmentStyle = styles.stepSegmentCurrent;
                    return (
                        <View
                            key={`${stage}-${index}`}
                            style={[styles.stepSegmentBase, segmentStyle, index === stages.length - 1 && styles.stepSegmentLast]}
                        />
                    );
                })}
            </View>
        );
    };

    const renderJobCard = (job) => (
        <View key={job.id} style={styles.card}>
            <View style={styles.cardTopRow}>
                <Text style={styles.requestNumber}>Request #{job.requestNumber}</Text>
                {job.statusLabel ? (
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{job.statusLabel}</Text>
                    </View>
                ) : null}
            </View>
            <Text style={styles.cardSubtitle}>
                {job.customerName}
                {job.createdAt ? ` | ${formatShortDate(job.createdAt)}` : ''}
            </Text>

            {job.aiSuggestion ? (
                <View style={styles.aiBanner}>
                    <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                    <Text style={styles.aiBannerText} numberOfLines={2}>
                        AI suggests {String(job.aiSuggestion).toLowerCase()}
                        {job.aiConfidence !== null && job.aiConfidence !== undefined ? ` (${Math.round(job.aiConfidence)}% confidence)` : ''}
                    </Text>
                </View>
            ) : null}

            <View style={styles.divider} />

            {renderStepBar(job)}
            {job.currentStepLabel ? (
                <Text style={styles.currentStepLabel}>Current Step: {job.currentStepLabel}</Text>
            ) : null}

            {job.status !== 'Done' && (
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionPrimary, styles.actionSpacing]}
                        onPress={() => handleUpdateStatus(job.id)}
                    >
                        <Text style={styles.actionText}>Update Status</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionSecondary]}
                        onPress={() => handleNotifyAdditionalParts(job.id)}
                    >
                        <Text style={styles.actionText}>Notify Additional Parts</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderQuotationCard = (quotation) => {
        const busy = busyId === quotation.id;
        return (
            <View key={quotation.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                    <Text style={styles.requestNumber}>Request #{quotation.requestNumber}</Text>
                    <View style={[styles.statusBadge, styles.statusBadgeNegotiation]}>
                        <Text style={styles.statusBadgeText}>{quotation.statusLabel}</Text>
                    </View>
                </View>
                <Text style={styles.cardSubtitle}>
                    {quotation.customerName}
                    {quotation.createdAt ? ` | ${formatShortDate(quotation.createdAt)}` : ''}
                </Text>
                {quotation.distanceKm !== null && quotation.distanceKm !== undefined ? (
                    <View style={styles.distanceRow}>
                        <Image source={require('../assets/icon_pinloc.png')} style={styles.pinIcon} />
                        <Text style={styles.distanceText}>{quotation.distanceKm} km away</Text>
                    </View>
                ) : null}

                <Text style={styles.negotiationIntro}>
                    The customer wants to negotiate with a suggested amount:
                </Text>
                <View style={styles.messageBox}>
                    <View style={styles.messageTextWrap}>
                        <Text style={styles.messageTitle}>Customer Message</Text>
                        <Text style={styles.messageBody}>
                            {quotation.customerMessage || `Original amount ${formatPeso(quotation.originalAmount)}`}
                        </Text>
                    </View>
                    <View style={styles.messageAmountWrap}>
                        <Text style={styles.messageAmount}>
                            {quotation.proposedAmount !== null && quotation.proposedAmount !== undefined
                                ? `₱ ${Number(quotation.proposedAmount).toLocaleString('en-PH')}`
                                : '—'}
                        </Text>
                        <Text style={styles.messageAmountCaption}>due for approval</Text>
                    </View>
                </View>

                <View style={styles.divider} />
                <View style={styles.quotationActions}>
                    <TouchableOpacity
                        style={[styles.smallButton, styles.messageButton]}
                        onPress={() => handleMessageCustomer(quotation)}
                        disabled={busy}
                    >
                        <Text style={styles.messageButtonText}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.smallButton, styles.declineButton, busy && styles.buttonDisabled]}
                        onPress={() => handleOpenReject(quotation)}
                        disabled={busy}
                    >
                        <Text style={styles.smallButtonText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.smallButton, styles.acceptButton, busy && styles.buttonDisabled]}
                        onPress={() => handleAccept(quotation)}
                        disabled={busy}
                    >
                        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.smallButtonText}>Accept</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderBody = () => {
        if (loading) return <ActivityIndicator style={styles.loader} color="#0255AF" />;
        if (showQuotations) {
            if (visibleQuotations.length > 0) return visibleQuotations.map(renderQuotationCard);
            return !loadFailed && <Text style={styles.emptyStateText}>No quotations found</Text>;
        }
        if (visibleJobs.length > 0) return visibleJobs.map(renderJobCard);
        return !loadFailed && <Text style={styles.emptyStateText}>No jobs found</Text>;
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.headerTitle}>Active Jobs</Text>

                <View style={styles.searchBox}>
                    <Image source={require('../assets/icon_search_colored.png')} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search job details"
                        placeholderTextColor="#727272"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <View style={styles.filterRow}>
                    {FILTER_OPTIONS.map((filter, index) => {
                        const isActive = filter.key === selectedFilter;
                        const showDot = filter.key === 'Active' && quotations.length > 0;
                        return (
                            <TouchableOpacity
                                key={filter.key}
                                style={[
                                    styles.filterPill,
                                    isActive && styles.filterPillActive,
                                    index < FILTER_OPTIONS.length - 1 && styles.filterPillSpacing,
                                ]}
                                onPress={() => setSelectedFilter(filter.key)}
                            >
                                <Text style={isActive ? styles.filterTextActive : styles.filterText}>{filter.label}</Text>
                                {showDot ? (
                                    <View style={styles.filterDot}>
                                        <Text style={styles.filterDotText}>{quotations.length > 9 ? '9+' : quotations.length}</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {showSections && (
                    <View style={styles.sectionRow}>
                        {SECTIONS.map((item) => {
                            const isActive = item.key === section;
                            return (
                                <TouchableOpacity key={item.key} style={styles.sectionTab} onPress={() => setSection(item.key)}>
                                    <Text style={isActive ? styles.sectionTextActive : styles.sectionText}>{item.label}</Text>
                                    <View style={[styles.sectionUnderline, isActive && styles.sectionUnderlineActive]} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {loadFailed && (
                    <TouchableOpacity style={styles.errorBanner} onPress={loadJobs}>
                        <Text style={styles.errorBannerText}>Couldn't load your jobs. Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                {renderBody()}
            </ScrollView>

            {/* "Price Negotiated" — the provider accepted the customer's suggested amount. */}
            <Modal visible={acceptedNotice} transparent animationType="fade" onRequestClose={() => setAcceptedNotice(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, styles.acceptedCard]}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setAcceptedNotice(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <View style={[styles.closeLine, styles.closeLineA]} />
                            <View style={[styles.closeLine, styles.closeLineB]} />
                        </TouchableOpacity>
                        <Text style={styles.acceptedTitle}>Price Negotiated</Text>
                        <Text style={styles.acceptedBody}>Your additional payment request has been updated.</Text>
                        <TouchableOpacity style={styles.gradientButton} onPress={() => setAcceptedNotice(false)} activeOpacity={0.85} accessibilityRole="button">
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            <Text style={styles.gradientButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* "Reason for Rejection" — the provider declined the customer's suggested amount. */}
            <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={handleCloseReject}>
                <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[styles.modalCard, styles.rejectCard]}>
                        <TouchableOpacity style={styles.modalClose} onPress={handleCloseReject} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <View style={[styles.closeLine, styles.closeLineA]} />
                            <View style={[styles.closeLine, styles.closeLineB]} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Reason for Rejection</Text>
                        <Text style={styles.modalSubtitle}>State a proper reason for rejection.</Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Enter your reason here."
                            placeholderTextColor="#B7B7B7"
                            multiline
                            maxLength={500}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                        />
                        <TouchableOpacity
                            style={[styles.gradientButton, sendingReject && styles.buttonDisabled]}
                            onPress={handleSendReject}
                            disabled={sendingReject}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            {sendingReject ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.gradientButtonText}>Send</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { paddingHorizontal: 25, paddingTop: 16, paddingBottom: 24 },
    headerTitle: { ...FONT_ROBOTO_BOLD, fontSize: 24, lineHeight: 28, color: '#021E79', marginBottom: 20 },

    // Search
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 37,
        borderWidth: 1,
        borderColor: '#9E9898',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        marginBottom: 14,
    },
    searchIcon: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#9A9A9A', marginRight: 8 },
    searchInput: { flex: 1, ...FONT_QUICKSAND_MEDIUM, fontSize: 10, color: '#292727', paddingVertical: 0 },

    // Filter pills
    filterRow: { flexDirection: 'row', marginBottom: 14 },
    filterPill: {
        flex: 1,
        height: 32,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        backgroundColor: '#FFFDFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterPillActive: { backgroundColor: '#021E79' },
    filterPillSpacing: { marginRight: 6 },
    filterText: { ...FONT_QUICKSAND_MEDIUM, fontSize: 10, color: '#414141' },
    filterTextActive: { ...FONT_QUICKSAND_MEDIUM, fontSize: 10, color: '#FFFAFA' },
    filterDot: {
        position: 'absolute',
        top: -4,
        right: 22,
        minWidth: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#C61E1E',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    filterDotText: { color: '#FFFFFF', fontSize: 7, fontWeight: '600' },

    // On-going | Quotations
    sectionRow: { flexDirection: 'row', marginBottom: 18 },
    sectionTab: { flex: 1, alignItems: 'center' },
    sectionText: { ...FONT_QUICKSAND_MEDIUM, fontSize: 10, color: '#292727', paddingVertical: 5 },
    sectionTextActive: { ...FONT_QUICKSAND_MEDIUM, fontSize: 10, fontWeight: '700', color: '#292727', paddingVertical: 5 },
    sectionUnderline: { alignSelf: 'stretch', height: 3, borderRadius: 10, backgroundColor: '#D9D9D9' },
    sectionUnderlineActive: { backgroundColor: '#18315B' },

    // Cards
    card: {
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 14,
        marginBottom: 16,
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    requestNumber: { fontSize: 13, lineHeight: 22, fontWeight: '700', color: '#292727' },
    statusBadge: {
        backgroundColor: '#62BB57',
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        paddingVertical: 2,
        paddingHorizontal: 12,
    },
    statusBadgeNegotiation: { backgroundColor: '#BB8157' },
    statusBadgeText: { ...FONT_QUICKSAND_MEDIUM, fontSize: 10, color: '#FFFFFF' },
    cardSubtitle: { fontSize: 9, lineHeight: 15, color: '#5B5959', marginBottom: 6 },

    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#262728',
        borderRadius: 10,
        minHeight: 34,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginTop: 4,
    },
    aiIcon: { width: 10, height: 10, resizeMode: 'contain', tintColor: '#577FBB', marginRight: 8 },
    aiBannerText: { flex: 1, fontSize: 9, lineHeight: 15, color: '#FFFFFF' },

    divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.4)', marginVertical: 12, opacity: 0.4 },

    stepRow: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 4 },
    stepSegmentBase: { flex: 1, height: 7, borderRadius: 10, marginRight: 6 },
    stepSegmentLast: { marginRight: 0 },
    stepSegmentDone: { backgroundColor: '#62BB57' },
    stepSegmentCurrent: { backgroundColor: '#021E79' },
    stepSegmentUpcoming: { backgroundColor: '#D9D9D9' },
    currentStepLabel: { fontSize: 9, lineHeight: 15, fontWeight: '700', color: '#5B5959', marginBottom: 10, paddingHorizontal: 4 },

    actionRow: { flexDirection: 'row', marginTop: 2 },
    actionButton: {
        flex: 1,
        height: 35,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionPrimary: { backgroundColor: '#021E79' },
    actionSecondary: { backgroundColor: '#BBAE57' },
    actionSpacing: { marginRight: 12 },
    actionText: { fontSize: 10, lineHeight: 17, fontWeight: '700', color: '#FFFFFF' },

    // Quotation card
    distanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    pinIcon: { width: 10, height: 10, resizeMode: 'contain', marginRight: 4 },
    distanceText: { fontSize: 9, lineHeight: 15, color: '#5B5959' },
    negotiationIntro: { fontSize: 9, lineHeight: 15, fontWeight: '700', color: '#5B5959', marginBottom: 6 },
    messageBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFED3',
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    messageTextWrap: { flex: 1, paddingRight: 8 },
    messageTitle: { fontSize: 10, lineHeight: 17, fontWeight: '700', color: '#BB8157' },
    messageBody: { fontSize: 8, lineHeight: 12, color: '#292727' },
    messageAmountWrap: { alignItems: 'center' },
    messageAmount: { fontSize: 10, lineHeight: 17, fontWeight: '700', color: '#292727' },
    messageAmountCaption: { fontSize: 7, lineHeight: 12, color: '#292727' },
    quotationActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    smallButton: {
        width: 80,
        height: 35,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
    messageButton: { backgroundColor: '#FFFDFD' },
    messageButtonText: { fontSize: 10, lineHeight: 17, fontWeight: '700', color: '#414141' },
    declineButton: { backgroundColor: '#C62828' },
    acceptButton: { backgroundColor: '#167713' },
    smallButtonText: { fontSize: 10, lineHeight: 17, fontWeight: '700', color: '#FFFFFF' },
    buttonDisabled: { opacity: 0.6 },

    emptyStateText: { fontSize: 12, color: '#999999', textAlign: 'center', marginTop: 24 },
    loader: { marginTop: 30 },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: { fontSize: 12, color: '#555555' },

    // Modals (Figma: card 345 wide, 1px #818080, radius 10; gradient button 265 x 40)
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 26,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        paddingHorizontal: 15,
    },
    rejectCard: { paddingTop: 17, paddingBottom: 23 },
    acceptedCard: { paddingTop: 45, paddingBottom: 29 },
    modalClose: { position: 'absolute', top: 14, right: 16, width: 15, height: 15, zIndex: 2 },
    closeLine: { position: 'absolute', top: 7, left: -1, width: 17, height: 1.6, backgroundColor: '#000000' },
    closeLineA: { transform: [{ rotate: '45deg' }] },
    closeLineB: { transform: [{ rotate: '-45deg' }] },
    modalTitle: { fontSize: 13, lineHeight: 22, fontWeight: '700', color: '#414141', paddingLeft: 0 },
    modalSubtitle: { fontSize: 9, lineHeight: 15, color: '#5B5959' },
    reasonInput: {
        height: 80,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 6,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 16,
        marginBottom: 37,
        fontSize: 10,
        lineHeight: 17,
        color: '#292727',
        textAlignVertical: 'top',
    },
    acceptedTitle: { fontSize: 13, lineHeight: 22, fontWeight: '700', color: '#414141', textAlign: 'center' },
    acceptedBody: { fontSize: 13, lineHeight: 22, color: '#5B5959', textAlign: 'center', marginTop: 5, marginBottom: 21, paddingHorizontal: 12 },
    // Figma gradient button: the LinearGradient fills it, the label sits on top.
    gradientButton: {
        alignSelf: 'center',
        width: '84%',
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientButtonText: { fontSize: 12, lineHeight: 20, fontWeight: '700', color: '#FFFFFF' },
});

export default Jobs;