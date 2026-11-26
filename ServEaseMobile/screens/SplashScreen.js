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
import { homeRouteFor, useAuth } from '../context/auth_context';

// Storage flag set once the user finishes creating an account (OTP verification).
export const ACCOUNT_CREATED_KEY = '@servease/accountCreated';

// The splash always stays visible for at least this long. It then follows the
// restored authentication state: authenticated users go home; only logged-out
// returning users go to LoginScreen; fresh installs reveal Get Started.
const MIN_SPLASH_DURATION_MS = 3000;

const SplashScreen = ({ navigation }) => {
    const { user, provider, restoring } = useAuth();
    const [showGetStarted, setShowGetStarted] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    // The one-shot bootstrap timer reads the latest auth result without
    // restarting the minimum splash duration whenever restoration completes.
    const authRef = useRef({ user, provider, restoring });
    authRef.current = { user, provider, restoring };

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

            const finishSplash = () => {
                if (!isMounted) return;
                const currentAuth = authRef.current;
                if (currentAuth.restoring) {
                    timer = setTimeout(finishSplash, 100);
                    return;
                }
                if (currentAuth.user) {
                    // A saved JWT that passed /auth/me is an active login. Never
                    // represent that session with the logged-out login screen.
                    navigation.replace(homeRouteFor(currentAuth.provider));
                } else if (accountCreated) {
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
            };

            timer = setTimeout(finishSplash, remaining);
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