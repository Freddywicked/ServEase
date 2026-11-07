import React, { useEffect, useState } from 'react';
import {
    View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../context/auth_context';
import { fetchMyProfile, updateMyProfile, uploadMyPhoto } from '../api/customerProfile';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CustomerEditProfile = ({ navigation }) => {
    const { user, refreshUser } = useAuth();

    // Saved values as last returned by the backend (used to detect changes).
    const [saved, setSaved] = useState({
        name: user?.name || '',
        email: user?.email || '',
        address: user?.address || '',
        photoUrl: user?.photoUrl || null,
    });
    const [email, setEmail] = useState(user?.email || '');
    const [address, setAddress] = useState(user?.address || '');
    const [newPhoto, setNewPhoto] = useState(null); // { uri, fileName, type } picked, not yet uploaded
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [photoModalVisible, setPhotoModalVisible] = useState(false);
    const [error, setError] = useState('');

    // Load the latest profile from the backend so the fields always show database values.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const profile = await fetchMyProfile();
                if (!active) return;
                const next = {
                    name: profile?.name || '',
                    email: profile?.email || '',
                    address: profile?.address || '',
                    photoUrl: profile?.photoUrl || null,
                };
                setSaved(next);
                setEmail(next.email);
                setAddress(next.address);
            } catch (e) {
                if (active) setError(e.message || 'Could not load your profile.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const photoOptions = {
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 800,
        maxHeight: 800,
    };

    const applyPickerResult = (result) => {
        if (result.errorMessage) {
            Alert.alert('Could not get photo', result.errorMessage);
            return;
        }
        const asset = result.assets?.[0];
        if (!result.didCancel && asset?.uri) {
            setNewPhoto({ uri: asset.uri, fileName: asset.fileName, type: asset.type });
        }
    };

    const handleChooseFromGallery = async () => {
        setPhotoModalVisible(false);
        applyPickerResult(await launchImageLibrary({ ...photoOptions, selectionLimit: 1 }));
    };

    const handleTakePhoto = async () => {
        setPhotoModalVisible(false);
        applyPickerResult(await launchCamera({ ...photoOptions, saveToPhotos: false }));
    };

    const handleDone = async () => {
        setError('');
        const trimmedEmail = email.trim();
        const trimmedAddress = address.trim();

        if (!EMAIL_REGEX.test(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }

        const fields = {};
        if (trimmedEmail !== saved.email) fields.email = trimmedEmail;
        if (trimmedAddress !== saved.address) fields.address = trimmedAddress;

        if (!Object.keys(fields).length && !newPhoto) {
            navigation.goBack();
            return;
        }

        setSaving(true);
        try {
            if (Object.keys(fields).length) await updateMyProfile(fields);
            if (newPhoto) await uploadMyPhoto(newPhoto.uri, newPhoto.fileName, newPhoto.type);
            // Pull the saved data back into auth_context so CustomerProfile shows it.
            await refreshUser();
            navigation.goBack();
        } catch (e) {
            setError(e.fieldErrors?.email || e.fieldErrors?.address || e.message || 'Could not save your changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const avatarSource = newPhoto
        ? { uri: newPhoto.uri }
        : saved.photoUrl
            ? { uri: saved.photoUrl }
            : require('../assets/icon_profile_photo.png');

    const roleLabel = user?.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : 'Customer';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.headerTitle}>Profile</Text>

                    <View style={styles.identityRow}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setPhotoModalVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Change profile photo"
                        >
                            <Image source={avatarSource} style={styles.avatar} />
                            <Image source={require('../assets/icon_edit.png')} style={styles.avatarEditIcon} />
                        </TouchableOpacity>
                        <View style={styles.identityText}>
                            <Text style={styles.name}>{saved.name}</Text>
                            <Text style={styles.role}>{roleLabel}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Account Details</Text>

                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email address"
                        placeholderTextColor="#6F6F6F"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading && !saving}
                    />

                    <Text style={styles.fieldLabel}>Address</Text>
                    <TextInput
                        style={styles.input}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Address"
                        placeholderTextColor="#6F6F6F"
                        editable={!loading && !saving}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={styles.doneButton}
                        onPress={handleDone}
                        disabled={loading || saving}
                        activeOpacity={0.7}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#000000" />
                        ) : (
                            <Text style={styles.doneText}>Done</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                visible={photoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPhotoModalVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setPhotoModalVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <Text style={styles.modalTitle}>Profile photo</Text>
                        <TouchableOpacity style={styles.modalOption} onPress={handleChooseFromGallery}>
                            <Text style={styles.modalOptionText}>Choose from gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={handleTakePhoto}>
                            <Text style={styles.modalOptionText}>Take photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => setPhotoModalVisible(false)}>
                            <Text style={styles.modalOptionText}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 120, // clears the static bottom navbar
    },
    headerTitle: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
        marginBottom: 27,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 27,
    },
    avatar: {
        width: 71,
        height: 71,
        borderRadius: 36,
        backgroundColor: '#D9D9D9',
    },
    avatarEditIcon: {
        position: 'absolute',
        right: 1,
        bottom: 5,
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    identityText: {
        marginLeft: 12,
        flexShrink: 1,
    },
    name: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
    },
    role: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#292727',
        marginBottom: 9,
    },
    fieldLabel: {
        fontSize: 9,
        lineHeight: 15,
        color: '#484040',
        marginBottom: 2,
    },
    input: {
        height: 29,
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 6,
        paddingVertical: 0,
        fontSize: 9,
        color: '#6F6F6F',
        marginBottom: 4,
    },
    errorText: {
        fontSize: 10,
        color: '#C62828',
        marginTop: 4,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingTop: 18,
        paddingBottom: 8,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 16,
        lineHeight: 20,
        fontWeight: '700',
        color: '#021E79',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    modalOption: {
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    modalOptionText: {
        fontSize: 14,
        lineHeight: 18,
        color: '#484040',
    },
    doneButton: {
        alignSelf: 'flex-end',
        width: 57,
        height: 24,
        borderWidth: 1,
        borderColor: '#55575B',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 11,
    },
    doneText: {
        fontSize: 9,
        lineHeight: 15,
        fontWeight: '700',
        color: '#000000',
    },
});

export default CustomerEditProfile;