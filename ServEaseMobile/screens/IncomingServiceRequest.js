import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ACTIVE_TAB = 'Requests';

// Bottom tab definitions — identical set/route names to ServiceProviderDashboard.js,
// with Requests as the active tab this time.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'Requests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Filter chip labels — these double as the values matched against each
// request's `status` field below (aside from 'All', which shows everything).
// 'Appointment' is intentionally left out — that feature (with its calendar
// and reschedule flow) isn't in scope yet.
const FILTER_OPTIONS = ['All', 'New', 'Pending'];

// Hardcoded per request — backend isn't integrated yet. Swap this out for a
// fetched list once the API exists; the shape to match is:
// { id, requestNumber, customerName, date, aiSuggestion, distanceAway, status }
const SAMPLE_REQUESTS = [
    {
        id: '1',
        requestNumber: 'SR-0001',
        customerName: 'Dominic Alcantara',
        date: 'Jun 27',
        aiSuggestion: 'AI suggests capacitor failure (82% confidence)',
        distanceAway: '1.2 km away',
        status: 'New',
    },
];

const IncomingServiceRequest = ({ navigation }) => {
    const [selectedFilter, setSelectedFilter] = useState('New');

    const handleFilterPress = (filter) => {
        setSelectedFilter(filter);
    };

    const handleViewRequest = (requestId) => {
        // TODO: point this to the actual request-detail screen once it exists
        navigation.navigate('ServiceRequestDetail', { requestId });
    };

    const handleApproveRequest = (requestId) => {
        // TODO: call the approve-request endpoint once it exists
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const filteredRequests = selectedFilter === 'All'
        ? SAMPLE_REQUESTS
        : SAMPLE_REQUESTS.filter((item) => item.status === selectedFilter);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Incoming Service Requests</Text>

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

                {filteredRequests.length > 0 ? (
                    filteredRequests.map((item) => (
                        <View key={item.id} style={styles.requestCard}>
                            <Text style={styles.requestNumber}>Request #{item.requestNumber}</Text>
                            <Text style={styles.requestSubtitle}>{item.customerName} | {item.date}</Text>

                            {item.aiSuggestion ? (
                                <View style={styles.aiBanner}>
                                    <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                                    <Text style={styles.aiBannerText}>{item.aiSuggestion}</Text>
                                </View>
                            ) : null}

                            <View style={styles.locationRow}>
                                <Image source={require('../assets/icon_pinloc.png')} style={styles.pinIcon} />
                                <Text style={styles.locationText}>{item.distanceAway}</Text>
                            </View>

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.viewButton} onPress={() => navigation.navigate('ViewServiceRequest')}>
                                    <Text style={styles.viewButtonText}>View</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleApproveRequest(item.id)}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.approveButton}>
                                        <Text style={styles.approveButtonText}>Approve</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyStateText}>No requests found</Text>
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
        fontSize: 22,
        fontWeight: '800',
        color: '#1B2A8C',
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
    requestCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 16,
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    requestSubtitle: {
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
        marginBottom: 12,
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
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    pinIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 6,
    },
    locationText: {
        fontSize: 12,
        color: '#666666',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    viewButton: {
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    viewButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    approveButton: {
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    approveButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
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

export default IncomingServiceRequest;