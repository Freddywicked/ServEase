import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import ProgressBar from '../components/ProgressBar';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { diagnoseServiceRequest } from '../api/servicerequest_api';

/* ============================================================================
 * AIDiagnosis (step 2 of 4 — choice, then runs the AI call)
 * ----------------------------------------------------------------------------
 * Three states on one screen, matching the Figma "Step 2" / "Step 2.1":
 *
 *   'choice'  -> initial state. The customer picks:
 *                  "Use AI Diagnosis"                  -> starts the AI call (-> 'loading')
 *                  "Skip AI and Find Service Providers" -> RecommendServiceProvider,
 *                                                          draft.aiDiagnosis stays null.
 *   'loading' -> calls POST /service-requests/diagnose (AI language-model endpoint, so
 *                expect higher latency than plain CRUD — the API layer allows 30s).
 *                  success -> diagnosis saved to the draft (draft.aiDiagnosis), then
 *                             AIResult is shown. `replace` is used so Back from the
 *                             result goes to step 1, not to this loading screen.
 *                             A LOW-confidence result still goes to AIResult (shown with
 *                             a note) — it is a real answer, not a failure.
 *                  failure / timeout -> 'failed'
 *   'failed'  -> no dead end: the customer can retry, or skip straight to
 *                RecommendServiceProvider without a diagnosis.
 *
 * No SERVICE_REQUEST row is created here; that happens on submit.
 * ========================================================================== */

const CURRENT_STEP = 2;

const AIDiagnosis = ({ navigation }) => {
    const setDraft = useServiceRequestDraftStore((state) => state.setDraft);
    const [status, setStatus] = useState('choice'); // 'choice' | 'loading' | 'failed'
    const [failureMessage, setFailureMessage] = useState('');
    // 0 = the customer hasn't chosen "Use AI Diagnosis" yet. Each increment starts one AI run.
    const [attempt, setAttempt] = useState(0);
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (status !== 'loading') {
            return undefined;
        }
        spinValue.setValue(0);
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spinAnimation.start();
        return () => spinAnimation.stop();
    }, [status, spinValue]);

    useEffect(() => {
        // Nothing to run until the customer taps "Use AI Diagnosis".
        if (attempt === 0) {
            return undefined;
        }

        let cancelled = false;
        const controller = new AbortController();
        setStatus('loading');

        const runDiagnosis = async () => {
            try {
                // getState() so this effect only re-runs on a new attempt, not on every draft change.
                const draft = useServiceRequestDraftStore.getState();
                const diagnosis = await diagnoseServiceRequest(draft, { signal: controller.signal });
                if (cancelled) return;

                // A low-confidence diagnosis is still a diagnosis — show it (AIResult
                // displays a "low confidence" note) instead of dead-ending the customer
                // on an error screen. Only a missing/empty result counts as a failure.
                if (!diagnosis || !diagnosis.probableCause) {
                    setDraft({ aiDiagnosis: null });
                    setFailureMessage("We couldn't reach a confident diagnosis for this one.");
                    setStatus('failed');
                    return;
                }
                setDraft({ aiDiagnosis: diagnosis });
                navigation.replace(ROUTES.AI_RESULT);
            } catch (error) {
                if (cancelled) return;
                setDraft({ aiDiagnosis: null });
                setFailureMessage(error.message);
                setStatus('failed');
            }
        };

        runDiagnosis();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [attempt, navigation, setDraft]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleClose = () => {
        navigation.goBack();
    };

    // Starts a run (first time from the choice screen, or again after a failure).
    const handleUseAI = () => {
        setAttempt((count) => count + 1);
    };

    // From the choice screen: navigate (not replace) so Back from the providers
    // screen returns here, to the choice.
    const handleSkipAI = () => {
        setDraft({ aiDiagnosis: null });
        navigation.navigate(ROUTES.RECOMMEND_SERVICE_PROVIDER);
    };

    // From the failed state: replace, so Back doesn't land on a dead error screen.
    const handleSkipToProviders = () => {
        // Draft keeps aiDiagnosis = null; the provider step works without it.
        navigation.replace(ROUTES.RECOMMEND_SERVICE_PROVIDER);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Creating Service Request</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Image source={require('../assets/icon_close.png')} style={styles.closeIcon} />
                    </TouchableOpacity>
                </View>

                <ProgressBar currentStep={CURRENT_STEP} />

                <Text style={styles.questionTitle}>
                    To enhance your service request details, we offer AI Diagnosis.
                </Text>
                <Text style={styles.questionSubtitle}>Let AI analyze your problem before booking.</Text>

                {status === 'choice' ? (
                    <View style={styles.choiceSection}>
                        <TouchableOpacity onPress={handleUseAI}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                <Text style={styles.actionButtonText}>Use AI Diagnosis</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSkipAI} style={styles.skipButton}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                <Text style={styles.actionButtonText}>Skip AI and Find Service Providers</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : status === 'loading' ? (
                    <View style={styles.loadingSection}>
                        <Animated.Image
                            source={require('../assets/icon_loading.png')}
                            style={[styles.loadingIcon, { transform: [{ rotate: spin }] }]}
                        />
                        <Text style={styles.loadingText}>
                            Reading your description and running AI diagnosis…
                        </Text>
                    </View>
                ) : (
                    <View style={styles.loadingSection}>
                        <Text style={styles.resultTitle}>AI diagnosis isn't available right now</Text>
                        <Text style={styles.loadingText}>{failureMessage}</Text>
                        <View style={[styles.actionRow, styles.failedActionRow]}>
                            <TouchableOpacity style={styles.actionButtonHalf} onPress={handleUseAI}>
                                <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                    <Text style={styles.actionButtonTextSmall}>Try again</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButtonHalf} onPress={handleSkipToProviders}>
                                <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                    <Text style={styles.actionButtonTextSmall}>Find Service Providers</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
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
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 27,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 23,
        color: '#021E79',
    },
    closeButton: {
        width: 25,
        height: 25,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#414141',
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIcon: {
        width: 11,
        height: 11,
        resizeMode: 'contain',
    },
    questionTitle: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 19,
        color: '#292727',
        marginRight: 10,
        marginBottom: 11,
    },
    questionSubtitle: {
        fontSize: 14,
        lineHeight: 16,
        color: '#414141',
        marginLeft: 2,
        marginBottom: 36,
    },
    choiceSection: {
        marginHorizontal: 11,
    },
    skipButton: {
        marginTop: 11,
    },
    loadingSection: {
        alignItems: 'center',
        paddingBottom: 30,
    },
    loadingIcon: {
        width: 48,
        height: 48,
        resizeMode: 'contain',
        marginBottom: 16,
    },
    loadingText: {
        fontSize: 13,
        color: '#666666',
        textAlign: 'center',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 6,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    actionButtonHalf: {
        flex: 1,
        marginHorizontal: 4,
    },
    actionButton: {
        height: 46,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontFamily: 'Quicksand-Bold',
        fontSize: 16,
        lineHeight: 23,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
    },
    actionButtonTextSmall: {
        fontFamily: 'Quicksand-Bold',
        fontSize: 13,
        lineHeight: 18,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
    },
    failedActionRow: {
        alignSelf: 'stretch',
        marginTop: 20,
    },
});

export default AIDiagnosis;