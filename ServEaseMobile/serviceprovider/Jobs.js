import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Jobs';

// Bottom tab definitions — identical set/route names to IncomingServiceRequest.js
// and ViewServiceRequest.js, with Jobs as the active tab this time.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const FILTER_OPTIONS = ['All', 'Active', 'Pending', 'Done'];

// Total segments drawn in each job's stage-progress bar. Individual segments
// aren't labeled in the design (aside from the current one), so this only
// controls how many bars are drawn and how far the done/current fill reaches.
const STEP_COUNT = 4;

// Hardcoded per job — backend isn't integrated yet. Swap this out for a
// fetched list once the API exists; the shape to match is:
// { id, requestNumber, customerName, date, status, statusLabel, aiSuggestion,
//   currentStepIndex, currentStepLabel, progressPaymentPaid }
const JOBS = [
    {
        id: '1',
        requestNumber: 'SR-0001',
        customerName: 'Nikki Pie',
        date: 'Jun 27',
        status: 'Active',
        statusLabel: 'In Progress',
        aiSuggestion: 'AI suggests LCD problem (96% confidence)',
        currentStepIndex: 1,
        currentStepLabel: 'Repairing',
        progressPaymentPaid: 500,
    },
];

const Jobs = ({ navigation }) => {
    const [selectedFilter, setSelectedFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const handleFilterPress = (filter) => {
        setSelectedFilter(filter);
    };

    const handleUpdateStatus = (jobId) => {
        navigation.navigate('JobUpdateStatus', { jobId });
    };

    const handleNotifyAdditionalParts = (jobId) => {
        navigation.navigate('JobAdditionalParts', { jobId });
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const statusFiltered = selectedFilter === 'All'
        ? JOBS
        : JOBS.filter((job) => job.status === selectedFilter);

    const query = searchQuery.trim().toLowerCase();
    const visibleJobs = query
        ? statusFiltered.filter((job) =>
              job.requestNumber.toLowerCase().includes(query) ||
              job.customerName.toLowerCase().includes(query) ||
              job.currentStepLabel.toLowerCase().includes(query)
          )
        : statusFiltered;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Active Jobs</Text>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search job and details..."
                    placeholderTextColor="#999999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.filterRow}>
                    {FILTER_OPTIONS.map((filter) => {
                        const isActive = filter === selectedFilter;
                        return (
                            <TouchableOpacity
                                key={filter}
                                style={isActive ? styles.filterPillActive : styles.filterPill}
                                onPress={() => handleFilterPress(filter)}
                            >
                                <Text style={isActive ? styles.filterTextActive : styles.filterText}>
                                    {filter}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {visibleJobs.length > 0 ? (
                    visibleJobs.map((job) => (
                        <View key={job.id} style={styles.jobCard}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.requestNumber}>Request #{job.requestNumber}</Text>
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusBadgeText}>{job.statusLabel}</Text>
                                </View>
                            </View>
                            <Text style={styles.jobSubtitle}>{job.customerName} | {job.date}</Text>

                            {job.aiSuggestion ? (
                                <View style={styles.aiBanner}>
                                    <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                                    <Text style={styles.aiBannerText}>{job.aiSuggestion}</Text>
                                </View>
                            ) : null}

                            <View style={styles.divider} />

                            <View style={styles.stepRow}>
                                {Array.from({ length: STEP_COUNT }).map((_, index) => {
                                    let segmentStyle = styles.stepSegmentUpcoming;
                                    if (index < job.currentStepIndex) segmentStyle = styles.stepSegmentDone;
                                    else if (index === job.currentStepIndex) segmentStyle = styles.stepSegmentCurrent;
                                    return (
                                        <View
                                            key={index}
                                            style={[
                                                styles.stepSegmentBase,
                                                segmentStyle,
                                                index === STEP_COUNT - 1 && styles.stepSegmentLast,
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                            <Text style={styles.currentStepLabel}>Current Step: {job.currentStepLabel}</Text>
                            <Text style={styles.progressPaymentText}>
                                Progress Payment ₱{job.progressPaymentPaid} already paid by customer
                            </Text>

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.actionButtonSpacing]}
                                    onPress={() => handleUpdateStatus(job.id)}
                                >
                                    <Text style={styles.actionButtonText}>Update Status</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleNotifyAdditionalParts(job.id)}
                                >
                                    <Text style={styles.actionButtonText}>Notify Additional Parts</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyStateText}>No jobs found</Text>
                )}
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
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    searchInput: {
        backgroundColor: '#EFEFEF',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    filterPill: {
        borderWidth: 1,
        borderColor: '#D5D5D5',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        backgroundColor: '#FFFFFF',
    },
    filterPillActive: {
        borderWidth: 1,
        borderColor: '#0255AF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        backgroundColor: '#0255AF',
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555555',
    },
    filterTextActive: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    jobCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 16,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    statusBadge: {
        backgroundColor: '#2FAE60',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    jobSubtitle: {
        fontSize: 12,
        color: '#888888',
        marginTop: 2,
        marginBottom: 12,
    },
    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    aiIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 8,
    },
    aiBannerText: {
        flex: 1,
        flexShrink: 1,
        fontSize: 12,
        color: '#FFFFFF',
    },
    divider: {
        height: 1,
        backgroundColor: '#EDEDED',
        marginVertical: 14,
    },
    stepRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    stepSegmentBase: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    stepSegmentLast: {
        marginRight: 0,
    },
    stepSegmentDone: {
        backgroundColor: '#2FAE60',
    },
    stepSegmentCurrent: {
        backgroundColor: '#0255AF',
    },
    stepSegmentUpcoming: {
        backgroundColor: '#E0E0E0',
    },
    currentStepLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#222222',
        marginBottom: 4,
    },
    progressPaymentText: {
        fontSize: 12,
        color: '#888888',
        marginBottom: 16,
    },
    actionRow: {
        flexDirection: 'row',
    },
    actionButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderRadius: 20,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    actionButtonSpacing: {
        marginRight: 10,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333333',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 20,
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
});

export default Jobs;