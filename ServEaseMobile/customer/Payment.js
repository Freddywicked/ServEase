import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Alert, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { payForServiceRequest, getPaymentStatus, getPaymentDue } from '../api/servicerequest_api';

// How often / how long the screen re-checks the payment after the customer comes
// back from the PayMongo checkout page.
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// Available payment methods — logos are provided assets, nothing hardcoded
// here needs backend data.
const PAYMENT_METHODS = [
    { id: 'gcash', label: 'Gcash', icon: require('../assets/gcash_logo.png') },
    { id: 'qrph', label: 'QR PH', icon: require('../assets/qrph_logo.png') },
    { id: 'card', label: 'Debit/Credit', icon: require('../assets/cc_logo.png') },
    // Cash has no logo (matches the Figma); an empty spacer keeps the labels aligned.
    { id: 'cash', label: 'Cash', icon: null },
];

// ServEase logo shown on the receipt header (same asset the other mobile screens use).
const RECEIPT_LOGO = require('../assets/logo_servease.png');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const METHOD_LABELS = { gcash: 'GCash', qrph: 'QRPh', card: 'Debit/Credit Card', cash: 'Cash' };

// Per payment stage: what the receipt calls it, the line item, and the modal subtitle.
const STAGE_COPY = {
    initial: {
        type: 'Initial Fee',
        lineItem: 'Initial repair payment',
        subtitle: 'Your 20% initial payment has been processed.',
    },
    additional: {
        type: 'Additional payment fee',
        lineItem: 'Additional payment',
        subtitle: 'The payment for additional parts has been processed.',
    },
    final: {
        type: 'Final Fee',
        lineItem: 'Final repair payment',
        subtitle: 'Your final payment has been processed.',
    },
};

// "26 October 2026, 10:30 AM"
const formatReceiptDate = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

// ₱2,000 for whole amounts, ₱2,000.50 when there are centavos (matches the Figma).
const formatPeso = (value) => {
    const n = Number(value) || 0;
    return `₱${n.toLocaleString('en-PH', {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    })}`;
};

const ReceiptRow = ({ label, value }) => (
    <Text style={styles.receiptMeta}>
        <Text style={styles.receiptMetaLabel}>{label}: </Text>
        {value}
    </Text>
);

// The receipt card shown inside the Payment Processed modal.
const ReceiptCard = ({ receipt }) => (
    <View style={styles.receiptCard}>
        <View style={styles.receiptHeader}>
            <Image source={RECEIPT_LOGO} style={styles.receiptLogo} resizeMode="contain" />
            <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
        </View>

        <View style={styles.receiptMetaBlock}>
            <ReceiptRow label="Receipt no." value={receipt.receiptNo || '—'} />
            <ReceiptRow label="Service Request" value={receipt.requestNumber ? `#${String(receipt.requestNumber).replace(/^#/, '')}` : '—'} />
            <ReceiptRow label="Date Paid" value={receipt.datePaid} />
            <ReceiptRow label="Payment Type" value={receipt.paymentType} />
        </View>

        <View style={styles.receiptDivider} />

        <View style={styles.partiesRow}>
            <View style={styles.partyCol}>
                <Text style={styles.partyName} numberOfLines={1}>{receipt.customerName || '—'}</Text>
                <Text style={styles.partyCaption}>Received from</Text>
            </View>
            <View style={styles.partyCol}>
                <Text style={styles.partyName} numberOfLines={1}>{receipt.providerName || '—'}</Text>
                <Text style={styles.partyCaption}>Sent to</Text>
            </View>
        </View>

        <View style={styles.receiptDivider} />

        <View style={styles.tableRow}>
            <Text style={[styles.tableHead, { flex: 1 }]}>Description</Text>
            <Text style={styles.tableHead}>Amount</Text>
        </View>
        <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1 }]}>{receipt.lineItem}</Text>
            <Text style={styles.tableCell}>{formatPeso(receipt.subtotal)}</Text>
        </View>
        {receipt.serviceFee > 0 ? (
            <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1 }]}>Service Fee</Text>
                <Text style={styles.tableCell}>{formatPeso(receipt.serviceFee)}</Text>
            </View>
        ) : null}

        <View style={[styles.receiptDivider, { marginTop: 8 }]} />

        <View style={styles.tableRow}>
            <Text style={[styles.totalText, { flex: 1 }]}>TOTAL</Text>
            <Text style={styles.totalText}>{formatPeso(receipt.total)}</Text>
        </View>

        <View style={styles.receiptFooter}>
            <ReceiptRow label="Payment Method" value={receipt.methodLabel} />
            {receipt.reference ? <ReceiptRow label="Payment Reference" value={receipt.reference} /> : null}
        </View>
    </View>
);

