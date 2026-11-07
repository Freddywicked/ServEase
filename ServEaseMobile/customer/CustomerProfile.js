import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';

const CustomerProfile = ({ navigation }) => {
    // `user` and `provider` come from auth_context, populated on login and kept in sync
    // via refreshUser(). CustomerEditProfile calls refreshUser() after saving, so any
    // change made there shows up here automatically. Nothing on this screen is hard-coded.
    const { user, provider, signOut } = useAuth();

    const name = user?.name || '';
    const contactText = [user?.email, user?.phone_number].filter(Boolean).join(' | ');

    // Service provider application states (the only way to become a provider):
    //   no application / rejected -> "Apply as Service Provider"
    //   pending                   -> "Application Under Review" (not tappable, so they can't re-apply)
    //   verified                  -> "Switch to Service Provider"
    const hasProviderAccount = provider?.verification_status === VERIFIED_STATUS;
    const isApplicationPending = provider?.verification_status === 'pending';

    const handleEditProfile = () => {
        navigation.navigate('CustomerEditProfile');
    };

    const handleApplyAsServiceProvider = () => {
        // ServiceProviderServiceCategory -> ServiceProviderVerificationRequirements
        navigation.navigate('ServiceProviderServiceCategory');
    };

    const handleSwitchAccount = () => {
        // BACKEND-READY: persist the active mode as "service_provider"
        // (e.g. PATCH /api/users/me { activeMode: 'service_provider' }) so the account
        // opens in Service Provider mode on future logins. One account holds both roles.
        navigation.reset({
            index: 0,
            routes: [{ name: 'ServiceProviderDashboard' }],
        });
    };

    const handleLogout = async () => {
        // signOut() clears the persisted token and resets user/provider to null.
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
        paddingTop: 40,
        paddingBottom: 120, // clears the static bottom navbar
    },
    headerTitle: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
        marginBottom: 6,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 38,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#D9D9D9',
        marginBottom: 26,
    },
    name: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
        marginBottom: 2,
    },
    contactText: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
    },
    menuList: {
        paddingLeft: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    menuItemPending: {
        opacity: 0.5,
    },
    menuIcon: {
        width: 30,
        height: 30,
        resizeMode: 'contain',
        marginRight: 10,
    },
    menuLabel: {
        fontSize: 14,
        lineHeight: 17,
        color: '#484040',
    },
});

export default CustomerProfile;