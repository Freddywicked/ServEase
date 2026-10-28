import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';
import { getProviderProfile, setActiveMode, updateProviderHomeRadius } from '../api/client';
import RadiusSlider, { DEFAULT_PROVIDER_RADIUS_KM } from '../components/RadiusSlider';
import { getServiceProviderDetails } from '../api/servicerequest_api';

// Specializations are saved as one list (categories + chosen services); these
// are the category names, used to pick the provider's role line.
const SERVICE_CATEGORIES = [
    'IT-Related Device Repair',
    'Phone Repair',
    'Automotive Services',
    'Home Repair Services',
];

const ServiceProviderProfile = ({ navigation }) => {
    // `user` and `provider` ({ verification_status }) come from auth_context.
    // The provider's own details come from GET /api/providers/me:
    //   { verification_status, years_of_experience, profile_photo,
    //     offers_home_services, specializations: [],
    //     company_name, company_address, availability }
    // `availability` is a display string (e.g. "Mon-Fri, 8AM-6PM") that the
    // provider sets from the calendar on ServiceProviderDashboard.
    const { user, provider, refreshUser, signOut } = useAuth();
    const [profile, setProfile] = useState(null);
    const [switching, setSwitching] = useState(false);
    const [radiusOverrideKm, setRadiusOverrideKm] = useState(null); // set while/after the provider edits it
    // Ratings / reviews / AI sentiment summary for THIS provider:
    //   { positiveFeedbackPercent, rating, reviewCount, aiSummaryTags: [],
    //     reviews: [{ id, reviewerName (masked), rating, serviceAvailed, comment }] }
    // null = not loaded / nothing to show.
    const [feedback, setFeedback] = useState(null);

    const isVerified = provider?.verification_status === VERIFIED_STATUS;
    const specializations = profile?.specializations || [];
    const categories = specializations.filter((item) => SERVICE_CATEGORIES.includes(item));

    const name = user?.name || 'Service Provider';
    const role = categories[0] ? `${categories[0]} Provider` : 'Service Provider';
    const years = profile?.years_of_experience;
    const companyName = profile?.company_name;
    const companyAddress = profile?.company_address;
    const availability = profile?.availability;
    const photoUri = /^https?:\/\//.test(profile?.profile_photo || '') ? profile.profile_photo : null;

    const homeRadiusKm = radiusOverrideKm ?? profile?.home_service_radius_km ?? DEFAULT_PROVIDER_RADIUS_KM;

    const handleHomeRadiusChange = async (km) => {
        const previous = radiusOverrideKm;
        setRadiusOverrideKm(km);
        try {
            await updateProviderHomeRadius(km);
        } catch (error) {
            setRadiusOverrideKm(previous);
            Alert.alert('Could not save your home service range', error.message);
        }
    };

    const loadProfile = useCallback(async () => {
        try {
            const data = await getProviderProfile();
            setProfile(data?.provider ?? null);
        } catch (error) {
            // Keep the last known data. A 401 is already handled by api/client.
        }
    }, []);

    // The feedback summary is the same GET /service-providers/:id data the
    // customer's ProviderDetails screen shows, fetched for this provider's own
    // id. Only verified providers have a public profile (the endpoint 404s
    // otherwise), and any failure just means "no feedback to show".
    const loadFeedback = useCallback(async () => {
        if (!isVerified || !user?.user_id) {
            setFeedback(null);
            return;
        }
        try {
            const details = await getServiceProviderDetails(user.user_id);
            setFeedback({
                positiveFeedbackPercent: details?.positiveFeedbackPercent ?? null,
                rating: details?.rating ?? null,
                reviewCount: details?.reviewCount ?? 0,
                aiSummaryTags: details?.aiSummaryTags ?? [],
                reviews: Array.isArray(details?.reviews) ? details.reviews : [],
            });
        } catch (error) {
            // Non-fatal: keep the last known data (or none).
        }
    }, [isVerified, user?.user_id]);

    useEffect(() => {
        loadProfile();
        loadFeedback();
    }, [loadProfile, loadFeedback]);

    // Keep the profile in sync with the backend whenever the screen is focused.
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', async () => {
            try {
                await refreshUser();
            } catch (error) {
                // Non-fatal: keep showing the last known data.
            }
            loadProfile();
            loadFeedback();
        });
        return unsubscribe;
    }, [navigation, refreshUser, loadProfile, loadFeedback]);


    const handleEditProfile = () => {
        // TODO: point this to the actual edit-profile screen once it exists
        navigation.navigate('EditProfile');
    };

    const handleSwitchAccount = async () => {
        if (switching) return;
        setSwitching(true);
        try {
            // Persist the active mode on the backend (PATCH /api/users/me
            // { activeMode: 'customer' }) so the account also opens in Customer
            // mode on future logins. A single account holds both roles, so this
            // only flips which side of the app is shown.
            await setActiveMode('customer');

            // Re-sync user/provider in auth_context with what the backend now says.
            try {
                await refreshUser();
            } catch (error) {
                // Non-fatal: the mode was already saved.
            }

            navigation.reset({
                index: 0,
                routes: [{ name: 'CustomerDashboard' }],
            });
        } catch (error) {
            // Stay on this screen so the user remains in Service Provider mode,
            // matching what the backend still has saved.
            Alert.alert('Unable to switch account', 'Please check your connection and try again.');
        } finally {
            setSwitching(false);
        }
    };

    const handleLogout = async () => {
        // signOut() (auth_context.js) clears the persisted token and resets
        // user/provider to null.
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
                        source={photoUri ? { uri: photoUri } : require('../assets/icon_ellipse.png')}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.role}>{role}</Text>

                    <View style={styles.verifiedRow}>
                        {isVerified && (
                            <View style={styles.verifiedBadge}>
                                <View style={styles.checkCircle}>
                                    <Image source={require('../assets/icon_check.png')} style={styles.checkIcon} />
                                </View>
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        )}
                        {years != null && (
                            <Text style={styles.experienceText}>
                                {years} {Number(years) === 1 ? 'year' : 'years'} experience
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.detailsBlock}>
                    {specializations.length > 0 && (
                        <Text style={styles.detailLine}>
                            <Text style={styles.detailLabel}>Specialties: </Text>
                            {specializations.join(', ')}
                        </Text>
                    )}
                    {availability ? (
                        <Text style={styles.detailLine}>
                            <Text style={styles.detailLabel}>Available: </Text>
                            {availability}
                        </Text>
                    ) : null}
                    {companyAddress ? (
                        <Text style={styles.detailLine}>
                            <Text style={styles.detailLabel}>Company Address: </Text>
                            {companyAddress}
                        </Text>
                    ) : null}
                    {companyName ? (
                        <Text style={styles.detailLine}>
                            <Text style={styles.detailLabel}>Company Name: </Text>
                            {companyName}
                        </Text>
                    ) : null}
                    {profile?.offers_home_services != null && (
                        <Text style={styles.detailLine}>
                            <Text style={styles.detailLabel}>Home services: </Text>
                            {profile.offers_home_services ? 'Yes' : 'No'}
                        </Text>
                    )}
                    {profile?.offers_home_services ? (
                        <View style={{ marginTop: 8 }}>
                            <RadiusSlider
                                label="Home service range"
                                value={homeRadiusKm}
                                onChange={handleHomeRadiusChange}
                            />
                        </View>
                    ) : null}
                </View>

                <View style={styles.aiSection}>
                    <Text style={styles.aiHeading}>AI Summary Insights</Text>
                    <Text style={styles.aiFeedback}>
                        {feedback?.positiveFeedbackPercent != null
                            ? `${feedback.positiveFeedbackPercent}% Positive Feedback`
                            : 'No feedback yet'}
                    </Text>
                    {(feedback?.aiSummaryTags || []).length > 0 && (
                        <View style={styles.tagRow}>
                            {feedback.aiSummaryTags.map((tag) => (
                                <View key={tag} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {feedback?.rating != null && (
                        <View style={styles.ratingRow}>
                            <Image source={require('../assets/icon_star.png')} style={styles.ratingStar} />
                            <Text style={styles.ratingValue}>{feedback.rating}</Text>
                            <Text style={styles.ratingCount}>
                                {feedback.reviewCount} {feedback.reviewCount === 1 ? 'review' : 'reviews'}
                            </Text>
                        </View>
                    )}
                </View>

                {(feedback?.reviews || []).length > 0 && (
                    <View style={styles.reviewsBlock}>
                        {feedback.reviews.slice(0, 3).map((review) => (
                            <View key={review.id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                                    <Text style={styles.reviewRating}>{review.rating}/5</Text>
                                </View>
                                {!!review.serviceAvailed && (
                                    <Text style={styles.reviewService}>{review.serviceAvailed}</Text>
                                )}
                                {!!review.comment && (
                                    <Text style={styles.reviewComment}>{review.comment}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.menuList}>
                    <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
                        <Image source={require('../assets/icon_edit_profile.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, switching && styles.menuItemDisabled]}
                        onPress={handleSwitchAccount}
                        disabled={switching}
                    >
                        <Image source={require('../assets/icon_switch_account.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Switch as Customer</Text>
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
        marginBottom: 20,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 14,
        backgroundColor: '#E5E5E5',
    },
    name: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 2,
    },
    role: {
        fontSize: 13,
        color: '#555555',
        marginBottom: 10,
        textAlign: 'center',
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E6F0FC',
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 10,
        marginRight: 10,
    },
    checkCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#0255AF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    checkIcon: {
        width: 9,
        height: 9,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0255AF',
    },
    experienceText: {
        fontSize: 12,
        color: '#666666',
    },
    detailsBlock: {
        marginTop: 18,
        marginBottom: 20,
    },
    detailLine: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 6,
        lineHeight: 19,
    },
    detailLabel: {
        fontWeight: '700',
        color: '#111111',
    },
    aiSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    aiHeading: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 6,
    },
    aiFeedback: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 12,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    tag: {
        borderWidth: 1,
        borderColor: '#D5D5D5',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 14,
        marginHorizontal: 5,
        marginBottom: 6,
    },
    tagText: {
        fontSize: 12,
        color: '#444444',
        fontWeight: '600',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingStar: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
        marginRight: 6,
    },
    ratingValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    ratingCount: {
        fontSize: 12,
        color: '#666666',
        marginLeft: 10,
    },
    reviewsBlock: {
        marginBottom: 20,
    },
    reviewCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    reviewerName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#222222',
    },
    reviewRating: {
        fontSize: 12,
        fontWeight: '700',
        color: '#B8860B',
    },
    reviewService: {
        fontSize: 11,
        color: '#777777',
        marginBottom: 4,
    },
    reviewComment: {
        fontSize: 12,
        color: '#333333',
        lineHeight: 17,
    },
    menuList: {
        marginTop: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    menuItemDisabled: {
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

export default ServiceProviderProfile;