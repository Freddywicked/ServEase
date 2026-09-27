import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCOUNT_CREATED_KEY } from './SplashScreen';

// Six one-time-passcode digits, ready to be sent to the verification API.
const OTP_LENGTH = 6;

const OTPVerification = ({ navigation, route }) => {
    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const inputRefs = useRef([]);

    // This screen is only displayed during account creation: SignupScreen
    // passes `fromSignup: true` when navigating here. Without it, send the
    // user back to the start of the signup flow.
    const isAccountCreation = route.params?.fromSignup === true;

    useEffect(() => {
        if (!isAccountCreation) {
            navigation.replace('SignupScreen');
        }
    }, [isAccountCreation, navigation]);

    const handleChange = (text, index) => {
        // Only accept single digits.
        const digit = text.replace(/[^0-9]/g, '').slice(-1);
        const nextOtp = [...otp];
        nextOtp[index] = digit;
        setOtp(nextOtp);
        // Clear the error as soon as the user starts fixing the code.
        if (error) {
            setError('');
        }

        // Auto-advance to the next box once a digit is entered.
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (event, index) => {
        // Move back to the previous box when deleting an empty box.
        if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSignIn = async () => {
        // All six digits are required before proceeding.
        if (otp.some((digit) => !digit)) {
            setError('Please enter the complete 6-digit code.');
            return;
        }
        // TODO: send `otp.join('')` to the OTP verification endpoint
        // once the backend is integrated, then navigate to Login.
        try {
            // Remember that an account exists so the splash screen skips the
            // Get Started button on the next app launch.
            await AsyncStorage.setItem(ACCOUNT_CREATED_KEY, 'true');
        } catch (storageError) {
            // Non-fatal: the splash will fall back to the Get Started flow.
        }
        navigation.navigate('LoginScreen');
    };

    // Render nothing while redirecting out of the account creation guard.
    if (!isAccountCreation) {
        return null;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>Verify your Phone number</Text>

                <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputRefs.current[index] = ref)}
                            style={[styles.otpBox, error ? styles.otpBoxError : null]}
                            value={digit}
                            onChangeText={(text) => handleChange(text, index)}
                            onKeyPress={(event) => handleKeyPress(event, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                        />
                    ))}
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
                    <Text style={styles.signInButtonText}>Verify</Text>
                </TouchableOpacity>
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
        marginBottom: 24,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
        marginBottom: 16,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
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
    otpBoxError: {
        borderWidth: 1,
        borderColor: '#E53935',
    },
    errorText: {
        color: '#E53935',
        fontSize: 11,
        marginBottom: 16,
    },
    signInButton: {
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    signInButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default OTPVerification;
