import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Track';

// Bottom tab definitions — same icon set and pattern as CustomerDashboard.js /
// FindServiceProvider.js, just with Track as the active tab this time.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const STATUS_FILTERS = ['Sent', 'Approved', 'On-going', 'Declined', 'Done'];

// Hardcoded per instructions for this round of frontend review — the adviser
// is checking the coded frontend before the backend exists. Swap this out for
// a fetch of the logged-in customer's service requests (grouped by status)
// once that API is ready.
//
// `cardType` decides which card layout renderRequestCard uses below:
//   'diagnosis' — AI-diagnosis summary card (Sent)
//   'quotation' — quotation preview, tap to open RequestDetails (Approved)
//   'schedule'  — proposed new schedule with inline Accept/Reject (Approved)
//   'payment'   — additional payment needed, expandable (On-going)
//   'timeline'  — step-by-step progress tracker, expandable (On-going)
//   'completed' — finished timeline + Proceed to Payment (final) (Done)
const REQUESTS_BY_STATUS = {
    Sent: [
        {
            id: 'SR-0000-diagnosis',
            cardType: 'diagnosis',
            requestNumber: 'SR-0000',
            providerName: 'Mark Rivera',
            probableCause: 'Liquid damage to charging circuit',
            confidencePercent: 82,
        },
    ],
    Approved: [
        {
            id: 'SR-0001-quotation',
            cardType: 'quotation',
            requestNumber: 'SR-0001',
            providerName: 'Mico Dominic',
            badgeLabel: 'Approve Quote?',
            laborCost: 850,
            total: 850,
        },
        {
            id: 'SR-0001-schedule',
            cardType: 'schedule',
            requestNumber: 'SR-0001',
            providerName: 'Mico Dominic',
            badgeLabel: 'New Schedule',
            scheduleDateTime: 'MM/DD/YY 10:00AM',
            reason: 'Lorem ipsum dolor. Lorem ipsum dolor.',
        },
    ],
    'On-going': [
        {
            id: 'SR-0000-payment',
            cardType: 'payment',
            requestNumber: 'SR-0000',
            providerName: 'Jose Rodolfo',
            statusTag: 'In progress',
            paymentAmount: 3000,
            paymentReason: 'Proper and valid reason stated in this sentence.',
        },
        {
            id: 'SR-0000-timeline',
            cardType: 'timeline',
            requestNumber: 'SR-0000',
            providerName: 'Josephinae Rodolfo',
            statusTag: 'In progress',
            timeline: [
                { label: 'Request received', timestamp: 'Jun 24 9:12 AM', done: true },
                { label: 'Quotation approved', timestamp: 'Jun 24 10:12 AM', done: true },
                { label: 'Service Provider is on the way', description: 'Service provider is now heading to your doorstep', done: false },
            ],
        },
    ],
    Declined: [],
    Done: [
        {
            id: 'SR-0000-completed',
            cardType: 'completed',
            requestNumber: 'SR-0000',
            providerName: 'Jose Rodolfo',
            statusTag: 'Completed',
            finalAmount: 3400,
            timeline: [
                { label: 'Request received', timestamp: 'Jun 24 9:12 AM', done: true },
                { label: 'Quotation approved', timestamp: 'Jun 24 10:12 AM', done: true },
                { label: 'Service Provider is on the way', timestamp: 'Jun 24 11:05 AM', done: true },
                { label: 'Completed', timestamp: 'Jun 24 1:45 PM', done: true },
            ],
        },
    ],
};

// Pulls together whichever text fields a card happens to have so search works
// the same way regardless of cardType, instead of assuming every request
// shares the same shape.
const getSearchableText = (request) =>
    [request.requestNumber, request.providerName, request.probableCause, request.reason]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

