import React, { useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/auth_context';

// Shown once, right after a brand-new account finishes sign-up
// (SignupScreen -> OTPVerification -> here). The user is already logged in:
// register() saved the token and OTPVerification called setUser().
// Returning users never see this screen; LoginScreen sends them straight to a dashboard.
const RoleSelectionScreen = ({ navigation }) => {
    const { user, restoring } = useAuth();

    // Only for logged-in users. If there's no session (e.g. token expired), go to Login.
    useEffect(() => {
        if (!restoring && !user) {
            navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
        }
    }, [restoring, user, navigation]);

    const handleSelectCustomer = () => {
        // Every account is already a customer on the backend (BR-02), so nothing to save.
        // reset() so the Back button doesn't return to this screen.
        navigation.reset({ index: 0, routes: [{ name: 'CustomerDashboard' }] });
    };

    const handleSelectServiceProvider = () => {
        // Provider application flow. The application is sent (with this user's token)
        // to POST /api/providers/application at the end of that flow. navigate() keeps
        // this screen underneath, so the user can go back and pick Customer instead.
        navigation.navigate('ServiceProviderServiceCategory');
    };

    if (restoring || !user) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.center]}>
                <ActivityIndicator size="large" color="#0255AF" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />

                <Text style={styles.title}>Continue as</Text>

                <TouchableOpacity style={styles.roleButton} onPress={handleSelectCustomer} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.roleButtonGradient}
                    >
                        <Text style={styles.roleButtonText}>Customer</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.roleButton} onPress={handleSelectServiceProvider} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.roleButtonGradient}
                    >
                        <Text style={styles.roleButtonText}>Service Provider</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, paddingHorizontal: 28 },
    logo: { width: 90, height: 90, resizeMode: 'contain', alignSelf: 'center', marginTop: 60 },
    title: {
        fontSize: 22, fontWeight: '700', color: '#1B2A8C', textAlign: 'center', marginTop: 70, marginBottom: 28,
    },
    roleButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
    roleButtonGradient: { paddingVertical: 15, alignItems: 'center' },
    roleButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default RoleSelectionScreen;