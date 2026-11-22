import React from 'react';
import { Alert, View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';

const CustomerProfile = ({ navigation }) => {
    // `user` and `provider` come from auth_context, populated on login and kept in sync
    // via refreshUser(). CustomerEditProfile calls refreshUser() after saving, so any
    // change made there shows up here automatically. Nothing on this screen is hard-coded.
    const { user, provider, signOut } = useAuth();

    const name = user?.name || '';
    const email = user?.email || '';
    const address = user?.address || '';
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

    const handleReportProblem = () => {
        // ReportProblemCustomer -> ReportSystemErrorCustomer | ReportUserCustomer (both submit to POST /reports)
        navigation.navigate('ReportProblemCustomer');
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

    const handleLogout = () => {
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                    // signOut() clears the persisted token and resets user/provider to null.
                    await signOut();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'LoginScreen' }],
                    });
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.headerTitle}>Profile</Text>

                <View style={styles.profileHeader}>
                    <Image
                        source={user?.photoUrl ? { uri: user.photoUrl } : require('../assets/icon_profile_photo.png')}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{name}</Text>
                    {contactText ? <Text style={styles.contactText}>{contactText}</Text> : null}
                </View>

                <View style={styles.detailsCard}>
                    <Text style={styles.detailsTitle}>Account Details</Text>
                    <View style={styles.detailsRow}>
                        <View style={styles.detailsColLeft}>
                            <Text style={styles.detailsLabel}>Email Address</Text>
                            <Text style={styles.detailsValue} numberOfLines={1}>{email || '—'}</Text>
                        </View>
                        <View style={styles.detailsColRight}>
                            <Text style={styles.detailsLabel}>Address Details</Text>
                            <Text style={styles.detailsValue} numberOfLines={1}>{address || '—'}</Text>
                        </View>
                    </View>
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

                    <TouchableOpacity style={styles.menuItem} onPress={handleReportProblem}>
                        <Image source={require('../assets/icon_report.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Report a problem</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                        <Image source={require('../assets/icon_exit.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Log out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const SF = Platform.OS === 'ios' ? undefined : 'SF Pro';

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 46,
        paddingBottom: 120, // clears the static bottom navbar
    },
    headerTitle: {
        fontFamily: 'Roboto',
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
    },
    profileHeader: {
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    avatar: {
        width: 101,
        height: 101,
        borderRadius: 50.5,
        backgroundColor: '#D9D9D9',
        marginBottom: 15,
    },
    name: {
        fontFamily: SF,
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
        marginBottom: 2,
    },
    contactText: {
        fontFamily: SF,
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
    },
    detailsCard: {
        minHeight: 81,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.46)',
        borderRadius: 10,
        backgroundColor: '#FDFFFF',
        paddingHorizontal: 16,
        paddingTop: 11,
        paddingBottom: 10,
    },
    detailsTitle: {
        fontFamily: 'Quicksand',
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#292727',
        marginBottom: 8,
    },
    detailsRow: {
        flexDirection: 'row',
    },
    detailsColLeft: {
        width: 142, // address column starts at x=184 in the Figma frame
    },
    detailsColRight: {
        flex: 1,
    },
    detailsLabel: {
        fontFamily: SF,
        fontSize: 10,
        lineHeight: 17,
        color: '#484040',
    },
    detailsValue: {
        fontFamily: SF,
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#000000',
    },
    menuList: {
        marginTop: 28,
        paddingLeft: 7,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    menuItemPending: {
        opacity: 0.5,
    },
    menuIcon: {
        width: 26,
        height: 26,
        resizeMode: 'contain',
        marginRight: 17,
    },
    menuLabel: {
        fontFamily: SF,
        fontSize: 13,
        lineHeight: 16,
        color: '#484040',
    },
});

export default CustomerProfile;