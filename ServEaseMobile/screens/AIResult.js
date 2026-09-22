import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

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
    };

    const handleFindServiceProviders = () => {
        // TODO: confirm this is the right screen for browsing service providers
        navigation.navigate('Find', { ...route.params, diagnosis: result });
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