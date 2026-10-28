import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import ProgressBar from '../components/ProgressBar';
import RadiusSlider, { DEFAULT_CUSTOMER_RADIUS_KM } from '../components/RadiusSlider';
import { useAuth } from '../context/auth_context';
import { getRecommendedProviders, createServiceRequest } from '../api/servicerequest_api';

/* ============================================================================
 * RecommendServiceProvider (step 3 of 4)
 * ----------------------------------------------------------------------------
 * Customer <-> provider handoff.
 *
 *   Loads    GET /service-providers/recommended using the draft (category,
 *            latitude/longitude, preferred date/time). Matching and sorting by
 *            specialization, ratings/sentiment, distance and availability is done
 *            server-side; the category match is a HARD filter, not a ranking boost,
 *            and providers who can't take the preferred schedule (blocked it on
 *            their Manage Calendar, or already have a request then) are excluded —
 *            when nobody is left the screen shows "No Service Provider Available".
 *            This screen re-checks both, so a provider from another category (e.g. a
 *            home-repair provider on an automotive request) or an unavailable one is
 *            never shown.
 *            "Find another" re-calls it with `exclude` = ids already shown and still
 *            returns only matched providers; once every match has been seen it starts
 *            again from the best match instead of falling back to other categories.
 *
 *   Empty    When no provider can take the preferred schedule, the "Please choose another
 *   state    date and time." link opens the same Preferred Appointment calendar modal used in
 *            CreateServiceRequest.js. Confirming it updates draft.preferredDate /
 *            draft.preferredTime and re-runs the provider search for the new schedule.
 *
 *   Request  POST /service-requests with the full draft (category, description, photo URL,
 *   Quotation  lat/long, preferred date/time, ai_diagnosis) + the chosen providerId. The
 *            backend creates the SERVICE_REQUEST ('pending_quotation') and — on the
 *            provider's side — notifies them (see the PROVIDER COMMUNICATION comment in
 *            handleRequestQuotation). The POST lives here, so SubmitServiceRequest is a
 *            pure confirmation screen.
 * ========================================================================== */

const CURRENT_STEP = 3;

// --- Preferred-appointment picker (same slots/format as CreateServiceRequest.js) -----------
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Hourly from 9:00 AM to 4:00 PM (working hours end at 5:00 PM). Keep in step with
// APPOINTMENT_TIME_SLOTS in CreateServiceRequest.js.
const APPOINTMENT_START_HOUR = 9;
const APPOINTMENT_END_HOUR = 16;
const formatSlotLabel = (hour24) => `${hour24 % 12 === 0 ? 12 : hour24 % 12}:00 ${hour24 >= 12 ? 'PM' : 'AM'}`;
const APPOINTMENT_TIME_SLOTS = Array.from(
    { length: APPOINTMENT_END_HOUR - APPOINTMENT_START_HOUR + 1 },
    (_, index) => {
        const hour = APPOINTMENT_START_HOUR + index;
        return { value: `${String(hour).padStart(2, '0')}:00`, label: formatSlotLabel(hour), hour };
    },
);

// Pads the leading cells with `null` so day 1 lands under the correct weekday column.
const getCalendarDays = (year, monthIndex) => {
    const startWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < startWeekday; i += 1) days.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) days.push(day);
    return days;
};

// The draft stores the preferred date as 'YYYY-MM-DD' (what the backend wants).
const toIsoDate = (year, monthIndex, day) =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const parseIsoDate = (iso) => {
    if (!iso) return null;
    const [year, month, day] = iso.split('-').map(Number);
    return { year, monthIndex: month - 1, day };
};

