import React, { useState, useEffect } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { getServiceRequest, respondToQuotation } from '../api/servicerequest_api';

/* ============================================================================
 * RequestDetails (Customer app) — review, approve/decline and pay for a QUOTATION
 * ----------------------------------------------------------------------------
 * Nothing on this screen is hard-coded. Everything comes from the backend:
 *
 *   Load     GET  /service-requests/:id   (getServiceRequest)
 *            The quotation lives on the provider entry whose status is 'quoted'
 *            (toCustomerDto in the backend): providers[].quote = {
 *              labor, parts, serviceFee, total, notes,
 *              initialFeePercent, initialAmount
 *            }
 *            - labor / parts / serviceFee   line items, always listed in this order (parts is 0.00 when
 *                                           the provider set no price; serviceFee is the platform fee,
 *                                           separate from the initial payment)
 *            - total                        quotation total (falls back to the sum of the line items)
 *            - initialFeePercent            the business rule for the initial payment, sent by the
 *                                           backend so the app and the payment validation always agree
 *            - initialAmount                the exact initial payment to charge (server-rounded)
 *   Respond  POST /service-requests/:id/quotation/respond  (respondToQuotation) { approve: boolean }
 *            Approve -> the provider is booked and notified, then the customer is asked to pay the
 *                       initial fee (Payment screen, stage 'initial').
 *            Decline -> opens the "Reason for Rejection" modal; Send -> { approve: false, reason }.
 *                       The quotation is declined and the provider is notified with the reason; the
 *                       request moves to the Closed tab (backend: closedBy 'customer',
 *                       closedAction 'declined', reason). Nothing is sent until the customer taps Send.
 *
 * Layout follows the Figma "SR- Quotation" frame (402px wide): Roboto title, 16px request number,
 * 8px line items, 96x32 Approve / Decline buttons aligned to the right.
 * ========================================================================== */

const FONTS = { roboto: 'Roboto' };

const toAmount = (value) => Number(value ?? 0);
const formatAmount = (value) => toAmount(value).toFixed(2);
const formatPercent = (value) => (Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2));

