import React, { useEffect, useState } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import {
    getProviderJob,
    updateJobStatus,
    MAX_UPDATE_IMAGES,
    MAX_UPDATE_VIDEOS,
} from '../api/providerWork_api';
import LinearGradient from 'react-native-linear-gradient';

// Fonts from the Figma (same convention as IncomingServiceRequest.js).
const FONT_ROBOTO_BOLD = Platform.OS === 'ios' ? { fontFamily: 'Roboto-Bold' } : { fontWeight: '700' };
const FONT_QUICKSAND_MEDIUM = { fontFamily: 'Quicksand-Medium' };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per photo (keep in sync with the backend limit)
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB per video

const isVideoAsset = (asset) => String(asset?.type || '').startsWith('video/');

/* ============================================================================
 * JobUpdateStatus (Service Provider) — "Update Status"
 * ----------------------------------------------------------------------------
 * The stage list depends on the request: shop-based requests go Assessing -> Repairing ->
 * Quality Checking -> Completed, home-based ones Preparing -> Service Provider is on the way ->
 * Arrived at the Customer's location -> Completed. The backend decides
 * (GET /provider/jobs/:id -> job.stageOptions); this screen only displays what it is given.
 * Pushing the update (PATCH /provider/jobs/:id/status) shows it on the customer's Track and
 * RepairDetails screens, together with the notes, up to 4 photos and 1 video.
 * ========================================================================== */
