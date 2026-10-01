import React, { useState } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { ACCOUNT_CREATED_KEY } from './SplashScreen';
import { login } from '../api/client';
import { useAuth, homeRouteFor } from '../context/auth_context';

const INITIAL_CREDENTIALS = {
    email: '', // email or username; the backend accepts both
    password: '',
};

const GRADIENT = ['#0255AF', '#04A5A5'];

const LoginScreen = ({ navigation }) => {
    const { setUser, setProvider } = useAuth();
    const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const updateCredential = (key, value) => {
        setCredentials((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: '', general: '' } : prev));
    };

    const validateForm = () => {
        const nextErrors = {};
        if (!credentials.email.trim()) {
            nextErrors.email = 'Email address is required.';
        }
        if (!credentials.password) {
            nextErrors.password = 'Password is required.';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSignIn = async () => {
        Keyboard.dismiss();
        if (submitting || !validateForm()) {
            return;
        }
        setSubmitting(true);
        try {
            const { user, provider } = await login(credentials.email, credentials.password);
            setUser(user);
            setProvider(provider);

            try {
                // An account exists on this device, so the splash can skip Get Started.
                await AsyncStorage.setItem(ACCOUNT_CREATED_KEY, 'true');
            } catch (storageError) {
                // Non-fatal.
            }

            // Returning users skip RoleSelectionScreen (only for brand-new accounts).
            // Verified providers -> provider dashboard; everyone else -> customer dashboard.
            navigation.reset({ index: 0, routes: [{ name: homeRouteFor(provider) }] });
        } catch (err) {
            if (err.status === 401) {
                setErrors({ password: 'Invalid email or password.' });
            } else if (err.fieldErrors) {
                setErrors(err.fieldErrors);
            } else {
                setErrors({ general: err.message || 'Something went wrong. Please try again.' });
            }
            setSubmitting(false);
        }
        // On success the screen is replaced, so submitting stays true to block double taps.
    };

    const handleForgotPassword = () => {
        // TODO: navigate to the Forgot Password screen once it is available.
    };

    const handleGoogleSignIn = () => {
        // TODO: integrate Google sign-in once the backend supports it.
    };

    const handleSignUp = () => {
        navigation.navigate('SignupScreen');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Welcome, User!</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>EMAIL ADDRESS</Text>
                    <View style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#B0B0B0"
                            value={credentials.email}
                            onChangeText={(text) => updateCredential('email', text)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="username"
                            returnKeyType="next"
                            editable={!submitting}
                        />
                    </View>
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>PASSWORD</Text>
                    <View style={[styles.inputWrapper, errors.password ? styles.inputWrapperError : null]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#B0B0B0"
                            value={credentials.password}
                            onChangeText={(text) => updateCredential('password', text)}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="password"
                            textContentType="password"
                            secureTextEntry={!passwordVisible}
                            returnKeyType="go"
                            onSubmitEditing={handleSignIn}
                            editable={!submitting}
                        />
                        <TouchableOpacity onPress={() => setPasswordVisible((prev) => !prev)}>
                            <Image source={require('../assets/icon_eye.png')} style={styles.eyeIcon} />
                        </TouchableOpacity>
                    </View>
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                    <TouchableOpacity onPress={handleForgotPassword}>
                        <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                </View>

                {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

                <TouchableOpacity
                    style={[styles.gradientButton, submitting && styles.buttonDisabled]}
                    onPress={handleSignIn}
                    disabled={submitting}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.signInGradient}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.signInButtonText}>Sign In</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={[styles.gradientButton, styles.googleButton]}
                    onPress={handleGoogleSignIn}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.googleGradient}
                    >
                        <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    Don't have an account?{' '}
                    <Text style={styles.link} onPress={handleSignUp}>Sign up</Text>
                </Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    container: { flex: 1, paddingHorizontal: 28 },
    logo: { width: 90, height: 90, resizeMode: 'contain', alignSelf: 'center', marginTop: 16 },
    title: {
        fontSize: 26, fontWeight: '700', color: '#1B2A8C', textAlign: 'center', marginTop: 8, marginBottom: 32,
    },
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
    generalError: { color: '#E53935', fontSize: 12, textAlign: 'center', marginBottom: 8 },
    input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333333' },
    eyeIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: '#888888' },
    forgotText: { alignSelf: 'flex-end', fontSize: 13, color: '#2E6BE6', fontWeight: '600', marginTop: 8 },
    gradientButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    buttonDisabled: { opacity: 0.7 },
    signInGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    signInButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
    dividerText: { fontSize: 13, color: '#888888', marginHorizontal: 12 },
    googleButton: { alignSelf: 'center', marginTop: 0 },
    googleGradient: { paddingVertical: 13, paddingHorizontal: 24, alignItems: 'center' },
    googleButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    footerText: { textAlign: 'center', fontSize: 13, color: '#333333', marginTop: 24 },
    link: { color: '#2E6BE6', fontWeight: '600' },
});

export default LoginScreen;