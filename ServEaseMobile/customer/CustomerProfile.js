import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';

const CustomerProfile = ({ navigation }) => {
    // `user` and `provider` come from auth_context, populated on login and kept in sync
    // via refreshUser() — `user.name`/`user.phone_number` match the backend's registration
    // field names (see client.js's toRegistrationPayload), not hard-coded sample data.
    const { user, provider, signOut } = useAuth();

    const name = user?.name || 'Your Name';
    const contactText = [user?.email, user?.phone_number].filter(Boolean).join(' | ');

    // "Switch Account" only appears once the service provider application has been
    // approved. Until then (no application yet, or still pending), the customer
    // sees "Apply as Service Provider" instead.
    const hasProviderAccount = provider?.verification_status === VERIFIED_STATUS;

    const handleEditProfile = () => {
        // TODO: point this to the actual edit-profile screen once it exists
        navigation.navigate('EditProfile');
    };

    const handleApplyAsServiceProvider = () => {
        // First step of the application flow:
        // ServiceProviderServiceCategory -> ServiceProviderVerificationRequirements
        navigation.navigate('ServiceProviderServiceCategory');
    };

    const handleSwitchAccount = () => {
        // ---------------------------------------------------------------------
        // BACKEND-READY: persist the user's active mode as "service_provider"
        // (e.g. PATCH /api/users/me { activeMode: 'service_provider' }) so the
        // account opens in Service Provider mode on future logins too. A single
        // account holds both roles, so this only flips which side of the app is
        // shown — it does not create a separate account.
        // ---------------------------------------------------------------------
        navigation.reset({
            index: 0,
            routes: [{ name: 'ServiceProviderDashboard' }],
        });
    };

    const handleLogout = async () => {
        // signOut() (auth_context.js) clears the persisted token via api/client's
        // logout() and resets user/provider to null — no manual state clearing needed.
        await signOut();
        navigation.reset({
            index: 0,
            routes: [{ name: 'LoginScreen' }],
        });
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Profile</Text>

                <View style={styles.profileHeader}>
                    <Image
                        source={user?.photoUrl ? { uri: user.photoUrl } : require('../assets/icon_profile_photo.png')}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{name}</Text>
                    {contactText ? <Text style={styles.contactText}>{contactText}</Text> : null}
                </View>

                <View style={styles.menuList}>
                    <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
                        <Image source={require('../assets/icon_edit_profile.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Edit Profile</Text>
                    </TouchableOpacity>

                    {hasProviderAccount ? (
                        <TouchableOpacity style={styles.menuItem} onPress={handleSwitchAccount}>
                            <Image source={require('../assets/icon_switch_account.png')} style={styles.menuIcon} />
                            <Text style={styles.menuLabel}>Switch Account</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.menuItem} onPress={handleApplyAsServiceProvider}>
                            <Image source={require('../assets/icon_form.png')} style={styles.menuIcon} />
                            <Text style={styles.menuLabel}>Apply as Service Provider</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                        <Image source={require('../assets/icon_exit.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Log out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 24,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 28,
    },
    avatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        marginBottom: 14,
        backgroundColor: '#EDEAE4',
    },
    name: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 4,
    },
    contactText: {
        fontSize: 13,
        color: '#666666',
    },
    menuList: {
        marginTop: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    menuIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginRight: 16,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#222222',
    },
});

export default CustomerProfile;