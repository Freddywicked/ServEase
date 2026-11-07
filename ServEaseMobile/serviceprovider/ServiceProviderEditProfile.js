import React, { useEffect, useState } from 'react';
import {
    View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../context/auth_context';
import {
    fetchMyProviderProfile,
    updateMyProviderProfile,
    uploadMyProviderPhoto,
} from '../api/providerProfile';

const GRADIENT = ['#0255AF', '#04A5A5']; // same as LoginScreen
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^(0?[1-9]|1[0-2]):[0-5]\d$/;

// Fixed UI choices (not user data).
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PERIODS = ['AM', 'PM'];

// ---- availability helpers (backend value <-> form state) --------------------

const dayIndex = (s) => DAYS.findIndex((d) => String(s).trim().toLowerCase().startsWith(d.toLowerCase()));

// Accepts an array ['Mon','Tue'] or a string such as "Mon-Fri", "Monday to Friday", "Mon, Wed, Fri".
const parseDays = (value) => {
    if (!value) return [];
    const set = new Set();
    const parts = Array.isArray(value) ? value : String(value).split(/[,&/]|\band\b/i);
    parts.forEach((part) => {
        const range = String(part).split(/\s*(?:-|–|—|\bto\b)\s*/i);
        if (range.length === 2) {
            const a = dayIndex(range[0]);
            const b = dayIndex(range[1]);
            if (a >= 0 && b >= 0) {
                let i = a;
                for (let n = 0; n < 7; n += 1) {
                    set.add(i);
                    if (i === b) break;
                    i = (i + 1) % 7;
                }
                return;
            }
        }
        const i = dayIndex(part);
        if (i >= 0) set.add(i);
    });
    return [...set].sort((a, b) => a - b);
};

// "Mon–Fri", "Mon, Wed, Fri" ... shown inside the dropdown box.
const summarizeDays = (idx) => {
    if (!idx.length) return '';
    const runs = [];
    let start = idx[0];
    let prev = idx[0];
    for (let i = 1; i <= idx.length; i += 1) {
        const cur = idx[i];
        if (cur === prev + 1) { prev = cur; continue; }
        if (start === prev) runs.push(DAYS[start]);
        else if (prev - start === 1) runs.push(`${DAYS[start]}, ${DAYS[prev]}`);
        else runs.push(`${DAYS[start]}–${DAYS[prev]}`);
        start = cur;
        prev = cur;
    }
    return runs.join(', ');
};

// "9:00 AM - 5:00 PM" -> { startTime, startPeriod, endTime, endPeriod }
const parseHours = (value) => {
    const empty = { startTime: '', startPeriod: 'AM', endTime: '', endPeriod: 'PM' };
    if (!value) return empty;
    const m = String(value).match(
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|\bto\b)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
    );
    if (!m) return empty;
    const endPeriod = m[6].toUpperCase();
    const startPeriod = (m[3] || m[6]).toUpperCase();
    return {
        startTime: `${m[1]}:${m[2] || '00'}`,
        startPeriod,
        endTime: `${m[4]}:${m[5] || '00'}`,
        endPeriod,
    };
};

const normTime = (t) => {
    const [h, m] = t.split(':');
    return `${parseInt(h, 10)}:${m}`;
};

const serializeHours = ({ startTime, startPeriod, endTime, endPeriod }) =>
    startTime || endTime
        ? `${normTime(startTime)} ${startPeriod} - ${normTime(endTime)} ${endPeriod}`
        : '';

const serializeDays = (idx) => idx.map((i) => DAYS[i]).join(',');

