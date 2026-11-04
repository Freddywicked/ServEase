import React, { useState } from 'react';
import {
    View, Text, Image, TextInput, TouchableOpacity, Pressable, Keyboard,
    ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { requestPasswordReset } from '../api/passwordReset';

// The Figma frame is 402 x 874. Positions and box sizes below are the Figma value times `s`,
// so the screen keeps the same proportions on any phone. Fonts, padding and radii match
// the Login screen so both screens look consistent.
const DESIGN_W = 402;
const DESIGN_H = 874;

const GRADIENT = ['#0255AF', '#04A5A5'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = ({ navigation }) => {
    const { width, height } = useWindowDimensions();
    const s = Math.min(width / DESIGN_W, height / DESIGN_H);
    const px = (v) => v * s;

    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleChangeEmail = (text) => {
        setEmail(text);
        if (error) setError('');
    };

    const handleSubmit = async () => {
        Keyboard.dismiss();
        if (submitting) return;

        if (!email.trim()) {
            setError('Email address is required.');
            return;
        }
        if (!EMAIL_RE.test(email.trim())) {
            setError('Enter a valid email address.');
            return;
        }

        setSubmitting(true);
        try {
            // The backend emails a one-time code (and answers the same for unknown emails).
            const res = await requestPasswordReset(email);
            navigation.navigate('OTPForgotPassword', {
                email: email.trim().toLowerCase(),
                resendAfter: res.resendAfter,
            });
        } catch (err) {
            setError((err.fieldErrors && err.fieldErrors.email) || err.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

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

                {/* Title */}
                <Text style={[styles.title, { left: px(72), top: px(270), width: px(259) }]}>
                    Forgot Password
                </Text>

                {/* Field + error + button live in ONE column, so the error can never overlap
                    the button. The error slot reserves space even when empty, so the button
                    does not jump when an error appears. */}
                <View style={{ position: 'absolute', left: px(33), top: px(345), width: px(336) }}>
                    <Text style={styles.label}>ENTER EMAIL ADDRESS</Text>

                    <View
                        style={[
                            styles.inputWrapper,
                            { minHeight: px(48) },
                            error ? styles.inputWrapperError : null,
                        ]}
                    >
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#B0B0B0"
                            value={email}
                            onChangeText={handleChangeEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            returnKeyType="send"
                            onSubmitEditing={handleSubmit}
                            editable={!submitting}
                        />
                    </View>

                    {/* Reserved error area */}
                    <View style={{ minHeight: px(24) }}>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    </View>

                    {/* Submit button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSubmit}
                        disabled={submitting}
                        style={[styles.button, { marginTop: px(16) }, submitting && styles.buttonDisabled]}
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

    errorText: { color: '#E53935', fontSize: 11, marginTop: 4 },

    // Same button look as Login's Sign In
    button: { borderRadius: 12, overflow: 'hidden' },
    buttonDisabled: { opacity: 0.7 },
    buttonGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default ForgotPassword;