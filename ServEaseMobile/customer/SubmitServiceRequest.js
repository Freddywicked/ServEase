import React, { useCallback, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, BackHandler, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import ProgressBar from '../components/ProgressBar';

/* ============================================================================
 * SubmitServiceRequest (step 4 of 4 — confirmation)
 * ----------------------------------------------------------------------------
 * Pure confirmation UI. The POST /service-requests call already succeeded on
 * RecommendServiceProvider (which then `replace`d itself with this screen), so
 * the request_id, reference code (SR-0001, SR-0002, ... counted per customer by the
 * backend) and provider name are read from the shared draft store.
 * Done, the close button and the Android back button all clear the draft and return
 * to the customer dashboard.
 * ========================================================================== */

const CURRENT_STEP = 4;

const SubmitServiceRequest = ({ navigation }) => {
    const providerName = useServiceRequestDraftStore((state) => state.providerName);
    const requestId = useServiceRequestDraftStore((state) => state.submittedRequestId);
    const referenceCode = useServiceRequestDraftStore((state) => state.submittedReferenceCode);
    const resetDraft = useServiceRequestDraftStore((state) => state.resetDraft);

    // The backend's per-customer reference (e.g. "SR-0001"). The old id-suffix is only a fallback
    // for a backend that doesn't return one yet.
    const displayReference = referenceCode || (requestId ? String(requestId).slice(-8).toUpperCase() : '');

    const handleDone = useCallback(() => {
        // reset (not navigate): the dashboard becomes the ONLY screen in the stack.
        // navigate() left AIResult mounted underneath, and its "no diagnosis -> replace
        // with RecommendServiceProvider" effect fired when the draft cleared, stealing
        // the navigation and landing the customer back on the provider step.
        navigation.reset({ index: 0, routes: [{ name: ROUTES.CUSTOMER_HOME }] });
        resetDraft();

        // ---------------------------------------------------------------------
        // PROVIDER COMMUNICATION (comment block — customer side)
        // The provider now has to act (submit a QUOTATION or decline). To have the
        // dashboard's "Active Repair" card and notifications update the moment they do,
        // start a Supabase Realtime subscription on this request. It is best started once
        // app-wide (e.g. in auth_context after login) so it survives leaving this screen;
        // shown here for the new request_id:
        //
        // import { subscribeToServiceRequest } from '../api/serviceRequestApi';
        //
        // const unsubscribe = subscribeToServiceRequest(requestId, (updatedRequest) => {
        //     // updatedRequest.request_status: 'quotation_sent' | 'declined' | ...
        //     // -> refresh the dashboard (getActiveRepair / getNotifications) or
        //     //    navigate to RequestDetails to review the quotation.
        // });
        // // call unsubscribe() on logout or once the request reaches a final status.
        // ---------------------------------------------------------------------
    }, [navigation, resetDraft]);

    // The request is already sent, so Android Back must not return into the create flow;
    // it behaves exactly like Done.
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleDone();
            return true;
        });
        return () => subscription.remove();
    }, [handleDone]);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Creating Service Request</Text>
                    <TouchableOpacity onPress={handleDone} style={styles.closeButton}>
                        <Image source={require('../assets/icon_close.png')} style={styles.closeIcon} />
                    </TouchableOpacity>
                </View>

                <ProgressBar currentStep={CURRENT_STEP} />

                <View style={styles.successIconWrap}>
                    <Image source={require('../assets/icon_bigellipse.png')} style={styles.successEllipse} />
                    <Image source={require('../assets/icon_bigcheck.png')} style={styles.successCheck} />
                </View>

                <Text style={styles.successTitle}>
                    {providerName ? `Sent to ${providerName}!` : 'Sent to the Service Provider!'}
                </Text>
                <Text style={styles.successDescription}>
                    This service provider will review your request and send a pre-repair quotation. You'll be
                    notified the moment it arrives.
                </Text>
                {!!displayReference && (
                    <Text style={styles.referenceText}>Reference: {displayReference}</Text>
                )}

                <TouchableOpacity onPress={handleDone}>
                    <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneButton}>
                        <Text style={styles.doneButtonText}>Done</Text>
                    </LinearGradient>
                </TouchableOpacity>
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    closeButton: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 6,
    },
    closeIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    successIconWrap: {
        width: 100,
        height: 100,
        alignSelf: 'center',
        marginTop: 60,
        marginBottom: 24,
    },
    successEllipse: {
        width: 100,
        height: 100,
        resizeMode: 'contain',
        tintColor: '#0255AF',
        position: 'absolute',
    },
    successCheck: {
        width: 46,
        height: 46,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
        position: 'absolute',
        top: 27,
        left: 27,
    },
    successTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginBottom: 10,
    },
    successDescription: {
        fontSize: 13,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 12,
        paddingHorizontal: 12,
    },
    doneButton: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    doneButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    referenceText: {
        fontSize: 12,
        color: '#999999',
        textAlign: 'center',
        marginBottom: 28,
    },
});

export default SubmitServiceRequest;