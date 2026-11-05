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

    // Service provider application states (the only way to become a provider):
    //   no application / rejected -> "Apply as Service Provider"
    //   pending                   -> "Application Under Review" (not tappable, so they can't re-apply)
    //   verified                  -> "Switch Account"
    const hasProviderAccount = provider?.verification_status === VERIFIED_STATUS;
    const isApplicationPending = provider?.verification_status === 'pending';

    // The edit icon on the avatar opens the edit screen (Edit Profile is no longer a menu item).
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
                    <View style={styles.avatarWrap}>
                        <Image
                            source={user?.photoUrl ? { uri: user.photoUrl } : require('../assets/icon_profile_photo.png')}
                            style={styles.avatar}
                        />
                        <TouchableOpacity
                            style={styles.avatarEdit}
                            onPress={handleEditProfile}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Edit profile"
                        >
                            <Image source={require('../assets/icon_edit_profile.png')} style={styles.avatarEditIcon} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.name}>{name}</Text>
                    {contactText ? <Text style={styles.contactText}>{contactText}</Text> : null}
                </View>

                <View style={styles.menuList}>
                    {hasProviderAccount ? (
                        <TouchableOpacity style={styles.menuItem} onPress={handleSwitchAccount}>
                            <Image source={require('../assets/icon_switch_account.png')} style={styles.menuIcon} />
                            <Text style={styles.menuLabel}>Switch to Service Provider</Text>
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
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
        marginBottom: 28,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 28,
    },
    avatarWrap: {
        width: 100,
        height: 100,
        marginBottom: 14,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#D9D9D9',
    },
    avatarEdit: {
        position: 'absolute',
        right: 4,
        bottom: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEditIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    name: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
        marginBottom: 4,
    },
    contactText: {
        fontSize: 12,
        color: '#484040',
    },
    menuList: {
        marginTop: 12,
        paddingLeft: 12,
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
        width: 27,
        height: 27,
        resizeMode: 'contain',
        marginRight: 12,
    },
    menuLabel: {
        fontSize: 13,
        lineHeight: 16,
        color: '#484040',
    },
});

export default CustomerProfile;