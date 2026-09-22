import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ServiceProviderVerification = ({ navigation, route }) => {
    const [validId, setValidId] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [supportingDocs, setSupportingDocs] = useState(null);
    const [certifyTrue, setCertifyTrue] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);

    const handleUploadValidId = () => {
        // TODO: open a file/image picker and store the selected ID once the
        // backend upload endpoint is integrated.
    };

    const handleUploadSelfie = () => {
        // TODO: open a camera/image picker for selfie verification once the
        // backend upload endpoint is integrated.
    };

    const handleUploadSupportingDocs = () => {
        // TODO: open a file/document picker for supporting documents once the
        // backend upload endpoint is integrated.
    };

    const handleSubmit = () => {
        const payload = {
            ...route.params,
            verification: { validId, selfie, supportingDocs, certifyTrue, agreeTerms },
        };
        // TODO: send `payload` to the Service Provider signup API once it's ready
        console.log('Service Provider application payload:', payload);
        Alert.alert('Application submitted', 'Your Service Provider application has been submitted for review.');
    };

    const renderUploadBox = (label, subtitle, value, onPress) => (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={onPress}>
                <Image source={require('../assets/icon_uploadbutton.png')} style={styles.uploadIcon} />
                <View>
                    <Text style={styles.uploadTitle}>{value ? value : 'Tap to upload'}</Text>
                    {subtitle ? <Text style={styles.uploadSubtitle}>{subtitle}</Text> : null}
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderCheckbox = (label, checked, onToggle) => (
        <TouchableOpacity style={styles.checkboxRow} onPress={onToggle}>
            <View style={styles.checkboxBox}>
                <Image source={require('../assets/icon_checkbox.png')} style={styles.checkboxIcon} />
                {checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Apply as Service Provider</Text>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                    <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                    <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                </View>

                <Text style={styles.sectionTitle}>Verification Requirements</Text>

                {renderUploadBox('UPLOAD VALID ID', 'Government-issued ID', validId, handleUploadValidId)}
                {renderUploadBox('SELFIE VERIFICATION', null, selfie, handleUploadSelfie)}
                {renderUploadBox('SUPPORTING DOCUMENTS (OPTIONAL)', null, supportingDocs, handleUploadSupportingDocs)}

                <Text style={styles.subLabel}>AGREEMENTS</Text>
                {renderCheckbox('I certify that all information provided is true and correct.', certifyTrue, () => setCertifyTrue((prev) => !prev))}
                {renderCheckbox("I agree to ServEase's Terms & Conditions.", agreeTerms, () => setAgreeTerms((prev) => !prev))}

                <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('ServiceProviderDashboard')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.nextButtonGradient}
                    >
                        <Text style={styles.nextButtonText}>Submit</Text>
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
    container: {
        paddingHorizontal: 28,
        paddingBottom: 40,
    },
    logo: {
        width: 70,
        height: 70,
        resizeMode: 'contain',
        alignSelf: 'center',
        marginTop: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1B2A8C',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    progressContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 3,
    },
    progressSegmentActive: {
        backgroundColor: '#0255AF',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 14,
    },
    subLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#555555',
        letterSpacing: 1,
        marginTop: 8,
        marginBottom: 10,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: '#555555',
        letterSpacing: 1,
        marginBottom: 6,
    },
    uploadBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        padding: 14,
    },
    uploadIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        marginRight: 12,
    },
    uploadTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333333',
    },
    uploadSubtitle: {
        fontSize: 11,
        color: '#888888',
        marginTop: 2,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    checkboxIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    checkmark: {
        position: 'absolute',
        fontSize: 13,
        fontWeight: '700',
        color: '#0255AF',
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 13,
        color: '#333333',
    },
    nextButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 16,
    },
    nextButtonGradient: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ServiceProviderVerification;