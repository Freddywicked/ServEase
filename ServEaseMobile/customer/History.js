import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMyServiceRequests } from '../api/servicerequest_api';
import { formatShortDate } from '../utils/formatters';

const ACTIVE_TAB = 'History';

// Filter chips for the history list. The selected key is used to
// filter the data once the backend is wired up.
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'repair', label: 'Repair' },
    { key: 'transactions', label: 'Transactions' },
];

// Bottom tab definitions — each tab carries both its active (white) and
// inactive (colored) icon so the same list can drive the bar regardless of
// which tab is currently active.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_search_white.png'), inactiveIcon: require('../assets/icon_search_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const History = ({ navigation }) => {
    const [filter, setFilter] = useState('all');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    // The customer's submitted requests, newest first (GET /service-requests).
    const loadHistory = useCallback(async () => {
        try {
            setRequests(await getMyServiceRequests());
            setLoadFailed(false);
        } catch (error) {
            setLoadFailed(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadHistory().finally(() => setLoading(false));
        }, [loadHistory]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        navigation.navigate(tabKey);
    };

    // 'transactions' = requests that reached a quote/payment stage (a quotation was
    // sent or the job is completed); 'repair' = every service request.
    const history = requests.filter((item) => {
        if (filter === 'transactions') {
            return item.status === 'Completed' || (item.providers || []).some((p) => p.quote);
        }
        return true;
    });

    const renderHistoryItem = ({ item }) => (
        <View style={styles.card}>
            <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.category}</Text>
                <Text style={styles.cardText}>
                    {item.id} · {formatShortDate(item.createdAt)}
                </Text>
            </View>
            <Text style={styles.cardStatus}>{item.status}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={renderHistoryItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator color="#0255AF" style={{ marginTop: 32 }} />
                    ) : (
                        <Text style={styles.emptyText}>
                            {loadFailed ? "Couldn't load your history. Pull down to retry." : 'No service requests yet.'}
                        </Text>
                    )
                }
                ListHeaderComponent={
                    <View>
                        <Text style={styles.header}>History</Text>
                        <View style={styles.chipRow}>
                            {FILTERS.map((f) => {
                                const isActive = f.key === filter;
                                return (
                                    <TouchableOpacity
                                        key={f.key}
                                        style={isActive ? styles.chipActive : styles.chip}
                                        onPress={() => setFilter(f.key)}
                                    >
                                        <Text style={isActive ? styles.chipLabelActive : styles.chipLabel}>{f.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No repair history</Text>
                    </View>
                }
            />

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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        flexGrow: 1,
    },
    header: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 20,
    },
    chipRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D9DDE4',
        backgroundColor: '#FFFFFF',
        marginRight: 10,
    },
    chipActive: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: '#4A7FBF',
        marginRight: 10,
    },
    chipLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    chipLabelActive: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    card: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        minHeight: 90,
        justifyContent: 'center',
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333333',
    },
    cardStatus: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0255AF',
        marginLeft: 10,
    },
    emptyText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 32,
    },
    cardText: {
        fontSize: 14,
        color: '#333333',
        textAlign: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
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

export default History;