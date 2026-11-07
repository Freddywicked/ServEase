import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
    BackHandler,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { requestPhoneOtp, verifyPhoneOtp } from '../api/client';
import { useAuth, homeRouteFor } from '../context/auth_context';

// Shown right after a FIRST-TIME Google sign-in: Google provides no phone number,
// but ServEase requires one verified number per account (BR-01). Step 1 texts an
// OTP to the entered PH mobile number (POST /auth/phone/request-otp); step 2
// verifies it and attaches the number to the account (POST /auth/phone/verify).
const PHONE_RE = /^(09|\+639)\d{9}$/;
const GRADIENT = ['#0255AF', '#04A5A5'];

const CompleteProfileScreen = ({ navigation }) => {
    const { setUser, refreshUser, signOut } = useAuth();
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const normalizedPhone = phone.trim().replace(/[\s-]/g, '');

    // Bail out of phone setup. signOut() clears BOTH the saved ServEase token
    // (loginWithGoogle stores it before needsPhone is known) and the cached Google
    // account, so the next tap on "Continue with Google" shows the account picker
    // instead of silently re-using the same account and looping straight back here.
    const handleUseDifferentAccount = useCallback(async () => {
        try {
            await signOut();
        } catch {
            // Best-effort: leave the screen even if sign-out itself fails.
        }
        navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    }, [signOut, navigation]);

    // This screen is reached via navigation.reset, so Android Back would otherwise
    // just exit the app and leave the half-authenticated session behind. Make it
    // behave exactly like the "use a different account" link.
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleUseDifferentAccount();
            return true;
        });
        return () => subscription.remove();
    }, [handleUseDifferentAccount]);

    const handleSendCode = async () => {
        Keyboard.dismiss();
        setError('');
        if (!PHONE_RE.test(normalizedPhone)) {
            setError('Enter a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX).');
            return;
        }
        setSubmitting(true);
        try {
            await requestPhoneOtp(normalizedPhone);
            setOtpSent(true);
        } catch (err) {
            setError(err.message || 'Failed to send the code. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerify = async () => {
        Keyboard.dismiss();
        setError('');
        const code = otp.trim();
        if (!/^\d{6}$/.test(code)) {
            setError('Please enter the 6-digit code.');
            return;
        }
        setSubmitting(true);
        try {
            const data = await verifyPhoneOtp(normalizedPhone, code);
            if (data?.user) setUser(data.user);
            // Refresh so provider status is current, then land on the right dashboard.
            const fresh = await refreshUser();
            navigation.reset({ index: 0, routes: [{ name: homeRouteFor(fresh.provider) }] });
        } catch (err) {
            setError(err.message || 'Verification failed. Please try again.');
            setSubmitting(false);
        }
        // On success the screen is replaced, so submitting stays true to block double taps.
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>One more step</Text>
                <Text style={styles.subtitle}>
                    Your Google account is connected. Add and verify your mobile number to finish
                    setting up your ServEase account.
                </Text>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Text style={styles.label}>PHONE NUMBER</Text>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="09XX XXX XXXX"
                        placeholderTextColor="#B0B0B0"
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        value={phone}
                        onChangeText={setPhone}
                        editable={!otpSent}
                    />
                </View>

                {!otpSent ? (
                    <TouchableOpacity
                        style={styles.gradientButton}
                        onPress={handleSendCode}
                        disabled={submitting}
                        activeOpacity={0.8}
                    >
                        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
                            {submitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Send verification code</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <>
                        <Text style={styles.label}>VERIFICATION CODE</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="6-digit code"
                                placeholderTextColor="#B0B0B0"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={otp}
                                onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.gradientButton}
                            onPress={handleVerify}
                            disabled={submitting}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
                                {submitting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Verify and continue</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <Text
                            style={styles.link}
                            onPress={() => {
                                setOtpSent(false);
                                setOtp('');
                                setError('');
                            }}
                        >
                            Use a different number / resend code
                        </Text>
                    </>
                )}

                <Text style={styles.link} onPress={handleUseDifferentAccount}>
                    Use a different Google account
                </Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    container: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
    title: {
        fontSize: 26, fontWeight: '700', color: '#1B2A8C', textAlign: 'center', marginBottom: 12,
    },
    subtitle: { fontSize: 13, color: '#888888', textAlign: 'center', lineHeight: 19, marginBottom: 28 },
    errorText: { color: '#E53935', fontSize: 12, textAlign: 'center', marginBottom: 12 },
    label: { fontSize: 11, fontWeight: '600', color: '#555555', letterSpacing: 1, marginBottom: 6 },
    inputWrapper: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        paddingHorizontal: 14,
        marginBottom: 16,
    },
    input: { paddingVertical: 12, fontSize: 14, color: '#333333' },
    gradientButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    gradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    link: { textAlign: 'center', fontSize: 13, color: '#2E6BE6', fontWeight: '600', marginTop: 20 },
});

export default CompleteProfileScreen;

