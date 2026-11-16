import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';

/* ============================================================================
 * ExitRequestModal + useExitServiceRequest
 * ----------------------------------------------------------------------------
 * Shared by every screen of the create-request flow (CreateServiceRequest,
 * AIDiagnosis, AIResult, RecommendServiceProvider) so the X button behaves the
 * same everywhere:
 *
 *   X pressed -> "Do you still want to continue?"
 *     Yes -> the modal closes and the customer stays on the current step.
 *     No  -> the request is cancelled: the local draft is wiped and the customer
 *            lands on CustomerDashboard with a clean navigation stack.
 *
 * NOTHING is sent to the backend on cancel. A SERVICE_REQUEST row is only ever
 * created on submit (RecommendServiceProvider "Request Quotation" or AIResult
 * "Yes, solved"), so a cancelled request simply never exists server-side.
 * ========================================================================== */

export const useExitServiceRequest = (navigation) => {
    const [isExitModalVisible, setIsExitModalVisible] = useState(false);

    // X button -> ask first.
    const requestExit = useCallback(() => setIsExitModalVisible(true), []);

    // "Yes" -> keep going.
    const continueRequest = useCallback(() => setIsExitModalVisible(false), []);

    // "No" -> cancel the request and go home.
    const cancelRequest = useCallback(() => {
        setIsExitModalVisible(false);
        // Navigate FIRST, then clear the draft. Clearing first would make screens still mounted
        // under this one react to the empty draft (AIResult's "no diagnosis -> go to providers"
        // effect would steal the navigation). reset() also unmounts AIDiagnosis, which aborts any
        // in-flight AI call.
        navigation.reset({ index: 0, routes: [{ name: ROUTES.CUSTOMER_HOME }] });
        useServiceRequestDraftStore.getState().resetDraft();
    }, [navigation]);

    return { isExitModalVisible, requestExit, continueRequest, cancelRequest };
};

/* Visual spec: Figma "Create SR - Step 5" (402px-wide frame).
 *   scrim   rgba(211,211,211,0.5)        card 337 x 243, white, radius 10
 *   title   20px / 23px regular #414141   top padding 50, 62px gap to the buttons
 *   buttons 85 x 35, radius 10, 1px #B1A8A8 border, 41px apart, 15px bold labels
 *           No  = #FFFDFD fill, #414141 text      Yes = #021E79 fill, white text */
const ExitRequestModal = ({ visible, onYes, onNo }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onYes}>
        <View style={styles.overlay}>
            <View style={styles.card}>
                <Text style={styles.title}>Do you still want to continue?</Text>
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.button, styles.noButton]}
                        onPress={onNo}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.buttonText, styles.noButtonText]}>No</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.yesButton]}
                        onPress={onYes}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.buttonText, styles.yesButtonText]}>Yes</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(211, 211, 211, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    card: {
        width: '100%',
        maxWidth: 337,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingTop: 50,
        paddingBottom: 73,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        lineHeight: 23,
        fontWeight: '400',
        color: '#414141',
        textAlign: 'center',
        marginBottom: 62,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        width: 85,
        height: 35,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    noButton: {
        backgroundColor: '#FFFDFD',
        marginRight: 20,
    },
    yesButton: {
        backgroundColor: '#021E79',
        marginLeft: 21,
    },
    buttonText: {
        fontSize: 15,
        lineHeight: 26,
        fontWeight: '700',
        textAlign: 'center',
    },
    noButtonText: {
        color: '#414141',
    },
    yesButtonText: {
        color: '#FFFFFF',
    },
});

export default ExitRequestModal;