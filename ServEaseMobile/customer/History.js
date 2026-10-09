import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMyServiceRequests } from '../api/servicerequest_api';
import { formatShortDate } from '../utils/formatters';
import { ROUTES } from '../navigation/routes';

// Filter chips for the history list.
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'repair', label: 'Repair' },
    { key: 'transactions', label: 'Transactions' },
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
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
                        {/* Back button -> always returns to the dashboard */}
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.navigate(ROUTES.CUSTOMER_HOME)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel="Back to dashboard"
                        >
                            <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                        </TouchableOpacity>
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
            />
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
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    backIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
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
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        minHeight: 90,
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
        fontSize: 13,
        color: '#333333',
        marginTop: 4,
    },
});

export default History;