import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const TOTAL_STEPS = 4;
const CURRENT_STEP = 2;

const AIDiagnosis = ({ navigation, route }) => {
    const handleClose = () => {
        navigation.goBack();
    };

    const handleUseAIDiagnosis = () => {
        // TODO: point this to the actual AI diagnosis screen once it exists
        navigation.navigate('AIDiagnosisChat', { ...route.params });
    };

    const handleSkipAI = () => {
        // TODO: confirm this is the right screen for browsing service providers
        navigation.navigate('Find', { ...route.params });
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

                <TouchableOpacity onPress={() => navigation.navigate('AIResult')}>
                    <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.optionButton}>
                        <Text style={styles.optionButtonText}>Use AI Diagnosis</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('RecommendServiceProvider')}>
                    <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.optionButton}>
                        <Text style={styles.optionButtonText}>Skip AI and Find Service Providers</Text>
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
    optionButton: {
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    optionButtonText: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
    },
});

export default AIDiagnosis;