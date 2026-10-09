import React, { useEffect, useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProviderJob, updateJobStatus } from '../api/providerWork_api';

const JobUpdateStatus = ({ navigation, route }) => {
    const jobId = route?.params?.jobId;

    // The stage list and the job's current stage come from GET /provider/jobs/:id.
    const [stages, setStages] = useState([]);
    const [currentStage, setCurrentStage] = useState('');
    const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [photo, setPhoto] = useState(null); // { uri, type, fileName }
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

    const handleUploadImage = () => {
        // TODO: wire up an image picker package once one is approved/installed, then
        // call setPhoto with the picked asset. With react-native-image-picker:
        //   const result = await launchImageLibrary({ mediaType: 'photo' });
        //   const asset = result?.assets?.[0];
        //   if (asset) setPhoto({ uri: asset.uri, type: asset.type, fileName: asset.fileName });
    };

    const handlePushUpdate = async () => {
        if (saving) return;
        if (!currentStage) {
            Alert.alert('Select a stage', 'Please choose the current stage of the job.');
            return;
        }
        setSaving(true);
        try {
            await updateJobStatus(jobId, { stage: currentStage, notes: notes.trim(), photo });
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

                        <TouchableOpacity style={styles.uploadBox} onPress={handleUploadImage} activeOpacity={0.8}>
                            {photo ? (
                                <Image source={{ uri: photo.uri }} style={styles.uploadPreview} />
                            ) : (
                                <Image source={require('../assets/icon_image.png')} style={styles.uploadIcon} />
                            )}
                            <Text style={styles.uploadText}>{photo ? 'Change Image' : 'Upload Image'}</Text>
                        </TouchableOpacity>

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
    uploadPreview: {
        width: 120,
        height: 90,
        borderRadius: 8,
        marginBottom: 8,
    },
    pushUpdateButtonDisabled: {
        opacity: 0.5,
    },
});

export default JobUpdateStatus;