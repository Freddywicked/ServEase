import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { diagnoseServiceRequest } from '../api/servicerequest_api';

/* ============================================================================
 * AIDiagnosis (step 2 of 4 — runs the AI call)
 * ----------------------------------------------------------------------------
 * Reads the draft collected in CreateServiceRequest from the shared store and
 * calls POST /service-requests/diagnose (the AI language-model endpoint, so
 * expect higher latency than plain CRUD — the API layer allows 30s).
 *
 *   success          -> diagnosis saved to the draft (draft.aiDiagnosis), then
 *                       AIResult is shown. `replace` is used so Back from the
 *                       result goes to step 1, not to this loading screen.
 *   failure / timeout / lowConfidence
 *                    -> no dead end: the customer can retry, or skip straight to
 *                       RecommendServiceProvider without a diagnosis.
 *
 * No SERVICE_REQUEST row is created here; that happens on submit.
 * ========================================================================== */

const TOTAL_STEPS = 4;
const CURRENT_STEP = 2;

const AIDiagnosis = ({ navigation }) => {
    const setDraft = useServiceRequestDraftStore((state) => state.setDraft);
    const [status, setStatus] = useState('loading'); // 'loading' | 'failed'
    const [failureMessage, setFailureMessage] = useState('');
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
        let cancelled = false;
        const controller = new AbortController();
        setStatus('loading');

        const runDiagnosis = async () => {
            try {
                // getState() so this effect only re-runs on "Try again", not on every draft change.
                const draft = useServiceRequestDraftStore.getState();
                const diagnosis = await diagnoseServiceRequest(draft, { signal: controller.signal });
                if (cancelled) return;

                if (!diagnosis || diagnosis.lowConfidence) {
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

    const handleTryAgain = () => {
        setAttempt((count) => count + 1);
    };

    const handleSkipToProviders = () => {
        // Draft keeps aiDiagnosis = null; the provider step works without it.
        navigation.replace(ROUTES.RECOMMEND_SERVICE_PROVIDER);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Creating Service Request</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Image source={require('../assets/icon_close.png')} style={styles.closeIcon} />
                    </TouchableOpacity>
                </View>

                <View style={styles.progressBar}>
                    {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                        <Image
                            key={index}
                            source={
                                index < CURRENT_STEP
                                    ? require('../assets/icon_tab_colored.png')
                                    : require('../assets/icon_tab.png')
                            }
                            style={styles.progressSegment}
                            resizeMode="stretch"
                        />
                    ))}
                </View>

                <Text style={styles.questionTitle}>
                    To enhance your service request details, we offer AI Diagnosis.
                </Text>
                <Text style={styles.questionSubtitle}>Let AI analyze your problem before booking.</Text>

                {status === 'loading' ? (
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
                            <TouchableOpacity style={styles.actionButtonHalf} onPress={handleTryAgain}>
                                <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                    <Text style={styles.actionButtonText}>Try again</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButtonHalf} onPress={handleSkipToProviders}>
                                <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                    <Text style={styles.actionButtonText}>Find Service Providers</Text>
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
    progressBar: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    progressSegment: {
        flex: 1,
        height: 6,
        marginRight: 6,
        borderRadius: 3,
    },
    questionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 6,
    },
    questionSubtitle: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 18,
        marginBottom: 24,
    },
    loadingSection: {
        alignItems: 'center',
        paddingVertical: 30,
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
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 14,
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