import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

/* ============================================================================
 * BACKEND-READY — AIResult (step 2 of 4)
 * ----------------------------------------------------------------------------
 * Runs the AI fault-diagnosis call and shows the result. Two things need to
 * exist before this can go live:
 *   1. The actual AI diagnosis endpoint (see the useEffect below).
 *   2. A resolved question about where the result is stored: SERVICE_REQUEST
 *      currently has a single `ai_diagnosis` column, but the shape returned
 *      here (probableCause, confidence, tags[], troubleshootingSteps[]) is
 *      structured, not a single string. Either store it as JSON in that one
 *      column, or split it into dedicated columns/a child table if it needs
 *      to be queried or shown on the provider's side later (e.g. a provider
 *      reviewing this request should probably see the same diagnosis).
 * ========================================================================== */

const TOTAL_STEPS = 4;
const CURRENT_STEP = 2;

const AIResult = ({ navigation, route }) => {
    const [result, setResult] = useState(null);
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
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
    }, [spinValue]);

    useEffect(() => {
        // TEMPORARY: simulates the AI diagnosis request until the real backend
        // endpoint is integrated. Replace this timeout with an actual API call
        // that sends route.params (category, description, photo, location) and
        // sets the response here.
        //
        // BACKEND-READY:
        //   Request:  POST /service-requests/diagnose (or similar)
        //             { category, description, photoUrl, latitude, longitude }
        //             — note this needs the *uploaded* photo URL from
        //             CreateServiceRequest's Supabase Storage step, not a
        //             local file URI.
        //   Response: { probableCause, confidence, tags[], troubleshootingSteps[] }
        //             — matches the shape `result` is set to below.
        //   This call hits the AI language-model API in the stack (fault
        //   diagnosis), not a plain CRUD endpoint — expect higher latency and
        //   handle failure (timeout / low-confidence result) with a fallback
        //   straight to "Find Service Providers" rather than a dead end.
        //   No SERVICE_REQUEST row needs to exist yet to run this — it only
        //   needs to be persisted once a request is actually submitted.
        const timeout = setTimeout(() => {
            setResult({
                probableCause: 'Liquid damage to charging circuit',
                confidence: 82,
                tags: ['Power jack', 'Motherboard Check', 'Safety test'],
                troubleshootingSteps: [
                    { title: 'Check your Power Adapter', description: 'Try another charger or wall outlet.' },
                    { title: 'Disconnect Peripherals', description: 'Remove USB devices other peripherals.' },
                ],
            });
        }, 2000);

        return () => clearTimeout(timeout);
    }, []);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleClose = () => {
        navigation.goBack();
    };

    const handleProblemSolved = () => {
        // TODO: mark the service request as resolved via the backend once it's ready
        navigation.navigate('CustomerHome');
        //
        // BACKEND-READY: since AI diagnosis alone can resolve the issue,
        // this is likely a point where a SERVICE_REQUEST row *does* need to
        // be created (or an existing draft finalized) with
        // request_status = 'resolved_self_ai' or similar, even though no
        // provider is ever assigned — useful for tracking which requests the
        // AI handles vs. hands off to a provider.
        //
        // NOTE: the "Yes, solved" button below navigates to 'CustomerDashboard'
        // directly instead of calling this handler (which targets
        // 'CustomerHome'). Reconcile the screen name and wire the button to
        // this handler before adding the backend call above.
    };

    const handleFindServiceProviders = () => {
        // TODO: confirm this is the right screen for browsing service providers
        navigation.navigate('Find', { ...route.params, diagnosis: result });
        //
        // NOTE: the "Find Service Providers" button below navigates to
        // 'RecommendServiceProvider' directly instead of calling this
        // handler, and drops `diagnosis: result` in the process — so the AI
        // diagnosis never reaches RecommendServiceProvider.js or, from there,
        // the eventual SERVICE_REQUEST.ai_diagnosis value. Wire the button to
        // this handler (with the screen name reconciled) so the diagnosis
        // survives into the rest of the flow.
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

                {result === null ? (
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
                    <View>
                        <Text style={styles.resultTitle}>Here's what we found</Text>
                        <Text style={styles.resultSubtitle}>
                            This is a suggestion — you'll always choose your own service provider if you'd rather not use it.
                        </Text>

                        <View style={styles.resultCard}>
                            <Text style={styles.cardLabel}>Probable Cause</Text>
                            <Text style={styles.probableCauseText}>{result.probableCause}</Text>
                            <View style={styles.confidenceRow}>
                                <View style={styles.confidenceBarTrack}>
                                    <View style={[styles.confidenceBarFill, { width: `${result.confidence}%` }]} />
                                </View>
                                <Text style={styles.confidencePercent}>{result.confidence}%</Text>
                            </View>
                            <Text style={styles.confidenceCaption}>Confidence based on similar reported cases</Text>
                            <View style={styles.tagRow}>
                                {result.tags.map((tag) => (
                                    <View key={tag} style={styles.tagPill}>
                                        <Text style={styles.tagText}>{tag}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <Text style={styles.sectionLabel}>Troubleshooting Suggestions</Text>
                        {result.troubleshootingSteps.map((step) => (
                            <View key={step.title} style={styles.stepCard}>
                                <Text style={styles.stepTitle}>{step.title}</Text>
                                <Text style={styles.stepDescription}>{step.description}</Text>
                            </View>
                        ))}

                        <Text style={styles.sectionLabel}>Is the problem solved?</Text>
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionButtonHalf} onPress={() => navigation.navigate('CustomerDashboard')}>
                                <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                                    <Text style={styles.actionButtonText}>Yes, solved</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButtonHalf} onPress={() => navigation.navigate('RecommendServiceProvider')}>
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