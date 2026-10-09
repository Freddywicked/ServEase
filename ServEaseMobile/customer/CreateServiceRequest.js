import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import {
    getCategories,
    getAppointmentTimeSlots,
    uploadServiceRequestPhoto,
    reverseGeocode,
} from '../api/servicerequest_api';
import { getCurrentCoordinates } from '../utils/deviceLocation';

/* ============================================================================
 * CreateServiceRequest (step 1 of 4)
 * ----------------------------------------------------------------------------
 * Collects the request details into the shared draft store
 * (store/serviceRequestDraftStore.js) so every later screen —
 * AIDiagnosis -> AIResult -> RecommendServiceProvider -> SubmitServiceRequest —
 * can read them. Nothing is written to SERVICE_REQUEST yet; that happens once
 * the customer picks a provider (RecommendServiceProvider) or marks the problem
 * solved by the AI suggestions (AIResult).
 *
 * Backend data used here:
 *   GET  /categories                  -> category buttons
 *   GET  /appointment-time-slots      -> preferred-time pills
 *   POST /service-requests/photos     -> uploads the chosen photo, returns its URL
 *   GET  /location/reverse-geocode    -> address + map thumbnail for the coordinates
 *
 * Preferred Appointment is the customer's stated preference
 * (SERVICE_REQUEST.preferred_date / preferred_time). It is distinct from the
 * submission timestamp and from the appointment confirmed later in RequestDetails.js.
 * ========================================================================== */

const TOTAL_STEPS = 4;
const CURRENT_STEP = 1;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Pads the leading cells with `null` so day 1 lands under the correct weekday
// column. Worth extracting into one shared `CalendarPicker` along with
// RequestDetails.js's calendar.
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

// "Sep 24, 2026" — for display in the field once a date is picked.
const formatAppointmentDate = ({ year, monthIndex, day }) => `${MONTH_NAMES[monthIndex].slice(0, 3)} ${day}, ${year}`;