const JobUpdateStatus = ({ navigation, route }) => {
    const jobId = route?.params?.jobId;

    const [stageOptions, setStageOptions] = useState([]); // [{ value, label }]
    const [currentStage, setCurrentStage] = useState(''); // a stage `value`
    const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [media, setMedia] = useState([]); // [{ uri, type, fileName, isVideo }]
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const loadJob = async () => {
            if (!jobId) {
                setLoadFailed(true);
                setLoading(false);
                return;
            }
            try {
                const data = await getProviderJob(jobId);
                if (cancelled) return;
                const job = data?.job || {};
                const options = Array.isArray(job.stageOptions) && job.stageOptions.length
                    ? job.stageOptions
                    : (job.stages ?? []).map((value) => ({ value, label: value }));
                setStageOptions(options);
                setCurrentStage(job.currentStage ?? '');
                setLoadFailed(false);
            } catch (error) {
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadJob();
        return () => {
            cancelled = true;
        };
    }, [jobId]);

    const imageCount = media.filter((m) => !m.isVideo).length;
    const videoCount = media.filter((m) => m.isVideo).length;
    const mediaFull = imageCount >= MAX_UPDATE_IMAGES && videoCount >= MAX_UPDATE_VIDEOS;
    const currentLabel = stageOptions.find((o) => o.value === currentStage)?.label;

    const handleBack = () => navigation.goBack();
    const handleToggleStageMenu = () => setIsStageMenuOpen((prev) => !prev);
    const handleSelectStage = (value) => {
        setCurrentStage(value);
        setIsStageMenuOpen(false);
    };

    const handleUploadMedia = async () => {
        if (saving) return;
        if (mediaFull) {
            Alert.alert(
                'Limit reached',
                `You can attach up to ${MAX_UPDATE_IMAGES} photos and ${MAX_UPDATE_VIDEOS} video per update.`,
            );
            return;
        }
        try {
            const result = await launchImageLibrary({
                mediaType: 'mixed', // photos and videos
                selectionLimit: MAX_UPDATE_IMAGES + MAX_UPDATE_VIDEOS - media.length,
                videoQuality: 'medium',
            });
            if (result.didCancel) return;
            if (result.errorCode) {
                Alert.alert('Unable to open gallery', result.errorMessage || 'Please try again.');
                return;
            }

            let images = imageCount;
            let videos = videoCount;
            const accepted = [];
            const problems = [];
            (result.assets || [])
                .filter((a) => a?.uri)
                .forEach((a, i) => {
                    const video = isVideoAsset(a);
                    const maxBytes = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
                    if (a.fileSize && a.fileSize > maxBytes) {
                        problems.push(video ? 'Each video must be 50 MB or smaller.' : 'Each photo must be 5 MB or smaller.');
                        return;
                    }
                    if (video ? videos >= MAX_UPDATE_VIDEOS : images >= MAX_UPDATE_IMAGES) {
                        problems.push(
                            video
                                ? `Only ${MAX_UPDATE_VIDEOS} video can be attached per update.`
                                : `Only ${MAX_UPDATE_IMAGES} photos can be attached per update.`,
                        );
                        return;
                    }
                    if (video) videos += 1;
                    else images += 1;
                    const type = a.type || (video ? 'video/mp4' : 'image/jpeg');
                    const ext = type.split('/')[1] || (video ? 'mp4' : 'jpg');
                    accepted.push({
                        uri: a.uri,
                        type,
                        fileName: a.fileName || `update_${Date.now()}_${i}.${ext}`,
                        isVideo: video,
                    });
                });

            if (problems.length) Alert.alert('Some files were not added', [...new Set(problems)].join('\n'));
            // Videos lead the strip, like they do on the customer's RepairDetails.
            setMedia((prev) => [...prev, ...accepted].sort((a, b) => Number(b.isVideo) - Number(a.isVideo)));
        } catch (error) {
            Alert.alert('Unable to open gallery', 'Please try again.');
        }
    };

    const handleRemoveMedia = (uri) => setMedia((prev) => prev.filter((m) => m.uri !== uri));

    const handlePushUpdate = async () => {
        if (saving) return;
        if (!currentStage) {
            Alert.alert('Select a stage', 'Please choose the current stage of the job.');
            return;
        }
        setSaving(true);
        try {
            await updateJobStatus(jobId, { stage: currentStage, notes: notes.trim(), media });
            Alert.alert('Status updated', 'The customer has been notified of the update.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            Alert.alert('Unable to update status', error?.message || 'Please check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const uploadLabel = media.length
        ? `Add More (${imageCount}/${MAX_UPDATE_IMAGES} photos, ${videoCount}/${MAX_UPDATE_VIDEOS} video)`
        : 'Upload Photos / Video';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Update Status</Text>

                {loading ? (
                    <ActivityIndicator style={styles.loader} color="#0255AF" />
                ) : loadFailed ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>Couldn't load this job. Go back and try again.</Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.fieldLabel}>Current stage</Text>
                        <View style={styles.dropdownWrap}>
                            <TouchableOpacity style={styles.dropdownField} onPress={handleToggleStageMenu} activeOpacity={0.8}>
                                <Text style={styles.dropdownValueText} numberOfLines={1}>
                                    {currentLabel || 'Select stage'}
                                </Text>
                                <Image
                                    source={require('../assets/icon_dropdown.png')}
                                    style={[styles.dropdownIcon, isStageMenuOpen && styles.dropdownIconOpen]}
                                />
                            </TouchableOpacity>
                            {isStageMenuOpen ? (
                                <View style={styles.dropdownMenu}>
                                    {stageOptions.map((option, index) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[styles.dropdownOption, index === 0 && styles.dropdownOptionFirst]}
                                            onPress={() => handleSelectStage(option.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.dropdownOptionText,
                                                    option.value === currentStage && styles.dropdownOptionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}
                        </View>

                        <Text style={styles.fieldLabel}>Notes</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Timeline, update, etc..."
                            placeholderTextColor="#8B8686"
                            multiline
                            numberOfLines={4}
                            value={notes}
                            onChangeText={setNotes}
                        />

                        <TouchableOpacity
                            style={[styles.uploadBox, mediaFull && styles.uploadBoxFull]}
                            onPress={handleUploadMedia}
                            activeOpacity={0.8}
                            disabled={saving}
                        >
                            <Image source={require('../assets/icon_image.png')} style={styles.uploadIcon} />
                            <Text style={styles.uploadText}>{uploadLabel}</Text>
                        </TouchableOpacity>

                        {media.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                                {media.map((m) => (
                                    <View key={m.uri} style={styles.previewItem}>
                                        {m.isVideo ? (
                                            <View style={[styles.previewThumb, styles.videoThumb]}>
                                                <Text style={styles.videoPlay}>▶</Text>
                                                <Text style={styles.videoLabel} numberOfLines={1}>Video</Text>
                                            </View>
                                        ) : (
                                            <Image source={{ uri: m.uri }} style={styles.previewThumb} />
                                        )}
                                        <TouchableOpacity
                                            style={styles.removeBadge}
                                            onPress={() => handleRemoveMedia(m.uri)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={styles.removeBadgeText}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.pushButton, saving && styles.buttonDisabled]}
                            onPress={handlePushUpdate}
                            disabled={saving}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.gradientButtonText}>Push Update</Text>}
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16, marginBottom: 4 },
    backIcon: { width: 11, height: 19, resizeMode: 'contain' },
    scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 },
    headerTitle: { ...FONT_ROBOTO_BOLD, fontSize: 24, lineHeight: 28, color: '#021E79', marginTop: 8, marginBottom: 20 },
    fieldLabel: { fontSize: 12, lineHeight: 20, color: '#5B5959', marginBottom: 6 },

    // Stage dropdown (156x32 pill-box in the design)
    dropdownWrap: { alignSelf: 'flex-start', marginBottom: 16 },
    dropdownField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minWidth: 156,
        maxWidth: 300,
        height: 32,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        paddingHorizontal: 12,
        backgroundColor: '#FFFDFD',
    },
    dropdownValueText: { flexShrink: 1, fontSize: 12, color: '#1C1B1B', marginRight: 10 },
    dropdownIcon: { width: 12, height: 12, resizeMode: 'contain' },
    dropdownIconOpen: { transform: [{ rotate: '180deg' }] },
    dropdownMenu: {
        minWidth: 156,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        marginTop: 4,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
    },
    dropdownOption: { paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#EEEEEE' },
    dropdownOptionFirst: { borderTopWidth: 0 },
    dropdownOptionText: { fontSize: 11, color: '#1C1B1B' },
    dropdownOptionTextActive: { fontWeight: '700', color: '#021E79' },

    notesInput: {
        height: 79,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 12,
        color: '#1C1B1B',
        textAlignVertical: 'top',
        marginBottom: 28,
    },

    uploadBox: {
        height: 90,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    uploadBoxFull: { opacity: 0.6 },
    uploadIcon: { width: 42, height: 42, resizeMode: 'contain', marginBottom: 2 },
    uploadText: { fontSize: 8, lineHeight: 10, color: '#484040', textAlign: 'center' },

    previewRow: { marginBottom: 20 },
    previewItem: { marginRight: 10, paddingTop: 6, paddingRight: 6 },
    previewThumb: { width: 70, height: 90, borderRadius: 6, backgroundColor: '#D9D9D9' },
    videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3F3F3F' },
    videoPlay: { color: '#FFFFFF', fontSize: 20 },
    videoLabel: { color: '#FFFFFF', fontSize: 9, marginTop: 2 },
    removeBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#111111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeBadgeText: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '700' },

    pushButton: {
        alignSelf: 'center',
        marginTop: 4,
        width: '82%',
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Figma gradient button: the LinearGradient fills it, the label sits on top.
    gradientButtonText: { fontSize: 12, lineHeight: 20, fontWeight: '700', color: '#FFFFFF' },
    buttonDisabled: { opacity: 0.55 },

    loader: { marginTop: 30 },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: { fontSize: 13, color: '#555555' },
});

export default JobUpdateStatus;