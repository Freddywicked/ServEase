// components/ReportForm.js
// Shared form for ReportSystemError.js and ReportUser.js (identical Figma layout,
// only the italic sub-label and the report `type` differ).
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { MEDIA_LIMITS, REPORTER_ROLES, submitReport } from '../api/report_api';

// Point this at the same upload icon used in CreateServiceRequest.
const UPLOAD_ICON = require('../assets/icon_upload_image.png');
const PLAY_ICON = require('../assets/icon_play_white.png');

const ReportForm = ({
    navigation,
    route,
    type,
    typeLabel,
    showUserName = false, // user reports only: adds the "Name" field
    reporterRole = REPORTER_ROLES.CUSTOMER,
    defaultReturnTo = 'CustomerProfile',
}) => {
    // Optional context passed by whichever screen opens the form
    // (e.g. Chat / ProviderDetails -> ReportUser with the person being reported).
    const reportedUserId = route?.params?.reportedUserId;
    const prefilledUserName = route?.params?.reportedUserName || '';
    const serviceRequestId = route?.params?.serviceRequestId;
    const returnTo = route?.params?.returnTo || defaultReturnTo;

    const [subject, setSubject] = useState('');
    const [userName, setUserName] = useState(prefilledUserName);
    const [details, setDetails] = useState('');
    const [media, setMedia] = useState([]);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);

    const imageCount = media.filter((m) => m.kind === 'image').length;
    const videoCount = media.filter((m) => m.kind === 'video').length;
    const imagesLeft = MEDIA_LIMITS.MAX_IMAGES - imageCount;
    const videosLeft = MEDIA_LIMITS.MAX_VIDEOS - videoCount;

    const addAssets = (assets = []) => {
        let images = imageCount;
        let videos = videoCount;
        let skipped = false;
        const accepted = [];

        assets.forEach((a, i) => {
            const kind = a.type?.startsWith('video') ? 'video' : 'image';
            if (kind === 'image' && images >= MEDIA_LIMITS.MAX_IMAGES) { skipped = true; return; }
            if (kind === 'video' && videos >= MEDIA_LIMITS.MAX_VIDEOS) { skipped = true; return; }
            kind === 'image' ? (images += 1) : (videos += 1);
            accepted.push({
                kind,
                uri: a.uri,
                type: a.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
                name: a.fileName || `report_${Date.now()}_${i}.${kind === 'video' ? 'mp4' : 'jpg'}`,
            });
        });

        if (accepted.length) setMedia((prev) => [...prev, ...accepted]);
        if (skipped) {
            Alert.alert(
                'Upload limit reached',
                `You can upload up to ${MEDIA_LIMITS.MAX_IMAGES} images and ${MEDIA_LIMITS.MAX_VIDEOS} video.`
            );
        }
    };

    const handlePickerResult = (res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
            Alert.alert('Unable to open', res.errorMessage || 'Please check your permissions and try again.');
            return;
        }
        addAssets(res.assets);
    };

    const openGallery = () => {
        setPickerVisible(false);
        const remaining = imagesLeft + videosLeft;
        if (remaining <= 0) {
            Alert.alert(
                'Upload limit reached',
                `You can upload up to ${MEDIA_LIMITS.MAX_IMAGES} images and ${MEDIA_LIMITS.MAX_VIDEOS} video.`
            );
            return;
        }
        const mediaType = videosLeft <= 0 ? 'photo' : imagesLeft <= 0 ? 'video' : 'mixed';
        setTimeout(() => {
            launchImageLibrary({ mediaType, selectionLimit: remaining }, handlePickerResult);
        }, 300);
    };

    const openCamera = (mediaType) => {
        setPickerVisible(false);
        setTimeout(() => {
            launchCamera({ mediaType, saveToPhotos: false, videoQuality: 'medium' }, handlePickerResult);
        }, 300);
    };

    const removeMedia = (uri) => setMedia((prev) => prev.filter((m) => m.uri !== uri));

    const handleSubmit = async () => {
        const next = {};
        if (!subject.trim()) next.subject = 'Please enter a subject.';
        if (showUserName && !userName.trim()) next.userName = 'Please enter the name of the user you are reporting.';
        if (!details.trim()) next.details = 'Please enter the report details.';
        setErrors(next);
        if (Object.keys(next).length) return;

        try {
            setSubmitting(true);
            await submitReport({
                type,
                subject: subject.trim(),
                details: details.trim(),
                media,
                reportedUserId,
                reportedUserName: showUserName ? userName.trim() : undefined,
                serviceRequestId,
                reporterRole,
            });
            Alert.alert('Report sent', 'Thank you. Our team will review your report.', [
                { text: 'OK', onPress: () => navigation.navigate(returnTo) },
            ]);
        } catch (e) {
            Alert.alert('Unable to send report', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View style={styles.backChevron} />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Report a Problem</Text>

                    <Text style={styles.formTitle}>Report Form</Text>
                    <Text style={styles.formType}>{typeLabel}</Text>

                    <Text style={styles.fieldLabel}>Subject</Text>
                    <TextInput
                        style={[styles.input, errors.subject && styles.inputError]}
                        placeholder="Enter subject report"
                        placeholderTextColor="#6F6F6F"
                        value={subject}
                        onChangeText={(t) => { setSubject(t); if (errors.subject) setErrors((e) => ({ ...e, subject: null })); }}
                        editable={!submitting}
                    />
                    {errors.subject ? <Text style={styles.errorText}>{errors.subject}</Text> : null}

                    {showUserName ? (
                        <>
                            <Text style={[styles.fieldLabel, styles.userNameLabel]}>Name</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    errors.userName && styles.inputError,
                                    // locked when the name came from the screen that opened this form
                                    prefilledUserName ? styles.inputLocked : null,
                                ]}
                                placeholder="Enter name"
                                placeholderTextColor="#6F6F6F"
                                value={userName}
                                onChangeText={(t) => { setUserName(t); if (errors.userName) setErrors((e) => ({ ...e, userName: null })); }}
                                editable={!submitting && !prefilledUserName}
                            />
                            {errors.userName ? <Text style={styles.errorText}>{errors.userName}</Text> : null}
                        </>
                    ) : null}

                    <Text style={[styles.fieldLabel, styles.detailsLabel, showUserName && styles.detailsLabelAfterUser]}>Details</Text>
                    <TextInput
                        style={[styles.input, styles.detailsInput, errors.details && styles.inputError]}
                        placeholder="Enter report details"
                        placeholderTextColor="#6F6F6F"
                        value={details}
                        onChangeText={(t) => { setDetails(t); if (errors.details) setErrors((e) => ({ ...e, details: null })); }}
                        multiline
                        textAlignVertical="top"
                        editable={!submitting}
                    />
                    {errors.details ? <Text style={styles.errorText}>{errors.details}</Text> : null}

                    <TouchableOpacity
                        style={styles.uploadBox}
                        onPress={() => setPickerVisible(true)}
                        disabled={submitting}
                        activeOpacity={0.7}
                    >
                        <Image source={UPLOAD_ICON} style={styles.uploadIcon} />
                        <Text style={styles.uploadLabel}>Upload Image</Text>
                    </TouchableOpacity>

                    {media.length > 0 ? (
                        <View style={styles.thumbRow}>
                            {media.map((m) => (
                                <View key={m.uri} style={styles.thumbWrap}>
                                    {m.kind === 'image' ? (
                                        <Image source={{ uri: m.uri }} style={styles.thumb} />
                                    ) : (
                                        <View style={[styles.thumb, styles.videoThumb]}>
                                            <Image source={PLAY_ICON} style={styles.playIcon} />
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        style={styles.removeBadge}
                                        onPress={() => removeMedia(m.uri)}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={styles.removeText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={styles.sendWrap}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#0255AF', '#04A5A5']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.sendButton}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.sendText}>Send Report</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                visible={pickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerVisible(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
                    <View style={styles.sheet}>
                        <Text style={styles.sheetTitle}>Upload</Text>
                        <TouchableOpacity style={styles.sheetItem} onPress={openGallery}>
                            <Text style={styles.sheetItemText}>Choose from gallery</Text>
                        </TouchableOpacity>
                        {imagesLeft > 0 ? (
                            <TouchableOpacity style={styles.sheetItem} onPress={() => openCamera('photo')}>
                                <Text style={styles.sheetItemText}>Take photo</Text>
                            </TouchableOpacity>
                        ) : null}
                        {videosLeft > 0 ? (
                            <TouchableOpacity style={styles.sheetItem} onPress={() => openCamera('video')}>
                                <Text style={styles.sheetItemText}>Record video</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.sheetItem} onPress={() => setPickerVisible(false)}>
                            <Text style={[styles.sheetItemText, styles.sheetCancel]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

const SF = Platform.OS === 'ios' ? undefined : 'SF Pro';

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 140, // clears the static bottom navbar
    },
    backButton: {
        marginTop: 4,
        height: 32,
        width: 32,
        justifyContent: 'center',
    },
    backChevron: {
        width: 11,
        height: 11,
        borderLeftWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: '#000000',
        transform: [{ rotate: '45deg' }],
        marginLeft: 1,
    },
    headerTitle: {
        marginTop: 10,
        fontFamily: 'Roboto',
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
    },
    formTitle: {
        marginTop: 33,
        fontFamily: SF,
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
    },
    formType: {
        marginTop: 4,
        fontFamily: SF,
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '700',
        fontStyle: 'italic',
        color: '#484040',
    },
    fieldLabel: {
        marginTop: 19,
        marginBottom: 2,
        marginLeft: 3,
        fontFamily: SF,
        fontSize: 9,
        lineHeight: 15,
        color: '#484040',
    },
    detailsLabel: { marginTop: 12 },
    userNameLabel: { marginTop: 15 },
    detailsLabelAfterUser: { marginTop: 15 },
    input: {
        height: 40,
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 0,
        fontFamily: SF,
        fontSize: 10,
        color: '#000000',
    },
    detailsInput: {
        height: 115,
        paddingTop: 8,
        paddingBottom: 8,
    },
    inputError: { borderColor: '#C62828' },
    inputLocked: { backgroundColor: '#F2F2F2' },
    errorText: {
        marginTop: 3,
        marginLeft: 3,
        fontFamily: SF,
        fontSize: 9,
        color: '#C62828',
    },
    uploadBox: {
        marginTop: 28,
        height: 65,
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        tintColor: '#3F3F3F',
        marginBottom: 4,
    },
    uploadLabel: {
        fontFamily: SF,
        fontSize: 10,
        lineHeight: 12,
        color: '#484040',
    },
    thumbRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    thumbWrap: {
        marginRight: 10,
        marginBottom: 8,
    },
    thumb: {
        width: 56,
        height: 56,
        borderRadius: 8,
        backgroundColor: '#D9D9D9',
    },
    videoThumb: {
        backgroundColor: '#1F1F1F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
    },
    removeBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#484040',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeText: {
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 15,
        fontWeight: '700',
    },
    sendWrap: {
        marginTop: 55,
        alignSelf: 'center',
    },
    sendButton: {
        width: 265,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendText: {
        fontFamily: SF,
        fontSize: 12,
        lineHeight: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 8,
    },
    sheetTitle: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: '700',
        color: '#484040',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    sheetItem: {
        paddingHorizontal: 20,
        paddingVertical: 13,
    },
    sheetItemText: {
        fontFamily: SF,
        fontSize: 13,
        color: '#484040',
    },
    sheetCancel: { color: '#C62828' },
});

export default ReportForm;