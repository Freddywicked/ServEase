import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { ROUTES } from '../navigation/routes';
import { useServiceRequestDraftStore } from '../store/ServiceRequestDraftStore';
import ProgressBar from '../components/ProgressBar';
import {
    getCategories,
    uploadServiceRequestPhoto,
    uploadServiceRequestVideo,
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
 *   POST /service-requests/photos     -> uploads each chosen photo, returns its storage path
 *   POST /service-requests/videos     -> uploads the chosen video, returns its storage path
 *   GET  /location/reverse-geocode    -> address + map thumbnail for the coordinates
 *
 * Media: up to MAX_PHOTOS photos and MAX_VIDEOS video. They live in draft.mediaItems
 * ([{ id, type: 'photo'|'video', uri, path, duration, status }]); the first uploaded photo is
 * also mirrored to draft.photoUri / draft.photoPath so existing consumers keep working.
 *
 * Preferred-time pills are built locally (hourly, 9:00 AM - 4:00 PM).
 *
 * Service Location Type (Home-based / Shop-based) is picked from a dropdown next to the
 * Preferred Appointment box and stored in draft.serviceLocationType ('home' | 'shop').
 * The backend field it should map to is up to you (e.g. SERVICE_REQUEST.service_location_type).
 *
 * Preferred Appointment is the customer's stated preference
 * (SERVICE_REQUEST.preferred_date / preferred_time). It is distinct from the
 * submission timestamp and from the appointment confirmed later in RequestDetails.js.
 * ========================================================================== */

const CURRENT_STEP = 1;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MAX_PHOTOS = 4;
const MAX_VIDEOS = 1;
const MAX_MEDIA = MAX_PHOTOS + MAX_VIDEOS;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // keep in step with the server's video limit

// Preferred-appointment slots: hourly from 9:00 AM to 4:00 PM. Working hours end at 5:00 PM,
// so the last slot starts at 4:00 PM. Keep in step with TIME_SLOTS in ServiceProviderDashboard.js.
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

// Where the repair takes place. `value` is what travels in the draft / to the backend.
const SERVICE_LOCATION_TYPES = [
    { value: 'home', label: 'Home-based' },
    { value: 'shop', label: 'Shop-based' },
];

// 75 -> "1:15"
const formatDuration = (seconds) => {
    if (!seconds) return '';
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

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
    const [optionsStatus, setOptionsStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
    const [optionsError, setOptionsError] = useState(''); // why loading failed (shown under the retry hint)
    const [isLocating, setIsLocating] = useState(false);
    const [isLocationTypeOpen, setIsLocationTypeOpen] = useState(false);

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
    const confirmedTimeLabel = APPOINTMENT_TIME_SLOTS.find((slot) => slot.value === draft.preferredTime)?.label ?? draft.preferredTime;
    const selectedLocationType = SERVICE_LOCATION_TYPES.find((type) => type.value === draft.serviceLocationType) ?? null;
    const mediaItems = draft.mediaItems ?? [];
    const photoCount = mediaItems.filter((item) => item.type === 'photo').length;
    const videoCount = mediaItems.filter((item) => item.type === 'video').length;
    const isUploadingMedia = mediaItems.some((item) => item.status === 'uploading');
    const appointmentCalendarDays = getCalendarDays(viewedAppointmentYear, viewedAppointmentMonth);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const loadOptions = useCallback(async () => {
        setOptionsStatus('loading');
        setOptionsError('');
        try {
            setCategories(await getCategories());
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

    const handleSelectLocationType = (value) => {
        setDraft({ serviceLocationType: value });
        setIsLocationTypeOpen(false);
    };

    // --- Media (photos + video) -------------------------------------------------------------
    // Always read/write through the store so overlapping uploads never clobber each other.
    const getMediaItems = () => useServiceRequestDraftStore.getState().mediaItems ?? [];

    const commitMedia = (items) => {
        const firstPhoto = items.find((item) => item.type === 'photo');
        setDraft({
            mediaItems: items,
            photoUri: firstPhoto?.uri ?? null,
            photoPath: firstPhoto?.path ?? null,
        });
    };

    const patchMedia = (id, changes) =>
        commitMedia(getMediaItems().map((item) => (item.id === id ? { ...item, ...changes } : item)));

    const handleRemoveMedia = (id) => {
        commitMedia(getMediaItems().filter((item) => item.id !== id));
    };

    const handleAddMedia = async () => {
        const current = getMediaItems();
        const currentPhotos = current.filter((item) => item.type === 'photo').length;
        const currentVideos = current.filter((item) => item.type === 'video').length;
        if (currentPhotos >= MAX_PHOTOS && currentVideos >= MAX_VIDEOS) {
            Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos and ${MAX_VIDEOS} video.`);
            return;
        }

        // Only offer what still has room, so the picker doesn't show things we'd have to reject.
        const canAddPhoto = currentPhotos < MAX_PHOTOS;
        const canAddVideo = currentVideos < MAX_VIDEOS;
        const result = await launchImageLibrary({
            mediaType: canAddPhoto && canAddVideo ? 'mixed' : canAddPhoto ? 'photo' : 'video',
            selectionLimit: MAX_MEDIA - current.length,
            quality: 0.8,
            // The server rejects images over 5 MB; resizing on the device keeps phone photos under that.
            maxWidth: 1600,
            maxHeight: 1600,
        });
        if (result.didCancel) return;
        if (result.errorCode) {
            Alert.alert('Could not open your gallery', result.errorMessage || 'Please check permissions and try again.');
            return;
        }

        let photosLeft = MAX_PHOTOS - currentPhotos;
        let videosLeft = MAX_VIDEOS - currentVideos;
        let overLimit = 0;
        let tooLarge = 0;
        const accepted = [];
        (result.assets ?? []).forEach((asset) => {
            if (!asset?.uri) return;
            const isVideo = (asset.type || '').startsWith('video');
            if (isVideo) {
                if (videosLeft <= 0) { overLimit += 1; return; }
                if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) { tooLarge += 1; return; }
                videosLeft -= 1;
            } else {
                if (photosLeft <= 0) { overLimit += 1; return; }
                photosLeft -= 1;
            }
            accepted.push({ asset, isVideo });
        });

        if (overLimit > 0 || tooLarge > 0) {
            Alert.alert(
                'Some files were skipped',
                [
                    overLimit > 0 ? `You can add up to ${MAX_PHOTOS} photos and ${MAX_VIDEOS} video.` : null,
                    tooLarge > 0 ? `Videos must be under ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB.` : null,
                ].filter(Boolean).join(' '),
            );
        }
        if (accepted.length === 0) return;

        // Show local previews right away, then upload. The uploaded storage path (not the local
        // URI) is what travels to SERVICE_REQUEST_ATTACHMENT.file_url.
        const stamp = Date.now();
        const newItems = accepted.map(({ asset, isVideo }, index) => ({
            id: `${stamp}-${index}`,
            type: isVideo ? 'video' : 'photo',
            uri: asset.uri,
            duration: asset.duration ?? null,
            path: null,
            status: 'uploading',
        }));
        commitMedia([...getMediaItems(), ...newItems]);

        await Promise.all(
            accepted.map(async ({ asset, isVideo }, index) => {
                const { id } = newItems[index];
                try {
                    const { path } = await (isVideo ? uploadServiceRequestVideo(asset) : uploadServiceRequestPhoto(asset));
                    patchMedia(id, { path, status: 'ready' });
                } catch (error) {
                    handleRemoveMedia(id);
                    Alert.alert(isVideo ? 'Video upload failed' : 'Photo upload failed', error.message);
                }
            }),
        );
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
        if (!draft.serviceLocationType) {
            Alert.alert('Choose a service location type', 'Tell us if the repair is home-based or shop-based.');
            return;
        }
        if (isUploadingMedia) {
            Alert.alert('Please wait', 'Your photos or video are still uploading.');
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
                    <Text
                        style={styles.categoryButtonText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                    >
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

    const renderMediaTile = (item) => (
        <View key={item.id} style={styles.mediaTile}>
            {item.type === 'photo' ? (
                <Image source={{ uri: item.uri }} style={styles.mediaThumb} />
            ) : (
                <View style={[styles.mediaThumb, styles.videoThumb]}>
                    <View style={styles.playTriangle} />
                    <Text style={styles.videoBadge}>
                        VIDEO{item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                    </Text>
                </View>
            )}
            {item.status === 'uploading' && (
                <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                </View>
            )}
            <TouchableOpacity
                style={styles.mediaRemove}
                onPress={() => handleRemoveMedia(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.mediaRemoveText}>×</Text>
            </TouchableOpacity>
        </View>
    );

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

                <Text style={styles.sectionLabel}>Photos & Video (optional)</Text>
                {mediaItems.length === 0 ? (
                    <TouchableOpacity style={styles.uploadBox} onPress={handleAddMedia} activeOpacity={0.85}>
                        <Image source={require('../assets/icon_upload.png')} style={styles.uploadIcon} />
                        <Text style={styles.uploadText}>Upload Photos or Video</Text>
                        <Text style={styles.uploadHint}>
                            Up to {MAX_PHOTOS} photos and {MAX_VIDEOS} video
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.mediaSection}>
                        <View style={styles.mediaGrid}>
                            {mediaItems.map(renderMediaTile)}
                            {mediaItems.length < MAX_MEDIA && (
                                <TouchableOpacity style={styles.addTile} onPress={handleAddMedia} activeOpacity={0.85}>
                                    <Image source={require('../assets/icon_upload.png')} style={styles.addTileIcon} />
                                    <Text style={styles.addTileText}>Add</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={styles.uploadHint}>
                            {photoCount}/{MAX_PHOTOS} photos · {videoCount}/{MAX_VIDEOS} video
                        </Text>
                    </View>
                )}

                <View style={[styles.appointmentRow, isLocationTypeOpen && styles.appointmentRowOpen]}>
                    <TouchableOpacity
                        style={styles.appointmentBox}
                        onPress={handleOpenAppointmentPicker}
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

                    <TouchableOpacity
                        style={styles.locationTypeBox}
                        onPress={() => setIsLocationTypeOpen((open) => !open)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Service location type"
                    >
                        <Text
                            style={[styles.locationTypeText, !selectedLocationType && styles.locationTypePlaceholder]}
                            numberOfLines={1}
                        >
                            {selectedLocationType ? selectedLocationType.label : 'Service Location Type'}
                        </Text>
                        <Text style={[styles.locationTypeChevron, isLocationTypeOpen && styles.locationTypeChevronOpen]}>›</Text>
                    </TouchableOpacity>
                </View>

                {isLocationTypeOpen && (
                    // Rendered in the normal flow (not absolutely positioned) so the options stay
                    // tappable on Android, which ignores touches outside a parent's bounds.
                    <View style={styles.locationTypeMenu}>
                        {SERVICE_LOCATION_TYPES.map((type, index) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[styles.locationTypeOption, index > 0 && styles.locationTypeOptionDivider]}
                                onPress={() => handleSelectLocationType(type.value)}
                            >
                                <Text
                                    style={[
                                        styles.locationTypeOptionText,
                                        type.value === draft.serviceLocationType && styles.locationTypeOptionTextSelected,
                                    ]}
                                >
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

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
        // Fixed height so every category button is the same size, whatever its label length.
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#B8C4D6',
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryButtonText: {
        fontSize: 13,
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
    uploadHint: {
        fontSize: 11,
        color: '#999999',
        marginTop: 4,
    },
    mediaSection: {
        marginBottom: 20,
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    mediaTile: {
        width: 92,
        height: 92,
        marginRight: 8,
        marginBottom: 8,
    },
    mediaThumb: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
        resizeMode: 'cover',
    },
    videoThumb: {
        backgroundColor: '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playTriangle: {
        width: 0,
        height: 0,
        borderTopWidth: 9,
        borderBottomWidth: 9,
        borderLeftWidth: 15,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: '#FFFFFF',
        marginLeft: 4,
    },
    videoBadge: {
        position: 'absolute',
        left: 6,
        bottom: 5,
        fontSize: 9,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    mediaRemove: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mediaRemoveText: {
        color: '#FFFFFF',
        fontSize: 16,
        lineHeight: 18,
        fontWeight: '700',
    },
    addTile: {
        width: 92,
        height: 92,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderStyle: 'dashed',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addTileIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 4,
    },
    addTileText: {
        fontSize: 12,
        color: '#666666',
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
    appointmentRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        marginBottom: 20,
    },
    appointmentRowOpen: {
        marginBottom: 6,
    },
    appointmentBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 10,
        marginRight: 10,
    },
    calendarIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        tintColor: '#204C96',
        marginRight: 8,
    },
    locationTypeBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    locationTypeText: {
        flex: 1,
        fontSize: 12,
        color: '#111111',
        marginRight: 6,
    },
    locationTypePlaceholder: {
        color: '#777777',
    },
    locationTypeChevron: {
        fontSize: 20,
        lineHeight: 20,
        color: '#333333',
        transform: [{ rotate: '90deg' }],
    },
    locationTypeChevronOpen: {
        transform: [{ rotate: '-90deg' }],
    },
    locationTypeMenu: {
        // Sits under the dropdown, i.e. the right-hand half of the row above.
        alignSelf: 'flex-end',
        width: '50%',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        marginBottom: 20,
        overflow: 'hidden',
    },
    locationTypeOption: {
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    locationTypeOptionDivider: {
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    locationTypeOptionText: {
        fontSize: 12,
        color: '#333333',
    },
    locationTypeOptionTextSelected: {
        color: '#0255AF',
        fontWeight: '700',
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