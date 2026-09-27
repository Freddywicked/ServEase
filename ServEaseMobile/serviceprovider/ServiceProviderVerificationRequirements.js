import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ServiceProviderVerification = ({ navigation, route }) => {
    const [validId, setValidId] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [supportingDocs, setSupportingDocs] = useState(null);
    const [certifyTrue, setCertifyTrue] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);

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
        // Required-field validation before submitting the application.
        if (!validId) {
            Alert.alert('Valid ID Required', 'Please upload a valid government-issued ID.');
            return;
        }
        if (!selfie) {
            Alert.alert('Selfie Required', 'Please upload a selfie for verification.');
            return;
        }
        if (!certifyTrue) {
            Alert.alert('Certification Required', 'Please certify that all information provided is true and correct.');
            return;
        }
        if (!agreeTerms) {
            Alert.alert('Agreement Required', "Please agree to ServEase's Terms & Conditions.");
            return;
        }

        const payload = {
            ...route.params,
            verification: { validId, selfie, supportingDocs, certifyTrue, agreeTerms },
        };

        // ---------------------------------------------------------------------
        // BACKEND-READY: submit the full Service Provider application
        // (personal details, service category, and verification docs) to the
        // admin review queue. Applications land as "pending" and are
        // approved/rejected from the admin web dashboard, not from this app.
        //
        // Example (uncomment and adjust once the API is ready):
        //
        // try {
        //   const response = await fetch(`${API_BASE_URL}/api/service-provider/applications`, {
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/json',
        //       Authorization: `Bearer ${userAuthToken}`,
        //     },
        //     body: JSON.stringify({
        //       userId: currentUser.id,
        //       personalDetails: payload.personalDetails,
        //       serviceCategory: payload.serviceCategory,
        //       verification: payload.verification,
        //       status: 'pending',
        //     }),
        //   });
        //   if (!response.ok) throw new Error('Failed to submit application');
        //   const data = await response.json();
        //   // data.applicationId can be stored so the app can later check (or
        //   // receive a push notification about) the admin's decision.
        // } catch (error) {
        //   Alert.alert('Submission Failed', 'Something went wrong. Please try again.');
        //   return;
        // }
        // ---------------------------------------------------------------------

        console.log('Service Provider application payload:', payload);
        setShowApprovalModal(true);
    };

    const handleApprovalModalClose = () => {
        setShowApprovalModal(false);
        // The applicant stays in Customer mode until the admin approves the
        // application on the web dashboard, so send them back to the
        // Customer Dashboard rather than a Service Provider screen.
        navigation.reset({
            index: 0,
            routes: [{ name: 'CustomerDashboard', params: { pendingApproval: true } }],
        });
    };

    const renderUploadBox = (label, subtitle, value, onPress) => (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={onPress}>
                <Image source={require('../assets/icon_upload.png')} style={styles.uploadIcon} />
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
                </View>

                <Text style={styles.sectionTitle}>Verification Requirements</Text>

                {renderUploadBox('UPLOAD VALID ID', 'Government-issued ID', validId, handleUploadValidId)}
                {renderUploadBox('SELFIE VERIFICATION', null, selfie, handleUploadSelfie)}
                {renderUploadBox('SUPPORTING DOCUMENTS (OPTIONAL)', null, supportingDocs, handleUploadSupportingDocs)}

                <Text style={styles.subLabel}>AGREEMENTS</Text>
                {renderCheckbox('I certify that all information provided is true and correct.', certifyTrue, () => setCertifyTrue((prev) => !prev))}
                {renderCheckbox("I agree to ServEase's Terms & Conditions.", agreeTerms, () => setAgreeTerms((prev) => !prev))}

                <TouchableOpacity style={styles.nextButton} onPress={handleSubmit}>
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

            <Modal
                visible={showApprovalModal}
                transparent
                animationType="fade"
                onRequestClose={handleApprovalModalClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalText}>
                            Wait for the admin approval to verify your application. Thank you!
                        </Text>
                        <TouchableOpacity style={styles.modalButton} onPress={handleApprovalModalClose}>
                            <LinearGradient
                                colors={['#0255AF', '#04A5A5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.modalButtonGradient}
                            >
                                <Text style={styles.modalButtonText}>OK</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    modalText: {
        fontSize: 15,
        color: '#333333',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    modalButton: {
        borderRadius: 12,
        overflow: 'hidden',
        alignSelf: 'stretch',
    },
    modalButtonGradient: {
        paddingVertical: 13,
        alignItems: 'center',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});

export default ServiceProviderVerification;