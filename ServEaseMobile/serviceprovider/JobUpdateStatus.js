import React, { useEffect, useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { getProviderJob, updateJobStatus } from '../api/providerWork_api';

const MAX_MEDIA = 5;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file (keep in sync with the backend limit)

const JobUpdateStatus = ({ navigation, route }) => {
    const jobId = route?.params?.jobId;

    // The stage list and the job's current stage come from GET /provider/jobs/:id.
    const [stages, setStages] = useState([]);
    const [currentStage, setCurrentStage] = useState('');
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
                setStages(data?.job?.stages ?? []);
                setCurrentStage(data?.job?.currentStage ?? '');
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

    const handleBack = () => {
        navigation.goBack();
    };

    const handleToggleStageMenu = () => {
        setIsStageMenuOpen((prev) => !prev);
    };

    const handleSelectStage = (stage) => {
        setCurrentStage(stage);
        setIsStageMenuOpen(false);
    };

    const handleUploadMedia = async () => {
        if (saving) return;
        if (media.length >= MAX_MEDIA) {
            Alert.alert('Limit reached', `You can attach up to ${MAX_MEDIA} photos/videos per update.`);
            return;
        }
        try {
            const result = await launchImageLibrary({
                mediaType: 'mixed', // photos and videos
                selectionLimit: MAX_MEDIA - media.length,
                videoQuality: 'medium',
            });
            if (result.didCancel) return;
            if (result.errorCode) {
                Alert.alert('Unable to open gallery', result.errorMessage || 'Please try again.');
                return;
            }
            const picked = (result.assets || []).filter((a) => a?.uri);
            const tooBig = picked.filter((a) => a.fileSize && a.fileSize > MAX_FILE_BYTES);
            if (tooBig.length) {
                Alert.alert('File too large', 'Each photo or video must be 50 MB or smaller.');
            }
            const accepted = picked
                .filter((a) => !a.fileSize || a.fileSize <= MAX_FILE_BYTES)
                .map((a, i) => {
                    const type = a.type || 'image/jpeg';
                    const ext = type.split('/')[1] || 'jpg';
                    return {
                        uri: a.uri,
                        type,
                        fileName: a.fileName || `update_${Date.now()}_${i}.${ext}`,
                        isVideo: type.startsWith('video/'),
                    };
                });
            setMedia((prev) => [...prev, ...accepted].slice(0, MAX_MEDIA));
        } catch (error) {
            Alert.alert('Unable to open gallery', 'Please try again.');
        }
    };

    const handleRemoveMedia = (uri) => {
        setMedia((prev) => prev.filter((m) => m.uri !== uri));
    };

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
            Alert.alert('Unable to update status', 'Please check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backArrow}>‹</Text>
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
                        <TouchableOpacity style={styles.dropdownField} onPress={handleToggleStageMenu} activeOpacity={0.8}>
                            <Text style={styles.dropdownValueText}>{currentStage || 'Select stage'}</Text>
                            <Image
                                source={require('../assets/icon_dropdown.png')}
                                style={[styles.dropdownIcon, isStageMenuOpen && styles.dropdownIconOpen]}
                            />
                        </TouchableOpacity>
                        {isStageMenuOpen ? (
                            <View style={styles.dropdownMenu}>
                                {stages.map((stage) => (
                                    <TouchableOpacity
                                        key={stage}
                                        style={styles.dropdownOption}
                                        onPress={() => handleSelectStage(stage)}
                                    >
                                        <Text style={styles.dropdownOptionText}>{stage}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}

                        <Text style={styles.fieldLabel}>Notes</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Timeline, update, etc..."
                            placeholderTextColor="#AAAAAA"
                            multiline
                            numberOfLines={4}
                            value={notes}
                            onChangeText={setNotes}
                        />

                        <TouchableOpacity
                            style={styles.uploadBox}
                            onPress={handleUploadMedia}
                            activeOpacity={0.8}
                            disabled={saving}
                        >
                            <Image source={require('../assets/icon_image.png')} style={styles.uploadIcon} />
                            <Text style={styles.uploadText}>
                                {media.length ? `Add More (${media.length}/${MAX_MEDIA})` : 'Upload Photos / Videos'}
                            </Text>
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
                            style={[styles.pushUpdateButton, saving && styles.pushUpdateButtonDisabled]}
                            onPress={handlePushUpdate}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#111111" />
                            ) : (
                                <Text style={styles.pushUpdateText}>Push Update</Text>
                            )}
                        </TouchableOpacity>
                    </>
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
    backButton: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    backArrow: {
        fontSize: 30,
        color: '#111111',
        fontWeight: '400',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 12,
        color: '#555555',
        marginBottom: 8,
    },
    dropdownField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        alignSelf: 'flex-start',
        minWidth: 150,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
    },
    dropdownValueText: {
        fontSize: 14,
        color: '#111111',
    },
    dropdownIcon: {
        width: 12,
        height: 12,
        resizeMode: 'contain',
    },
    dropdownIconOpen: {
        transform: [{ rotate: '180deg' }],
    },
    dropdownMenu: {
        alignSelf: 'flex-start',
        minWidth: 150,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
    },
    dropdownOption: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    dropdownOptionText: {
        fontSize: 14,
        color: '#333333',
    },
    notesInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
        color: '#111111',
        minHeight: 90,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    uploadBox: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 10,
        paddingVertical: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    uploadIcon: {
        width: 36,
        height: 36,
        resizeMode: 'contain',
        marginBottom: 8,
    },
    uploadText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#555555',
    },
    pushUpdateButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    pushUpdateText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    loader: {
        marginTop: 30,
    },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: {
        fontSize: 13,
        color: '#555555',
    },
    previewRow: {
        marginBottom: 20,
    },
    previewItem: {
        marginRight: 10,
        paddingTop: 6,
        paddingRight: 6,
    },
    previewThumb: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    videoThumb: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#222222',
    },
    videoPlay: {
        color: '#FFFFFF',
        fontSize: 22,
    },
    videoLabel: {
        color: '#FFFFFF',
        fontSize: 10,
        marginTop: 2,
    },
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
    removeBadgeText: {
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: 16,
        fontWeight: '700',
    },
    pushUpdateButtonDisabled: {
        opacity: 0.5,
    },
});

export default JobUpdateStatus;