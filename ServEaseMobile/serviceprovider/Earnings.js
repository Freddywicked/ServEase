import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProviderEarnings } from '../api/providerWork_api';
import { formatPeso, formatShortDate } from '../utils/provider_formatters';

const Earnings = ({ navigation }) => {
    // Summary and transactions come from GET /provider/earnings
    // (see api/providerWorkApi.js for the shape). null summary -> cards show '–'.
    const [summary, setSummary] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const loadEarnings = useCallback(async () => {
        try {
            const data = await getProviderEarnings();
            setSummary(data?.summary ?? null);
            setTransactions(data?.transactions ?? []);
            setLoadFailed(false);
        } catch (error) {
            // Keep the last known figures. A 401 is already handled by api/client.
            setLoadFailed(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadEarnings().finally(() => setLoading(false));
        }, [loadEarnings]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadEarnings();
        setRefreshing(false);
    };

    const handleTransactionPress = (transactionId) => {
        // TODO: point this to an actual transaction-detail screen once it exists
        navigation.navigate('TransactionDetail', { transactionId });
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Earnings</Text>

                {loadFailed && (
                    <TouchableOpacity style={styles.errorBanner} onPress={loadEarnings}>
                        <Text style={styles.errorBannerText}>Couldn't load your earnings. Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, styles.statCardSpacing]}>
                        <Text style={styles.statAmount}>{formatPeso(summary?.thisWeek)}</Text>
                        <Text style={styles.statLabel}>This week</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statAmount}>{formatPeso(summary?.pendingPayment)}</Text>
                        <Text style={styles.statLabel}>Pending Payment</Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>

                {loading ? (
                    <ActivityIndicator style={styles.loader} color="#0255AF" />
                ) : transactions.length > 0 ? (
                    transactions.map((transaction) => (
                        <TouchableOpacity
                            key={transaction.id}
                            style={styles.transactionRow}
                            onPress={() => handleTransactionPress(transaction.id)}
                            activeOpacity={0.85}
                        >
                            <View style={styles.transactionTextWrap}>
                                <Text style={styles.transactionTitle} numberOfLines={1}>
                                    Request #{transaction.requestNumber} · {transaction.customerName}
                                </Text>
                                <Text style={styles.transactionDate}>{formatShortDate(transaction.date)}</Text>
                            </View>
                            <Text style={styles.transactionAmount}>{formatPeso(transaction.amount)}</Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    !loadFailed && <Text style={styles.emptyStateText}>No transactions yet</Text>
                )}
            </ScrollView>

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
    backButton: {
        alignSelf: 'flex-start',
        paddingRight: 16,
        marginBottom: 4,
    },
    backArrow: {
        fontSize: 36,
        lineHeight: 36,
        color: '#000000',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 12,
        paddingVertical: 18,
        paddingHorizontal: 14,
    },
    statCardSpacing: {
        marginRight: 12,
    },
    statAmount: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111111',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#666666',
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888888',
        letterSpacing: 1,
        marginBottom: 12,
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    transactionTextWrap: {
        flex: 1,
        marginRight: 10,
    },
    transactionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 3,
    },
    transactionDate: {
        fontSize: 11,
        color: '#999999',
    },
    transactionAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2FAE60',
    },
    loader: {
        marginTop: 30,
    },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: {
        fontSize: 13,
        color: '#555555',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default Earnings;