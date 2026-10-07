import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { createServiceRequest } from '../api/servicerequest_api';

/* ============================================================================
 * AIResult (step 2 of 4 — shows the diagnosis)
 * ----------------------------------------------------------------------------
 * Displays draft.aiDiagnosis, which AIDiagnosis.js stored after calling the AI
 * endpoint. Two ways out:
 *
 *   "Yes, solved"            -> POST /service-requests with resolvedByAi: true.
 *                               The backend stores it as 'resolved_self_ai' with no
 *                               provider, so AI-handled requests can be tracked. Then the
 *                               draft is cleared and the customer returns home.
 *   "Find Service Providers" -> RecommendServiceProvider, with the diagnosis still in
 *                               the draft so it is saved on SERVICE_REQUEST.ai_diagnosis
 *                               (and visible to the provider) when the request is sent.
 *
 * The diagnosis is sent as an object — store it as jsonb in the single
 * SERVICE_REQUEST.ai_diagnosis column (or split it out later if providers need to query it).
 * ========================================================================== */

const TOTAL_STEPS = 4;
const CURRENT_STEP = 2;

const AIResult = ({ navigation }) => {
    const diagnosis = useServiceRequestDraftStore((state) => state.aiDiagnosis);
    const resetDraft = useServiceRequestDraftStore((state) => state.resetDraft);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Landed here without a diagnosis (e.g. restored navigation state): nothing to show,
        // so continue to the provider step instead of rendering an empty screen.
        // Only while this screen is FOCUSED — it stays mounted under SubmitServiceRequest,
        // and without this guard the draft reset on Done/problem-solved made this effect
        // fire and steal the navigation back to RecommendServiceProvider.
        if (!diagnosis && navigation.isFocused()) {
            navigation.replace(ROUTES.RECOMMEND_SERVICE_PROVIDER);
        }
    }, [diagnosis, navigation]);

    const handleClose = () => {
        navigation.goBack();
    };

    const handleProblemSolved = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await createServiceRequest(useServiceRequestDraftStore.getState(), { resolvedByAi: true });
            resetDraft();
            // reset (not navigate): land on the dashboard with a clean stack, so the
            // whole create-request flow is gone and Back can't return to it.
            navigation.reset({ index: 0, routes: [{ name: ROUTES.CUSTOMER_HOME }] });
        } catch (error) {
            setIsSaving(false);
            Alert.alert('Could not save your request', error.message);
        }
    };

    const handleFindServiceProviders = () => {
        navigation.navigate(ROUTES.RECOMMEND_SERVICE_PROVIDER);
    };

    if (!diagnosis) {
        return null;
    }

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

                <View>
                    <Text style={styles.resultTitle}>Here's what we found</Text>
                    <Text style={styles.resultSubtitle}>
                        This is a suggestion — you'll always choose your own service provider if you'd rather not use it.
                    </Text>

                    <View style={styles.resultCard}>
                        <Text style={styles.cardLabel}>Probable Cause</Text>
                        <Text style={styles.probableCauseText}>{diagnosis.probableCause}</Text>
                        <View style={styles.confidenceRow}>
                            <View style={styles.confidenceBarTrack}>
                                <View style={[styles.confidenceBarFill, { width: `${diagnosis.confidence}%` }]} />
                            </View>
                            <Text style={styles.confidencePercent}>{diagnosis.confidence}%</Text>
                        </View>
                        <Text style={styles.confidenceCaption}>Confidence based on similar reported cases</Text>
                        {diagnosis.lowConfidence ? (
                            <Text style={styles.lowConfidenceNote}>
                                Low confidence — add more detail or a clearer photo for a sharper diagnosis.
                            </Text>
                        ) : null}
                        <View style={styles.tagRow}>
                            {(diagnosis.tags || []).map((tag) => (
                                <View key={tag} style={styles.tagPill}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <Text style={styles.sectionLabel}>Troubleshooting Suggestions</Text>
                    {(diagnosis.troubleshootingSteps || []).map((step) => (
                        <View key={step.title} style={styles.stepCard}>
                            <Text style={styles.stepTitle}>{step.title}</Text>
                            <Text style={styles.stepDescription}>{step.description}</Text>
                        </View>
                    ))}

                    <Text style={styles.sectionLabel}>Is the problem solved?</Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionButtonHalf} onPress={handleProblemSolved} disabled={isSaving}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                {isSaving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.actionButtonText}>Yes, solved</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButtonHalf} onPress={handleFindServiceProviders} disabled={isSaving}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                <Text style={styles.actionButtonText}>Find Service Providers</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
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
    resultTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 6,
    },
    resultSubtitle: {
        fontSize: 12,
        color: '#666666',
        lineHeight: 17,
        marginBottom: 16,
    },
    resultCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888888',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    probableCauseText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 12,
    },
    confidenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    confidenceBarTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E0E0E0',
        marginRight: 10,
        overflow: 'hidden',
    },
    confidenceBarFill: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#0255AF',
    },
    confidencePercent: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333333',
    },
    confidenceCaption: {
        fontSize: 11,
        color: '#999999',
        marginBottom: 12,
    },
    lowConfidenceNote: {
        fontSize: 11,
        color: '#B26A00',
        marginTop: -8,
        marginBottom: 12,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tagPill: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 12,
        color: '#333333',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 10,
        marginTop: 4,
    },
    stepCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },
    stepTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 4,
    },
    stepDescription: {
        fontSize: 12,
        color: '#666666',
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
});

export default AIResult;