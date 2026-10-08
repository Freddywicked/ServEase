import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth, VERIFIED_STATUS } from '../context/auth_context';
import { getProviderProfile, getProviderUnavailableSlots, setProviderSlotAvailability } from '../api/client';
import { ROUTES } from '../navigation/routes';
import { getCategories, getProviderDashboard } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';

// Must match the `key` of the Home tab below so it is highlighted.
const ACTIVE_TAB = ROUTES.SERVICE_PROVIDER_DASHBOARD;

// Bottom tab definitions — each tab carries both its active (white) and
// inactive (colored) icon so the same list can drive the bar regardless of
// which tab is currently active. Same icon set as the Customer Home screen.
const TAB_ITEMS = [
    { key: ROUTES.SERVICE_PROVIDER_DASHBOARD, label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: ROUTES.INCOMING_SERVICE_REQUEST, label: 'Requests', activeIcon: require('../assets/icon_request_white.png'), inactiveIcon: require('../assets/icon_request_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_dollar_white.png'), inactiveIcon: require('../assets/icon_dollar_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Bookable hourly slots, 9:00 AM through 5:00 PM. Change the range here.
const FIRST_HOUR = 9;
const LAST_HOUR = 17;
const TIME_SLOTS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => {
    const hour = FIRST_HOUR + index;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return { value: `${String(hour).padStart(2, '0')}:00`, label: `${display}:00 ${suffix}` };
});

// 'YYYY-MM-DD' in local time — the format used to store/send unavailable dates.
const toDateKey = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

// Cells for one month grid: leading nulls for the empty days before the 1st.
const buildMonthCells = (year, month) => {
    const leading = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cells = Array(leading).fill(null);
    for (let day = 1; day <= total; day += 1) {
        cells.push(new Date(year, month, day));
    }
    return cells;
};

const ServiceProviderDashboard = ({ navigation }) => {
    // `user` (name, email, ...) and `provider` ({ verification_status }) come from
    // auth_context. The provider's own details (years, specializations, ...) come
    // from GET /api/providers/me. Once the admin approves the application on the
    // web dashboard, refreshUser() returns 'verified' and the screen updates.
    //
    // Stats, active repair, notifications and pending requests come from
    // GET /provider/dashboard — the provider's view of the SERVICE_REQUEST rows that
    // customers send from the Create Service Request flow. A request a customer just
    // sent shows up under PENDING REQUESTS (and as a notification) as soon as this
    // screen is focused.
    const { user, provider, refreshUser } = useAuth();
    const isVerified = provider?.verification_status === VERIFIED_STATUS;

    const [profile, setProfile] = useState(null);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [stats, setStats] = useState(null); // null until loaded -> cards show '–'
    const [activeRepair, setActiveRepair] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loadFailed, setLoadFailed] = useState(false);

    // Calendar modal state. `unavailableSlots` holds 'YYYY-MM-DDTHH:00' strings.
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [viewMonth, setViewMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [unavailableSlots, setUnavailableSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [savingDate, setSavingDate] = useState(false);

    // The provider's title is the first of their saved specializations that is a service category.
    // Registration stores specialization names as free text mixed with chosen services
    // ("Phone Repair", "Home Repair Services", a custom service ...), so the category-level
    // names come from GET /categories (`specializationNames` per category) instead of a
    // hard-coded list. Compared case-insensitively — the admin screens already treat
    // "Phone Repair" and "Phone repair" as the same category.
    const categoryNames = categoryOptions
        .flatMap((option) => option.specializationNames ?? [option.label])
        .map((name) => name.toLowerCase());
    const providerName = user?.name || 'Provider';
    const categories = (profile?.specializations || []).filter((item) => categoryNames.includes(String(item).toLowerCase()));
    const providerTitle = categories[0] ? `${categories[0]} Provider` : 'Service Provider';

    const loadProfile = useCallback(async () => {
        try {
            const data = await getProviderProfile();
            setProfile(data?.provider ?? null);
        } catch (error) {
            // Keep the last known data. A 401 is already handled by api/client
            // (token cleared + setOnUnauthorized callback).
        }
    }, []);

    const loadCategories = useCallback(async () => {
        try {
            setCategoryOptions(await getCategories());
        } catch (error) {
            // Non-fatal: the title just falls back to 'Service Provider'.
        }
    }, []);

    const loadDashboard = useCallback(async () => {
        try {
            const data = await getProviderDashboard();
            setStats(data.stats ?? null);
            setActiveRepair(data.activeRepair ?? null);
            setNotifications(data.notifications ?? []);
            setPendingRequests(data.pendingRequests ?? []);
            setLoadFailed(false);
        } catch (error) {
            if (error.status === 403) {
                // Not verified yet: nothing to show, and the banner below already explains why.
                setStats(null);
                setActiveRepair(null);
                setNotifications([]);
                setPendingRequests([]);
                setLoadFailed(false);
            } else {
                setLoadFailed(true);
            }
        }
    }, []);

    useEffect(() => {
        loadProfile();
        loadCategories();
    }, [loadProfile, loadCategories]);

    // Loads the dashboard on mount and every time this screen regains focus, so new
    // customer requests and quotation updates appear when the provider comes back.
    useFocusEffect(
        useCallback(() => {
            loadDashboard();
        }, [loadDashboard]),
    );

    // Re-sync whenever this screen comes into focus, so an admin approval shows
    // up without logging out and back in.
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', async () => {
            try {
                await refreshUser();
            } catch (error) {
                // Non-fatal: keep showing the last known data.
            }
            loadProfile();
        });
        return unsubscribe;
    }, [navigation, refreshUser, loadProfile]);

    // ---------------------------------------------------------------------
    // PROVIDER COMMUNICATION (comment block): live updates. Refresh the cards the moment a
    // customer sends this provider a request, without waiting for the next focus.
    // Uncomment once serviceRequestApi.js's Realtime helpers are enabled (needs the mobile
    // Supabase client). `provider.id` is this provider's id.
    //
    // useEffect(() => {
    //     if (!isVerified || !provider?.id) return undefined;
    //     return subscribeToIncomingRequests(provider.id, () => loadDashboard());
    // }, [isVerified, provider?.id, loadDashboard]);
    //
    // (import { subscribeToIncomingRequests } from '../api/serviceRequestApi';)
    // ---------------------------------------------------------------------

    const loadUnavailableSlots = useCallback(async () => {
        try {
            const data = await getProviderUnavailableSlots();
            setUnavailableSlots(data?.slots ?? []);
        } catch (error) {
            // Keep the last known dates.
        }
    }, []);

    const handleManageCalendar = () => {
        setSelectedDate(null);
        setSelectedTime(null);
        setCalendarVisible(true);
        loadUnavailableSlots();
    };

    const handleCloseCalendar = () => {
        setCalendarVisible(false);
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const handleChangeMonth = (offset) => {
        setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
        setSelectedDate(null);
        setSelectedTime(null);
    };

    // makeAvailable = true removes the selected date + time slot from the
    // unavailable list; false adds it. Persisted on the backend, then reflected locally.
    const handleSetAvailability = async (makeAvailable) => {
        if (!selectedDate || !selectedTime || savingDate) return;
        const slotKey = `${selectedDate}T${selectedTime}`;
        setSavingDate(true);
        try {
            await setProviderSlotAvailability(selectedDate, selectedTime, makeAvailable);
            setUnavailableSlots((current) => (
                makeAvailable
                    ? current.filter((key) => key !== slotKey)
                    : [...current.filter((key) => key !== slotKey), slotKey]
            ));
        } catch (error) {
            Alert.alert('Unable to update calendar', 'Please check your connection and try again.');
        } finally {
            setSavingDate(false);
        }
    };

    const handleNotificationsPress = () => {
        // TODO: point this to a full notifications screen once it exists
        navigation.navigate(ROUTES.NOTIFICATIONS);
    };

    const handlePendingRequestPress = () => {
        navigation.navigate(ROUTES.INCOMING_SERVICE_REQUEST);
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const todayKey = toDateKey(new Date());
    const monthCells = buildMonthCells(viewMonth.getFullYear(), viewMonth.getMonth());
    const selectedSlotKey = selectedDate && selectedTime ? `${selectedDate}T${selectedTime}` : null;
    const selectedIsUnavailable = selectedSlotKey ? unavailableSlots.includes(selectedSlotKey) : false;
    const selectedTimeLabel = TIME_SLOTS.find((slot) => slot.value === selectedTime)?.label;

    const showStat = (value) => (value === null || value === undefined ? '–' : String(value));

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.welcomeText}>Welcome, {providerName}!</Text>
                        <Text style={styles.subtitle}>{providerTitle}</Text>
                    </View>
                    <TouchableOpacity onPress={handleNotificationsPress}>
                        <Image source={require('../assets/icon_ringbell.png')} style={styles.bellIcon} />
                    </TouchableOpacity>
                </View>

                {!isVerified && (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerText}>
                            {provider?.verification_status === 'rejected'
                                ? 'Your Service Provider application was not approved.'
                                : 'Your Service Provider application is under review. Your details will appear here once the admin approves it.'}
                        </Text>
                    </View>
                )}

                {loadFailed && (
                    <TouchableOpacity style={styles.pendingBanner} onPress={loadDashboard}>
                        <Text style={styles.pendingBannerText}>Couldn't load your dashboard. Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{showStat(stats?.activeJobs)}</Text>
                        <Text style={styles.statLabel}>Active jobs</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{showStat(stats?.jobsThisMonth)}</Text>
                        <Text style={styles.statLabel}>This month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {stats?.rating !== null && stats?.rating !== undefined ? Number(stats.rating).toFixed(1) : '–'}
                        </Text>
                        <Text style={styles.statLabel}>Rating</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={handleManageCalendar} activeOpacity={0.85}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.calendarButton}
                    >
                        <Text style={styles.calendarButtonText}>Manage your Calendar</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>ACTIVE REPAIR</Text>
                <View style={styles.card}>
                    {activeRepair ? (
                        <Text style={styles.activeRepairText}>
                            {activeRepair.customerName ? `${activeRepair.customerName} — ` : ''}
                            {activeRepair.statusLabel}
                        </Text>
                    ) : (
                        <Text style={styles.emptyStateText}>No Active Repair</Text>
                    )}
                </View>

                <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
                <View style={styles.card}>
                    {notifications.length > 0 ? (
                        notifications.map((item) => (
                            <View key={item.id} style={styles.notificationItem}>
                                <Text style={styles.notificationMessage}>{item.message}</Text>
                                <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyStateText}>No Notifications</Text>
                    )}
                </View>

                <Text style={styles.sectionLabel}>PENDING REQUESTS</Text>
                <View style={styles.card}>
                    {pendingRequests.length > 0 ? (
                        pendingRequests.map((item) => (
                            <TouchableOpacity key={item.id} style={styles.notificationItem} onPress={handlePendingRequestPress}>
                                <Text style={styles.notificationMessage}>
                                    #{item.requestNumber} · {item.customerName}
                                </Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.emptyStateText}>No Pending Requests</Text>
                    )}
                </View>
            </ScrollView>

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => handleTabPress(tab.key)}
                        >
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image
                                    source={isActive ? tab.activeIcon : tab.inactiveIcon}
                                    style={styles.tabIcon}
                                />
                                <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}>
                                    {tab.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Modal
                visible={calendarVisible}
                transparent
                animationType="fade"
                onRequestClose={handleCloseCalendar}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Manage your Calendar</Text>
                            <TouchableOpacity onPress={handleCloseCalendar}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.monthRow}>
                            <TouchableOpacity onPress={() => handleChangeMonth(-1)} style={styles.monthArrow}>
                                <Text style={styles.monthArrowText}>‹</Text>
                            </TouchableOpacity>
                            <Text style={styles.monthLabel}>
                                {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                            </Text>
                            <TouchableOpacity onPress={() => handleChangeMonth(1)} style={styles.monthArrow}>
                                <Text style={styles.monthArrowText}>›</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.weekRow}>
                            {WEEKDAY_LABELS.map((label) => (
                                <Text key={label} style={styles.weekLabel}>{label}</Text>
                            ))}
                        </View>

                        <View style={styles.daysGrid}>
                            {monthCells.map((date, index) => {
                                if (!date) {
                                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                                }
                                const key = toDateKey(date);
                                const isPast = key < todayKey;
                                const blockedCount = unavailableSlots.filter((slot) => slot.startsWith(`${key}T`)).length;
                                const isUnavailable = blockedCount >= TIME_SLOTS.length;
                                const isPartial = blockedCount > 0 && !isUnavailable;
                                const isSelected = key === selectedDate;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.dayCell}
                                        disabled={isPast}
                                        onPress={() => { setSelectedDate(key); setSelectedTime(null); }}
                                    >
                                        <View
                                            style={[
                                                styles.dayCircle,
                                                isUnavailable && styles.dayCircleUnavailable,
                                                isPartial && styles.dayCirclePartial,
                                                isSelected && styles.dayCircleSelected,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.dayText,
                                                    isPast && styles.dayTextPast,
                                                    isUnavailable && styles.dayTextUnavailable,
                                                    isSelected && styles.dayTextSelected,
                                                ]}
                                            >
                                                {date.getDate()}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, styles.legendDotUnavailable]} />
                            <Text style={styles.legendText}>Unavailable (all day)</Text>
                            <View style={[styles.legendDot, styles.legendDotPartial]} />
                            <Text style={styles.legendText}>Some times blocked</Text>
                        </View>

                        <Text style={styles.selectTimeTitle}>Select Time</Text>
                        <View style={styles.timeRow}>
                            {TIME_SLOTS.map((slot) => {
                                const isChosen = slot.value === selectedTime;
                                const slotBlocked = selectedDate
                                    ? unavailableSlots.includes(`${selectedDate}T${slot.value}`)
                                    : false;
                                return (
                                    <TouchableOpacity
                                        key={slot.value}
                                        disabled={!selectedDate}
                                        onPress={() => setSelectedTime(slot.value)}
                                        style={[
                                            styles.timeChip,
                                            slotBlocked && styles.timeChipBlocked,
                                            isChosen && styles.timeChipSelected,
                                            !selectedDate && styles.actionButtonDisabled,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.timeChipText,
                                                slotBlocked && styles.timeChipTextBlocked,
                                                isChosen && styles.timeChipTextSelected,
                                            ]}
                                        >
                                            {slot.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.selectedInfo}>
                            {!selectedDate
                                ? 'Select a date to change your availability'
                                : !selectedTime
                                    ? 'Select a time'
                                    : `${selectedDate} at ${selectedTimeLabel} is ${selectedIsUnavailable ? 'marked unavailable' : 'available'}`}
                        </Text>

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.availableButton,
                                    (!selectedSlotKey || !selectedIsUnavailable || savingDate) && styles.actionButtonDisabled,
                                ]}
                                disabled={!selectedSlotKey || !selectedIsUnavailable || savingDate}
                                onPress={() => handleSetAvailability(true)}
                            >
                                <Text style={styles.actionButtonText}>Mark as Available</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.unavailableButton,
                                    (!selectedSlotKey || selectedIsUnavailable || savingDate) && styles.actionButtonDisabled,
                                ]}
                                disabled={!selectedSlotKey || selectedIsUnavailable || savingDate}
                                onPress={() => handleSetAvailability(false)}
                            >
                                <Text style={styles.actionButtonText}>Mark as Unavailable</Text>
                            </TouchableOpacity>
                        </View>
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
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headerTextWrap: {
        flex: 1,
        marginRight: 12,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
        marginTop: 6,
    },
    bellIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        marginTop: 4,
    },
    pendingBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginTop: 4,
    },
    pendingBannerText: {
        fontSize: 13,
        color: '#555555',
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 10,
        paddingVertical: 14,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    statLabel: {
        fontSize: 11,
        color: '#666666',
        marginTop: 4,
        textAlign: 'center',
    },
    calendarButton: {
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    calendarButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginTop: 20,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888888',
        letterSpacing: 1,
        marginTop: 20,
        marginBottom: 10,
    },
    card: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        minHeight: 90,
        justifyContent: 'center',
    },
    activeRepairText: {
        fontSize: 14,
        color: '#333333',
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
    },
    notificationItem: {
        marginBottom: 10,
    },
    notificationMessage: {
        fontSize: 13,
        color: '#333333',
    },
    notificationTime: {
        fontSize: 11,
        color: '#999999',
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
    },
    tabItemInactive: {
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    tabItemActive: {
        alignItems: 'center',
        backgroundColor: '#0255AF',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginHorizontal: 4,
    },
    tabIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 2,
    },
    tabLabel: {
        fontSize: 11,
        color: '#555555',
    },
    tabLabelActive: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 18,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    modalClose: {
        fontSize: 18,
        color: '#555555',
        paddingHorizontal: 4,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    monthArrow: {
        paddingHorizontal: 14,
        paddingVertical: 4,
    },
    monthArrowText: {
        fontSize: 24,
        color: '#0255AF',
        fontWeight: '700',
    },
    monthLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#222222',
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    weekLabel: {
        width: '14.2857%',
        textAlign: 'center',
        fontSize: 11,
        color: '#888888',
        fontWeight: '600',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.2857%',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircleUnavailable: {
        backgroundColor: '#FDE4E4',
    },
    dayCirclePartial: {
        borderWidth: 1,
        borderColor: '#C62828',
    },
    dayCircleSelected: {
        backgroundColor: '#0255AF',
    },
    dayText: {
        fontSize: 13,
        color: '#222222',
    },
    dayTextPast: {
        color: '#BBBBBB',
    },
    dayTextUnavailable: {
        color: '#C62828',
        fontWeight: '700',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 6,
    },
    legendDotUnavailable: {
        backgroundColor: '#FDE4E4',
        borderWidth: 1,
        borderColor: '#C62828',
    },
    legendText: {
        fontSize: 12,
        color: '#555555',
        marginRight: 12,
    },
    legendDotPartial: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#C62828',
    },
    selectTimeTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginTop: 16,
        marginBottom: 10,
    },
    timeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    timeChip: {
        borderWidth: 1,
        borderColor: '#B8AFAF',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
        marginRight: 8,
        marginBottom: 8,
    },
    timeChipSelected: {
        backgroundColor: '#2B2B2B',
        borderColor: '#2B2B2B',
    },
    timeChipBlocked: {
        borderColor: '#C62828',
    },
    timeChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333333',
    },
    timeChipTextSelected: {
        color: '#FFFFFF',
    },
    timeChipTextBlocked: {
        color: '#C62828',
    },
    selectedInfo: {
        fontSize: 13,
        color: '#333333',
        textAlign: 'center',
        marginTop: 14,
        marginBottom: 12,
    },
    actionRow: {
        flexDirection: 'row',
    },
    actionButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    availableButton: {
        backgroundColor: '#2E7D32',
    },
    unavailableButton: {
        backgroundColor: '#C62828',
    },
    actionButtonDisabled: {
        opacity: 0.35,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
});

export default ServiceProviderDashboard;