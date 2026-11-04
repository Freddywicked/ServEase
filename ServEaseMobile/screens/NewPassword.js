import React, { useState } from 'react';
import {
    View, Text, Image, TextInput, TouchableOpacity, Pressable, Keyboard, Alert,
    ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { resetPassword } from '../api/passwordReset';

// The Figma frame is 402 x 874. Positions and box sizes below are the Figma value times `s`,
// so the screen keeps the same proportions on any phone. Fonts, padding and radii match
// the Login screen so both screens look consistent.
const DESIGN_W = 402;
const DESIGN_H = 874;

const GRADIENT = ['#0255AF', '#04A5A5'];

// Same rule as the Signup screen / backend.
const isStrongPassword = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

const NewPassword = ({ navigation, route }) => {
    const { width, height } = useWindowDimensions();
    const s = Math.min(width / DESIGN_W, height / DESIGN_H);
    const px = (v) => v * s;

    const [form, setForm] = useState({ password: '', confirmPassword: '' });
    const [visible, setVisible] = useState({ password: false, confirmPassword: false });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Sent by OTPForgotPassword after the code was verified.
    const { email, resetToken } = route?.params || {};

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: '', general: '' } : prev));
    };

    const toggleVisible = (key) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

    const handleSubmit = async () => {
        Keyboard.dismiss();
        if (submitting) return;

        const nextErrors = {};
        if (!form.password) {
            nextErrors.password = 'Password is required.';
        } else if (!isStrongPassword(form.password)) {
            nextErrors.password = 'Use at least 8 characters with letters and numbers.';
        }
        if (!form.confirmPassword) {
            nextErrors.confirmPassword = 'Please confirm your password.';
        } else if (!nextErrors.password && form.password !== form.confirmPassword) {
            nextErrors.confirmPassword = 'Passwords do not match.';
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        if (!email || !resetToken) {
            setErrors({ general: 'Your reset session has expired. Please start again.' });
            return;
        }

        setSubmitting(true);
        try {
            // The backend hashes the password and saves it to the database.
            const res = await resetPassword(email, resetToken, form.password);
            Alert.alert(
                'Password updated',
                res.message || 'Your password has been updated. Please log in with your new password.',
                [{
                    text: 'OK',
                    onPress: () => navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] }),
                }],
                { cancelable: false },
            );
        } catch (err) {
            if (err.fieldErrors) {
                setErrors(err.fieldErrors);
            } else {
                setErrors({ general: err.message || 'Something went wrong. Please try again.' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    const renderPasswordField = ({ key, label, placeholder, returnKeyType, onSubmitEditing }) => (
        <View>
            <Text style={styles.label}>{label}</Text>
            <View
                style={[
                    styles.inputWrapper,
                    { minHeight: px(48) },
                    errors[key] ? styles.inputWrapperError : null,
                ]}
            >
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#B0B0B0"
                    value={form[key]}
                    onChangeText={(text) => updateField(key, text)}
                    secureTextEntry={!visible[key]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    editable={!submitting}
                />
                <TouchableOpacity
                    onPress={() => toggleVisible(key)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Image source={require('../assets/icon_eye.png')} style={styles.eyeIcon} />
                </TouchableOpacity>
            </View>

            {/* Reserved error area, so nothing below it jumps or overlaps */}
            <View style={{ minHeight: px(24) }}>
                {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
            </View>
        </View>
    );

    return (
        <Pressable style={styles.root} onPress={Keyboard.dismiss}>
            <View style={{ width: px(DESIGN_W), height: px(DESIGN_H), alignSelf: 'center' }}>
                {/* Logo */}
                <Image
                    source={require('../assets/logo_servease.png')}
                    style={{ position: 'absolute', left: px(102), top: px(51), width: px(198), height: px(198), resizeMode: 'contain' }}
                />

                {/* Back button (11 x 19) */}
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    style={{ position: 'absolute', left: px(41), top: px(79), width: px(11), height: px(19) }}
                >
                    <Image
                        source={require('../assets/icon_back_button.png')}
                        style={{ width: px(11), height: px(19), resizeMode: 'contain' }}
                    />
                </TouchableOpacity>

                {/* Title (the Figma frame uses "Forgot Password" here too) */}
                <Text style={[styles.title, { left: px(72), top: px(270), width: px(259) }]}>
                    Forgot Password
                </Text>

                {/* Fields + errors + button live in ONE column, so errors can never overlap
                    the fields or the button. */}
                <View style={{ position: 'absolute', left: px(33), top: px(322), width: px(336) }}>
                    {renderPasswordField({
                        key: 'password',
                        label: 'ENTER NEW PASSWORD',
                        placeholder: 'Create a password',
                        returnKeyType: 'next',
                    })}

                    {renderPasswordField({
                        key: 'confirmPassword',
                        label: 'CONFIRM PASSWORD',
                        placeholder: 'Confirm password',
                        returnKeyType: 'go',
                        onSubmitEditing: handleSubmit,
                    })}

                    {/* Submit button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSubmit}
                        disabled={submitting}
                        style={[styles.button, { marginTop: px(8) }, submitting && styles.buttonDisabled]}
                    >
                        <LinearGradient
                            colors={GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Submit</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}
                </View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#FFFFFF' },

    title: {
        position: 'absolute',
        textAlign: 'center',
        fontSize: 26,
        lineHeight: 32,
        fontWeight: '700',
        color: '#1B2A8C',
    },

    // Same label style as Login
    label: { fontSize: 11, fontWeight: '600', color: '#555555', letterSpacing: 1, marginBottom: 6 },

    // Same text box container as Login
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
    input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333333' },
    eyeIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: '#888888' },

    errorText: { color: '#E53935', fontSize: 11, marginTop: 4 },
    generalError: { color: '#E53935', fontSize: 12, textAlign: 'center', marginTop: 12 },

    // Same button look as Login's Sign In
    button: { borderRadius: 12, overflow: 'hidden' },
    buttonDisabled: { opacity: 0.7 },
    buttonGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default NewPassword;