const Payment = ({ navigation, route }) => {
    const requestId = route?.params?.requestId;
    const requestNumber = route?.params?.requestNumber || requestId || '';
    // 'initial' (20% deposit, right after the quotation/appointment is approved),
    // 'additional' (extra cost the provider requested mid-job, approved from Track) or
    // 'final' (remaining balance, once the job is marked Done).
    const paymentStage = route?.params?.paymentStage || 'initial';
    // Only for 'additional': which payment request is being paid.
    const paymentRequestId = route?.params?.paymentRequestId;
    const amount = route?.params?.amount ?? 0;
    // Receipt details. Names/fee fall back to route params until the backend returns them
    // (see buildReceipt).
    const customerName = route?.params?.customerName;
    const providerName = route?.params?.providerName;
    const stageCopy = STAGE_COPY[paymentStage] || STAGE_COPY.initial;

    const [selectedMethod, setSelectedMethod] = useState(null);
    const [showProcessedModal, setShowProcessedModal] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    // True while the PayMongo checkout page is open in the browser and we're
    // polling the backend for the confirmation.
    const [waitingForCheckout, setWaitingForCheckout] = useState(false);
    const pollTimerRef = useRef(null);
    // Data for the receipt shown in the Payment Processed modal.
    const [receipt, setReceipt] = useState(null);

    // The amount is read from the backend (payment-due); the route-param amount is
    // only a preview until the server answers. This is what makes the deductions
    // reflect: the server's 'final' is the remaining balance (total minus the 20%
    // initial fee and any additional payments already paid), while 'initial' is the
    // 20% fee and 'additional' the approved extra not yet paid.
    const [dueAmount, setDueAmount] = useState(amount);

    useEffect(() => () => clearInterval(pollTimerRef.current), []);

    useEffect(() => {
        if (!requestId) return undefined;
        let cancelled = false;
        getPaymentDue(requestId)
            .then((data) => {
                if (cancelled) return;
                const serverAmount = data?.due?.[paymentStage];
                if (Number.isFinite(serverAmount) && serverAmount > 0) setDueAmount(serverAmount);
            })
            .catch(() => {
                // Keep the route-param amount — a flaky connection must not block paying.
            });
        return () => {
            cancelled = true;
        };
    }, [requestId, paymentStage]);

    const formattedAmount = `₱${Number(dueAmount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

    // Builds the receipt from whatever the backend returned for the payment (payment
    // status / payment response). BACKEND: ideally return a `receipt` object, e.g.
    //   { receiptNo, requestNumber, paidAt, customerName, providerName,
    //     subtotal, serviceFee, total, method, reference }
    // Anything missing falls back to what this screen already knows.
    // NOTE: this assumes `dueAmount` is the TOTAL charged (repair amount + service fee).
    const buildReceipt = (payment, methodId) => {
        const src = payment?.receipt ?? payment ?? {};
        const total = Number(src.total ?? src.amount ?? dueAmount) || 0;
        const serviceFee = Number(src.serviceFee ?? src.service_fee ?? route?.params?.serviceFee ?? 0) || 0;
        return {
            receiptNo: src.receiptNo ?? src.receipt_number ?? '',
            requestNumber: src.requestNumber ?? src.request_number ?? requestNumber,
            datePaid: formatReceiptDate(src.paidAt ?? src.paid_at),
            paymentType: stageCopy.type,
            customerName: src.customerName ?? src.customer_name ?? customerName,
            providerName: src.providerName ?? src.provider_name ?? providerName,
            lineItem: stageCopy.lineItem,
            subtotal: Number(src.subtotal ?? total - serviceFee) || 0,
            serviceFee,
            total,
            methodLabel: METHOD_LABELS[src.method ?? methodId] || METHOD_LABELS[methodId] || '—',
            reference: src.reference ?? src.paymentReference ?? src.payment_reference ?? '',
        };
    };

    const openReceipt = (payment, methodId) => {
        setReceipt(buildReceipt(payment, methodId));
        setShowProcessedModal(true);
    };

    // Shares the receipt as text via the system share sheet (no extra packages needed).
    // To save it as an image/PDF instead, capture <ReceiptCard /> with react-native-view-shot.
    const handleDownloadReceipt = async () => {
        if (!receipt) return;
        const lines = [
            'ServEase - PAYMENT RECEIPT',
            `Receipt no.: ${receipt.receiptNo || '—'}`,
            `Service Request: #${String(receipt.requestNumber).replace(/^#/, '')}`,
            `Date Paid: ${receipt.datePaid}`,
            `Payment Type: ${receipt.paymentType}`,
            `Received from: ${receipt.customerName || '—'}`,
            `Sent to: ${receipt.providerName || '—'}`,
            '',
            `${receipt.lineItem}: ${formatPeso(receipt.subtotal)}`,
            ...(receipt.serviceFee > 0 ? [`Service Fee: ${formatPeso(receipt.serviceFee)}`] : []),
            `TOTAL: ${formatPeso(receipt.total)}`,
            '',
            `Payment Method: ${receipt.methodLabel}`,
            ...(receipt.reference ? [`Payment Reference: ${receipt.reference}`] : []),
        ];
        try {
            await Share.share({ title: `ServEase Receipt ${receipt.receiptNo || ''}`.trim(), message: lines.join('\n') });
        } catch (error) {
            // Share sheet dismissed/unavailable — nothing to do.
        }
    };

    const handleBack = () => {
        navigation.goBack();
    };

    const handleSelectMethod = (methodId) => {
        setSelectedMethod(methodId);
    };

    // The payment runs through OUR backend (POST /service-requests/:id/payment),
    // which creates a PayMongo Checkout Session — the app never talks to PayMongo
    // directly. We open the checkout page in the browser, then poll the backend
    // until the payment is confirmed; only then does the processed modal open.
    const startPolling = () => {
        const startedAt = Date.now();
        pollTimerRef.current = setInterval(async () => {
            try {
                const payment = await getPaymentStatus(requestId, { stage: paymentStage, paymentRequestId });
                if (payment?.status === 'paid') {
                    clearInterval(pollTimerRef.current);
                    setWaitingForCheckout(false);
                    setIsPaying(false);
                    openReceipt(payment, selectedMethod);
                } else if (payment?.status === 'failed' || Date.now() - startedAt > POLL_TIMEOUT_MS) {
                    clearInterval(pollTimerRef.current);
                    setWaitingForCheckout(false);
                    setIsPaying(false);
                    if (payment?.status === 'failed') {
                        Alert.alert('Payment failed', 'No charge went through. Please try again.');
                    }
                    // on timeout: stay quiet — the customer can tap Continue again to re-check
                }
            } catch (error) {
                // A flaky connection shouldn't kill the wait; the next poll retries.
            }
        }, POLL_INTERVAL_MS);
    };

    const handleContinue = async () => {
        if (!selectedMethod || isPaying) return;
        if (!requestId || !(dueAmount > 0)) {
            Alert.alert('Missing payment details', 'Go back to Track and open the request again.');
            return;
        }
        // Cash is paid in person, so there is no PayMongo checkout:
        //  - initial / additional: nothing is sent, just return to the previous screen;
        //  - final: the backend records the cash payment, which marks the request completed
        //    (paid) so it moves to Track's Done tab; the "Payment Completed" modal then offers
        //    "Rate and Review" (Ratings lands on the Done tab).
        if (selectedMethod === 'cash') {
            if (paymentStage !== 'final') {
                navigation.goBack();
                return;
            }
            setIsPaying(true);
            try {
                const cashResult = await payForServiceRequest(requestId, { amount: dueAmount, method: 'cash', stage: 'final' });
                openReceipt(cashResult, 'cash');
            } catch (error) {
                Alert.alert('Could not complete the request', error.message);
            } finally {
                setIsPaying(false);
            }
            return;
        }
        setIsPaying(true);
        // Local flag — the state variable would be stale inside this closure.
        let openedCheckout = false;
        try {
            const result = await payForServiceRequest(requestId, { amount: dueAmount, method: selectedMethod, stage: paymentStage, paymentRequestId });
            if (result?.checkoutUrl) {
                openedCheckout = true;
                setWaitingForCheckout(true);
                startPolling();
                Linking.openURL(result.checkoutUrl);
            } else {
                // No PayMongo keys on the backend: payment recorded directly (dev mode).
                openReceipt(result, selectedMethod);
            }
        } catch (error) {
            Alert.alert('Payment failed', error.message);
        } finally {
            if (!openedCheckout) setIsPaying(false);
        }
    };

    const isCashFinal = paymentStage === 'final' && selectedMethod === 'cash';

    const handleCloseProcessedModal = () => {
        setShowProcessedModal(false);
    };

    // 'final' continues to the review (Ratings lands on Track's Done tab); every
    // other payment goes back to the Track tab that matches what was just paid —
    // a paid initial fee or extra means the job is underway, so both land on
    // On-going (the screen the customer was on before paying).
    const TRACK_TAB_BY_STAGE = { initial: 'ongoing', additional: 'ongoing', final: 'done' };
    const handlePrimaryCta = () => {
        setShowProcessedModal(false);
        if (paymentStage === 'final') {
            navigation.navigate('Ratings', { requestId, requestNumber });
        } else {
            navigation.navigate('Track', { tab: TRACK_TAB_BY_STAGE[paymentStage] });
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>

                <Text style={styles.amountText}>{formattedAmount}</Text>

                <Text style={styles.sectionLabel}>Select Payment Method</Text>

                {PAYMENT_METHODS.map((method) => {
                    const isSelected = selectedMethod === method.id;
                    return (
                        <TouchableOpacity
                            key={method.id}
                            style={styles.methodRow}
                            onPress={() => handleSelectMethod(method.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                {isSelected ? <View style={styles.radioInner} /> : null}
                            </View>
                            {method.icon ? (
                                <Image source={method.icon} style={styles.methodIcon} resizeMode="contain" />
                            ) : (
                                <View style={styles.methodIcon} />
                            )}
                            <Text style={styles.methodLabel}>{method.label}</Text>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    style={[styles.continueButton, (isPaying || waitingForCheckout) && { opacity: 0.6 }]}
                    onPress={handleContinue}
                    disabled={isPaying || waitingForCheckout}
                >
                    <Text style={styles.continueButtonText}>
                        {waitingForCheckout
                            ? 'Waiting for payment… complete it in your browser'
                            : isPaying
                              ? 'Processing…'
                              : 'Continue'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={showProcessedModal} transparent animationType="fade" onRequestClose={handleCloseProcessedModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>{isCashFinal ? 'Payment Completed' : 'Payment Processed'}</Text>
                            <TouchableOpacity onPress={handleCloseProcessedModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            {isCashFinal ? 'Payment completed.' : stageCopy.subtitle}
                        </Text>

                        {receipt ? (
                            <ScrollView style={styles.receiptScroll} showsVerticalScrollIndicator={false}>
                                <ReceiptCard receipt={receipt} />
                            </ScrollView>
                        ) : null}

                        <View style={styles.modalButtonRow}>
                            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadReceipt} activeOpacity={0.85}>
                                <Text style={styles.downloadButtonText}>Download Receipt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryCtaButton} onPress={handlePrimaryCta} activeOpacity={0.85}>
                                <Text style={styles.primaryCtaText}>
                                    {paymentStage === 'final' ? 'Rate and Review' : 'Done'}
                                </Text>
                            </TouchableOpacity>
                        </View>
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
    },
    backButton: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginBottom: 20,
    },
    backIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    amountText: {
        fontSize: 26,
        fontWeight: '800',
        color: '#111111',
        textAlign: 'center',
        marginBottom: 28,
    },
    sectionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: '#BBBBBB',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    radioOuterSelected: {
        borderColor: '#0255AF',
    },
    radioInner: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#0255AF',
    },
    methodIcon: {
        width: 30,
        height: 20,
        marginRight: 10,
    },
    methodLabel: {
        fontSize: 14,
        color: '#333333',
    },
    continueButton: {
        alignSelf: 'flex-end',
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 28,
        backgroundColor: '#FFFFFF',
        marginTop: 20,
    },
    continueButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 18,
        maxHeight: '90%',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        flex: 1,
    },
    modalCloseIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 14,
    },
    receiptScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    modalButtonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 16,
    },
    downloadButton: {
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 18,
        backgroundColor: '#0255AF', // Figma uses a blue→teal gradient; swap for a LinearGradient if the project has one
        marginRight: 10,
    },
    downloadButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    primaryCtaButton: {
        borderWidth: 1,
        borderColor: '#CFCFCF',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    primaryCtaText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111111',
    },

    // ---- Receipt card ----
    receiptCard: {
        borderWidth: 3,
        borderColor: '#14295F',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    receiptHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    receiptLogo: {
        width: 44,
        height: 44,
        marginRight: 14,
    },
    receiptTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#14295F',
        letterSpacing: 0.4,
    },
    receiptMetaBlock: {
        marginBottom: 10,
    },
    receiptMeta: {
        fontSize: 10.5,
        color: '#111111',
        lineHeight: 17,
    },
    receiptMetaLabel: {
        fontWeight: '700',
    },
    receiptDivider: {
        height: 1,
        backgroundColor: '#1A1A1A',
        marginVertical: 8,
    },
    partiesRow: {
        flexDirection: 'row',
        paddingVertical: 2,
    },
    partyCol: {
        flex: 1,
        alignItems: 'center',
    },
    partyName: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#111111',
    },
    partyCaption: {
        fontSize: 8.5,
        fontStyle: 'italic',
        color: '#444444',
        marginTop: 1,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3,
    },
    tableHead: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#111111',
    },
    tableCell: {
        fontSize: 10.5,
        color: '#111111',
    },
    totalText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#111111',
    },
    receiptFooter: {
        marginTop: 10,
    },
});

export default Payment;