// Auto-insert the colon while typing: "930" -> "9:30", "0930" -> "09:30".
const formatTypedTime = (text) => {
    const d = text.replace(/\D/g, '').slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, d.length - 2)}:${d.slice(-2)}` : d;
};

// ---- small UI pieces --------------------------------------------------------

const Chevron = () => <View style={styles.chevron} />;

const Field = ({ label, children }) => (
    <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {children}
    </View>
);

const InputBox = (props) => (
    <View style={styles.inputWrapper}>
        <TextInput style={styles.input} placeholderTextColor="#B0B0B0" {...props} />
    </View>
);

const OptionModal = ({ visible, title, options, selected, multi, onSelect, onClose }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
                <Text style={styles.modalTitle}>{title}</Text>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={String(opt.value)}
                        style={styles.modalOptionRow}
                        onPress={() => onSelect(opt.value)}
                    >
                        <Text style={styles.modalOptionText}>{opt.label}</Text>
                        {selected.includes(opt.value) ? <Text style={styles.modalCheck}>✓</Text> : null}
                    </TouchableOpacity>
                ))}
                {multi ? (
                    <TouchableOpacity style={styles.modalOptionRow} onPress={onClose}>
                        <Text style={[styles.modalOptionText, styles.modalDone]}>Done</Text>
                    </TouchableOpacity>
                ) : null}
            </Pressable>
        </Pressable>
    </Modal>
);

// ---- screen -----------------------------------------------------------------

const ServiceProviderEditProfile = ({ navigation }) => {
    const { refreshUser } = useAuth();

    const [profile, setProfile] = useState(null); // read-only header data from the backend
    const [initial, setInitial] = useState(null); // last values saved on the backend (for change detection)

    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [selectedDays, setSelectedDays] = useState([]);
    const [startTime, setStartTime] = useState('');
    const [startPeriod, setStartPeriod] = useState('AM');
    const [endTime, setEndTime] = useState('');
    const [endPeriod, setEndPeriod] = useState('PM');
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');

    const [newPhoto, setNewPhoto] = useState(null); // { uri, fileName, type } picked, not yet uploaded
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [photoModalVisible, setPhotoModalVisible] = useState(false);
    const [picker, setPicker] = useState(null); // 'days' | 'startPeriod' | 'endPeriod' | null

    // Load the latest provider profile so every field shows database values.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const p = await fetchMyProviderProfile();
                if (!active) return;
                const days = parseDays(p.other.availabilityDays);
                const hours = parseHours(p.other.availabilityHours);
                setProfile(p);
                setEmail(p.account.email || '');
                setAddress(p.account.address || '');
                setSelectedDays(days);
                setStartTime(hours.startTime);
                setStartPeriod(hours.startPeriod);
                setEndTime(hours.endTime);
                setEndPeriod(hours.endPeriod);
                setCompanyName(p.other.companyName || '');
                setCompanyAddress(p.other.companyAddress || '');
                setInitial({
                    email: p.account.email || '',
                    address: p.account.address || '',
                    days: serializeDays(days),
                    hours: serializeHours(hours),
                    companyName: p.other.companyName || '',
                    companyAddress: p.other.companyAddress || '',
                });
            } catch (e) {
                if (active) setError(e.message || 'Could not load your profile.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    // ---- photo ----
    const photoOptions = { mediaType: 'photo', quality: 0.7, maxWidth: 800, maxHeight: 800 };

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

    // ---- days / period pickers ----
    const toggleDay = (i) =>
        setSelectedDays((cur) => (cur.includes(i) ? cur.filter((d) => d !== i) : [...cur, i].sort((a, b) => a - b)));

    // ---- save ----
    const handleDone = async () => {
        if (!initial) return;
        setError('');

        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }

        const hasHours = !!(startTime || endTime);
        if (selectedDays.length || hasHours) {
            if (!selectedDays.length) {
                setError('Select the days you are available.');
                return;
            }
            if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
                setError('Enter your start and end time as hh:mm (for example 9:00).');
                return;
            }
        }

        const daysKey = serializeDays(selectedDays);
        const hoursStr = serializeHours({ startTime, startPeriod, endTime, endPeriod });

        const fields = {};
        if (trimmedEmail !== initial.email.toLowerCase()) fields.email = trimmedEmail;
        if (address.trim() !== initial.address) fields.address = address.trim();
        if (daysKey !== initial.days) fields.availabilityDays = selectedDays.map((i) => DAYS[i]);
        if (hoursStr !== initial.hours) fields.availabilityHours = hoursStr || null;
        if (companyName.trim() !== initial.companyName) fields.companyName = companyName.trim();
        if (companyAddress.trim() !== initial.companyAddress) fields.companyAddress = companyAddress.trim();

        if (!Object.keys(fields).length && !newPhoto) {
            navigation.goBack();
            return;
        }

        setSaving(true);
        try {
            if (Object.keys(fields).length) await updateMyProviderProfile(fields);
            if (newPhoto) await uploadMyProviderPhoto(newPhoto.uri, newPhoto.fileName, newPhoto.type);
            await refreshUser?.();
            navigation.goBack(); // ServiceProviderProfile reloads on focus
        } catch (e) {
            setError(
                e.fieldErrors?.email || e.fieldErrors?.address ||
                e.message || 'Could not save your changes. Please try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    const avatarSource = newPhoto
        ? { uri: newPhoto.uri }
        : profile?.photoUrl
            ? { uri: profile.photoUrl }
            : require('../assets/icon_profile_photo.png');

    const disabled = loading || saving;
    const daysText = summarizeDays(selectedDays);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                            <Text style={styles.name} numberOfLines={1}>{profile?.fullName || ''}</Text>
                            {profile?.specialty ? (
                                <Text style={styles.specialty} numberOfLines={1}>{profile.specialty}</Text>
                            ) : null}
                            {profile?.yearsExperience != null ? (
                                <Text style={styles.experience}>
                                    {profile.yearsExperience} {Number(profile.yearsExperience) === 1 ? 'year' : 'years'} experience
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    {/* Account Details */}
                    <Text style={styles.sectionTitle}>Account Details</Text>

                    <Field label="Email Address">
                        <InputBox
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email address"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!disabled}
                        />
                    </Field>

                    <Field label="Address">
                        <InputBox
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Address"
                            editable={!disabled}
                        />
                    </Field>

                    {/* Other Details */}
                    <Text style={[styles.sectionTitle, styles.sectionGap]}>Other Details</Text>

                    <Field label="Availability">
                        {/* Row 1: days */}
                        <TouchableOpacity
                            style={[styles.box, styles.daysBox]}
                            onPress={() => setPicker('days')}
                            disabled={disabled}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={daysText ? styles.boxText : styles.boxPlaceholder}
                                numberOfLines={1}
                            >
                                {daysText || 'Select Days'}
                            </Text>
                            <Chevron />
                        </TouchableOpacity>

                        {/* Row 2: [time][AM] — [time][PM] */}
                        <View style={styles.hoursRow}>
                            <TextInput
                                style={[styles.box, styles.timeBox, styles.boxText]}
                                value={startTime}
                                onChangeText={(t) => setStartTime(formatTypedTime(t))}
                                placeholder="00:00"
                                placeholderTextColor="#B0B0B0"
                                keyboardType="number-pad"
                                maxLength={5}
                                editable={!disabled}
                            />
                            <TouchableOpacity
                                style={[styles.box, styles.periodBox]}
                                onPress={() => setPicker('startPeriod')}
                                disabled={disabled}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.boxText}>{startPeriod}</Text>
                                <Chevron />
                            </TouchableOpacity>

                            <View style={styles.dashWrap}>
                                <View style={styles.dash} />
                            </View>

                            <TextInput
                                style={[styles.box, styles.timeBox, styles.boxText]}
                                value={endTime}
                                onChangeText={(t) => setEndTime(formatTypedTime(t))}
                                placeholder="00:00"
                                placeholderTextColor="#B0B0B0"
                                keyboardType="number-pad"
                                maxLength={5}
                                editable={!disabled}
                            />
                            <TouchableOpacity
                                style={[styles.box, styles.periodBox]}
                                onPress={() => setPicker('endPeriod')}
                                disabled={disabled}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.boxText}>{endPeriod}</Text>
                                <Chevron />
                            </TouchableOpacity>
                        </View>
                    </Field>

                    <Field label="Company Name">
                        <InputBox
                            value={companyName}
                            onChangeText={setCompanyName}
                            placeholder="Company name"
                            editable={!disabled}
                        />
                    </Field>

                    <Field label="Company Address">
                        <InputBox
                            value={companyAddress}
                            onChangeText={setCompanyAddress}
                            placeholder="Company address"
                            editable={!disabled}
                        />
                    </Field>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[styles.gradientButton, disabled && styles.buttonDisabled]}
                        onPress={handleDone}
                        disabled={disabled}
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

            {/* Days (multi-select) */}
            <OptionModal
                visible={picker === 'days'}
                title="Available days"
                options={DAY_NAMES.map((label, value) => ({ label, value }))}
                selected={selectedDays}
                multi
                onSelect={toggleDay}
                onClose={() => setPicker(null)}
            />
            {/* AM / PM */}
            <OptionModal
                visible={picker === 'startPeriod' || picker === 'endPeriod'}
                title={picker === 'endPeriod' ? 'End time' : 'Start time'}
                options={PERIODS.map((p) => ({ label: p, value: p }))}
                selected={[picker === 'endPeriod' ? endPeriod : startPeriod]}
                onSelect={(p) => {
                    if (picker === 'endPeriod') setEndPeriod(p);
                    else setStartPeriod(p);
                    setPicker(null);
                }}
                onClose={() => setPicker(null)}
            />

            {/* Photo options */}
            <Modal
                visible={photoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPhotoModalVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setPhotoModalVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <Text style={styles.modalTitle}>Profile photo</Text>
                        <TouchableOpacity style={styles.modalOptionRow} onPress={handleChooseFromGallery}>
                            <Text style={styles.modalOptionText}>Choose from gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOptionRow} onPress={handleTakePhoto}>
                            <Text style={styles.modalOptionText}>Take photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOptionRow} onPress={() => setPhotoModalVisible(false)}>
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
        flex: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333333',
    },
    specialty: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#555555',
        marginTop: 4,
    },
    experience: {
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
    sectionGap: {
        marginTop: 12,
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

    // Availability: days on its own row, then [time][AM] — [time][PM]
    box: {
        height: 48,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
    },
    boxText: {
        fontSize: 14,
        color: '#333333',
    },
    boxPlaceholder: {
        fontSize: 14,
        color: '#B0B0B0',
    },
    daysBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
    },
    hoursRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    timeBox: {
        flex: 1,
        marginRight: 6,
        paddingHorizontal: 10,
        paddingVertical: 0,
        textAlign: 'center',
    },
    periodBox: {
        width: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    dashWrap: {
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dash: {
        width: 10,
        height: 1.5,
        backgroundColor: '#888888',
    },
    chevron: {
        width: 8,
        height: 8,
        borderRightWidth: 1.5,
        borderBottomWidth: 1.5,
        borderColor: '#888888',
        transform: [{ rotate: '45deg' }, { translateY: -2 }],
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

    // Dialogs
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
    modalOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    modalOptionText: {
        fontSize: 15,
        color: '#333333',
    },
    modalCheck: {
        fontSize: 16,
        color: '#1B2A8C',
        fontWeight: '700',
    },
    modalDone: {
        color: '#1B2A8C',
        fontWeight: '700',
    },
});

export default ServiceProviderEditProfile;