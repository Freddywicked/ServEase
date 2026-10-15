import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Alert, Linking } from 'react-native';
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

    const [selectedMethod, setSelectedMethod] = useState(null);
    const [showProcessedModal, setShowProcessedModal] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    // True while the PayMongo checkout page is open in the browser and we're
    // polling the backend for the confirmation.
    const [waitingForCheckout, setWaitingForCheckout] = useState(false);
    const pollTimerRef = useRef(null);

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
                    setShowProcessedModal(true);
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
                await payForServiceRequest(requestId, { amount: dueAmount, method: 'cash', stage: 'final' });
                setShowProcessedModal(true);
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
                setShowProcessedModal(true);
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
                            <TouchableOpacity onPress={handleCloseProcessedModal}>
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            {isCashFinal
                                ? 'Payment completed.'
                                : paymentStage === 'additional'
                                  ? 'The payment for additional parts has been processed.'
                                  : 'The money was sent to the service provider.'}
                        </Text>

                        <TouchableOpacity style={styles.primaryCtaButton} onPress={handlePrimaryCta}>
                            <Text style={styles.primaryCtaText}>
                                {paymentStage === 'final' ? 'Rate and Review' : 'Go back'}
                            </Text>
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
        paddingHorizontal: 28,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        flex: 1,
        textAlign: 'center',
        marginLeft: 20,
    },
    modalCloseIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 16,
    },
    primaryCtaButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    primaryCtaText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
});

export default Payment;