import React, { useState } from 'react';
import {
    View, Text, Image, TextInput, TouchableOpacity, Pressable, Keyboard, Alert,
    ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { resetPassword } from '../api/passwordReset';

// The Figma frame is 402 x 874. Every size and position below is the Figma value times `s`,
// so the screen keeps the same proportions on any phone.
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
        setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
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
            setSubmitting(false);
        }
    };

    const renderPasswordField = ({ key, label, placeholder, top }) => (
        <View style={{ position: 'absolute', left: px(39), top: px(top), width: px(325) }}>
            <Text style={styles.label}>{label}</Text>
            <View
                style={[
                    styles.textbox,
                    { height: px(40), padding: px(8), borderRadius: px(6), marginTop: px(4) },
                    errors[key] ? styles.textboxError : null,
                ]}
            >
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#A6A6A6"
                    value={form[key]}
                    onChangeText={(text) => updateField(key, text)}
                    secureTextEntry={!visible[key]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    returnKeyType={key === 'password' ? 'next' : 'go'}
                    onSubmitEditing={key === 'confirmPassword' ? handleSubmit : undefined}
                />
                <TouchableOpacity
                    onPress={() => toggleVisible(key)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginLeft: px(10) }}
                >
                    <Image
                        source={require('../assets/icon_eye.png')}
                        style={{ width: px(14.69), height: px(14.69), resizeMode: 'contain', tintColor: '#000000', opacity: 0.75 }}
                    />
                </TouchableOpacity>
            </View>
            {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
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

                {renderPasswordField({ key: 'password', label: 'ENTER NEW PASSWORD', placeholder: 'Create a password', top: 324 })}
                {renderPasswordField({ key: 'confirmPassword', label: 'CONFIRM PASSWORD', placeholder: 'Confirm password', top: 395 })}

                {/* Submit button */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={[
                        styles.button,
                        { left: px(39), top: px(473), width: px(325), height: px(46), borderRadius: px(8) },
                        submitting && styles.buttonDisabled,
                    ]}
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

                {errors.general ? (
                    <Text style={[styles.generalError, { left: px(39), top: px(529), width: px(325) }]}>{errors.general}</Text>
                ) : null}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#FFFFFF' },

    title: {
        position: 'absolute',
        textAlign: 'center',
        fontSize: 24,
        lineHeight: 30,
        fontWeight: '700',
        color: '#021E79',
    },

    label: {
        fontSize: 9,
        lineHeight: 11,
        fontWeight: '700',
        letterSpacing: 1.8, // 0.2em
        textTransform: 'uppercase',
        color: '#000000',
    },
    textbox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#A6A6A6',
    },
    textboxError: { borderColor: '#E53935' },
    input: {
        flex: 1,
        padding: 0,
        fontSize: 12,
        lineHeight: 14,
        color: '#333333',
        includeFontPadding: false,
    },
    errorText: { color: '#E53935', fontSize: 10, lineHeight: 12, marginTop: 1 },

    button: {
        position: 'absolute',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.3)',
    },
    buttonDisabled: { opacity: 0.7 },
    generalError: { position: 'absolute', textAlign: 'center', color: '#E53935', fontSize: 12, lineHeight: 14 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '700' },
});

export default NewPassword;