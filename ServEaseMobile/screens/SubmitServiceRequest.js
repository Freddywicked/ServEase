import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const TOTAL_STEPS = 4;
const CURRENT_STEP = 4;

const SubmitServiceRequest = ({ navigation }) => {
    const handleClose = () => {
        navigation.goBack();
    };

    const handleDone = () => {
        navigation.navigate('CustomerHome');
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

                <View style={styles.successIconWrap}>
                    <Image source={require('../assets/icon_bigellipse.png')} style={styles.successEllipse} />
                    <Image source={require('../assets/icon_bigcheck.png')} style={styles.successCheck} />
                </View>

                <Text style={styles.successTitle}>Sent to the Service Provider!</Text>
                <Text style={styles.successDescription}>
                    This service provider will review your request and send a pre-repair quotation. You'll be
                    notified the moment it arrives.
                </Text>

                <TouchableOpacity onPress={() => navigation.navigate('CustomerDashboard')}>
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
        marginBottom: 40,
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
});

export default SubmitServiceRequest;