const Track = ({ navigation }) => {
    const [selectedStatus, setSelectedStatus] = useState('Sent');
    const [searchQuery, setSearchQuery] = useState('');
    // On-going cards (payment / timeline) start collapsed — tapping the
    // "Request #..." line expands that specific card's details. Holds the
    // ids of whichever cards are currently expanded.
    const [expandedRequestIds, setExpandedRequestIds] = useState([]);

    const statusRequests = REQUESTS_BY_STATUS[selectedStatus] || [];
    const visibleRequests = searchQuery.trim()
        ? statusRequests.filter((request) => getSearchableText(request).includes(searchQuery.trim().toLowerCase()))
        : statusRequests;

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleSelectStatus = (status) => {
        setSelectedStatus(status);
    };

    const handleRequestPress = (requestNumber) => {
        // TODO: confirm 'RequestDetails' matches the screen name registered in
        // your navigator, and pass along whatever the real backend needs.
        navigation.navigate('RequestDetails', { requestNumber });
    };

    const toggleRequestExpanded = (requestId) => {
        setExpandedRequestIds((current) =>
            current.includes(requestId) ? current.filter((id) => id !== requestId) : [...current, requestId]
        );
    };

    const handleAcceptSchedule = (requestId) => {
        // TODO: confirm the proposed schedule via the backend once the API is ready
    };

    const handleRejectSchedule = (requestId) => {
        // TODO: reject the proposed schedule via the backend once the API is ready
    };

    const handleApprovePayment = (requestId) => {
        // TODO: approve the additional payment via the backend once the API is ready
    };

    const handleRejectPayment = (requestId) => {
        // TODO: reject the additional payment via the backend once the API is ready
    };

    const handleMessageProvider = (providerName) => {
        // Re-uses the existing Chat -> Conversation flow so the customer can
        // message this provider directly about the request.
        navigation.navigate('Conversation', { senderName: providerName });
    };

    const handleProceedToPayment = (request) => {
        navigation.navigate('Payment', {
            requestNumber: request.requestNumber,
            paymentStage: 'final',
            amount: request.finalAmount,
        });
    };

    const renderDiagnosisCard = (request) => (
        <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            onPress={() => handleRequestPress(request.requestNumber)}
            activeOpacity={0.85}
        >
            <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
            <Text style={styles.sentToLine}>
                sent to <Text style={styles.providerName}>{request.providerName}</Text>
            </Text>

            <Text style={styles.probableCauseLabel}>Probable Cause</Text>
            <Text style={styles.probableCauseText}>{request.probableCause}</Text>

            <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${request.confidencePercent}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{request.confidencePercent}%</Text>
            </View>
            <Text style={styles.progressCaption}>Confidence based on similar reported cases</Text>
        </TouchableOpacity>
    );

    const renderQuotationCard = (request) => (
        // Preview only — tapping opens RequestDetails, which is where the real
        // Approve/Decline actions (and the scheduling + payment modals) live.
        <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            onPress={() => handleRequestPress(request.requestNumber)}
            activeOpacity={0.85}
        >
            <View style={styles.cardTopRow}>
                <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                <View style={styles.badgeOrange}>
                    <Text style={styles.badgeOrangeText}>{request.badgeLabel}</Text>
                </View>
            </View>
            <Text style={styles.sentToLine}>{request.providerName} sent a quotation</Text>

            <View style={styles.lineItemRow}>
                <Text style={styles.lineItemLabel}>Labor Cost</Text>
                <Text style={styles.lineItemAmount}>₱{request.laborCost.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.lineItemRow}>
                <Text style={styles.lineItemLabelBold}>Total</Text>
                <Text style={styles.lineItemAmountBold}>₱{request.total.toFixed(2)}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderScheduleCard = (request) => (
        <View key={request.id} style={styles.requestCard}>
            <View style={styles.cardTopRow}>
                <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                <View style={styles.badgeOrange}>
                    <Text style={styles.badgeOrangeText}>{request.badgeLabel}</Text>
                </View>
            </View>
            <Text style={styles.sentToLine}>{request.providerName} sent a new schedule.</Text>

            <Text style={styles.scheduleDateTime}>{request.scheduleDateTime}</Text>

            <Text style={styles.reasonLabel}>Reason for New Schedule</Text>
            <Text style={styles.reasonText}>{request.reason}</Text>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleAcceptSchedule(request.id)}>
                    <Text style={styles.actionButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleRejectSchedule(request.id)}>
                    <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderPaymentCard = (request) => {
        const isExpanded = expandedRequestIds.includes(request.id);
        return (
            <View key={request.id} style={styles.requestCard}>
                <TouchableOpacity style={styles.cardTopRow} onPress={() => toggleRequestExpanded(request.id)} activeOpacity={0.7}>
                    <Text style={styles.requestNumber}>
                        Request #{request.requestNumber} {isExpanded ? '▲' : '▼'}
                    </Text>
                    <View style={styles.badgeBlue}>
                        <Text style={styles.badgeBlueText}>{request.statusTag}</Text>
                    </View>
                </TouchableOpacity>
                <Text style={styles.providerNameLine}>{request.providerName}</Text>

                {isExpanded && (
                    <>
                        <View style={styles.paymentNotice}>
                            <View style={styles.paymentNoticeTextWrap}>
                                <Text style={styles.paymentNoticeTitle}>Additional payment needed</Text>
                                <Text style={styles.paymentNoticeReason}>{request.paymentReason}</Text>
                            </View>
                            <View style={styles.paymentNoticeAmountWrap}>
                                <Text style={styles.paymentNoticeAmount}>₱{request.paymentAmount.toLocaleString()}</Text>
                                <Text style={styles.paymentNoticeCaption}>Due for approval</Text>
                            </View>
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleApprovePayment(request.id)}>
                                <Text style={styles.actionButtonText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleRejectPayment(request.id)}>
                                <Text style={styles.actionButtonText}>Reject</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.cardDivider} />
                        <TouchableOpacity onPress={() => handleMessageProvider(request.providerName)} style={styles.messageButton}>
                            <Text style={styles.messageButtonText}>Message</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        );
    };

    const renderTimelineCard = (request) => {
        const isExpanded = expandedRequestIds.includes(request.id);
        return (
            <View key={request.id} style={styles.requestCard}>
                <TouchableOpacity style={styles.cardTopRow} onPress={() => toggleRequestExpanded(request.id)} activeOpacity={0.7}>
                    <Text style={styles.requestNumber}>
                        Request #{request.requestNumber} {isExpanded ? '▲' : '▼'}
                    </Text>
                    <View style={styles.badgeBlue}>
                        <Text style={styles.badgeBlueText}>{request.statusTag}</Text>
                    </View>
                </TouchableOpacity>
                <Text style={styles.providerNameLine}>{request.providerName}</Text>

                {isExpanded && (
                    <>
                        {request.timeline.map((step) => (
                            <View key={step.label} style={styles.timelineRow}>
                                <View style={styles.timelineDot}>
                                    {step.done && <Image source={require('../assets/icon_check.png')} style={styles.timelineCheckIcon} />}
                                </View>
                                <View style={styles.timelineTextWrap}>
                                    <Text style={styles.timelineLabel}>{step.label}</Text>
                                    <Text style={styles.timelineSubtext}>{step.timestamp || step.description}</Text>
                                </View>
                            </View>
                        ))}

                        <View style={styles.cardDivider} />
                        <TouchableOpacity onPress={() => handleMessageProvider(request.providerName)} style={styles.messageButton}>
                            <Text style={styles.messageButtonText}>Message</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        );
    };

    const renderCompletedCard = (request) => {
        const isExpanded = expandedRequestIds.includes(request.id);
        return (
            <View key={request.id} style={styles.requestCard}>
                <TouchableOpacity style={styles.cardTopRow} onPress={() => toggleRequestExpanded(request.id)} activeOpacity={0.7}>
                    <Text style={styles.requestNumber}>
                        Request #{request.requestNumber} {isExpanded ? '▲' : '▼'}
                    </Text>
                    <View style={styles.badgeBlue}>
                        <Text style={styles.badgeBlueText}>{request.statusTag}</Text>
                    </View>
                </TouchableOpacity>
                <Text style={styles.providerNameLine}>{request.providerName}</Text>

                {isExpanded && (
                    <>
                        {request.timeline.map((step) => (
                            <View key={step.label} style={styles.timelineRow}>
                                <View style={styles.timelineDot}>
                                    {step.done && <Image source={require('../assets/icon_check.png')} style={styles.timelineCheckIcon} />}
                                </View>
                                <View style={styles.timelineTextWrap}>
                                    <Text style={styles.timelineLabel}>{step.label}</Text>
                                    <Text style={styles.timelineSubtext}>{step.timestamp || step.description}</Text>
                                </View>
                            </View>
                        ))}

                        <View style={styles.cardDivider} />
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleProceedToPayment(request)}>
                                <Text style={styles.actionButtonText}>Proceed to Payment</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleMessageProvider(request.providerName)}
                            >
                                <Text style={styles.actionButtonText}>Message</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        );
    };

    const renderRequestCard = (request) => {
        switch (request.cardType) {
            case 'quotation':
                return renderQuotationCard(request);
            case 'schedule':
                return renderScheduleCard(request);
            case 'payment':
                return renderPaymentCard(request);
            case 'timeline':
                return renderTimelineCard(request);
            case 'completed':
                return renderCompletedCard(request);
            case 'diagnosis':
            default:
                return renderDiagnosisCard(request);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>My Requests</Text>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search request details..."
                    placeholderTextColor="#999999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.statusTabRow}
                >
                    {STATUS_FILTERS.map((status) => {
                        const isSelected = status === selectedStatus;
                        const count = REQUESTS_BY_STATUS[status].length;
                        return (
                            <TouchableOpacity
                                key={status}
                                style={[styles.statusTab, isSelected && styles.statusTabSelected]}
                                onPress={() => handleSelectStatus(status)}
                            >
                                <Text style={[styles.statusTabText, isSelected && styles.statusTabTextSelected]}>
                                    {status} ({count})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {visibleRequests.length > 0 ? (
                    visibleRequests.map(renderRequestCard)
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No {selectedStatus.toLowerCase()} requests</Text>
                    </View>
                )}
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
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    searchInput: {
        backgroundColor: '#EFEFEF',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
        marginBottom: 16,
    },
    statusTabRow: {
        paddingBottom: 4,
        marginBottom: 20,
    },
    statusTab: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    statusTabSelected: {
        backgroundColor: '#021E79',
        borderColor: '#021E79',
    },
    statusTabText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '600',
    },
    statusTabTextSelected: {
        color: '#FFFFFF',
    },
    requestCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 4,
    },
    sentToLine: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 12,
    },
    providerName: {
        fontWeight: '700',
        color: '#111111',
    },
    providerNameLine: {
        fontSize: 13,
        color: '#666666',
        marginBottom: 12,
    },
    probableCauseLabel: {
        fontSize: 11,
        color: '#888888',
        marginBottom: 2,
    },
    probableCauseText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 10,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E5E5E5',
        overflow: 'hidden',
        marginRight: 8,
    },
    progressFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#0255AF',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333333',
    },
    progressCaption: {
        fontSize: 11,
        color: '#999999',
    },
    badgeOrange: {
        backgroundColor: '#BB8157',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    badgeOrangeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    badgeBlue: {
        backgroundColor: '#5C7CC9',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    badgeBlueText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 8,
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginTop: 12,
        marginBottom: 12,
    },
    lineItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lineItemLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    lineItemAmount: {
        fontSize: 13,
        color: '#666666',
    },
    lineItemLabelBold: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    lineItemAmountBold: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    scheduleDateTime: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginVertical: 10,
    },
    reasonLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 2,
    },
    reasonText: {
        fontSize: 12,
        color: '#777777',
        marginBottom: 14,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '700',
    },
    paymentNotice: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#FCF3C8',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    paymentNoticeTextWrap: {
        flex: 1,
        marginRight: 10,
    },
    paymentNoticeTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#B4622A',
        marginBottom: 2,
    },
    paymentNoticeReason: {
        fontSize: 11,
        color: '#8A7A4A',
    },
    paymentNoticeAmountWrap: {
        alignItems: 'flex-end',
    },
    paymentNoticeAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    paymentNoticeCaption: {
        fontSize: 10,
        color: '#8A7A4A',
    },
    messageButton: {
        alignSelf: 'flex-end',
        borderWidth: 1,
        borderColor: '#DDDDDD',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageButtonText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '700',
    },
    timelineRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    timelineDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#5C7CC9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    timelineCheckIcon: {
        width: 12,
        height: 12,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
    },
    timelineTextWrap: {
        flex: 1,
    },
    timelineLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    timelineSubtext: {
        fontSize: 11,
        color: '#999999',
        marginTop: 1,
    },
    emptyState: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 24,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
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

export default Track;