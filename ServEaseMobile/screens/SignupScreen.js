import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Field definitions drive the form so inputs stay data-driven and easy to
// map to the backend payload once the signup API is integrated.
const INPUT_FIELDS = [
    { key: 'fullName', label: 'FULL NAME', placeholder: 'Juan Luna', keyboardType: 'default', autoCapitalize: 'words' },
    { key: 'email', label: 'EMAIL ADDRESS', placeholder: 'juanluna@gmail.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'phone', label: 'PHONE NUMBER', placeholder: '+63 912 345 6789', keyboardType: 'phone-pad', autoCapitalize: 'none' },
    { key: 'password', label: 'PASSWORD', placeholder: 'Create a password', secure: true, autoCapitalize: 'none' },
    { key: 'confirmPassword', label: 'CONFIRM PASSWORD', placeholder: 'Confirm password', secure: true, autoCapitalize: 'none' },
    { key: 'address', label: 'ADDRESS', placeholder: 'Street, Barangay, Municipality, Province', keyboardType: 'default', autoCapitalize: 'words' },
];

const INITIAL_FORM = {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    validId: null,
    agreedToTerms: false,
};

// Inline error shown under each required field when it is left empty.
const REQUIRED_MESSAGES = {
    fullName: 'Full name is required.',
    email: 'Email address is required.',
    phone: 'Phone number is required.',
    password: 'Password is required.',
    confirmPassword: 'Please confirm your password.',
    address: 'Address is required.',
};

const SignupScreen = ({ navigation }) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [passwordVisible, setPasswordVisible] = useState({});
    const [errors, setErrors] = useState({});

    const updateField = (key, value) => {
        setForm((prevForm) => ({ ...prevForm, [key]: value }));
        // Clear the error as soon as the user starts fixing the field.
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const togglePasswordVisibility = (key) => {
        setPasswordVisible((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleUploadId = () => {
        // TODO: open a file/image picker and store the selected ID in `form.validId`
        // when the backend upload endpoint is integrated.
    };

    const validateForm = () => {
        const nextErrors = {};

        // Every text field must be filled (whitespace-only does not count).
        INPUT_FIELDS.forEach(({ key }) => {
            if (!form[key].trim()) {
                nextErrors[key] = REQUIRED_MESSAGES[key];
            }
        });

        if (
            !nextErrors.password &&
            !nextErrors.confirmPassword &&
            form.password !== form.confirmPassword
        ) {
            nextErrors.confirmPassword = 'Passwords do not match.';
        }

        if (!form.agreedToTerms) {
            nextErrors.agreedToTerms = 'Please agree to the Terms of Service and Privacy Policy.';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleNext = () => {
        // TODO: validate and send the `form` payload to the signup API endpoint,
        // then navigate to OTP verification after a successful signup.
        // All fields are required before proceeding to the next screen.
        if (!validateForm()) {
            return;
        }
        // OTP verification is part of account creation only; this param lets
        // OTPVerification enforce that it was reached from the signup flow.
        navigation.navigate('OTPVerification', { fromSignup: true });
    };

    const handleLoginPress = () => {
        navigation.navigate('LoginScreen');
    };

    const renderField = ({ key, label, placeholder, keyboardType, autoCapitalize, secure }) => (
        <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputWrapper, errors[key] ? styles.inputWrapperError : null]}>
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#B0B0B0"
                    value={form[key]}
                    onChangeText={(text) => updateField(key, text)}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    secureTextEntry={secure && !passwordVisible[key]}
                />
                {secure && (
                    <TouchableOpacity onPress={() => togglePasswordVisibility(key)}>
                        <Image source={require('../assets/icon_eye.png')} style={styles.eyeIcon} />
                    </TouchableOpacity>
                )}
            </View>
            {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Create your account</Text>

                {INPUT_FIELDS.map(renderField)}

                <View style={styles.termsRow}>
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
                {errors.agreedToTerms ? (
                    <Text style={styles.errorText}>{errors.agreedToTerms}</Text>
                ) : null}

                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    Already have an account?{' '}
                    <Text style={styles.link} onPress={handleLoginPress}>Log in</Text>
                </Text>
            </ScrollView>
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
        width: 90,
        height: 90,
        resizeMode: 'contain',
        alignSelf: 'center',
        marginTop: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#1B2A8C',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
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
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        paddingHorizontal: 14,
    },
    inputWrapperError: {
        borderColor: '#E53935',
    },
    errorText: {
        color: '#E53935',
        fontSize: 11,
        marginTop: 4,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
    },
    eyeIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: '#888888',
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
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    checkbox: {
        width: 26,
        height: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    checkboxIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    checkmark: {
        position: 'absolute',
        fontSize: 14,
        fontWeight: '700',
        color: '#0255AF',
    },
    termsText: {
        flex: 1,
        fontSize: 13,
        color: '#333333',
    },
    link: {
        color: '#2E6BE6',
        fontWeight: '600',
    },
    nextButton: {
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 13,
        color: '#333333',
        marginTop: 20,
    },
});

export default SignupScreen;

