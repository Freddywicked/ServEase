import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import { getRecommendedProviders, createServiceRequest } from '../api/servicerequest_api';

/* ============================================================================
 * RecommendServiceProvider (step 3 of 4)
 * ----------------------------------------------------------------------------
 * Customer <-> provider handoff.
 *
 *   Loads    GET /service-providers/recommended using the draft (category,
 *            latitude/longitude, preferred date/time). Matching and sorting by
 *            specialization, ratings/sentiment, distance and availability is done
 *            server-side. "Find another" re-calls it with `exclude` = ids already shown.
 *
 *   Request  POST /service-requests with the full draft (category, description, photo URL,
 *   Quotation  lat/long, preferred date/time, ai_diagnosis) + the chosen providerId. The
 *            backend creates the SERVICE_REQUEST ('pending_quotation') and — on the
 *            provider's side — notifies them (see the PROVIDER COMMUNICATION comment in
 *            handleRequestQuotation). The POST lives here, so SubmitServiceRequest is a
 *            pure confirmation screen.
 * ========================================================================== */

const TOTAL_STEPS = 4;
const CURRENT_STEP = 3;

const formatLocation = (provider) =>
    [
        provider.locationName,
        provider.distanceKm !== null && provider.distanceKm !== undefined
            ? `${Number(provider.distanceKm).toFixed(1)} km away`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

const RecommendServiceProvider = ({ navigation }) => {
    const setDraft = useServiceRequestDraftStore((state) => state.setDraft);

    const [providers, setProviders] = useState([]);
    const [selectedProviderId, setSelectedProviderId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [notice, setNotice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;
    const seenProviderIdsRef = useRef(new Set());
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!isLoading) {
            return undefined;
        }
        spinValue.setValue(0);
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spinAnimation.start();
        return () => spinAnimation.stop();
    }, [isLoading, spinValue]);

    // `findAnother` = true re-queries excluding every provider already shown, instead of
    // looping back to the same result set.
    const loadProviders = useCallback(async ({ findAnother = false } = {}) => {
        setIsLoading(true);
        setLoadError('');
        setNotice('');
        try {
            const draft = useServiceRequestDraftStore.getState();
            const list = await getRecommendedProviders({
                categoryKey: draft.categoryKey,
                latitude: draft.location?.latitude,
                longitude: draft.location?.longitude,
                preferredDate: draft.preferredDate,
                preferredTime: draft.preferredTime,
                exclude: findAnother ? Array.from(seenProviderIdsRef.current) : [],
            });
            if (!isMountedRef.current) return;

            if (findAnother && list.length === 0) {
                setNotice('No other service providers are available right now.');
                return;
            }
            list.forEach((provider) => seenProviderIdsRef.current.add(provider.id));
            setProviders(list);
            setSelectedProviderId(list.length > 0 ? list[0].id : null);
        } catch (error) {
            if (isMountedRef.current) setLoadError(error.message);
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleClose = () => {
        navigation.goBack();
    };

    const handleSelectProvider = (id) => {
        setSelectedProviderId(id);
    };

    const handleFindAnother = () => {
        loadProviders({ findAnother: true });
    };

    const handleRequestQuotation = async () => {
        if (!selectedProviderId || isSubmitting) return;
        const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
        setIsSubmitting(true);
        setDraft({ providerId: selectedProviderId, providerName: selectedProvider?.name ?? null });

        try {
            const created = await createServiceRequest(useServiceRequestDraftStore.getState(), {
                providerId: selectedProviderId,
            });
            setDraft({ submittedRequestId: created.requestId });

            // ---------------------------------------------------------------------
            // PROVIDER COMMUNICATION (comment block — nothing to call from the app here)
            //
            // The app does NOT notify the provider directly. When POST /service-requests
            // succeeds, the backend, in the same transaction, should:
            //   1. insert the SERVICE_REQUEST (request_status = 'pending_quotation',
            //      provider_id = selectedProviderId) and its SERVICE_REQUEST_ATTACHMENT;
            //   2. insert a NOTIFICATION row for the provider's user
            //      ("New service request: <category>");
            //   3. send an FCM push to the provider's registered device token(s).
            //
            // On the provider's device that surfaces as:
            //   - the request appearing on their dashboard (getIncomingRequests() and/or
            //     subscribeToIncomingRequests(providerId, ...) — see serviceRequestApi.js);
            //   - they then call submitQuotation() (labor_cost, parts_cost, remarks) or
            //     declineRequest(), and nothing else in this flow proceeds until they do.
            //
            // Customer side, once they answer: subscribeToServiceRequest(requestId, ...)
            // (see SubmitServiceRequest.js / CustomerDashboard.js) updates the
            // "Active Repair" card without polling.
            // ---------------------------------------------------------------------

            // replace (not navigate) so Back from the confirmation can't land here and re-send.
            navigation.replace(ROUTES.SUBMIT_SERVICE_REQUEST);
        } catch (error) {
            setIsSubmitting(false);
            if (error.status === 409) {
                // The provider became unavailable between listing and requesting.
                Alert.alert('Provider unavailable', 'This service provider can no longer take your request. Please pick another.');
                loadProviders({ findAnother: true });
            } else {
                Alert.alert('Could not send your request', error.message);
            }
        }
    };

    const renderProviderCard = (provider) => {
        const isSelected = provider.id === selectedProviderId;
        const specialties = Array.isArray(provider.specialties) ? provider.specialties.join(', ') : provider.specialties;
        return (
            <TouchableOpacity
                key={provider.id}
                style={[styles.providerCard, isSelected && styles.providerCardSelected]}
                onPress={() => handleSelectProvider(provider.id)}
                activeOpacity={0.85}
            >
                <View style={styles.providerHeaderRow}>
                    <Image
                        source={provider.photoUrl ? { uri: provider.photoUrl } : require('../assets/icon_profile_photo.png')}
                        style={styles.providerPhoto}
                    />
                    <View style={styles.providerNameWrap}>
                        <Text style={styles.providerName}>{provider.name}</Text>
                        <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
                    </View>
                </View>

                <View style={styles.badgeRow}>
                    {provider.verified && (
                        <View style={styles.verifiedBadge}>
                            <View style={styles.verifiedIconWrap}>
                                <Image source={require('../assets/icon_ellipse.png')} style={styles.verifiedEllipse} />
                                <Image source={require('../assets/icon_check.png')} style={styles.verifiedCheck} />
                            </View>
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                    )}
                    {provider.available && (
                        <View style={styles.availableBadge}>
                            <Text style={styles.availableText}>Available</Text>
                        </View>
                    )}
                </View>

                <View style={styles.ratingRow}>
                    <Image source={require('../assets/icon_star.png')} style={styles.starIcon} />
                    <Text style={styles.ratingText}>
                        {provider.rating !== null && provider.rating !== undefined ? Number(provider.rating).toFixed(1) : 'New'}
                    </Text>
                    <Text style={styles.ratingDetail}>{provider.reviewCount ?? 0} reviews</Text>
                    {provider.experienceYears !== null && provider.experienceYears !== undefined && (
                        <Text style={styles.ratingDetail}>{provider.experienceYears} years experience</Text>
                    )}
                </View>

                {!!specialties && (
                    <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>Specialities: </Text>
                        {specialties}
                    </Text>
                )}
                {!!formatLocation(provider) && (
                    <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>Location: </Text>
                        {formatLocation(provider)}
                    </Text>
                )}
                {!!provider.availabilitySchedule && (
                    <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>Available: </Text>
                        {provider.availabilitySchedule}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    const renderBody = () => {
        if (isLoading) {
            return (
                <View style={styles.reloadingSection}>
                    <Animated.Image
                        source={require('../assets/icon_loading.png')}
                        style={[styles.reloadingIcon, { transform: [{ rotate: spin }] }]}
                    />
                    <Text style={styles.reloadingText}>Finding service providers…</Text>
                </View>
            );
        }

        if (loadError) {
            return (
                <View style={styles.reloadingSection}>
                    <Text style={styles.reloadingText}>{loadError}</Text>
                    <TouchableOpacity onPress={() => loadProviders()} style={styles.findAnotherWrap}>
                        <Text style={styles.findAnotherText}>Try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (providers.length === 0) {
            return (
                <View style={styles.reloadingSection}>
                    <Text style={styles.reloadingText}>
                        No service providers are available for this request yet.
                    </Text>
                    <TouchableOpacity onPress={() => loadProviders()} style={styles.findAnotherWrap}>
                        <Text style={styles.findAnotherText}>Search again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <>
                {providers.map(renderProviderCard)}

                {!!notice && <Text style={styles.noticeText}>{notice}</Text>}

                <TouchableOpacity onPress={handleRequestQuotation} disabled={isSubmitting || !selectedProviderId}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.requestButton}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.requestButtonText}>Request Quotation</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleFindAnother} disabled={isSubmitting} style={styles.findAnotherWrap}>
                    <Text style={styles.findAnotherText}>Find another Service Provider</Text>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Creating Service Request</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Image source={require('../assets/icon_close.png')} style={styles.closeIcon} />
                    </TouchableOpacity>
                </View>

                <View style={styles.progressBar}>
                    {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                        <Image
                            key={index}
                            source={
                                index < CURRENT_STEP
                                    ? require('../assets/icon_tab_colored.png')
                                    : require('../assets/icon_tab.png')
                            }
                            style={styles.progressSegment}
                            resizeMode="stretch"
                        />
                    ))}
                </View>

                <Text style={styles.questionTitle}>Recommended Service Providers</Text>
                <Text style={styles.questionSubtitle}>
                    Matched by specialization, customer satisfaction sentiments, ratings and distance from you.
                </Text>

                {renderBody()}
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    closeButton: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 6,
    },
    closeIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    progressBar: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    progressSegment: {
        flex: 1,
        height: 6,
        marginRight: 6,
        borderRadius: 3,
    },
    questionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 6,
    },
    questionSubtitle: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 18,
        marginBottom: 20,
    },
    reloadingSection: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    reloadingIcon: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
        marginBottom: 12,
    },
    reloadingText: {
        fontSize: 13,
        color: '#666666',
    },
    providerCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },
    providerCardSelected: {
        borderColor: '#04A5A5',
        borderWidth: 2,
    },
    providerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    providerPhoto: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    providerNameWrap: {
        flex: 1,
    },
    providerName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    providerSpecialty: {
        fontSize: 12,
        color: '#666666',
        marginTop: 2,
    },
    badgeRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D9E8FB',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 8,
    },
    verifiedIconWrap: {
        width: 16,
        height: 16,
        marginRight: 4,
    },
    verifiedEllipse: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
        tintColor: '#0255AF',
        position: 'absolute',
    },
    verifiedCheck: {
        width: 9,
        height: 9,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
        position: 'absolute',
        top: 3.5,
        left: 3.5,
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0255AF',
    },
    availableBadge: {
        backgroundColor: '#86FF8A',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 4,
        justifyContent: 'center',
    },
    availableText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0B4D0E',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    starIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 4,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
        marginRight: 10,
    },
    ratingDetail: {
        fontSize: 12,
        color: '#666666',
        marginRight: 10,
    },
    detailLine: {
        fontSize: 12,
        color: '#333333',
        marginBottom: 3,
    },
    detailLabel: {
        fontWeight: '700',
        color: '#111111',
    },
    requestButton: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 16,
    },
    requestButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    findAnotherWrap: {
        alignItems: 'center',
    },
    findAnotherText: {
        fontSize: 14,
        color: '#111111',
        textDecorationLine: 'underline',
    },
    noticeText: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 12,
    },
});

export default RecommendServiceProvider;