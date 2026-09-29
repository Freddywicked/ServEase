import React, { useState } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Credentials state is ready to be sent to the login API once integrated.
const INITIAL_CREDENTIALS = {
    email: '',
    password: '',
};

const LoginScreen = ({ navigation }) => {
    const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [errors, setErrors] = useState({});

    const updateCredential = (key, value) => {
        setCredentials((prev) => ({ ...prev, [key]: value }));
        // Clear the error as soon as the user starts fixing the field.
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const validateForm = () => {
        const nextErrors = {};
        if (!credentials.email.trim()) {
            nextErrors.email = 'Email address is required.';
        }
        if (!credentials.password.trim()) {
            nextErrors.password = 'Password is required.';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSignIn = () => {
        // TODO: send `credentials` to the login API endpoint.
        // All fields are required before proceeding to the next screen.
        if (!validateForm()) {
            return;
        }
        navigation.navigate('RoleSelectionScreen');
    };

    const handleForgotPassword = () => {
        // TODO: navigate to the Forgot Password screen once it is available.
    };

    const handleServiceProvider = () => {
        // TODO: navigate to the Service Provider sign-in flow once available.
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
                            secureTextEntry={!passwordVisible}
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

                <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
                    <Text style={styles.signInButtonText}>Sign In</Text>
                </TouchableOpacity>


                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
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
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        paddingHorizontal: 28,
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
        marginBottom: 32,
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
    forgotText: {
        alignSelf: 'flex-end',
        fontSize: 13,
        color: '#2E6BE6',
        fontWeight: '600',
        marginTop: 8,
    },
    signInButton: {
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 8,
    },
    signInButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    providerText: {
        textAlign: 'center',
        fontSize: 14,
        color: '#2E6BE6',
        fontWeight: '600',
        marginTop: 16,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    dividerText: {
        fontSize: 13,
        color: '#888888',
        marginHorizontal: 12,
    },
    googleButton: {
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 24,
        alignItems: 'center',
        alignSelf: 'center',
    },
    googleButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 13,
        color: '#333333',
        marginTop: 24,
    },
    link: {
        color: '#2E6BE6',
        fontWeight: '600',
    },
});

export default LoginScreen;

