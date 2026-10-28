import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';
import { updateCustomerPreferences } from '../api/client';
import RadiusSlider, { DEFAULT_CUSTOMER_RADIUS_KM } from '../components/RadiusSlider';

const CustomerProfile = ({ navigation }) => {
    // `user` and `provider` come from auth_context, populated on login and kept in sync
    // via refreshUser() — `user.name`/`user.phone_number` match the backend's registration
    // field names (see client.js's toRegistrationPayload), not hard-coded sample data.
    const { user, provider, signOut, refreshUser } = useAuth();

    // Saved defaults for new requests: do they want home service, and how far out to look.
    // BACKEND: /auth/me returns prefers_home_service and search_radius_km.
    const [prefersHomeService, setPrefersHomeService] = useState(user?.prefers_home_service ?? true);
    const [searchRadiusKm, setSearchRadiusKm] = useState(user?.search_radius_km ?? DEFAULT_CUSTOMER_RADIUS_KM);

    useEffect(() => {
        if (user?.prefers_home_service != null) setPrefersHomeService(user.prefers_home_service);
        if (user?.search_radius_km != null) setSearchRadiusKm(user.search_radius_km);
    }, [user?.prefers_home_service, user?.search_radius_km]);

    const savePreferences = async (changes, revert) => {
        try {
            await updateCustomerPreferences(changes);
            refreshUser?.().catch(() => {});
        } catch (error) {
            revert();
            Alert.alert('Could not save your preference', error.message);
        }
    };

    const handleToggleHomeService = (value) => {
        const previous = prefersHomeService;
        setPrefersHomeService(value);
        savePreferences({ prefersHomeService: value }, () => setPrefersHomeService(previous));
    };

    const handleRadiusChange = (km) => {
        const previous = searchRadiusKm;
        setSearchRadiusKm(km);
        savePreferences({ searchRadiusKm: km }, () => setSearchRadiusKm(previous));
    };

    const name = user?.name || 'Your Name';
    const contactText = [user?.email, user?.phone_number].filter(Boolean).join(' | ');

    // Service provider application states (the only way to become a provider):
    //   no application / rejected -> "Apply as Service Provider"
    //   pending                   -> "Application Under Review" (not tappable, so they can't re-apply)
    //   verified                  -> "Switch Account"
    const hasProviderAccount = provider?.verification_status === VERIFIED_STATUS;
    const isApplicationPending = provider?.verification_status === 'pending';

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

                <View style={styles.preferencesCard}>
                    <View style={styles.preferenceRow}>
                        <View style={styles.preferenceTextWrap}>
                            <Text style={styles.preferenceTitle}>Home Service</Text>
                            <Text style={styles.preferenceHint}>Prefer a provider who comes to you</Text>
                        </View>
                        <Switch
                            value={prefersHomeService}
                            onValueChange={handleToggleHomeService}
                            trackColor={{ false: '#D0D0D0', true: '#04A5A5' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                    <RadiusSlider label="Search radius" value={searchRadiusKm} onChange={handleRadiusChange} />
                    <Text style={styles.preferenceHint}>Providers farther than this won't be recommended. You can change it per request too.</Text>
                </View>

                <View style={styles.menuList}>
                    <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
                        <Image source={require('../assets/icon_edit_profile.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Edit Profile</Text>
                    </TouchableOpacity>

                    {hasProviderAccount ? (
                        <TouchableOpacity style={styles.menuItem} onPress={handleSwitchAccount}>
                            <Image source={require('../assets/icon_switch_account.png')} style={styles.menuIcon} />
                            <Text style={styles.menuLabel}>Switch as Service Provider</Text>
                        </TouchableOpacity>
                    ) : isApplicationPending ? (
                        <View style={[styles.menuItem, styles.menuItemPending]}>
                            <Image source={require('../assets/icon_form.png')} style={styles.menuIcon} />
                            <Text style={styles.menuLabel}>Application Under Review</Text>
                        </View>
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
    preferencesCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    preferenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    preferenceTextWrap: {
        flex: 1,
        marginRight: 12,
    },
    preferenceTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#222222',
    },
    preferenceHint: {
        fontSize: 11,
        color: '#888888',
        marginTop: 2,
    },
    menuList: {
        marginTop: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    menuItemPending: {
        opacity: 0.5,
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