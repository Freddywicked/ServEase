import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { payForServiceRequest, getPaymentStatus } from '../api/servicerequest_api';

// How often / how long the screen re-checks the payment after the customer comes
// back from the PayMongo checkout page.
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const ACTIVE_TAB = 'Track';

// Bottom tab definitions — copied verbatim from Track.js so the route keys match.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Available payment methods — logos are provided assets, nothing hardcoded
// here needs backend data.
const PAYMENT_METHODS = [
    { id: 'gcash', label: 'Gcash', icon: require('../assets/gcash_logo.png') },
    { id: 'qrph', label: 'QR PH', icon: require('../assets/qrph_logo.png') },
    { id: 'card', label: 'Debit/Credit', icon: require('../assets/cc_logo.png') },
];

const Payment = ({ navigation, route }) => {
    const requestId = route?.params?.requestId;
    const requestNumber = route?.params?.requestNumber || requestId || '';
    // 'initial' (20% deposit, right after the quotation/appointment is approved)
    // or 'final' (remaining balance, once the job is marked Done).
    const paymentStage = route?.params?.paymentStage || 'initial';
    const amount = route?.params?.amount ?? 0;

    const [selectedMethod, setSelectedMethod] = useState(null);
    const [showProcessedModal, setShowProcessedModal] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    // True while the PayMongo checkout page is open in the browser and we're
    // polling the backend for the confirmation.
    const [waitingForCheckout, setWaitingForCheckout] = useState(false);
    const pollTimerRef = useRef(null);

    useEffect(() => () => clearInterval(pollTimerRef.current), []);

    const formattedAmount = `₱${Number(amount).toLocaleString('en-PH', {
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
                const payment = await getPaymentStatus(requestId);
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
        if (!requestId || !(amount > 0)) {
            Alert.alert('Missing payment details', 'Go back to Track and open the request again.');
            return;
        }
        setIsPaying(true);
        // Local flag — the state variable would be stale inside this closure.
        let openedCheckout = false;
        try {
            const result = await payForServiceRequest(requestId, { amount, method: selectedMethod, stage: paymentStage });
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

    const handleCloseProcessedModal = () => {
        setShowProcessedModal(false);
    };

    const handleDownloadReceipt = () => {
        // TODO: download/share the actual receipt once the backend generates one
    };

    const handlePrimaryCta = () => {
        setShowProcessedModal(false);
        if (paymentStage === 'final') {
            navigation.navigate('Ratings', { requestId, requestNumber });
        } else {
            navigation.navigate('Track');
        }
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
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
                            <Image source={method.icon} style={styles.methodIcon} resizeMode="contain" />
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

            <Modal visible={showProcessedModal} transparent animationType="fade" onRequestClose={handleCloseProcessedModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Payment Processed</Text>
                            <TouchableOpacity onPress={handleCloseProcessedModal}>
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>The money was sent to the service provider.</Text>

                        <TouchableOpacity style={styles.receiptBox} onPress={handleDownloadReceipt} activeOpacity={0.85}>
                            <Image source={require('../assets/icon_download.png')} style={styles.downloadIcon} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.primaryCtaButton} onPress={handlePrimaryCta}>
                            <Text style={styles.primaryCtaText}>
                                {paymentStage === 'final' ? 'Rate and Review' : 'Go to Dashboard'}
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
    receiptBox: {
        height: 150,
        borderRadius: 10,
        backgroundColor: '#E6E6E6',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        padding: 10,
        marginBottom: 18,
    },
    downloadIcon: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
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