import React, { useEffect, useState } from 'react';
import {
    View, Text, Image, TextInput, TouchableOpacity, Pressable, Keyboard,
    ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { requestPasswordReset, verifyResetOtp } from '../api/passwordReset';

// The Figma frame is 402 x 874. Every size and position below is the Figma value times `s`.
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

                {/* Enter verification code */}
                <Text style={[styles.heading, { left: px(44), top: px(327), width: px(268) }]}>
                    Enter Verification code
                </Text>

                {/* Six code boxes */}
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <View
                        key={i}
                        pointerEvents="none"
                        style={[
                            styles.box,
                            { left: px(40 + 55 * i), top: px(366), width: px(44), height: px(61), borderRadius: px(10) },
                            i === activeIndex ? styles.boxActive : null,
                            error ? styles.boxError : null,
                        ]}
                    >
                        <Text style={styles.boxText}>{code[i] || ''}</Text>
                    </View>
                ))}

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
                    style={{
                        position: 'absolute', left: px(40), top: px(366), width: px(319), height: px(61), opacity: 0,
                    }}
                />

                {/* Resend line */}
                <Text style={[styles.resendRow, { left: px(40), top: px(446), width: px(319) }]}>
                    If you didn’t receive a code,{' '}
                    <Text
                        style={[styles.resend, resendDisabled && styles.resendDisabled]}
                        onPress={handleResend}
                    >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                    </Text>
                </Text>

                {/* Verify button */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleVerify}
                    disabled={verifying}
                    style={[
                        styles.button,
                        { left: px(40), top: px(473), width: px(319), height: px(46), borderRadius: px(8) },
                        verifying && styles.buttonDisabled,
                    ]}
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

                {/* Backend messages */}
                {error ? (
                    <Text style={[styles.message, styles.messageError, { left: px(40), top: px(529), width: px(319) }]}>{error}</Text>
                ) : info ? (
                    <Text style={[styles.message, styles.messageInfo, { left: px(40), top: px(529), width: px(319) }]}>{info}</Text>
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
    heading: {
        position: 'absolute',
        fontSize: 20,
        lineHeight: 25,
        fontWeight: '700',
        color: '#292727',
    },

    box: {
        position: 'absolute',
        backgroundColor: '#D9D9D9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    boxActive: { borderColor: '#0255AF' },
    boxError: { borderColor: '#E53935' },
    boxText: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#292727' },

    resendRow: {
        position: 'absolute',
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 14,
        fontWeight: '700',
        color: '#484040',
    },
    resend: { color: '#2E86FF' },
    resendDisabled: { color: '#9AB8E8' },

    button: {
        position: 'absolute',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.3)',
    },
    buttonDisabled: { opacity: 0.7 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '700' },

    message: { position: 'absolute', textAlign: 'center', fontSize: 12, lineHeight: 14 },
    messageError: { color: '#E53935' },
    messageInfo: { color: '#2E7D32' },
});

export default OTPForgotPassword;