import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ACTIVE_TAB = 'Track';

// Bottom tab definitions — same icon set and pattern as Track.js.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

/* ============================================================================
 * BACKEND-READY — RequestDetails
 * ----------------------------------------------------------------------------
 * This is the screen where the QUOTATION a provider sent gets reviewed,
 * approved/declined, and paid for. Every action here has a direct
 * provider-side mirror — the provider needs to know the outcome of each step
 * (accepted/declined, payment received) since they're the
 * one fulfilling the request. See the per-handler notes below.
 * ========================================================================== */

// Hardcoded per instructions for this round of frontend review — the adviser
// is checking the coded frontend before the backend exists. Once real
// navigation params + a backend fetch are wired up, this should come from
// route.params (e.g. route.params.requestNumber) instead, e.g.
// fetchRequestDetail(route.params.requestNumber).then(setRequestDetail).
// BACKEND-READY: GET /service-requests/:id (or /quotations/:id)
//   requestNumber → SERVICE_REQUEST.request_id (display-formatted)
//   providerName  → USER.name for the QUOTATION's provider_id
//   reason        → QUOTATION.remarks
//   lineItems     → derived from QUOTATION.labor_cost / parts_cost (split into
//                   rows here, or the backend returns them pre-split)
//   total         → QUOTATION.total_amount
//   initialFeePercent → this is hardcoded to 20 here, but the minimum initial
//                   payment discussed for the ERD was 50% of total_amount.
//                   Reconcile these before wiring this up — if 50% is the
//                   real business rule, this should either be a constant
//                   shared with the backend or fetched, not hardcoded per
//                   screen at a different value than intended.
const REQUEST_DETAIL = {
    requestNumber: 'SR-0000',
    providerName: 'Mico Dominic',
    reason: 'This sentence states the reason to justify the labor.',
    lineItems: [{ label: 'Labor', amount: 850 }],
    total: 850,
    initialFeePercent: 20,
};

const RequestDetails = ({ navigation, route }) => {
    // null | 'approved' — which modal (if any) is on screen.
    const [modalStep, setModalStep] = useState(null);

    const handleClose = () => {
        navigation.goBack();
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleApprove = () => {
        setModalStep('approved');
        //
        // BACKEND-READY: PATCH the QUOTATION's status to 'accepted' here.
        // Provider-side effect: the provider needs to be
        // notified their quotation was accepted, since it's what unblocks
        // them to start preparing for the job. SERVICE_REQUEST.request_status
        // should also move forward at this point (e.g. to 'accepted').
    };

    const handleDecline = () => {
        // TODO: send the decline via the backend once the API is ready, e.g.
        // declineRequest(REQUEST_DETAIL.requestNumber).then(() => navigation.goBack());
        //
        // BACKEND-READY: PATCH QUOTATION.status to 'declined'. Provider-side
        // effect: the provider needs to be notified the quotation was
        // declined so it drops off their active list — otherwise they're left
        // thinking a response is still pending.
        navigation.goBack();
    };

    const handleProceedToPayment = () => {
        // TODO: navigate to the actual payment screen once it exists, e.g.
        // navigation.navigate('Payment', { requestNumber: REQUEST_DETAIL.requestNumber });
        //
        // BACKEND-READY: this is the initial-payment step — creates a
        // PAYMENT row with payment_type = 'initial', request_id, and amount
        // (validated as >= the required minimum of QUOTATION.total_amount —
        // confirm the real percentage first, see the REQUEST_DETAIL note
        // above) via PayMongo. On success: SERVICE_REQUEST.request_status
        // moves to something like 'booked'/'confirmed', and the provider
        // should be notified payment was received — this is what actually
        // locks in the booking on their side.
        setModalStep(null);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity onPress={handleClose}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.header}>My Requests</Text>

                <Text style={styles.requestNumber}>Request #{REQUEST_DETAIL.requestNumber}</Text>
                <Text style={styles.senderLine}>{REQUEST_DETAIL.providerName} sent a quotation</Text>
                <Text style={styles.reasonText}>{REQUEST_DETAIL.reason}</Text>

                <View style={styles.lineItemsCard}>
                    {REQUEST_DETAIL.lineItems.map((item) => (
                        <View key={item.label} style={styles.lineItemRow}>
                            <Text style={styles.lineItemLabel}>{item.label}</Text>
                            <Text style={styles.lineItemAmount}>₱{item.amount.toFixed(2)}</Text>
                        </View>
                    ))}
                    <View style={styles.divider} />
                    <View style={styles.lineItemRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalAmount}>₱{REQUEST_DETAIL.total.toFixed(2)}</Text>
                    </View>
                </View>

                <Text style={styles.noteText}>
                    Note: If you accepted the quotation, you are required to pay the initial fee which is the{' '}
                    {REQUEST_DETAIL.initialFeePercent}% of the total service repair cost.
                </Text>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionButtonHalf} onPress={handleApprove}>
                        <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                            <Text style={styles.actionButtonText}>Approve</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButtonHalf} onPress={handleDecline}>
                        <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                            <Text style={styles.actionButtonText}>Decline</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => handleTabPress(tab.key)}>
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image source={isActive ? tab.activeIcon : tab.inactiveIcon} style={styles.tabIcon} />
                                <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}> {tab.label}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Modal — asks for the initial payment after approving the quotation. */}
            <Modal visible={modalStep === 'approved'} transparent animationType="fade" onRequestClose={() => setModalStep(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardCompact}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalStep(null)}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Service Request Approved</Text>
                        <Text style={styles.modalSubtitle}>
                            You are required to pay the initial fee which is the {REQUEST_DETAIL.initialFeePercent}% of the total
                            service repair cost.
                        </Text>

                        <TouchableOpacity onPress={handleProceedToPayment}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.proceedButton}>
                                <Text style={styles.proceedButtonText}>Proceed to Payment</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        flexGrow: 1,
    },
    backIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 12,
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 20,
    },
    requestNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 4,
    },
    senderLine: {
        fontSize: 13,
        color: '#666666',
        marginBottom: 10,
    },
    reasonText: {
        fontSize: 12,
        color: '#777777',
        marginBottom: 18,
    },
    lineItemsCard: {
        marginBottom: 14,
    },
    lineItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
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
    totalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    totalAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    noteText: {
        fontSize: 12,
        color: '#777777',
        lineHeight: 17,
        marginBottom: 20,
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    actionButtonHalf: {
        flex: 1,
        marginHorizontal: 4,
    },
    actionButton: {
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '700',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(20, 24, 40, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCardCompact: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    modalCloseButton: {
        alignSelf: 'flex-end',
        marginBottom: 4,
    },
    modalCloseIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 17,
        marginBottom: 16,
    },
    proceedButton: {
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
    },
    proceedButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default RequestDetails;