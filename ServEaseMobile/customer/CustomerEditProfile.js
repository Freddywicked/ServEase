import React, { useEffect, useState } from 'react';
import {
    View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../context/auth_context';
import { fetchMyProfile, updateMyProfile, uploadMyPhoto } from '../api/customerProfile';

const GRADIENT = ['#0255AF', '#04A5A5']; // same as LoginScreen
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

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email address"
                                placeholderTextColor="#B0B0B0"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading && !saving}
                            />
                        </View>
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Address</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Address"
                                placeholderTextColor="#B0B0B0"
                                editable={!loading && !saving}
                            />
                        </View>
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[styles.gradientButton, (loading || saving) && styles.buttonDisabled]}
                        onPress={handleDone}
                        disabled={loading || saving}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.doneGradient}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.doneText}>Done</Text>
                            )}
                        </LinearGradient>
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
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: {
        paddingHorizontal: 28,   // LoginScreen container padding
        paddingTop: 24,
        paddingBottom: 120,      // clears the static bottom navbar
    },
    headerTitle: {
        fontSize: 26,            // LoginScreen title
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 28,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#D9D9D9',
    },
    avatarEditIcon: {
        position: 'absolute',
        right: 0,
        bottom: 4,
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    identityText: {
        marginLeft: 16,
        flexShrink: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333333',
    },
    role: {
        fontSize: 14,
        color: '#555555',
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 14,
    },
    field: { marginBottom: 16 },
    fieldLabel: {
        fontSize: 11,            // LoginScreen label
        fontWeight: '600',
        color: '#555555',
        letterSpacing: 1,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        paddingHorizontal: 14,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
    },
    errorText: {
        color: '#E53935',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 8,
    },
    gradientButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    buttonDisabled: { opacity: 0.7 },
    doneGradient: {
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
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
        fontSize: 18,
        fontWeight: '700',
        color: '#1B2A8C',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    modalOption: {
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    modalOptionText: {
        fontSize: 15,
        color: '#333333',
    },
});

export default CustomerEditProfile;