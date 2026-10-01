import React, { useEffect, useRef, useState } from 'react';
import {
    View, Image, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, Platform, Modal, Pressable, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

// Field definitions drive the form. `type` decides how each field is rendered.
const INPUT_FIELDS = [
    { key: 'fullName', label: 'FULL NAME', placeholder: 'Juan Luna', keyboardType: 'default', autoCapitalize: 'words' },
    { key: 'email', label: 'EMAIL ADDRESS', placeholder: 'juanluna@gmail.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'phone', label: 'PHONE NUMBER', placeholder: '+63 912 345 6789', keyboardType: 'phone-pad', autoCapitalize: 'none' },
    { key: 'password', label: 'PASSWORD', placeholder: 'Create a password', secure: true, autoCapitalize: 'none' },
    { key: 'confirmPassword', label: 'CONFIRM PASSWORD', placeholder: 'Confirm password', secure: true, autoCapitalize: 'none' },
    { key: 'address', label: 'ADDRESS', placeholder: 'Street, Barangay, Municipality, Province', keyboardType: 'default', autoCapitalize: 'words' },
    { key: 'birthdate', label: 'BIRTHDATE', placeholder: 'mm/dd/yyyy', type: 'date' },
    { key: 'gender', label: 'GENDER', placeholder: 'Male/Female', type: 'select' },
];

// `value` is sent to the backend; `label` is what the user sees.
const GENDER_OPTIONS = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
];

const INITIAL_FORM = {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    birthdate: '', // 'YYYY-MM-DD'
    gender: '',    // 'male' | 'female'
    validId: null,
    agreedToTerms: false,
};

const REQUIRED_MESSAGES = {
    fullName: 'Full name is required.',
    email: 'Email address is required.',
    phone: 'Phone number is required.',
    password: 'Password is required.',
    confirmPassword: 'Please confirm your password.',
    address: 'Address is required.',
    birthdate: 'Birthdate is required.',
    gender: 'Please select your gender.',
};

// Same rules as the backend's utils/validators.js, so mistakes are caught before the OTP screen.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(09|\+639)\d{9}$/;
const isStrongPassword = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

// Order used to find the first error to scroll to.
const ERROR_ORDER = [...INPUT_FIELDS.map((f) => f.key), 'agreedToTerms'];

// ---- Date helpers (local time, so the date never shifts by a day because of UTC) ----
const pad = (n) => String(n).padStart(2, '0');
const toISODate = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseISODate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const formatDisplayDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
};
const DEFAULT_PICKER_DATE = new Date(2000, 0, 1);
const MIN_BIRTHDATE = new Date(1900, 0, 1);