const formatLocation = (provider) =>
    [
        provider.locationName,
        provider.distanceKm !== null && provider.distanceKm !== undefined
            ? `${Number(provider.distanceKm).toFixed(1)} km away`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

// Which category keys a provider serves. Reads whichever field the endpoint returns;
// `null` means the endpoint sent no category information at all.
const getProviderCategoryKeys = (provider) => {
    const raw = provider.categoryKeys ?? provider.categories ?? provider.categoryKey ?? provider.category;
    if (raw === undefined || raw === null) return null;
    return []
        .concat(raw)
        .map((entry) =>
            normalizeKey(entry && typeof entry === 'object' ? entry.key ?? entry.categoryKey ?? entry.name : entry),
        )
        .filter(Boolean);
};

let warnedMissingCategory = false;
const matchesRequestCategory = (provider, categoryKey) => {
    const keys = getProviderCategoryKeys(provider);
    if (keys === null) {
        // Can't verify, so trust the server's filter — but make the gap visible while developing.
        if (__DEV__ && !warnedMissingCategory) {
            warnedMissingCategory = true;
            console.warn('[RecommendServiceProvider] providers have no category field (categoryKeys); client-side category check skipped.');
        }
        return true;
    }
    return keys.includes(normalizeKey(categoryKey));
};

const RecommendServiceProvider = ({ navigation }) => {
    const setDraft = useServiceRequestDraftStore((state) => state.setDraft);

    const [providers, setProviders] = useState([]);
    const [selectedProviderId, setSelectedProviderId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [notice, setNotice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Search radius. This request's own value (draft.searchRadiusKm, set by the slider below)
    // wins; otherwise the customer's saved default from their profile.
    const { user } = useAuth();
    const savedRadiusRef = useRef(DEFAULT_CUSTOMER_RADIUS_KM);
    savedRadiusRef.current = user?.search_radius_km ?? DEFAULT_CUSTOMER_RADIUS_KM;
    const [searchRadiusKm, setSearchRadiusKm] = useState(
        useServiceRequestDraftStore.getState().searchRadiusKm ?? savedRadiusRef.current,
    );

    // Appointment picker. `viewed*` is the month the grid shows; `draftAppointment*` is the
    // in-progress pick, so closing without confirming never changes the saved preference.
    const today = new Date();
    const [isAppointmentModalVisible, setIsAppointmentModalVisible] = useState(false);
    const [viewedAppointmentYear, setViewedAppointmentYear] = useState(today.getFullYear());
    const [viewedAppointmentMonth, setViewedAppointmentMonth] = useState(today.getMonth());
    const [draftAppointmentDay, setDraftAppointmentDay] = useState(null);
    const [draftAppointmentTime, setDraftAppointmentTime] = useState(null);
    const appointmentCalendarDays = getCalendarDays(viewedAppointmentYear, viewedAppointmentMonth);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
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

    // Asks the server for ranked providers and keeps only those that match the request's
    // category. Every returned id is remembered (matched or not) so "Find another" never
    // fetches the same provider twice.
    const fetchMatchedProviders = useCallback(async (exclude) => {
        const draft = useServiceRequestDraftStore.getState();
        const list = await getRecommendedProviders({
            categoryKey: draft.categoryKey,
            latitude: draft.location?.latitude,
            longitude: draft.location?.longitude,
            preferredDate: draft.preferredDate,
            preferredTime: draft.preferredTime,
            // BACKEND: matches providers within this many km (and, for 'home', who offer home service).
            radiusKm: draft.searchRadiusKm ?? savedRadiusRef.current,
            serviceLocationType: draft.serviceLocationType,
            exclude,
        });
        list.forEach((provider) => seenProviderIdsRef.current.add(provider.id));
        // The server already excludes providers who are unavailable on the draft's
        // preferred schedule; this keeps any stale/unfiltered response out as well.
        return list.filter(
            (provider) => provider.available !== false && matchesRequestCategory(provider, draft.categoryKey),
        );
    }, []);

    // `findAnother` = true re-queries excluding every provider already shown, instead of
    // looping back to the same result set. Either way the list only ever holds matched providers.
    const loadProviders = useCallback(async ({ findAnother = false } = {}) => {
        setIsLoading(true);
        setLoadError('');
        setNotice('');
        try {
            if (!findAnother) seenProviderIdsRef.current.clear();
            let matches = await fetchMatchedProviders(findAnother ? Array.from(seenProviderIdsRef.current) : []);
            let restarted = false;

            if (findAnother && matches.length === 0) {
                // Every matching provider has been shown: start over from the best match
                // (never widen to other categories).
                seenProviderIdsRef.current.clear();
                matches = await fetchMatchedProviders([]);
                restarted = matches.length > 0;
            }
            if (!isMountedRef.current) return;

            setProviders(matches);
            setSelectedProviderId(matches.length > 0 ? matches[0].id : null);
            if (restarted) {
                setNotice("You've seen every matching service provider — showing the best matches again.");
            }
        } catch (error) {
            if (isMountedRef.current) setLoadError(error.message);
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [fetchMatchedProviders]);

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

    // "Widen search area": remember the new radius on this request and search again.
    const handleRadiusChange = (km) => {
        setSearchRadiusKm(km);
        setDraft({ searchRadiusKm: km });
        loadProviders();
    };

    // --- Preferred appointment picker -------------------------------------------------------
    const handleOpenAppointmentPicker = () => {
        // Re-open on the saved preference (or the current month if there isn't one).
        const { preferredDate, preferredTime } = useServiceRequestDraftStore.getState();
        const saved = parseIsoDate(preferredDate);
        if (saved) {
            setViewedAppointmentYear(saved.year);
            setViewedAppointmentMonth(saved.monthIndex);
            setDraftAppointmentDay(saved.day);
            setDraftAppointmentTime(preferredTime ?? null);
        } else {
            setViewedAppointmentYear(today.getFullYear());
            setViewedAppointmentMonth(today.getMonth());
            setDraftAppointmentDay(null);
            setDraftAppointmentTime(null);
        }
        setIsAppointmentModalVisible(true);
    };

    const handleCloseAppointmentPicker = () => {
        setIsAppointmentModalVisible(false);
    };

    const handlePrevAppointmentMonth = () => {
        setViewedAppointmentMonth((month) => {
            if (month === 0) {
                setViewedAppointmentYear((year) => year - 1);
                return 11;
            }
            return month - 1;
        });
    };

    const handleNextAppointmentMonth = () => {
        setViewedAppointmentMonth((month) => {
            if (month === 11) {
                setViewedAppointmentYear((year) => year + 1);
                return 0;
            }
            return month + 1;
        });
    };

    const isPastDay = (day) => new Date(viewedAppointmentYear, viewedAppointmentMonth, day) < startOfToday;

    // On today's date, slots whose hour has already started can't be picked.
    const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());
    const isSlotPast = (slot, day = draftAppointmentDay) =>
        day !== null &&
        toIsoDate(viewedAppointmentYear, viewedAppointmentMonth, day) === todayIso &&
        slot.hour <= today.getHours();

    const handleSelectAppointmentDay = (day) => {
        setDraftAppointmentDay(day);
        const pickedSlot = APPOINTMENT_TIME_SLOTS.find((slot) => slot.value === draftAppointmentTime);
        if (pickedSlot && isSlotPast(pickedSlot, day)) setDraftAppointmentTime(null);
    };

    const handleConfirmAppointment = () => {
        // Save the new preferred slot, then search again — loadProviders reads the draft
        // from the store, and setDraft updates it synchronously.
        setDraft({
            preferredDate: toIsoDate(viewedAppointmentYear, viewedAppointmentMonth, draftAppointmentDay),
            preferredTime: draftAppointmentTime,
        });
        setIsAppointmentModalVisible(false);
        loadProviders();
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
            setDraft({
                submittedRequestId: created.requestId,
                // Per-customer reference such as "SR-0001", generated by the backend.
                submittedReferenceCode: created.referenceCode ?? null,
            });

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
                <>
                    <View style={styles.emptySection}>
                        <Text style={styles.emptyText}>There are no available service providers at this time.</Text>
                        <TouchableOpacity onPress={handleOpenAppointmentPicker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.emptyLinkText}>Please choose another date and time.</Text>
                        </TouchableOpacity>
                        <View style={styles.widenWrap}>
                            <Text style={styles.widenHint}>Or look farther out:</Text>
                            <RadiusSlider label="Widen search area" value={searchRadiusKm} onChange={handleRadiusChange} />
                        </View>
                    </View>

                    {/* Nothing to request yet, so the button is shown disabled (matches the design). */}
                    <TouchableOpacity disabled>
                        <LinearGradient
                            colors={['#0255AF', '#04A5A5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.requestButton, styles.requestButtonDisabled]}
                        >
                            <Text style={styles.requestButtonText}>Request Quotation</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleFindAnother} style={styles.findAnotherWrap}>
                        <Text style={styles.findAnotherText}>Find another Service Provider</Text>
                    </TouchableOpacity>
                </>
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

                <ProgressBar currentStep={CURRENT_STEP} />

                <Text style={styles.questionTitle}>Recommended Service Providers</Text>
                <Text style={styles.questionSubtitle}>
                    Matched by specialization, customer satisfaction sentiments, ratings and distance from you.
                </Text>

                {renderBody()}
            </ScrollView>

            <Modal
                visible={isAppointmentModalVisible}
                transparent
                animationType="fade"
                onRequestClose={handleCloseAppointmentPicker}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity onPress={handleCloseAppointmentPicker} style={styles.modalCloseButton}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>Preferred Appointment</Text>

                            <Text style={styles.modalSectionLabel}>Select Date</Text>
                            <View style={styles.calendarCard}>
                                <View style={styles.calendarHeaderRow}>
                                    <TouchableOpacity onPress={handlePrevAppointmentMonth} style={styles.calendarArrowButton}>
                                        <Text style={styles.calendarArrow}>‹</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.calendarMonthYear}>
                                        {MONTH_NAMES[viewedAppointmentMonth].slice(0, 3)} {viewedAppointmentYear}
                                    </Text>
                                    <TouchableOpacity onPress={handleNextAppointmentMonth} style={styles.calendarArrowButton}>
                                        <Text style={styles.calendarArrow}>›</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.weekdayRow}>
                                    {WEEKDAY_LABELS.map((label) => (
                                        <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                                    ))}
                                </View>

                                <View style={styles.daysGrid}>
                                    {appointmentCalendarDays.map((day, index) => {
                                        const isSelected = day !== null && day === draftAppointmentDay;
                                        const isDisabled = day === null || isPastDay(day);
                                        return (
                                            <TouchableOpacity
                                                key={`${index}-${day}`}
                                                disabled={isDisabled}
                                                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                                                onPress={() => handleSelectAppointmentDay(day)}
                                            >
                                                {day !== null && (
                                                    <Text
                                                        style={[
                                                            styles.dayCellText,
                                                            isSelected && styles.dayCellTextSelected,
                                                            isDisabled && styles.dayCellTextDisabled,
                                                        ]}
                                                    >
                                                        {day}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <Text style={styles.modalSectionLabel}>Select Time</Text>
                            <View style={styles.timeSlotRow}>
                                {APPOINTMENT_TIME_SLOTS.map((slot) => {
                                    const isSelected = slot.value === draftAppointmentTime;
                                    const isDisabled = isSlotPast(slot);
                                    return (
                                        <TouchableOpacity
                                            key={slot.value}
                                            disabled={isDisabled}
                                            onPress={() => setDraftAppointmentTime(slot.value)}
                                        >
                                            {isSelected ? (
                                                <LinearGradient
                                                    colors={['#0255AF', '#04A5A5']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    style={styles.timeSlotPill}
                                                >
                                                    <Text style={styles.timeSlotTextSelected}>{slot.label}</Text>
                                                </LinearGradient>
                                            ) : (
                                                <View style={[styles.timeSlotPill, styles.timeSlotPillInactive, isDisabled && styles.timeSlotPillDisabled]}>
                                                    <Text style={[styles.timeSlotText, isDisabled && styles.timeSlotTextDisabled]}>{slot.label}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                onPress={handleConfirmAppointment}
                                disabled={draftAppointmentDay === null || draftAppointmentTime === null}
                                style={styles.confirmButtonWrap}
                            >
                                <LinearGradient
                                    colors={['#0255AF', '#04A5A5']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[
                                        styles.confirmButton,
                                        (draftAppointmentDay === null || draftAppointmentTime === null) && styles.confirmButtonDisabled,
                                    ]}
                                >
                                    <Text style={styles.confirmButtonText}>Confirm</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
        textAlign: 'center',
    },
    emptySection: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 8,
    },
    emptyText: {
        fontSize: 13,
        color: '#111111',
        textAlign: 'center',
        marginBottom: 2,
    },
    widenWrap: {
        width: '100%',
        marginTop: 28,
    },
    widenHint: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 6,
    },
    emptyLinkText: {
        fontSize: 13,
        color: '#111111',
        textAlign: 'center',
        textDecorationLine: 'underline',
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
    requestButtonDisabled: {
        opacity: 0.5,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(20, 24, 40, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        maxHeight: '92%',
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
    },
    modalCloseButton: {
        alignSelf: 'flex-end',
        marginBottom: 4,
    },
    modalCloseIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginBottom: 16,
    },
    modalSectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 8,
    },
    calendarCard: {
        backgroundColor: '#F1F2F5',
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
    },
    calendarHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    calendarArrowButton: {
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarArrow: {
        fontSize: 18,
        color: '#333333',
        fontWeight: '700',
    },
    calendarMonthYear: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    weekdayRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    weekdayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11,
        color: '#999999',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        marginBottom: 2,
    },
    dayCellSelected: {
        backgroundColor: '#204C96',
    },
    dayCellText: {
        fontSize: 12,
        color: '#333333',
    },
    dayCellTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    dayCellTextDisabled: {
        color: '#CCCCCC',
    },
    timeSlotRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    timeSlotPill: {
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 10,
    },
    timeSlotPillDisabled: {
        backgroundColor: '#F4F4F4',
        borderColor: '#EEEEEE',
    },
    timeSlotTextDisabled: {
        color: '#BBBBBB',
    },
    timeSlotPillInactive: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        backgroundColor: '#FFFFFF',
    },
    timeSlotText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333333',
    },
    timeSlotTextSelected: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    confirmButtonWrap: {
        alignSelf: 'flex-end',
    },
    confirmButton: {
        borderRadius: 10,
        paddingHorizontal: 24,
        paddingVertical: 11,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        opacity: 0.5,
    },
    confirmButtonText: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default RecommendServiceProvider;