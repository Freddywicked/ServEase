import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ACTIVE_TAB = 'Track';

// Bottom tab definitions — same icon set and pattern as Track.js.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const TIME_SLOTS = ['10:00 AM', '11:00 AM'];

// Builds one grid of day numbers for a given month, padded with `null` for
// the leading empty cells so the first real day lands under the right
// weekday column. Purely a date calculation, not something that needs a
// backend — the request-specific default date below is what's hardcoded.
const getCalendarDays = (year, monthIndex) => {
    const startWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < startWeekday; i += 1) days.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) days.push(day);
    return days;
};

// Hardcoded per instructions for this round of frontend review — the adviser
// is checking the coded frontend before the backend exists. Once real
// navigation params + a backend fetch are wired up, this should come from
// route.params (e.g. route.params.requestNumber) instead, e.g.
// fetchRequestDetail(route.params.requestNumber).then(setRequestDetail).
const REQUEST_DETAIL = {
    requestNumber: 'SR-0000',
    providerName: 'Mico Dominic',
    reason: 'This sentence states the reason to justify the labor.',
    lineItems: [{ label: 'Labor', amount: 850 }],
    total: 850,
    initialFeePercent: 20,
    defaultAppointment: { year: 2026, monthIndex: 8, day: 9 }, // September 9, 2026
};