const SignupScreen = ({ navigation, route }) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [passwordVisible, setPasswordVisible] = useState({});
    const [errors, setErrors] = useState({});

    const [showIosDatePicker, setShowIosDatePicker] = useState(false);
    const [iosTempDate, setIosTempDate] = useState(DEFAULT_PICKER_DATE);
    const [showGenderPicker, setShowGenderPicker] = useState(false);

    // Used to scroll to the first invalid field.
    const scrollRef = useRef(null);
    const fieldPositions = useRef({});

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
    };

    const togglePasswordVisibility = (key) => {
        setPasswordVisible((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleUploadId = () => {
        // TODO: open a file/image picker and store the selected ID in `form.validId`.
    };

    const validateForm = () => {
        const nextErrors = {};

        INPUT_FIELDS.forEach(({ key }) => {
            if (!String(form[key] ?? '').trim()) {
                nextErrors[key] = REQUIRED_MESSAGES[key];
            }
        });

        if (!nextErrors.email && !EMAIL_RE.test(form.email.trim())) {
            nextErrors.email = 'Enter a valid email address.';
        }
        if (!nextErrors.phone && !PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))) {
            nextErrors.phone = 'Enter a valid PH mobile number (09XXXXXXXXX or +63 9XX XXX XXXX).';
        }
        if (!nextErrors.password && !isStrongPassword(form.password)) {
            nextErrors.password = 'Use at least 8 characters with letters and numbers.';
        }

        if (
            !nextErrors.password &&
            !nextErrors.confirmPassword &&
            form.password !== form.confirmPassword
        ) {
            nextErrors.confirmPassword = 'Passwords do not match.';
        }

        if (!nextErrors.birthdate && form.birthdate > toISODate(new Date())) {
            nextErrors.birthdate = 'Birthdate cannot be in the future.';
        }

        if (!nextErrors.gender && !GENDER_OPTIONS.some((o) => o.value === form.gender)) {
            nextErrors.gender = REQUIRED_MESSAGES.gender;
        }

        if (!form.agreedToTerms) {
            nextErrors.agreedToTerms = 'Please agree to the Terms of Service and Privacy Policy.';
        }

        setErrors(nextErrors);
        return nextErrors;
    };

    const scrollToFirstError = (nextErrors) => {
        const firstKey = ERROR_ORDER.find((key) => nextErrors[key]);
        const y = fieldPositions.current[firstKey];
        if (y != null) {
            scrollRef.current?.scrollTo({ y: Math.max(y - 24, 0), animated: true });
        }
    };

    // Errors sent back from OTPVerification ("Edit details"), e.g. email already registered.
    useEffect(() => {
        const serverErrors = route.params?.serverErrors;
        if (!serverErrors) return;
        setErrors((prev) => ({ ...prev, ...serverErrors }));
        scrollToFirstError(serverErrors);
        navigation.setParams({ serverErrors: undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.serverErrors]);

    const handleNext = () => {
        Keyboard.dismiss();

        const nextErrors = validateForm();
        if (Object.keys(nextErrors).length > 0) {
            scrollToFirstError(nextErrors);
            return;
        }

        // OTPVerification sends the code (requestOtp) and finishes registration (register).
        navigation.navigate('OTPVerification', { fromSignup: true, form });
    };

    const handleLoginPress = () => {
        navigation.navigate('LoginScreen');
    };

    // ---------------- Birthdate ----------------
    const openDatePicker = () => {
        Keyboard.dismiss();
        const current = form.birthdate ? parseISODate(form.birthdate) : DEFAULT_PICKER_DATE;

        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: current,
                mode: 'date',
                minimumDate: MIN_BIRTHDATE,
                maximumDate: new Date(),
                onChange: (event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                        updateField('birthdate', toISODate(selectedDate));
                    }
                },
            });
        } else {
            setIosTempDate(current);
            setShowIosDatePicker(true);
        }
    };

    const confirmIosDate = () => {
        updateField('birthdate', toISODate(iosTempDate));
        setShowIosDatePicker(false);
    };

    // ---------------- Field renderers ----------------
    const renderDateField = ({ key, placeholder }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={openDatePicker}
            style={[styles.inputWrapper, errors[key] ? styles.inputWrapperError : null]}
        >
            <Text style={[styles.pickerText, !form[key] && styles.placeholderText]}>
                {form[key] ? formatDisplayDate(form[key]) : placeholder}
            </Text>
            <CalendarIcon />
        </TouchableOpacity>
    );

    const renderSelectField = ({ key, placeholder }) => {
        const selected = GENDER_OPTIONS.find((o) => o.value === form[key]);
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    Keyboard.dismiss();
                    setShowGenderPicker(true);
                }}
                style={[styles.inputWrapper, errors[key] ? styles.inputWrapperError : null]}
            >
                <Text style={[styles.pickerText, !selected && styles.placeholderText]}>
                    {selected ? selected.label : placeholder}
                </Text>
                <View style={styles.caret} />
            </TouchableOpacity>
        );
    };

    const renderTextField = ({ key, placeholder, keyboardType, autoCapitalize, secure }) => (
        <View style={[styles.inputWrapper, errors[key] ? styles.inputWrapperError : null]}>
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#B0B0B0"
                value={form[key]}
                onChangeText={(text) => updateField(key, text)}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={false}
                secureTextEntry={secure && !passwordVisible[key]}
            />
            {secure && (
                <TouchableOpacity onPress={() => togglePasswordVisibility(key)}>
                    <Image source={require('../assets/icon_eye.png')} style={styles.eyeIcon} />
                </TouchableOpacity>
            )}
        </View>
    );

    const renderField = (field) => (
        <View
            key={field.key}
            style={styles.field}
            onLayout={(e) => { fieldPositions.current[field.key] = e.nativeEvent.layout.y; }}
        >
            <Text style={styles.label}>{field.label}</Text>
            {field.type === 'date'
                ? renderDateField(field)
                : field.type === 'select'
                    ? renderSelectField(field)
                    : renderTextField(field)}
            {errors[field.key] ? <Text style={styles.errorText}>{errors[field.key]}</Text> : null}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Create your account</Text>

                {INPUT_FIELDS.map(renderField)}

                <View
                    style={styles.termsRow}
                    onLayout={(e) => { fieldPositions.current.agreedToTerms = e.nativeEvent.layout.y; }}
                >
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => updateField('agreedToTerms', !form.agreedToTerms)}
                    >
                        <Image source={require('../assets/icon_checkbox.png')} style={styles.checkboxIcon} />
                        {form.agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                    <Text style={styles.termsText}>
                        I agree to ServEase's <Text style={styles.link}>Terms of Service</Text> and{' '}
                        <Text style={styles.link}>Privacy Policy</Text>
                    </Text>
                </View>
                {errors.agreedToTerms ? <Text style={styles.termsError}>{errors.agreedToTerms}</Text> : null}

                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    Already have an account?{' '}
                    <Text style={styles.link} onPress={handleLoginPress}>Log in</Text>
                </Text>
            </ScrollView>

            {/* iOS: spinner in a bottom sheet with Cancel / Done */}
            {Platform.OS === 'ios' && (
                <Modal transparent animationType="slide" visible={showIosDatePicker}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setShowIosDatePicker(false)} />
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <TouchableOpacity onPress={() => setShowIosDatePicker(false)}>
                                <Text style={styles.sheetCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmIosDate}>
                                <Text style={styles.sheetDone}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <DateTimePicker
                            value={iosTempDate}
                            mode="date"
                            display="spinner"
                            themeVariant="light"
                            minimumDate={MIN_BIRTHDATE}
                            maximumDate={new Date()}
                            onChange={(_, d) => d && setIosTempDate(d)}
                        />
                    </View>
                </Modal>
            )}

            {/* Gender option list (iOS + Android) */}
            <Modal
                transparent
                animationType="fade"
                visible={showGenderPicker}
                onRequestClose={() => setShowGenderPicker(false)}
            >
                <Pressable style={styles.modalBackdropCenter} onPress={() => setShowGenderPicker(false)}>
                    <View style={styles.optionCard}>
                        <Text style={styles.optionHeader}>SELECT GENDER</Text>
                        {GENDER_OPTIONS.map((o) => (
                            <TouchableOpacity
                                key={o.value}
                                style={styles.optionRow}
                                onPress={() => {
                                    updateField('gender', o.value);
                                    setShowGenderPicker(false);
                                }}
                            >
                                <Text style={[styles.optionText, form.gender === o.value && styles.optionTextSelected]}>
                                    {o.label}
                                </Text>
                                {form.gender === o.value && <Text style={styles.optionCheck}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

// Small calendar icon made of Views, so no icon library is required.
const CalendarIcon = () => (
    <View style={styles.calendarIcon}>
        <View style={styles.calendarTop} />
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    container: { paddingHorizontal: 28, paddingBottom: 40 },
    logo: { width: 90, height: 90, resizeMode: 'contain', alignSelf: 'center', marginTop: 16 },
    title: { fontSize: 26, fontWeight: '700', color: '#1B2A8C', textAlign: 'center', marginTop: 8, marginBottom: 24 },
    field: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '600', color: '#555555', letterSpacing: 1, marginBottom: 6 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        paddingHorizontal: 14,
    },
    inputWrapperError: { borderColor: '#E53935' },
    errorText: { color: '#E53935', fontSize: 11, marginTop: 4 },
    termsError: { color: '#E53935', fontSize: 11, marginTop: -12, marginBottom: 16 },
    input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333333' },
    eyeIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: '#888888' },

    pickerText: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333333' },
    placeholderText: { color: '#B0B0B0' },
    caret: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#777777',
        marginLeft: 8,
    },
    calendarIcon: {
        width: 15,
        height: 15,
        borderWidth: 1.5,
        borderColor: '#333333',
        borderRadius: 2,
        marginLeft: 8,
    },
    calendarTop: { height: 4, backgroundColor: '#333333' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    modalBackdropCenter: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    sheet: { backgroundColor: '#FFFFFF', paddingBottom: 24 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    sheetCancel: { fontSize: 15, color: '#888888' },
    sheetDone: { fontSize: 15, color: '#2E6BE6', fontWeight: '600' },
    optionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
    optionHeader: {
        fontSize: 11, fontWeight: '600', color: '#555555', letterSpacing: 1,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    optionText: { fontSize: 15, color: '#333333' },
    optionTextSelected: { color: '#0255AF', fontWeight: '700' },
    optionCheck: { fontSize: 15, color: '#0255AF', fontWeight: '700' },

    uploadBox: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
        borderRadius: 10, backgroundColor: '#F9F9F9', padding: 14,
    },
    uploadIcon: { width: 24, height: 24, resizeMode: 'contain', marginRight: 12 },
    uploadTitle: { fontSize: 14, fontWeight: '700', color: '#333333' },
    uploadSubtitle: { fontSize: 11, color: '#888888', marginTop: 2 },
    termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 20 },
    checkbox: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    checkboxIcon: { width: 24, height: 24, resizeMode: 'contain' },
    checkmark: { position: 'absolute', fontSize: 14, fontWeight: '700', color: '#0255AF' },
    termsText: { flex: 1, fontSize: 13, color: '#333333' },
    link: { color: '#2E6BE6', fontWeight: '600' },
    nextButton: {
        backgroundColor: '#0255AF', // fallback where the gradient isn't supported
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    footerText: { textAlign: 'center', fontSize: 13, color: '#333333', marginTop: 20 },
});

export default SignupScreen;