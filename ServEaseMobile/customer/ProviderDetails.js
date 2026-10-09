import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { getServiceProviderDetails } from '../api/servicerequest_api';

// Icons (assets folder). NOTE: icon_back_button.png is the "<" arrow at the top-left.
const ICON_BACK = require('../assets/icon_back_button.png');
const ICON_STAR = require('../assets/icon_star.png');
const ICON_ELLIPSE = require('../assets/icon_ellipse.png');
const ICON_CHECK = require('../assets/icon_check.png');

/* ============================================================================
 * Provider Details (Customer app) — opened from Find Service Providers.
 * ----------------------------------------------------------------------------
 * Route params: { providerId, provider? }  (`provider` = the card the customer tapped,
 * shown immediately while the full profile loads.)
 *
 *   GET /service-providers/:id  ->  getServiceProviderDetails(providerId)
 *   {
 *     id, name, photoUrl,
 *     headline,                    // 'Automotive Repair Service Provider'
 *     available,                   // true -> green "Available", false -> red "Unavailable"
 *     experienceYears,             // 5
 *     specialities,                // 'IT and Phone Repair'
 *     locationName, distanceKm,    // 'Naga City', 2.5
 *     availabilitySchedule,        // 'Mon-Fri, 8AM-6PM'
 *     workplace,                   // 'Malamaya Studio'
 *     positiveFeedbackPercent,     // 92
 *     aiSummaryTags,               // ['Professional', 'Always on Time']
 *     rating, reviewCount,         // 4.8, 95
 *     reviews: [{ id, reviewerName (masked by the backend, e.g. 'N**** O*ea'), rating, serviceAvailed, comment }]
 *   }
 * ========================================================================== */

const AVAILABLE_COLOR = '#2E7D32';
const UNAVAILABLE_COLOR = '#C62828';

const renderStars = (count, size, keyPrefix) =>
    Array.from({ length: Math.max(0, Math.round(count ?? 0)) }, (_, index) => (
        <Image key={`${keyPrefix}-${index}`} source={ICON_STAR} style={{ width: size, height: size, resizeMode: 'contain' }} />
    ));

