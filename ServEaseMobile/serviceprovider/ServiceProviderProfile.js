import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth_context';
import { fetchMyProviderProfile } from '../api/providerProfile';

const SIDE = 24; // horizontal screen padding
const REVIEW_GAP = 10; // space between review cards

const Stars = ({ count = 5, size = 11 }) => (
    <View style={styles.starsRow} accessibilityLabel={`${count} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
            <Text key={n} style={[styles.star, { fontSize: size, lineHeight: size + 3 }]}>
                {n <= count ? '★' : '☆'}
            </Text>
        ))}
    </View>
);

const Chip = ({ label }) => (
    <View style={styles.chip}>
        <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
    </View>
);

const ReviewCard = ({ review, width }) => (
    <View style={[styles.reviewCard, { width }]}>
        <Text style={styles.reviewName}>{review.reviewer}</Text>
        <Stars count={review.rating} />
        <Text style={styles.reviewService}>Service Availed: {review.service}</Text>
        <Text style={styles.reviewComment} numberOfLines={2}>{review.comment}</Text>
    </View>
);

const ServiceProviderProfile = ({ navigation }) => {
    const { width } = useWindowDimensions();
    const { signOut } = useAuth();

    // Everything shown here comes from the backend (api/providerProfile.js), never hard-coded.
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadProfile = useCallback(async () => {
        try {
            setError(null);
            setProfile(await fetchMyProviderProfile());
        } catch (e) {
            setError(e.message || 'Could not load your profile.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
        // refresh when coming back from the edit screen
        const unsubscribe = navigation.addListener('focus', loadProfile);
        return unsubscribe;
    }, [loadProfile, navigation]);

    const reviewCardWidth = width - SIDE * 2;

    const goToEdit = () => {
        navigation.navigate('ServiceProviderEditProfile');
    };

    const handleSwitchToCustomer = () => {
        // ---------------------------------------------------------------------
        // BACKEND-READY: persist the user's active mode as "customer" so the
        // account opens in Customer mode on future logins too. A single account
        // holds both roles, so this only flips which side of the app is shown.
        // ---------------------------------------------------------------------
        navigation.reset({
            index: 0,
            routes: [{ name: 'CustomerDashboard' }],
        });
    };

    const handleLogout = () => {
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                    // signOut() clears the persisted token and resets user/provider
                    await signOut();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'LoginScreen' }],
                    });
                },
            },
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.center]} edges={['top', 'left', 'right']}>
                <ActivityIndicator size="large" color="#021E79" />
            </SafeAreaView>
        );
    }

    if (error || !profile) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.center]} edges={['top', 'left', 'right']}>
                <Text style={styles.errorTitle}>Could not load your profile</Text>
                <Text style={styles.errorText}>{error || 'Please try again.'}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                        setLoading(true);
                        loadProfile();
                    }}
                    accessibilityRole="button"
                >
                    <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const { aiSummary } = profile;
    const reviewLabel = profile.reviewCount === 1 ? 'review' : 'reviews';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.headerTitle}>Profile</Text>

                {/* Header: avatar + name */}
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={goToEdit}
                        accessibilityRole="button"
                        accessibilityLabel="Edit profile photo"
                    >
                        <Image
                            source={
                                profile.photoUrl
                                    ? { uri: profile.photoUrl }
                                    : require('../assets/icon_profile_photo.png')
                            }
                            style={styles.avatar}
                        />
                        <Image source={require('../assets/icon_edit.png')} style={styles.avatarEditIcon} />
                    </TouchableOpacity>

                    <View style={styles.headerText}>
                        <Text style={styles.name} numberOfLines={1}>{profile.fullName || ''}</Text>
                        {profile.specialty ? (
                            <Text style={styles.specialty} numberOfLines={1}>{profile.specialty}</Text>
                        ) : null}
                        {profile.yearsExperience != null && (
                            <Text style={styles.experience}>
                                {profile.yearsExperience} {Number(profile.yearsExperience) === 1 ? 'year' : 'years'} experience
                            </Text>
                        )}
                    </View>
                </View>

                {/* AI Summary Insights (only when the backend provides one) */}
                {aiSummary.positiveFeedbackPercent != null && (
                    <View style={styles.insights}>
                        <Text style={styles.insightsTitle}>AI Summary Insights</Text>
                        <View style={styles.insightsRow}>
                            <Text style={styles.insightsFeedback}>
                                {aiSummary.positiveFeedbackPercent}% Positive Feedback
                            </Text>
                            <View style={styles.chipsRow}>
                                {aiSummary.tags.map((tag) => (
                                    <Chip key={tag} label={tag} />
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Rating summary */}
                <View style={styles.ratingRow}>
                    <Text style={styles.ratingStar}>★</Text>
                    <Text style={styles.ratingText}>
                        {profile.rating != null ? Number(profile.rating).toFixed(1) : '—'}
                    </Text>
                    <Text style={styles.ratingText}>{profile.reviewCount} {reviewLabel}</Text>
                </View>

                {/* Reviews (swipe sideways; the next card peeks in) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={reviewCardWidth + REVIEW_GAP}
                    decelerationRate="fast"
                    style={styles.reviewsScroll}
                    contentContainerStyle={styles.reviewsContent}
                >
                    {profile.reviews.length > 0 ? (
                        profile.reviews.map((review) => (
                            <ReviewCard key={review.id} review={review} width={reviewCardWidth} />
                        ))
                    ) : (
                        <View style={[styles.reviewCard, styles.reviewEmpty, { width: reviewCardWidth }]}>
                            <Text style={styles.reviewComment}>
                                No reviews yet. Completed jobs will show customer reviews here.
                            </Text>
                        </View>
                    )}
                </ScrollView>

                {/* Edit Profile / Switch to Customer / Log out */}
                <View style={styles.menuList}>
                    <TouchableOpacity style={styles.menuItem} onPress={goToEdit}>
                        <Image source={require('../assets/icon_edit_profile.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleSwitchToCustomer}>
                        <Image source={require('../assets/icon_switch_account.png')} style={styles.menuIcon} />
                        <Text style={styles.menuLabel}>Switch to Customer</Text>
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
    center: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SIDE,
    },
    scrollContent: {
        paddingHorizontal: SIDE,
        paddingTop: 40,
        paddingBottom: 120, // clears the static bottom navbar
    },
    headerTitle: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
        marginBottom: 27,
    },

    // Error state
    errorTitle: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
    },
    errorText: {
        fontSize: 12,
        lineHeight: 16,
        color: '#484040',
        textAlign: 'center',
        marginTop: 6,
    },
    retryButton: {
        marginTop: 16,
        height: 32,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#55575B',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#000000',
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 71,
        height: 71,
        borderRadius: 36,
        backgroundColor: '#D9D9D9',
    },
    avatarEditIcon: {
        position: 'absolute',
        right: 1,
        bottom: 5,
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
    },
    specialty: {
        fontSize: 12,
        lineHeight: 14,
        fontStyle: 'italic',
        color: '#484040',
        marginTop: 5,
    },
    experience: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        marginTop: 3,
    },

    // AI Summary Insights
    insights: {
        marginTop: 14,
        paddingLeft: 12,
    },
    insightsTitle: {
        fontSize: 12,
        lineHeight: 14,
        fontWeight: '700',
        color: '#484040',
    },
    insightsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    insightsFeedback: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        marginRight: 8,
        marginBottom: 6,
    },
    chipsRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    chip: {
        minWidth: 98,
        height: 21,
        paddingHorizontal: 8,
        marginLeft: 4,
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipText: {
        fontSize: 9,
        lineHeight: 11,
        textAlign: 'center',
        color: '#484040',
    },

    // Rating summary
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingLeft: 4,
    },
    ratingStar: {
        fontSize: 24,
        lineHeight: 28,
        color: '#FFDD03',
        marginRight: 6,
    },
    ratingText: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        marginRight: 12,
    },

    // Reviews
    starsRow: {
        flexDirection: 'row',
        marginTop: 1,
    },
    star: {
        color: '#FFDD03',
    },
    reviewsScroll: {
        marginTop: 7,
        marginHorizontal: -SIDE,
        flexGrow: 0,
    },
    reviewsContent: {
        paddingHorizontal: SIDE,
    },
    reviewCard: {
        minHeight: 83,
        marginRight: REVIEW_GAP,
        paddingHorizontal: 11,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
    },
    reviewEmpty: {
        justifyContent: 'center',
    },
    reviewName: {
        fontSize: 11,
        lineHeight: 13,
        color: '#484040',
    },
    reviewService: {
        fontSize: 9,
        lineHeight: 11,
        color: '#484040',
        marginTop: 3,
    },
    reviewComment: {
        fontSize: 8,
        lineHeight: 10,
        color: '#484040',
        marginTop: 3,
    },

    // Edit Profile / Switch to Customer / Log out
    menuList: {
        marginTop: 15,
        paddingLeft: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    menuIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        marginRight: 12,
    },
    menuLabel: {
        fontSize: 14,
        lineHeight: 17,
        color: '#484040',
    },
});

export default ServiceProviderProfile;