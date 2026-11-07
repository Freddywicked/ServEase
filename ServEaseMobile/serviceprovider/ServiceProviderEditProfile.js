import React, { useEffect, useState } from 'react';
import {
    View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAuth } from '../context/auth_context';
import {
    fetchMyProviderProfile,
    updateMyProviderProfile,
    uploadMyProviderPhoto,
} from '../api/providerProfile';

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
                        editable={!disabled}
                    />

                    <Text style={styles.fieldLabel}>Address</Text>
                    <TextInput
                        style={styles.input}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Address"
                        placeholderTextColor="#6F6F6F"
                        editable={!disabled}
                    />

                    {/* Other Details */}
                    <Text style={[styles.sectionTitle, styles.sectionGap]}>Other Details</Text>

                    <Text style={styles.fieldLabel}>Availability</Text>
                    <View style={styles.availabilityRow}>
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

                        <TextInput
                            style={[styles.box, styles.timeBox, styles.boxText]}
                            value={startTime}
                            onChangeText={(t) => setStartTime(formatTypedTime(t))}
                            placeholder="00:00"
                            placeholderTextColor="#6F6F6F"
                            keyboardType="number-pad"
                            maxLength={5}
                            editable={!disabled}
                        />
                        <TouchableOpacity
                            style={[styles.box, styles.periodBox, styles.periodGapLeft]}
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
                            placeholderTextColor="#6F6F6F"
                            keyboardType="number-pad"
                            maxLength={5}
                            editable={!disabled}
                        />
                        <TouchableOpacity
                            style={[styles.box, styles.periodBox, styles.periodGapLeft]}
                            onPress={() => setPicker('endPeriod')}
                            disabled={disabled}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.boxText}>{endPeriod}</Text>
                            <Chevron />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.fieldLabel}>Company Name</Text>
                    <TextInput
                        style={styles.input}
                        value={companyName}
                        onChangeText={setCompanyName}
                        placeholder="Company name"
                        placeholderTextColor="#6F6F6F"
                        editable={!disabled}
                    />

                    <Text style={styles.fieldLabel}>Company Address</Text>
                    <TextInput
                        style={styles.input}
                        value={companyAddress}
                        onChangeText={setCompanyAddress}
                        placeholder="Company address"
                        placeholderTextColor="#6F6F6F"
                        editable={!disabled}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={styles.doneButton}
                        onPress={handleDone}
                        disabled={disabled}
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
        flex: 1,
    },
    name: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
    },
    specialty: {
        fontSize: 12,
        lineHeight: 14,
        fontStyle: 'italic',
        color: '#484040',
        marginTop: 5,
    },
    experience: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        marginTop: 3,
    },
    sectionTitle: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#292727',
        marginBottom: 9,
    },
    sectionGap: {
        marginTop: 14,
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
        paddingLeft: 9,
        paddingRight: 6,
        paddingVertical: 0,
        fontSize: 9,
        color: '#6F6F6F',
        marginBottom: 4,
    },

    // Availability row: [days][time][AM] — [time][PM]
    availabilityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    box: {
        height: 29,
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    boxText: {
        fontSize: 9,
        color: '#6F6F6F',
    },
    boxPlaceholder: {
        fontSize: 9,
        color: '#6F6F6F',
    },
    daysBox: {
        flex: 120,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 9,
        paddingRight: 8,
    },
    timeBox: {
        flex: 62,
        marginLeft: 5,
        paddingLeft: 7,
        paddingRight: 4,
        paddingVertical: 0,
    },
    periodBox: {
        flex: 37,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 7,
        paddingRight: 6,
    },
    periodGapLeft: {
        marginLeft: 3,
    },
    dashWrap: {
        flex: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dash: {
        width: 8,
        height: 1,
        backgroundColor: '#818080',
    },
    chevron: {
        width: 5,
        height: 5,
        borderRightWidth: 1.2,
        borderBottomWidth: 1.2,
        borderColor: '#7C7979',
        transform: [{ rotate: '45deg' }, { translateY: -1 }],
    },

    errorText: {
        fontSize: 10,
        color: '#C62828',
        marginTop: 4,
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
        marginTop: 23,
    },
    doneText: {
        fontSize: 9,
        lineHeight: 15,
        fontWeight: '700',
        color: '#000000',
    },

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
        fontSize: 16,
        lineHeight: 20,
        fontWeight: '700',
        color: '#021E79',
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
        fontSize: 14,
        lineHeight: 18,
        color: '#484040',
    },
    modalCheck: {
        fontSize: 14,
        color: '#021E79',
        fontWeight: '700',
    },
    modalDone: {
        color: '#021E79',
        fontWeight: '700',
    },
});

export default ServiceProviderEditProfile;