const RequestDetails = ({ navigation, route }) => {
    const requestId = route?.params?.requestId;

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [acting, setActing] = useState(false);
    // null | 'approved' — which modal (if any) is on screen.
    const [modalStep, setModalStep] = useState(null);
    // "Reason for Rejection" modal (customer declining the quotation).
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!requestId) {
                setLoadError('Missing request id');
                setLoading(false);
                return;
            }
            try {
                const request = await getServiceRequest(requestId);
                if (cancelled) return;
                const quoted = (request.providers || []).find((p) => p.status === 'quoted' && p.quote);
                const quote = quoted?.quote;

                // Labor, Parts and Service Fee are always listed in this order. Parts shows 0.00 when the
                // provider set no price for parts; the service fee (platform fee) is set by the backend.
                const lineItems = [
                    { label: 'Labor', amount: toAmount(quote?.labor) },
                    { label: 'Parts', amount: toAmount(quote?.parts) },
                    { label: 'Service Fee', amount: toAmount(quote?.serviceFee) },
                ];

                const total = quote?.total ?? lineItems.reduce((sum, item) => sum + item.amount, 0);
                const initialFeePercent = quote?.initialFeePercent ?? request.initialFeePercent ?? null;
                const initialAmount =
                    quote?.initialAmount ??
                    (initialFeePercent !== null ? Math.round(((toAmount(total) * Number(initialFeePercent)) / 100) * 100) / 100 : null);

                setDetail({
                    requestNumber: request.id,
                    providerName: quoted?.name || 'Service provider',
                    reason: quote?.notes || '',
                    lineItems,
                    total: toAmount(total),
                    initialFeePercent,
                    initialAmount,
                    hasOpenQuotation: Boolean(quoted),
                });
            } catch (error) {
                if (!cancelled) setLoadError(error.message || 'Could not load the request.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId]);

    const handleClose = () => {
        navigation.goBack();
    };

    // Approving books the provider (request_status -> 'Approved') and notifies them.
    const handleApprove = async () => {
        if (acting) return;
        setActing(true);
        try {
            await respondToQuotation(requestId, { approve: true });
            setModalStep('approved');
        } catch (error) {
            Alert.alert('Could not approve', error.message);
        } finally {
            setActing(false);
        }
    };

    // Decline opens the "Reason for Rejection" modal; nothing is sent until Send.
    const handleDecline = () => {
        if (acting) return;
        setRejectReason('');
        setRejectOpen(true);
    };

    const handleCloseRejectModal = () => {
        if (acting) return;
        setRejectOpen(false);
        setRejectReason('');
    };

    // Declining the quotation notifies the provider (with the reason) and the request goes to the Closed tab.
    const handleSendRejection = async () => {
        const reason = rejectReason.trim();
        if (acting) return;
        if (!reason) {
            Alert.alert('Reason needed', 'Please state a reason for rejecting this quotation.');
            return;
        }
        setActing(true);
        try {
            await respondToQuotation(requestId, { approve: false, reason });
            setRejectOpen(false);
            navigation.goBack();
        } catch (error) {
            setActing(false);
            Alert.alert('Could not decline', error.message);
        }
    };

    const handleProceedToPayment = () => {
        setModalStep(null);
        navigation.navigate(ROUTES.PAYMENT, {
            requestId,
            requestNumber: detail?.requestNumber,
            providerName: detail?.providerName,
            paymentStage: 'initial',
            amount: detail?.initialAmount ?? undefined,
        });
    };

    // The percentage is part of the sentence only when the backend sent it.
    const initialFeeSentence =
        detail?.initialFeePercent !== null && detail?.initialFeePercent !== undefined
            ? `the initial fee which is the ${formatPercent(detail.initialFeePercent)}% of the total service repair cost`
            : 'the initial fee of the total service repair cost';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.header}>My Requests</Text>

                {loading ? (
                    <ActivityIndicator color="#0255AF" style={styles.loadingIndicator} />
                ) : loadError ? (
                    <Text style={styles.reasonText}>{loadError}</Text>
                ) : !detail || !detail.hasOpenQuotation ? (
                    <Text style={styles.reasonText}>There is no open quotation for this request.</Text>
                ) : (
                    <>
                        <Text style={styles.requestNumber}>Request #{detail.requestNumber}</Text>
                        <Text style={styles.senderLine}>{detail.providerName} sent a quotation</Text>
                        {!!detail.reason && <Text style={styles.reasonText}>{detail.reason}</Text>}

                        <View style={styles.lineItemsCard}>
                            {detail.lineItems.map((item) => (
                                <View key={item.label} style={styles.lineItemRow}>
                                    <Text style={styles.lineItemLabel}>{item.label}</Text>
                                    <Text style={styles.lineItemAmount}>{formatAmount(item.amount)}</Text>
                                </View>
                            ))}
                            <View style={styles.divider} />
                            <View style={styles.lineItemRow}>
                                <Text style={styles.totalLabel}>Total</Text>
                                <Text style={styles.totalAmount}>{formatAmount(detail.total)}</Text>
                            </View>
                        </View>

                        <Text style={styles.noteText}>
                            Note: If you accepted the quotation, you are required to pay {initialFeeSentence}.
                        </Text>

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.approveButton, acting && styles.actionButtonDisabled]}
                                onPress={handleApprove}
                                disabled={acting}
                            >
                                <Text style={styles.actionButtonText}>{acting ? 'Please wait…' : 'Approve'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.declineButton, acting && styles.actionButtonDisabled]}
                                onPress={handleDecline}
                                disabled={acting}
                            >
                                <Text style={styles.actionButtonText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Modal — asks for the initial payment after approving the quotation. */}
            <Modal visible={modalStep === 'approved'} transparent animationType="fade" onRequestClose={() => setModalStep(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardCompact}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalStep(null)}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Service Request Approved</Text>
                        <Text style={styles.modalSubtitle}>You are required to pay {initialFeeSentence}.</Text>

                        <TouchableOpacity style={styles.gradientButton} onPress={handleProceedToPayment} activeOpacity={0.85} accessibilityRole="button">
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            <Text style={styles.gradientButtonText}>Proceed to Payment</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal — reason for declining the quotation (Figma "Reason for Rejection"). */}
            <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={handleCloseRejectModal}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalCardReject}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseRejectModal} disabled={acting}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>

                        <Text style={styles.rejectTitle}>Reason for Rejection</Text>
                        <Text style={styles.rejectSubtitle}>State a proper reason for rejection.</Text>

                        <TextInput
                            style={styles.rejectInput}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="Enter your reason here."
                            placeholderTextColor="#999999"
                            multiline
                            textAlignVertical="top"
                            editable={!acting}
                        />

                        <TouchableOpacity
                            style={[styles.gradientButton, styles.sendButton, (!rejectReason.trim() || acting) && styles.actionButtonDisabled]}
                            onPress={handleSendRejection}
                            disabled={!rejectReason.trim() || acting}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.gradientButtonText}>Send</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
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
        paddingTop: 12, // Figma: back arrow sits ~12px below the 62px status bar the SafeAreaView covers
        paddingBottom: 24,
        flexGrow: 1,
    },
    backIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 14,
    },
    header: {
        fontFamily: FONTS.roboto,
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 28,
        color: '#021E79',
        marginBottom: 24,
    },
    requestNumber: {
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 27,
        color: '#292727',
    },
    senderLine: {
        fontSize: 13,
        lineHeight: 22,
        color: '#5B5959',
        marginBottom: 12,
    },
    reasonText: {
        fontSize: 11,
        lineHeight: 19,
        color: '#5B5959',
        marginBottom: 14,
    },
    lineItemsCard: {
        marginBottom: 16,
    },
    lineItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lineItemLabel: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#191818',
    },
    lineItemAmount: {
        fontSize: 8,
        lineHeight: 14,
        color: '#5B5959',
        textAlign: 'right',
    },
    totalLabel: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#191818',
    },
    totalAmount: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#5B5959',
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        marginTop: 5,
        marginBottom: 6,
    },
    noteText: {
        fontSize: 11,
        lineHeight: 19,
        color: '#5B5959',
        marginBottom: 16,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginRight: 10,
    },
    actionButton: {
        width: 96,
        height: 32,
        marginLeft: 5,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    approveButton: {
        backgroundColor: '#167713',
    },
    declineButton: {
        backgroundColor: '#C62828',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        fontSize: 10,
        lineHeight: 17,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    loadingIndicator: {
        marginTop: 24,
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
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
        alignItems: 'center',
    },
    modalCardReject: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
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
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 22,
        color: '#414141',
        textAlign: 'center',
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 11,
        color: '#5B5959',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 20,
    },
    // Blue-to-teal gradient button (Figma: 150x40, 10px radius, grey outline, 12px bold white text).
    gradientButton: {
        width: 150,
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientButtonText: {
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 20,
        color: '#FFFFFF',
    },
    // "Reason for Rejection" modal.
    rejectTitle: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 22,
        color: '#414141',
    },
    rejectSubtitle: {
        fontSize: 10,
        lineHeight: 17,
        color: '#5B5959',
        marginBottom: 10,
    },
    rejectInput: {
        minHeight: 90,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 10,
        fontSize: 11,
        color: '#333333',
        marginBottom: 20,
    },
    sendButton: {
        width: '80%',
        alignSelf: 'center',
    },
});

export default RequestDetails;