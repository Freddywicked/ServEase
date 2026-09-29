import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Image,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage flag set once the user finishes creating an account (OTP verification).
export const ACCOUNT_CREATED_KEY = '@servease/accountCreated';

// The splash always stays visible for at least this long. On a fresh install
// the Get Started button appears afterwards; returning users are routed
// straight to the login screen once the time has elapsed.
const MIN_SPLASH_DURATION_MS = 3000;

const SplashScreen = ({ navigation }) => {
    const [showGetStarted, setShowGetStarted] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let isMounted = true;
        let timer;

        const bootstrap = async () => {
            const startedAt = Date.now();

            let accountCreated = false;
            try {
                accountCreated = (await AsyncStorage.getItem(ACCOUNT_CREATED_KEY)) === 'true';
            } catch (error) {
                // Storage unavailable: fall back to the first-launch flow so the
                // user can still move forward manually.
                accountCreated = false;
            }

            // Guarantee the splash loads for at least MIN_SPLASH_DURATION_MS.
            const elapsed = Date.now() - startedAt;
            const remaining = Math.max(MIN_SPLASH_DURATION_MS - elapsed, 0);

            timer = setTimeout(() => {
                if (!isMounted) {
                    return;
                }
                if (accountCreated) {
                    // Returning user: skip the button and go straight to login.
                    // `replace` keeps the splash out of the back stack.
                    navigation.replace('LoginScreen');
                } else {
                    // Fresh install: reveal the Get Started button.
                    setShowGetStarted(true);
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }).start();
                }
            }, remaining);
        };

        bootstrap();

        return () => {
            isMounted = false;
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [navigation, fadeAnim]);

    return (
        <View style={styles.container}>
            <Image source={require('../assets/logo_servease.png')} style={styles.logo} />

            {!showGetStarted && (
                <ActivityIndicator style={styles.loader} color="#FFFFFF" size="large" />
            )}

            {showGetStarted && (
                <Animated.View style={[styles.buttonWrapper, { opacity: fadeAnim }]}>
                    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('LoginScreen')}>
                        <View style={styles.buttonGradient}>
                            <Text style={styles.buttonText}>Get Started</Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundImage: 'linear-gradient(#00BABA 0%, #0255AF 55%, #04A5A5 100%)',
    },
    logo: {
        width: 220,
        height: 170,
        resizeMode: 'contain',
        position: 'absolute',
        top: '38%',
    },
    loader: {
        position: 'absolute',
        bottom: 80,
    },
    buttonWrapper: {
        position: 'absolute',
        bottom: 60,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        paddingVertical: 15,
        paddingHorizontal: 80,
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
    },
    buttonText: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default SplashScreen;