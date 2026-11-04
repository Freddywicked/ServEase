import React, { useEffect, useState } from 'react';
import {
    View, Text, Image, TextInput, TouchableOpacity, Pressable, Keyboard,
    ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { requestPasswordReset, verifyResetOtp } from '../api/passwordReset';

// The Figma frame is 402 x 874. Positions and box sizes below are the Figma value times `s`,
// so the screen keeps the same proportions on any phone. The code boxes, numbers and fonts
// match the OTP Verification screen so both screens look consistent.
const DESIGN_W = 402;
const DESIGN_H = 874;

const GRADIENT = ['#0255AF', '#04A5A5'];
const OTP_LENGTH = 6; // matches the six boxes in the design and the backend's code length

const OTPForgotPassword = ({ navigation, route }) => {
    const { width, height } = useWindowDimensions();
    const s = Math.min(width / DESIGN_W, height / DESIGN_H);
    const px = (v) => v * s;

    // Sent by ForgotPassword after the code was requested.
    const { email, resendAfter } = route?.params || {};

    const [code, setCode] = useState('');
    const [focused, setFocused] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(Number(resendAfter) || 0);

    // Resend countdown (seconds come from the backend).
    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleChange = (text) => {
        setCode(text.replace(/\D/g, '').slice(0, OTP_LENGTH));
        setError('');
        setInfo('');
    };

    const handleVerify = async () => {
        Keyboard.dismiss();
        if (verifying) return;

        if (!email) {
            setError('Your session has expired. Please start again.');
            return;
        }
        if (code.length !== OTP_LENGTH) {
            setError(`Enter the ${OTP_LENGTH}-digit code.`);
            return;
        }

        setVerifying(true);
        setError('');
        try {
            const { resetToken } = await verifyResetOtp(email, code);
            navigation.navigate('NewPassword', { email, resetToken });
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            setCode('');
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        if (resending || cooldown > 0 || !email) return;
        setResending(true);
        setError('');
        setInfo('');
        try {
            const res = await requestPasswordReset(email);
            setCode('');
            setCooldown(Number(res.resendAfter) || 0);
            setInfo(res.message || '');
        } catch (err) {
            setError(err.message || 'Could not resend the code. Please try again.');
        } finally {
            setResending(false);
        }
    };

    const activeIndex = focused && code.length < OTP_LENGTH ? code.length : -1;
    const resendDisabled = cooldown > 0 || resending;

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

                {/* Heading + code boxes + messages + resend + button live in ONE column,
                    so nothing can overlap. The message slot reserves space even when empty,
                    so the layout does not jump when a message appears. */}
                <View style={{ position: 'absolute', left: px(33), top: px(322), width: px(336) }}>
                    <Text style={styles.heading}>Enter Verification code</Text>

                    {/* Six code boxes (same look as OTP Verification) */}
                    <View style={{ height: px(56) }}>
                        <View style={styles.otpRow} pointerEvents="none">
                            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.otpBox,
                                        { width: px(48), height: px(56) },
                                        i === activeIndex ? styles.otpBoxActive : null,
                                        error ? styles.otpBoxError : null,
                                        verifying ? styles.otpBoxDisabled : null,
                                    ]}
                                >
                                    <Text style={styles.otpText}>{code[i] || ''}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Invisible input laid over the boxes: handles typing, paste and SMS/email autofill */}
                        <TextInput
                            value={code}
                            onChangeText={handleChange}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            selection={{ start: code.length, end: code.length }}
                            keyboardType="number-pad"
                            maxLength={OTP_LENGTH}
                            textContentType="oneTimeCode"
                            autoComplete="sms-otp"
                            autoFocus
                            caretHidden
                            editable={!verifying}
                            onSubmitEditing={handleVerify}
                            style={styles.hiddenInput}
                        />
                    </View>

                    {/* Backend messages (reserved area) */}
                    <View style={{ minHeight: px(32), paddingTop: px(8) }}>
                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : info ? (
                            <Text style={styles.infoText}>{info}</Text>
                        ) : null}
                    </View>

                    {/* Resend line */}
                    <Text style={styles.resendText}>
                        If you didn’t receive a code,{' '}
                        <Text
                            style={resendDisabled ? styles.resendDisabled : styles.link}
                            onPress={handleResend}
                        >
                            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                        </Text>
                    </Text>

                    {/* Verify button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleVerify}
                        disabled={verifying}
                        style={[styles.button, { marginTop: px(16) }, verifying && styles.buttonDisabled]}
                    >
                        <LinearGradient
                            colors={GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            {verifying ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Verify</Text>
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

    // Same title as OTP Verification
    title: {
        position: 'absolute',
        textAlign: 'center',
        fontSize: 26,
        lineHeight: 32,
        fontWeight: '700',
        color: '#1B2A8C',
    },
    // Same as OTP Verification's subtitle
    heading: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 12 },

    // Same code boxes as OTP Verification
    otpRow: { flexDirection: 'row', justifyContent: 'space-between' },
    otpBox: {
        borderRadius: 10,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    otpBoxActive: { borderColor: '#0255AF' },
    otpBoxError: { borderColor: '#E53935' },
    otpBoxDisabled: { opacity: 0.5 },
    otpText: { fontSize: 20, fontWeight: '600', color: '#333333' },
    hiddenInput: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0 },

    errorText: { color: '#E53935', fontSize: 11 },
    infoText: { color: '#2E7D32', fontSize: 11 },

    // Same resend line as OTP Verification
    resendText: { textAlign: 'center', fontSize: 13, color: '#333333' },
    resendDisabled: { color: '#999999' },
    link: { color: '#2E6BE6', fontWeight: '600' },

    // Same button look as OTP Verification's Verify
    button: { borderRadius: 12, overflow: 'hidden' },
    buttonDisabled: { opacity: 0.6 },
    buttonGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default OTPForgotPassword;