const ProviderDetails = ({ navigation, route }) => {
    const { providerId, provider: initialProvider } = route.params ?? {};
    const resetDraft = useServiceRequestDraftStore((state) => state.resetDraft);

    const [provider, setProvider] = useState(initialProvider ?? null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const loadProvider = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            setProvider(await getServiceProviderDetails(providerId));
        } catch (error) {
            setLoadError(error.message || 'Could not load this service provider.');
        } finally {
            setIsLoading(false);
        }
    }, [providerId]);

    useEffect(() => {
        loadProvider();
    }, [loadProvider]);

    const handleBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('FindServiceProvider');
    };

    const handleMessage = () => {
        // Same Chat -> Conversation flow Track uses to message a provider.
        navigation.navigate(ROUTES.CONVERSATION, {
            senderName: provider.name,
            contactName: provider.name,
            providerId: provider.id,
        });
    };

    const handleChooseProvider = () => {
        // Starts a new service request with this provider already chosen.
        resetDraft();
        navigation.navigate(ROUTES.CREATE_SERVICE_REQUEST, { providerId: provider.id });
    };

    const renderInfoLine = (label, value) =>
        value ? (
            <Text style={styles.infoLine}>
                <Text style={styles.infoLabel}>{label}: </Text>
                {value}
            </Text>
        ) : null;

    const renderReview = (review, index) => (
        <View key={review.id ?? index} style={styles.reviewCard}>
            <Text style={styles.reviewerName}>{review.reviewerName}</Text>
            <View style={styles.reviewStars}>{renderStars(review.rating, 11, `review-${index}`)}</View>
            {!!review.serviceAvailed && <Text style={styles.reviewService}>Service Availed: {review.serviceAvailed}</Text>}
            {!!review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
        </View>
    );

    const renderContent = () => {
        if (!provider) {
            return isLoading ? (
                <ActivityIndicator color="#0255AF" style={styles.loader} />
            ) : (
                <TouchableOpacity onPress={loadProvider}>
                    <Text style={styles.stateText}>Couldn't load this provider. Tap to retry.{'\n'}{loadError}</Text>
                </TouchableOpacity>
            );
        }

        const locationText = [
            provider.locationName,
            provider.distanceKm != null ? `${provider.distanceKm} km away` : null,
        ].filter(Boolean).join(' · ');
        const headline = provider.headline || (provider.specialty ? `${provider.specialty} Service Provider` : 'Service Provider');
        const reviews = provider.reviews ?? [];

        return (
            <>
                {provider.photoUrl ? (
                    <Image source={{ uri: provider.photoUrl }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatar} />
                )}

                <Text style={styles.name}>{provider.name}</Text>
                <Text style={styles.headline}>{headline}</Text>

                <View style={styles.pillRow}>
                    <View style={styles.verifiedBadge}>
                        <View style={styles.verifiedIconWrap}>
                            <Image source={ICON_ELLIPSE} style={styles.verifiedEllipse} />
                            <Image source={ICON_CHECK} style={styles.verifiedCheck} />
                        </View>
                        <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                    <View style={[styles.availabilityBadge, { backgroundColor: provider.available ? AVAILABLE_COLOR : UNAVAILABLE_COLOR }]}>
                        <Text style={styles.availabilityText}>{provider.available ? 'Available' : 'Unavailable'}</Text>
                    </View>
                    <TouchableOpacity onPress={handleMessage} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.messageText}>Message</Text>
                    </TouchableOpacity>
                </View>

                {provider.experienceYears != null && (
                    <Text style={styles.experience}>{provider.experienceYears} years experience</Text>
                )}

                <View style={styles.infoBlock}>
                    {renderInfoLine('Specialities', provider.specialities || provider.specialty)}
                    {renderInfoLine('Location', locationText)}
                    {renderInfoLine('Available', provider.availabilitySchedule)}
                    {renderInfoLine('Workplace', provider.workplace)}
                </View>

                {provider.positiveFeedbackPercent != null && (
                    <Text style={styles.positiveFeedback}>{provider.positiveFeedbackPercent}% Positive Feedback</Text>
                )}

                {(provider.aiSummaryTags ?? []).length > 0 && (
                    <>
                        <Text style={styles.aiTitle}>AI Summary Insights</Text>
                        <View style={styles.tagRow}>
                            {provider.aiSummaryTags.map((tag) => (
                                <View key={tag} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                <View style={styles.ratingRow}>
                    <Image source={ICON_STAR} style={styles.ratingStar} />
                    <Text style={styles.ratingValue}>{provider.rating ?? '—'}</Text>
                    <Text style={styles.ratingCount}>{provider.reviewCount ?? reviews.length} reviews</Text>
                </View>

                {reviews.slice(0, 2).map(renderReview)}

                {isLoading && <ActivityIndicator color="#0255AF" style={styles.inlineLoader} />}
                {!!loadError && (
                    <TouchableOpacity onPress={loadProvider}>
                        <Text style={styles.stateText}>Couldn't load the full profile. Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity activeOpacity={0.85} onPress={handleChooseProvider} style={styles.ctaWrap}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.cta}
                    >
                        <Text style={styles.ctaText}>Choose this Service Provider</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Find Service Providers"
                >
                    <Image source={ICON_BACK} style={styles.backIcon} />
                </TouchableOpacity>

                {renderContent()}
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
        paddingHorizontal: 26,
        paddingTop: 12,
        paddingBottom: 24,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginLeft: -2,
    },
    backIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    loader: {
        marginTop: 80,
    },
    inlineLoader: {
        marginTop: 12,
    },
    stateText: {
        fontSize: 13,
        color: '#777777',
        textAlign: 'center',
        marginTop: 24,
        lineHeight: 19,
    },
    avatar: {
        width: 101,
        height: 101,
        borderRadius: 51,
        backgroundColor: '#D9D9D9',
        alignSelf: 'center',
        marginTop: 4,
    },
    name: {
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#484040',
        textAlign: 'center',
        marginTop: 15,
    },
    headline: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        textAlign: 'center',
        marginTop: 3,
    },
    pillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    verifiedBadge: {
        width: 92,
        height: 22,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(87, 127, 187, 0.46)',
        borderRadius: 10,
        paddingLeft: 2,
        marginRight: 5,
    },
    verifiedIconWrap: {
        width: 17,
        height: 17,
        marginRight: 8,
    },
    verifiedEllipse: {
        width: 17,
        height: 17,
        resizeMode: 'contain',
        tintColor: '#0255AF',
        position: 'absolute',
    },
    verifiedCheck: {
        width: 10,
        height: 10,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
        position: 'absolute',
        top: 3.5,
        left: 3.5,
    },
    verifiedText: {
        fontSize: 12,
        lineHeight: 14,
        color: '#0255AF',
    },
    availabilityBadge: {
        width: 86,
        height: 22,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 9,
    },
    availabilityText: {
        fontSize: 12,
        lineHeight: 14,
        color: '#FFFFFF',
    },
    messageText: {
        fontSize: 12,
        lineHeight: 14,
        fontWeight: '700',
        color: '#18315B',
    },
    experience: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        textAlign: 'center',
        marginTop: 7,
    },
    infoBlock: {
        marginTop: 13,
        paddingLeft: 4,
    },
    infoLine: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
    },
    infoLabel: {
        fontWeight: '700',
    },
    positiveFeedback: {
        fontSize: 12,
        lineHeight: 14,
        fontWeight: '700',
        color: '#484040',
        textAlign: 'center',
        marginTop: 14,
    },
    aiTitle: {
        fontSize: 12,
        lineHeight: 14,
        fontWeight: '700',
        color: '#484040',
        marginTop: 8,
        paddingLeft: 4,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        paddingLeft: 4,
    },
    tag: {
        height: 21,
        paddingHorizontal: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        marginRight: 4,
    },
    tagText: {
        fontSize: 9,
        lineHeight: 11,
        color: '#484040',
        textAlign: 'center',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 7,
        paddingLeft: 4,
    },
    ratingStar: {
        width: 21,
        height: 21,
        resizeMode: 'contain',
        marginRight: 6,
    },
    ratingValue: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        marginRight: 10,
    },
    ratingCount: {
        fontSize: 12,
        lineHeight: 14,
        color: '#484040',
        textDecorationLine: 'underline',
    },
    reviewCard: {
        minHeight: 83,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        paddingTop: 10,
        paddingHorizontal: 10,
        paddingBottom: 8,
        marginBottom: 7,
    },
    reviewerName: {
        fontSize: 11,
        lineHeight: 13,
        color: '#484040',
    },
    reviewStars: {
        flexDirection: 'row',
        marginTop: 1,
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
    ctaWrap: {
        marginTop: 7,
    },
    cta: {
        height: 46,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: {
        fontSize: 16,
        lineHeight: 23,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default ProviderDetails;