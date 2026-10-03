import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { errorCodes, isErrorWithCode, pick, types as DocumentPickerTypes } from '@react-native-documents/picker';
import { useAuth } from '../context/auth_context';
import { submitServiceProviderApplication } from '../api/client';

const ServiceProviderVerification = ({ navigation, route }) => {
    // The auth token itself is never read here — client.js's request helpers pull it
    // from AsyncStorage internally and attach it to every authenticated call, including
    // submitServiceProviderApplication below. refreshUser() re-fetches /auth/me after a
    // successful submit so `provider` (and its real verification_status) comes straight
    // from the backend instead of being guessed at client-side.
    const { refreshUser } = useAuth();

    const [validId, setValidId] = useState(null); // { uri, type, fileName } from the image picker
    const [selfie, setSelfie] = useState(null); // { uri, type, fileName }
    const [supportingDocs, setSupportingDocs] = useState([]); // [{ uri, type, name }], optional
    const [certifyTrue, setCertifyTrue] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Simple action sheet so the user can choose the camera or their gallery for a photo
    // upload, then hands whichever asset they picked to `onPicked`.
    const pickImage = (title, onPicked) => {
        Alert.alert(title, 'Choose a source', [
            {
                text: 'Take Photo',
                onPress: async () => {
                    const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
                    if (result.didCancel || result.errorCode) return;
                    const asset = result.assets?.[0];
                    if (asset) onPicked(asset);
                },
            },
            {
                text: 'Choose from Gallery',
                onPress: async () => {
                    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
                    if (result.didCancel || result.errorCode) return;
                    const asset = result.assets?.[0];
                    if (asset) onPicked(asset);
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleUploadValidId = () => {
        pickImage('Upload Valid ID', setValidId);
    };

    const handleUploadSelfie = () => {
        pickImage('Selfie Verification', setSelfie);
    };

    const handleUploadSupportingDocs = async () => {
        try {
            const results = await pick({
                type: [DocumentPickerTypes.pdf, DocumentPickerTypes.images],
                allowMultiSelection: true,
            });
            setSupportingDocs(results);
        } catch (err) {
            const isCancellation = isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED;
            if (!isCancellation) {
                Alert.alert('Upload Failed', "Couldn't select the file. Please try again.");
            }
        }
    };

    // Normalizes either an image-picker asset ({ uri, type, fileName }) or a
    // document-picker result ({ uri, type, name }) into the { uri, type, name } shape
    // React Native's fetch/FormData expects for a file part.
    const toFormDataFile = (file, fallbackName) => ({
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        name: file.fileName || file.name || fallbackName,
    });

    const handleSubmit = async () => {
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

        setSubmitting(true);
        try {
            // Multipart form so the ID photo, selfie, and any supporting documents go up
            // in the same request as the rest of the application. There's no `user_id`
            // field — submitServiceProviderApplication (client.js) attaches the Bearer
            // token itself, so the backend identifies the applicant from that rather
            // than a client-supplied id. Applications land as "pending" server-side and
            // are approved/rejected from the admin web dashboard (AdminDashboard.jsx /
            // UserManagement.jsx), not from this app.
            //
            // Field names below are CONFIRMED against provider_routes.js for the three
            // files (validId/selfie/supportingDocs — not snake_case, and posts to /apply,
            // not /application). selectedCategories/yearsOfExperience/otherService are a
            // best-effort match, not confirmed — I haven't seen provider_controllers.js,
            // so these could still be off; share it to lock this down exactly.
            // certifyTrue/agreeTerms stay client-side only — they're a submit gate, not
            // something service_providers has a column for.
            const { selectedCategories = [], othersSelected, otherService, yearsOfExperience } =
                route.params?.serviceCategory || {};

            const formData = new FormData();
            formData.append('selectedCategories', JSON.stringify(selectedCategories));
            formData.append('yearsOfExperience', String(yearsOfExperience ?? ''));
            if (othersSelected && otherService) formData.append('otherService', otherService);
            formData.append('validId', toFormDataFile(validId, 'valid_id.jpg'));
            formData.append('selfie', toFormDataFile(selfie, 'selfie.jpg'));
            supportingDocs.forEach((doc, index) => {
                formData.append('supportingDocs', toFormDataFile(doc, `document_${index}.pdf`));
            });

            await submitServiceProviderApplication(formData);

            // Re-fetch /auth/me so `provider` (and its real verification_status) comes
            // from the backend — this is the same context value CustomerDashboard.js
            // already reads, so its "pending" banner updates as soon as this resolves.
            await refreshUser();

            setShowApprovalModal(true);
        } catch (error) {
            Alert.alert('Submission Failed', error.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
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

    const renderUploadBox = (label, subtitle, displayText, onPress) => (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={onPress} disabled={submitting}>
                <Image source={require('../assets/icon_upload.png')} style={styles.uploadIcon} />
                <View>
                    <Text style={styles.uploadTitle}>{displayText || 'Tap to upload'}</Text>
                    {subtitle ? <Text style={styles.uploadSubtitle}>{subtitle}</Text> : null}
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderCheckbox = (label, checked, onToggle) => (
        <TouchableOpacity style={styles.checkboxRow} onPress={onToggle} disabled={submitting}>
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

                {renderUploadBox('UPLOAD VALID ID', 'Government-issued ID', validId?.fileName, handleUploadValidId)}
                {renderUploadBox('SELFIE VERIFICATION', null, selfie?.fileName, handleUploadSelfie)}
                {renderUploadBox(
                    'SUPPORTING DOCUMENTS (OPTIONAL)',
                    null,
                    supportingDocs.length > 0 ? `${supportingDocs.length} file(s) selected` : null,
                    handleUploadSupportingDocs
                )}

                <Text style={styles.subLabel}>AGREEMENTS</Text>
                {renderCheckbox('I certify that all information provided is true and correct.', certifyTrue, () => setCertifyTrue((prev) => !prev))}
                {renderCheckbox("I agree to ServEase's Terms & Conditions.", agreeTerms, () => setAgreeTerms((prev) => !prev))}

                <TouchableOpacity style={styles.nextButton} onPress={handleSubmit} disabled={submitting}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.nextButtonGradient}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.nextButtonText}>Submit</Text>
                        )}
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