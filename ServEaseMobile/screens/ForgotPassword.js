import React, { useState } from 'react';
import {
    View, Text, Image, TextInput, TouchableOpacity, Pressable, Keyboard,
    ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { requestPasswordReset } from '../api/passwordReset';

// The Figma frame is 402 x 874. Every size and position below is the Figma value times `s`,
// so the screen keeps the same proportions on any phone.
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

                {/* Email field */}
                <View style={{ position: 'absolute', left: px(33), top: px(345), width: px(325) }}>
                    <Text style={styles.label}>ENTER EMAIL ADDRESS</Text>
                    <View
                        style={[
                            styles.textbox,
                            { height: px(40), padding: px(8), borderRadius: px(6), marginTop: px(4) },
                            error ? styles.textboxError : null,
                        ]}
                    >
                        <TextInput
                            style={styles.input}
                            placeholder="juanluna@gmail.com"
                            placeholderTextColor="#A6A6A6"
                            value={email}
                            onChangeText={handleChangeEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            returnKeyType="send"
                            onSubmitEditing={handleSubmit}
                        />
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                {/* Submit button */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={[
                        styles.button,
                        { left: px(33), top: px(414), width: px(325), height: px(46), borderRadius: px(8) },
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
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '700' },
});

export default ForgotPassword;