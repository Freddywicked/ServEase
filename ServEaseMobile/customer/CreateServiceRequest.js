import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, Pressable, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

/* ============================================================================
 * BACKEND-READY — CreateServiceRequest (step 1 of 4)
 * ----------------------------------------------------------------------------
 * This screen only COLLECTS fields into local state — it doesn't create a
 * SERVICE_REQUEST row yet (that happens once a provider is picked, in
 * SubmitServiceRequest.js). Because the flow spans 4 screens
 * (CreateServiceRequest → AIDiagnosis → AIResult → RecommendServiceProvider →
 * SubmitServiceRequest), the values gathered here need to survive across all
 * of them.
 *
 * Two ways to thread that data through — pick one:
 *   1. Keep passing an ever-growing `route.params` object forward at every
 *      `navigation.navigate(...)` call (what the screens currently attempt,
 *      inconsistently — see the per-handler notes below).
 *   2. Add a Zustand store, e.g. `useServiceRequestDraftStore`, holding
 *      { category, description, photoUri, location, aiDiagnosis, providerId }
 *      that every screen in this flow reads/writes. Zustand is already in
 *      the planned stack, and this is exactly the kind of cross-screen state
 *      it's meant for — recommended over stuffing everything into route
 *      params 4 screens deep.
 *
 * Whichever is picked, do it consistently — right now several buttons call
 * `navigation.navigate(...)` directly instead of the handler defined for
 * them, so the params being carefully assembled here don't actually reach
 * the next screen. Flagged inline at each spot below.
 *
 * Preferred Appointment (added below): this is a THIRD date concept for
 * SERVICE_REQUEST, distinct from the other two already in play elsewhere:
 *   1. SERVICE_REQUEST.date/time — when the request was submitted (audit trail)
 *   2. preferred_date/preferred_time (NEW — this field) — the customer's
 *      stated preference, given upfront before any provider is involved
 *   3. the CONFIRMED appointment set in RequestDetails.js after a quotation
 *      is approved (REPAIR_SERVICE.start_date or dedicated
 *      scheduled_date/scheduled_time fields, per that file's note) — which
 *      may end up different from what's picked here if it doesn't work for
 *      the assigned provider
 * SERVICE_REQUEST needs preferred_date/preferred_time columns added to hold
 * #2. It's also worth having RecommendServiceProvider.js factor this
 * preference into matching/sorting, since a provider who's free at the
 * customer's preferred time is a better match than one who isn't.
 * ========================================================================== */

const TOTAL_STEPS = 4;
const CURRENT_STEP = 1;

// Hardcoded for now — swap this out for a backend fetch once the categories
// API is integrated.
//
// BACKEND-READY: GET /categories (or a static enum shared with the backend).
// Whatever `key` values are used here must match SERVICE_REQUEST.category
// exactly (or a lookup table's category code), since this value is written
// straight to that column with no transformation. If a provider's
// specialization list (SERVICE_PROVIDER_SPECIALIZATION.specialization_name)
// is meant to be matched against this category in RecommendServiceProvider,
// the two vocabularies need to agree on categories now, before either side
// is built out further.
const CATEGORIES = [
    { key: 'HomeRepair', label: 'Home Repair' },
    { key: 'Automotive', label: 'Automotive' },
    { key: 'ITAndPhoneDeviceRepair', label: 'IT and Phone Device Repair' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Placeholder slot list for the picker below — no provider is chosen yet at
// this point in the flow (that happens in RecommendServiceProvider.js), so
// this can't be validated against any one provider's real availability. See
// the BACKEND-READY note above handleConfirmAppointment for what this is
// actually for.
const APPOINTMENT_TIME_SLOTS = ['8:00 AM', '10:00 AM', '1:00 PM', '3:00 PM', '5:00 PM'];

// Same grid-building approach as RequestDetails.js's appointment calendar —
// pads the leading cells with `null` so day 1 lands under the correct
// weekday column. Duplicated here rather than shared since there's no
// existing shared-components file in this project yet; worth extracting into
// one `CalendarPicker` component now that two screens need this same widget.
const getCalendarDays = (year, monthIndex) => {
    const startWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < startWeekday; i += 1) days.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) days.push(day);
    return days;
};