const CreateServiceRequest = ({ navigation }) => {
    // The draft lives in the shared store, so going back from a later step keeps what was typed.
    const draft = useServiceRequestDraftStore((state) => state);
    const setDraft = useServiceRequestDraftStore((state) => state.setDraft);

    const [categories, setCategories] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [optionsStatus, setOptionsStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
    const [optionsError, setOptionsError] = useState(''); // why loading failed (shown under the retry hint)
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isLocating, setIsLocating] = useState(false);

    // Preferred appointment picker.
    // `viewed*` is which month the grid is showing (moves as the customer taps ‹ ›).
    // The committed appointment is draft.preferredDate / draft.preferredTime.
    // `draftAppointment*` holds the in-progress pick while the modal is open, so
    // closing without confirming never overwrites an already-confirmed appointment.
    const today = new Date();
    const [isAppointmentModalVisible, setIsAppointmentModalVisible] = useState(false);
    const [viewedAppointmentYear, setViewedAppointmentYear] = useState(today.getFullYear());
    const [viewedAppointmentMonth, setViewedAppointmentMonth] = useState(today.getMonth());
    const [draftAppointmentDay, setDraftAppointmentDay] = useState(null);
    const [draftAppointmentTime, setDraftAppointmentTime] = useState(null);

    const confirmedDate = parseIsoDate(draft.preferredDate);
    const confirmedTimeLabel = timeSlots.find((slot) => slot.value === draft.preferredTime)?.label ?? draft.preferredTime;
    const appointmentCalendarDays = getCalendarDays(viewedAppointmentYear, viewedAppointmentMonth);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const loadOptions = useCallback(async () => {
        setOptionsStatus('loading');
        setOptionsError('');
        try {
            const [categoryList, slotList] = await Promise.all([getCategories(), getAppointmentTimeSlots()]);
            setCategories(categoryList);
            setTimeSlots(slotList);
            setOptionsStatus('ready');
        } catch (error) {
            // Kept on screen (not just the console) so connection problems can be
            // diagnosed on a physical device without a logcat setup.
            setOptionsError(error?.message || String(error));
            setOptionsStatus('error');
        }
    }, []);

    useEffect(() => {
        loadOptions();
    }, [loadOptions]);

    const handleClose = () => {
        navigation.goBack();
    };

    const handleSelectCategory = (categoryKey) => {
        setDraft({ categoryKey });
    };

    const handleUploadImage = async () => {
        if (isUploadingPhoto) return;
        const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 1,
            quality: 0.8,
            // The server rejects images over 5 MB; resizing on the device keeps phone photos under that.
            maxWidth: 1600,
            maxHeight: 1600,
        });
        if (result.didCancel) return;
        if (result.errorCode) {
            Alert.alert('Could not open photos', result.errorMessage || 'Please check photo permissions and try again.');
            return;
        }
        const asset = result.assets?.[0];
        if (!asset?.uri) return;

        // Show the local preview right away, then upload; the uploaded storage path (not the
        // local URI) is what travels to SERVICE_REQUEST_ATTACHMENT.file_url.
        setDraft({ photoUri: asset.uri, photoPath: null });
        setIsUploadingPhoto(true);
        try {
            const { path } = await uploadServiceRequestPhoto(asset);
            setDraft({ photoPath: path });
        } catch (error) {
            setDraft({ photoUri: null, photoPath: null });
            Alert.alert('Photo upload failed', error.message);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleTurnOnLocation = async () => {
        if (isLocating) return;
        setIsLocating(true);
        try {
            // Raw latitude/longitude are kept — they map to SERVICE_REQUEST.latitude/longitude
            // and RecommendServiceProvider needs them to sort providers by distance.
            const { latitude, longitude } = await getCurrentCoordinates();
            let address = null;
            let mapImageUri = null;
            try {
                ({ address, mapImageUri } = await reverseGeocode({ latitude, longitude }));
            } catch (geocodeError) {
                // Non-fatal: coordinates alone are enough to continue.
            }
            setDraft({ location: { latitude, longitude, address, mapImageUri } });
        } catch (error) {
            if (error.message === 'LOCATION_PERMISSION_DENIED') {
                Alert.alert('Location permission needed', 'Allow location access so we can find service providers near you.');
            } else {
                Alert.alert('Could not get your location', 'Make sure location services are on and try again.');
            }
        } finally {
            setIsLocating(false);
        }
    };

    const handleOpenAppointmentPicker = () => {
        // Re-open on whatever was last confirmed (or the current month if nothing is picked).
        if (confirmedDate) {
            setViewedAppointmentYear(confirmedDate.year);
            setViewedAppointmentMonth(confirmedDate.monthIndex);
            setDraftAppointmentDay(confirmedDate.day);
            setDraftAppointmentTime(draft.preferredTime);
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

    const isPastDay = (day) => new Date(viewedAppointmentYear, viewedAppointmentMonth, day) < startOfToday;

    const handleConfirmAppointment = () => {
        // This is the customer's PREFERRED slot, not a confirmed one — it travels with the
        // draft and lands in SERVICE_REQUEST.preferred_date / preferred_time on submit.
        setDraft({
            preferredDate: toIsoDate(viewedAppointmentYear, viewedAppointmentMonth, draftAppointmentDay),
            preferredTime: draftAppointmentTime,
        });
        setIsAppointmentModalVisible(false);
    };

    const handleNext = () => {
        if (!draft.categoryKey) {
            Alert.alert('Pick a category', 'Choose what kind of repair you need.');
            return;
        }
        if (!draft.description.trim()) {
            Alert.alert('Describe the problem', 'Tell us what is going on so we can diagnose it.');
            return;
        }
        if (isUploadingPhoto) {
            Alert.alert('Please wait', 'Your photo is still uploading.');
            return;
        }
        if (!draft.location) {
            Alert.alert('Turn on location', 'We need your location to find service providers near you.');
            return;
        }
        // Everything collected here is already in the draft store; AIDiagnosis reads it from there.
        navigation.navigate(ROUTES.AI_DIAGNOSIS);
    };

    const renderCategoryButton = (category, containerStyle) => {
        // Every category is a gradient pill (matches the design). The selected one is
        // marked with a navy ring around it; the ring is always reserved (transparent
        // when not selected) so selecting never shifts the layout.
        const isSelected = category.key === draft.categoryKey;

        return (
            <Pressable
                key={category.key}
                style={[containerStyle, styles.categoryRing, isSelected && styles.categoryRingSelected]}
                onPress={() => handleSelectCategory(category.key)}
            >
                <LinearGradient
                    colors={['#0255AF', '#04A5A5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.categoryButton}
                >
                    <Text style={styles.categoryButtonText} numberOfLines={2}>
                        {category.label}
                    </Text>
                </LinearGradient>
            </Pressable>
        );
    };

    // Two half-width buttons per row; a leftover odd one gets a full-width row.
    const renderCategoryRows = () => {
        const rows = [];
        for (let i = 0; i < categories.length; i += 2) {
            const pair = categories.slice(i, i + 2);
            rows.push(
                pair.length === 2 ? (
                    <View key={pair[0].key} style={styles.categoryRow}>
                        {pair.map((category) => renderCategoryButton(category, styles.categoryHalf))}
                    </View>
                ) : (
                    renderCategoryButton(pair[0], styles.categoryFull)
                ),
            );
        }
        return rows;
    };

    const renderCategorySection = () => {
        if (optionsStatus === 'loading') {
            return <ActivityIndicator color="#0255AF" style={styles.optionsLoading} />;
        }
        if (optionsStatus === 'error') {
            return (
                <TouchableOpacity onPress={loadOptions} style={styles.optionsLoading}>
                    <Text style={styles.turnOnLocationText}>Couldn't load categories. Tap to retry.</Text>
                    {optionsError ? (
                        <Text style={styles.optionsErrorText}>{optionsError}</Text>
                    ) : null}
                </TouchableOpacity>
            );
        }
        return renderCategoryRows();
    };

    const canPickAppointment = optionsStatus === 'ready';

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

                <Text style={styles.questionTitle}>What needs fixing?</Text>
                <Text style={styles.questionSubtitle}>
                    Pick a category and tell us what's going on — the more detail, the better the diagnosis.
                </Text>

                <Text style={styles.sectionLabel}>Category</Text>
                <View style={styles.categoryList}>{renderCategorySection()}</View>

                <Text style={styles.sectionLabel}>Describe the Problem</Text>
                <TextInput
                    style={styles.problemInput}
                    placeholder="e.g. Screen cracked"
                    placeholderTextColor="#999999"
                    value={draft.description}
                    onChangeText={(description) => setDraft({ description })}
                    multiline
                />

                <Text style={styles.sectionLabel}>Photo (optional)</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={handleUploadImage} activeOpacity={0.85}>
                    {draft.photoUri ? (
                        <>
                            <Image source={{ uri: draft.photoUri }} style={styles.uploadedImage} />
                            {isUploadingPhoto && (
                                <View style={styles.uploadOverlay}>
                                    <ActivityIndicator color="#FFFFFF" />
                                </View>
                            )}
                        </>
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
                    disabled={!canPickAppointment}
                    activeOpacity={0.85}
                >
                    <Image source={require('../assets/icon_calendar.png')} style={styles.calendarIcon} />
                    <View style={styles.appointmentTextWrap}>
                        <Text style={styles.appointmentTitle}>Preferred Appointment</Text>
                        <Text style={styles.appointmentSubtitle}>
                            {confirmedDate && draft.preferredTime
                                ? `${formatAppointmentDate(confirmedDate)} · ${confirmedTimeLabel}`
                                : 'Choose a date and time'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>Location</Text>
                {draft.location ? (
                    <View>
                        {draft.location.mapImageUri ? (
                            <Image source={{ uri: draft.location.mapImageUri }} style={styles.locationImage} />
                        ) : null}
                        {draft.location.address ? (
                            <Text style={styles.locationAddressText}>{draft.location.address}</Text>
                        ) : null}
                        <TouchableOpacity onPress={handleTurnOnLocation} disabled={isLocating}>
                            <Text style={styles.turnOnLocationText}>{isLocating ? 'Updating…' : 'Update location'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity onPress={handleTurnOnLocation} disabled={isLocating}>
                        {isLocating ? (
                            <ActivityIndicator color="#0255AF" />
                        ) : (
                            <Text style={styles.turnOnLocationText}>Turn on location</Text>
                        )}
                    </TouchableOpacity>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity onPress={handleNext}>
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
                                    const isDisabled = day === null || isPastDay(day);
                                    return (
                                        <TouchableOpacity
                                            key={`${index}-${day}`}
                                            disabled={isDisabled}
                                            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                                            onPress={() => setDraftAppointmentDay(day)}
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
                            {timeSlots.length === 0 && <Text style={styles.uploadText}>No time slots available.</Text>}
                            {timeSlots.map((slot) => {
                                const isSelected = slot.value === draftAppointmentTime;
                                return (
                                    <TouchableOpacity key={slot.value} onPress={() => setDraftAppointmentTime(slot.value)}>
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
                                            <View style={[styles.timeSlotPill, styles.timeSlotPillInactive]}>
                                                <Text style={styles.timeSlotText}>{slot.label}</Text>
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
    categoryRing: {
        borderWidth: 2,
        borderColor: 'transparent',
        borderRadius: 14,
    },
    categoryRingSelected: {
        borderColor: '#1B2A8C',
    },
    categoryButton: {
        minHeight: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#B8C4D6',
        paddingVertical: 10,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
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
    optionsLoading: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    uploadOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationAddressText: {
        fontSize: 12,
        color: '#555555',
        marginBottom: 8,
    },
    optionsErrorText: {
        marginTop: 6,
        fontSize: 11,
        color: '#B00020',
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    dayCellTextDisabled: {
        color: '#CCCCCC',
    },
});

export default CreateServiceRequest;