const RequestDetails = ({ navigation, route }) => {
    // null | 'schedule' | 'approved' — which modal (if any) is on screen.
    const [modalStep, setModalStep] = useState(null);
    const [calendarYear, setCalendarYear] = useState(REQUEST_DETAIL.defaultAppointment.year);
    const [calendarMonth, setCalendarMonth] = useState(REQUEST_DETAIL.defaultAppointment.monthIndex);
    const [selectedDate, setSelectedDate] = useState(REQUEST_DETAIL.defaultAppointment.day);
    const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[0]);

    const calendarDays = getCalendarDays(calendarYear, calendarMonth);

    const handleClose = () => {
        navigation.goBack();
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleApprove = () => {
        setModalStep('schedule');
    };

    const handleDecline = () => {
        // TODO: send the decline via the backend once the API is ready, e.g.
        // declineRequest(REQUEST_DETAIL.requestNumber).then(() => navigation.goBack());
        navigation.goBack();
    };

    const handlePrevMonth = () => {
        setCalendarMonth((month) => {
            if (month === 0) {
                setCalendarYear((year) => year - 1);
                return 11;
            }
            return month - 1;
        });
    };

    const handleNextMonth = () => {
        setCalendarMonth((month) => {
            if (month === 11) {
                setCalendarYear((year) => year + 1);
                return 0;
            }
            return month + 1;
        });
    };

    const handleConfirmSchedule = () => {
        // TODO: submit `selectedDate`/`selectedTime` (plus calendarMonth/calendarYear)
        // to the backend once the appointment-scheduling API is ready.
        setModalStep('approved');
    };

    const handleProceedToPayment = () => {
        // TODO: navigate to the actual payment screen once it exists, e.g.
        // navigation.navigate('Payment', { requestNumber: REQUEST_DETAIL.requestNumber });
        setModalStep(null);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity onPress={handleClose}>
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.header}>My Requests</Text>

                <Text style={styles.requestNumber}>Request #{REQUEST_DETAIL.requestNumber}</Text>
                <Text style={styles.senderLine}>{REQUEST_DETAIL.providerName} sent a quotation</Text>
                <Text style={styles.reasonText}>{REQUEST_DETAIL.reason}</Text>

                <View style={styles.lineItemsCard}>
                    {REQUEST_DETAIL.lineItems.map((item) => (
                        <View key={item.label} style={styles.lineItemRow}>
                            <Text style={styles.lineItemLabel}>{item.label}</Text>
                            <Text style={styles.lineItemAmount}>₱{item.amount.toFixed(2)}</Text>
                        </View>
                    ))}
                    <View style={styles.divider} />
                    <View style={styles.lineItemRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalAmount}>₱{REQUEST_DETAIL.total.toFixed(2)}</Text>
                    </View>
                </View>

                <Text style={styles.noteText}>
                    Note: If you accepted the quotation, you are required to pay the initial fee which is the{' '}
                    {REQUEST_DETAIL.initialFeePercent}% of the total service repair cost.
                </Text>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionButtonHalf} onPress={handleApprove}>
                        <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                            <Text style={styles.actionButtonText}>Approve</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButtonHalf} onPress={handleDecline}>
                        <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
                            <Text style={styles.actionButtonText}>Decline</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => handleTabPress(tab.key)}>
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image source={isActive ? tab.activeIcon : tab.inactiveIcon} style={styles.tabIcon} />
                                <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}> {tab.label}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Modal 1 — pick an appointment date/time after approving the quotation. */}
            <Modal visible={modalStep === 'schedule'} transparent animationType="fade" onRequestClose={() => setModalStep(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalStep(null)}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Quotation Approved</Text>
                        <Text style={styles.modalSubtitle}>
                            You are required to settle the appointment schedule with your service provider.
                        </Text>

                        <Text style={styles.modalSectionLabel}>Select Date</Text>
                        <View style={styles.calendarCard}>
                            <View style={styles.calendarHeaderRow}>
                                <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarArrowButton}>
                                    <Text style={styles.calendarArrow}>‹</Text>
                                </TouchableOpacity>
                                <Text style={styles.calendarMonthYear}>
                                    {MONTH_NAMES[calendarMonth].slice(0, 3)} {calendarYear}
                                </Text>
                                <TouchableOpacity onPress={handleNextMonth} style={styles.calendarArrowButton}>
                                    <Text style={styles.calendarArrow}>›</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.weekdayRow}>
                                {WEEKDAY_LABELS.map((label) => (
                                    <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                                ))}
                            </View>

                            <View style={styles.daysGrid}>
                                {calendarDays.map((day, index) => {
                                    const isSelected = day !== null && day === selectedDate;
                                    return (
                                        <TouchableOpacity
                                            key={`${index}-${day}`}
                                            disabled={day === null}
                                            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                                            onPress={() => day !== null && setSelectedDate(day)}
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
                            {TIME_SLOTS.map((time) => {
                                const isSelected = time === selectedTime;
                                return (
                                    <TouchableOpacity key={time} onPress={() => setSelectedTime(time)}>
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

                        <TouchableOpacity onPress={handleConfirmSchedule} style={styles.confirmButtonWrap}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmButton}>
                                <Text style={styles.confirmButtonText}>Confirm</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal 2 — confirms the appointment and asks for the initial payment. */}
            <Modal visible={modalStep === 'approved'} transparent animationType="fade" onRequestClose={() => setModalStep(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardCompact}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalStep(null)}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Service Request Approved</Text>
                        <Text style={styles.modalSubtitle}>
                            You are required to pay the initial fee which is the {REQUEST_DETAIL.initialFeePercent}% of the total
                            service repair cost.
                        </Text>

                        <TouchableOpacity onPress={handleProceedToPayment}>
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.proceedButton}>
                                <Text style={styles.proceedButtonText}>Proceed to Payment</Text>
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
        flexGrow: 1,
    },
    backIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 12,
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 20,
    },
    requestNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 4,
    },
    senderLine: {
        fontSize: 13,
        color: '#666666',
        marginBottom: 10,
    },
    reasonText: {
        fontSize: 12,
        color: '#777777',
        marginBottom: 18,
    },
    lineItemsCard: {
        marginBottom: 14,
    },
    lineItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    lineItemLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    lineItemAmount: {
        fontSize: 13,
        color: '#666666',
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    totalAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    noteText: {
        fontSize: 12,
        color: '#777777',
        lineHeight: 17,
        marginBottom: 20,
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    actionButtonHalf: {
        flex: 1,
        marginHorizontal: 4,
    },
    actionButton: {
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '700',
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
    modalCardCompact: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
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
        backgroundColor: '#1B2A8C',
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
        marginBottom: 20,
    },
    timeSlotPill: {
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 10,
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
    confirmButtonText: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    proceedButton: {
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
    },
    proceedButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default RequestDetails;