import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCOUNT_CREATED_KEY } from './SplashScreen';
import { requestOtp, register } from '../api/client';
import { useAuth } from '../context/auth_context';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30; // matches otp.resendCooldownSeconds on the backend

const OTPVerification = ({ navigation, route }) => {
    const { setUser } = useAuth();
    const form = route.params?.form;

    // Only reachable from SignupScreen, which passes `fromSignup: true` and the form.
    const isAccountCreation = route.params?.fromSignup === true && !!form;

    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const [sendStatus, setSendStatus] = useState('sending'); // 'sending' | 'sent' | 'failed'
    const [sendError, setSendError] = useState('');
    const [sendFieldErrors, setSendFieldErrors] = useState(null);
    const [cooldown, setCooldown] = useState(0);
    const [verifying, setVerifying] = useState(false);

    const inputRefs = useRef([]);
    const hasRequestedRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!isAccountCreation) {
            navigation.replace('SignupScreen');
        }
    }, [isAccountCreation, navigation]);

    const sendOtp = useCallback(async () => {
        setSendStatus('sending');
        setSendError('');
        setSendFieldErrors(null);
        setError('');
        try {
            await requestOtp(form);
            if (!isMountedRef.current) return;
            setSendStatus('sent');
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setOtp(Array(OTP_LENGTH).fill(''));
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } catch (err) {
            if (!isMountedRef.current) return;
            setSendStatus('failed');
            setSendError(err.message || 'We could not send the code. Please try again.');
            setSendFieldErrors(err.fieldErrors || null);
        }
    }, [form]);

    // Send the code once when the screen opens.
    useEffect(() => {
        if (!isAccountCreation || hasRequestedRef.current) return;
        hasRequestedRef.current = true;
        sendOtp();
    }, [isAccountCreation, sendOtp]);

    // Resend countdown.
    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Go back to the existing SignupScreen (typed values are kept) and highlight bad fields.
    // popTo exists in React Navigation 7; in v6, navigate() returns to the existing screen.
    const handleEditDetails = () => {
        const params = { serverErrors: sendFieldErrors };
        if (typeof navigation.popTo === 'function') navigation.popTo('SignupScreen', params);
        else navigation.navigate('SignupScreen', params);
    };

    const handleChange = (text, index) => {
        const digits = text.replace(/[^0-9]/g, '');

        // Pasted / autofilled full code: spread it across the boxes.
        if (digits.length > 1) {
            const nextOtp = Array(OTP_LENGTH).fill('');
            digits.slice(0, OTP_LENGTH).split('').forEach((d, i) => { nextOtp[i] = d; });
            setOtp(nextOtp);
            if (error) setError('');
            inputRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
            return;
        }

        const nextOtp = [...otp];
        nextOtp[index] = digits;
        setOtp(nextOtp);
        if (error) setError('');
        if (digits && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (event, index) => {
        if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        if (sendStatus !== 'sent' || verifying) return;
        if (otp.some((digit) => !digit)) {
            setError('Please enter the complete 6-digit code.');
            return;
        }
        setVerifying(true);
        try {
            const user = await register(form, otp.join(''));
            setUser(user);
            try {
                // Remember that an account exists so the splash screen skips Get Started.
                await AsyncStorage.setItem(ACCOUNT_CREATED_KEY, 'true');
            } catch (storageError) {
                // Non-fatal: the splash will fall back to the Get Started flow.
            }
            navigation.reset({ index: 0, routes: [{ name: 'RoleSelectionScreen' }] });
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.message || 'Verification failed. Please try again.');
            }
        } finally {
            if (isMountedRef.current) setVerifying(false);
        }
    };

    if (!isAccountCreation) {
        return null;
    }

    const canVerify = sendStatus === 'sent' && !verifying;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>Verify your Phone number</Text>

                {sendStatus === 'sending' && (
                    <View style={styles.statusRow}>
                        <ActivityIndicator size="small" color="#0255AF" />
                        <Text style={styles.statusInline}>  Sending a code to {form.phone}...</Text>
                    </View>
                )}
                {sendStatus === 'sent' && (
                    <Text style={styles.statusText}>
                        Enter the 6-digit code sent to <Text style={styles.bold}>{form.phone}</Text>.
                    </Text>
                )}
                {sendStatus === 'failed' && (
                    <View style={styles.failedBox}>
                        <Text style={styles.failedText}>{sendError}</Text>
                        <View style={styles.failedActions}>
                            <Text style={styles.link} onPress={sendOtp}>Try again</Text>
                            <Text style={styles.link} onPress={handleEditDetails}>Edit details</Text>
                        </View>
                    </View>
                )}

                <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputRefs.current[index] = ref)}
                            style={[
                                styles.otpBox,
                                error ? styles.otpBoxError : null,
                                !canVerify ? styles.otpBoxDisabled : null,
                            ]}
                            value={digit}
                            onChangeText={(text) => handleChange(text, index)}
                            onKeyPress={(event) => handleKeyPress(event, index)}
                            keyboardType="number-pad"
                            textContentType="oneTimeCode"
                            autoComplete="sms-otp"
                            maxLength={index === 0 ? OTP_LENGTH : 1}
                            editable={canVerify}
                        />
                    ))}
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                    style={[styles.signInButton, !canVerify && styles.buttonDisabled]}
                    onPress={handleVerify}
                    disabled={!canVerify}
                >
                    <Text style={styles.signInButtonText}>{verifying ? 'Verifying...' : 'Verify'}</Text>
                </TouchableOpacity>

                {sendStatus === 'sent' && (
                    <Text style={styles.resendText}>
                        Didn't receive the code?{' '}
                        {cooldown > 0 ? (
                            <Text style={styles.resendDisabled}>Resend in {cooldown}s</Text>
                        ) : (
                            <Text style={styles.link} onPress={sendOtp}>Resend</Text>
                        )}
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    container: { flex: 1, paddingHorizontal: 28 },
    logo: { width: 90, height: 90, resizeMode: 'contain', alignSelf: 'center', marginTop: 16 },
    title: { fontSize: 26, fontWeight: '700', color: '#1B2A8C', textAlign: 'center', marginTop: 8, marginBottom: 24 },
    subtitle: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    statusInline: { fontSize: 13, color: '#666666' },
    statusText: { fontSize: 13, color: '#666666', marginBottom: 16 },
    bold: { fontWeight: '700', color: '#333333' },
    failedBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginBottom: 16 },
    failedText: { color: '#E53935', fontSize: 13 },
    failedActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
    otpBox: {
        width: 48,
        height: 56,
        borderRadius: 10,
        backgroundColor: '#F0F0F0',
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '600',
        color: '#333333',
    },
    otpBoxError: { borderWidth: 1, borderColor: '#E53935' },
    otpBoxDisabled: { opacity: 0.5 },
    errorText: { color: '#E53935', fontSize: 11, marginTop: -20, marginBottom: 16 },
    signInButton: {
        backgroundColor: '#0255AF',
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    signInButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    resendText: { textAlign: 'center', fontSize: 13, color: '#333333', marginTop: 20 },
    resendDisabled: { color: '#999999' },
    link: { color: '#2E6BE6', fontWeight: '600' },
});

export default OTPVerification;