const CreateServiceRequest = ({ navigation }) => {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [hoveredCategory, setHoveredCategory] = useState(null);
    const [problemDescription, setProblemDescription] = useState('');
    const [photo, setPhoto] = useState(null);
    const [location, setLocation] = useState(null);

    // Preferred appointment — unlike RequestDetails.js's calendar (which
    // defaults to a specific hardcoded demo date since it's confirming a
    // slot already in motion), this one has nothing to default to yet, so it
    // opens on today's real month/year with nothing selected.
    //
    // `viewed*` is just which month the grid is currently showing — it moves
    // independently as the customer taps ‹ › to browse. `confirmed*` is the
    // committed appointment shown in the field once "Confirm" is pressed.
    // Keeping these separate (rather than reusing one pair of state
    // variables for both) avoids a real bug: if the customer reopens the
    // picker and browses to a different month without picking a new day,
    // the already-confirmed date's label would otherwise silently pick up
    // whatever month the grid happens to be showing.
    const today = new Date();
    const [isAppointmentModalVisible, setIsAppointmentModalVisible] = useState(false);
    const [viewedAppointmentYear, setViewedAppointmentYear] = useState(today.getFullYear());
    const [viewedAppointmentMonth, setViewedAppointmentMonth] = useState(today.getMonth());
    const [confirmedAppointmentYear, setConfirmedAppointmentYear] = useState(null);
    const [confirmedAppointmentMonth, setConfirmedAppointmentMonth] = useState(null);
    const [confirmedAppointmentDay, setConfirmedAppointmentDay] = useState(null);
    const [confirmedAppointmentTime, setConfirmedAppointmentTime] = useState(null);
    // Holds the in-progress pick while the modal is open, so canceling out
    // (closing without confirming) never overwrites an already-confirmed
    // appointment with a half-made selection.
    const [draftAppointmentDay, setDraftAppointmentDay] = useState(null);
    const [draftAppointmentTime, setDraftAppointmentTime] = useState(null);

    const appointmentCalendarDays = getCalendarDays(viewedAppointmentYear, viewedAppointmentMonth);

    const handleClose = () => {
        navigation.goBack();
    };

    const handleSelectCategory = (categoryKey) => {
        setSelectedCategory(categoryKey);
    };

    const handleUploadImage = () => {
        // TODO: hook this up to an image picker once the backend/storage is ready
        //
        // BACKEND-READY:
        //   1. Open an image picker (e.g. react-native-image-picker), get a local URI.
        //   2. Upload to a Supabase Storage bucket (e.g. `service-request-photos`)
        //      under a path like `${customerId}/${draftRequestId or uuid}.jpg`.
        //   3. Store the resulting public/signed URL — not the raw local URI —
        //      in state, since that's what ultimately needs to travel to
        //      SERVICE_REQUEST_ATTACHMENT.file_url / filename once the request
        //      is submitted. This screen only stages it; the actual
        //      SERVICE_REQUEST_ATTACHMENT row is created once request_id exists.
    };

    const handleTurnOnLocation = () => {
        // TODO: request device location permission / fetch coordinates once
        // location services are integrated
        //
        // BACKEND-READY:
        //   1. Request device location permission, read current coordinates.
        //   2. Use Google Maps Platform (Geocoding API) to reverse-geocode into
        //      a human-readable address for display, and/or a static map
        //      thumbnail (`location.mapImageUri` below) for the preview.
        //   3. Persist raw latitude/longitude — these map directly onto
        //      SERVICE_REQUEST.latitude / SERVICE_REQUEST.longitude and are
        //      what RecommendServiceProvider will need to sort providers by
        //      distance, so don't discard them once the address is displayed.
    };

    const handleOpenAppointmentPicker = () => {
        // Re-open showing whatever was last confirmed (or today, if nothing
        // has been picked yet) rather than always resetting to the current month.
        if (confirmedAppointmentDay !== null) {
            setViewedAppointmentYear(confirmedAppointmentYear);
            setViewedAppointmentMonth(confirmedAppointmentMonth);
            setDraftAppointmentDay(confirmedAppointmentDay);
            setDraftAppointmentTime(confirmedAppointmentTime);
        } else {
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

    const handleConfirmAppointment = () => {
        setConfirmedAppointmentYear(viewedAppointmentYear);
        setConfirmedAppointmentMonth(viewedAppointmentMonth);
        setConfirmedAppointmentDay(draftAppointmentDay);
        setConfirmedAppointmentTime(draftAppointmentTime);
        setIsAppointmentModalVisible(false);
        //
        // BACKEND-READY: this is the customer's PREFERRED slot, not a
        // confirmed one — no provider has been matched yet at this point in
        // the flow, so there's nothing to check this against server-side
        // yet. It just needs to travel forward with the rest of this draft
        // (see the file-level note on the two ways to thread that data) and
        // eventually land in SERVICE_REQUEST.preferred_date /
        // .preferred_time when the request is actually created in
        // SubmitServiceRequest.js.
    };

    // "Sep 24, 2026" — for display in the field once a date is picked.
    const formatAppointmentDate = (year, monthIndex, day) =>
        day === null ? '' : `${MONTH_NAMES[monthIndex].slice(0, 3)} ${day}, ${year}`;

    const handleNext = () => {
        // TODO: validate the fields above and navigate to the next step of the
        // service request flow once it exists
        navigation.navigate('CreateServiceRequestStepTwo');
        //
        // NOTE: this handler isn't actually wired to the "Next" button below —
        // that button calls navigation.navigate('AIDiagnosis') directly, and
        // neither call forwards { selectedCategory, problemDescription, photo,
        // location } as route params. Reconcile these before building the
        // backend integration: pick one target screen name, and either pass
        // this draft forward as params or write it into the shared draft
        // store described in the file-level comment above. AIDiagnosis.js and
        // everything after it currently has no way to receive what was
        // collected on this screen.
    };

    const renderCategoryButton = (category, containerStyle) => {
        // Gradient on select or hover (hover only fires on platforms/pointers
        // that support it, e.g. web or a trackpad — it's a no-op on touch-only
        // devices), plain white otherwise.
        const isActive = category.key === selectedCategory || category.key === hoveredCategory;

        return (
            <Pressable
                key={category.key}
                style={containerStyle}
                onPress={() => handleSelectCategory(category.key)}
                onHoverIn={() => setHoveredCategory(category.key)}
                onHoverOut={() => setHoveredCategory(null)}
            >
                {isActive ? (
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.categoryButton}
                    >
                        <Text style={styles.categoryButtonTextSelected}>{category.label}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.categoryButton, styles.categoryButtonInactive]}>
                        <Text style={styles.categoryButtonText}>{category.label}</Text>
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
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

                <Text style={styles.questionTitle}>What needs fixing?</Text>
                <Text style={styles.questionSubtitle}>
                    Pick a category and tell us what's going on — the more detail, the better the diagnosis.
                </Text>

                <Text style={styles.sectionLabel}>Category</Text>
                <View style={styles.categoryList}>
                    <View style={styles.categoryRow}>
                        {renderCategoryButton(CATEGORIES[0], styles.categoryHalf)}
                        {renderCategoryButton(CATEGORIES[1], styles.categoryHalf)}
                    </View>
                    {renderCategoryButton(CATEGORIES[2], styles.categoryFull)}
                </View>

                <Text style={styles.sectionLabel}>Describe the Problem</Text>
                <TextInput
                    style={styles.problemInput}
                    placeholder="e.g. Screen cracked"
                    placeholderTextColor="#999999"
                    value={problemDescription}
                    onChangeText={setProblemDescription}
                    multiline
                />

                <Text style={styles.sectionLabel}>Photo (optional)</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={handleUploadImage} activeOpacity={0.85}>
                    {photo ? (
                        <Image source={{ uri: photo }} style={styles.uploadedImage} />
                    ) : (
                        <>
                            <Image source={require('../assets/icon_image.png')} style={styles.uploadIcon} />
                            <Text style={styles.uploadText}>Upload Image</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.appointmentBox}
                    onPress={handleOpenAppointmentPicker}
                    activeOpacity={0.85}
                >
                    <Image source={require('../assets/icon_calendar.png')} style={styles.calendarIcon} />
                    <View style={styles.appointmentTextWrap}>
                        <Text style={styles.appointmentTitle}>Preferred Appointment</Text>
                        <Text style={styles.appointmentSubtitle}>
                            {confirmedAppointmentDay !== null
                                ? `${formatAppointmentDate(confirmedAppointmentYear, confirmedAppointmentMonth, confirmedAppointmentDay)} · ${confirmedAppointmentTime}`
                                : 'Choose a date and time'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>Location</Text>
                {location ? (
                    <Image source={{ uri: location.mapImageUri }} style={styles.locationImage} />
                ) : (
                    <TouchableOpacity onPress={handleTurnOnLocation}>
                        <Text style={styles.turnOnLocationText}>Turn on location</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('AIDiagnosis')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.nextButton}
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

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
                                    return (
                                        <TouchableOpacity
                                            key={`${index}-${day}`}
                                            disabled={day === null}
                                            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                                            onPress={() => day !== null && setDraftAppointmentDay(day)}
                                        >
                                            {day !== null && (
                                                <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>{day}</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <Text style={styles.modalSectionLabel}>Select Time</Text>
                        <View style={styles.timeSlotRow}>
                            {APPOINTMENT_TIME_SLOTS.map((time) => {
                                const isSelected = time === draftAppointmentTime;
                                return (
                                    <TouchableOpacity key={time} onPress={() => setDraftAppointmentTime(time)}>
                                        {isSelected ? (
                                            <LinearGradient
                                                colors={['#0255AF', '#04A5A5']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.timeSlotPill}
                                            >
                                                <Text style={styles.timeSlotTextSelected}>{time}</Text>
                                            </LinearGradient>
                                        ) : (
                                            <View style={[styles.timeSlotPill, styles.timeSlotPillInactive]}>
                                                <Text style={styles.timeSlotText}>{time}</Text>
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
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 10,
    },
    categoryList: {
        marginBottom: 20,
    },
    categoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    categoryHalf: {
        width: '48%',
    },
    categoryFull: {
        width: '100%',
    },
    categoryButton: {
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryButtonInactive: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DDDDDD',
    },
    categoryButtonText: {
        fontSize: 15,
        color: '#333333',
        fontWeight: '700',
        textAlign: 'center',
    },
    categoryButtonTextSelected: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
    },
    problemInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 14,
        fontSize: 14,
        color: '#333333',
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    uploadBox: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        minHeight: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    uploadIcon: {
        width: 32,
        height: 32,
        resizeMode: 'contain',
        marginBottom: 8,
    },
    uploadText: {
        fontSize: 13,
        color: '#666666',
    },
    uploadedImage: {
        width: '100%',
        height: 140,
        borderRadius: 10,
        resizeMode: 'cover',
    },
    locationImage: {
        width: '100%',
        height: 110,
        borderRadius: 10,
        resizeMode: 'cover',
    },
    turnOnLocationText: {
        fontSize: 14,
        color: '#0255AF',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    appointmentBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 20,
    },
    calendarIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        tintColor: '#204C96',
        marginRight: 12,
    },
    appointmentTextWrap: {
        flex: 1,
    },
    appointmentTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 2,
    },
    appointmentSubtitle: {
        fontSize: 12,
        color: '#777777',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(20, 24, 40, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
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
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 17,
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
    timeSlotRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    timeSlotPill: {
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 10,
        marginBottom: 10,
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
    footer: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
    },
    nextButton: {
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default CreateServiceRequest;