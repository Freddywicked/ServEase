import React, { useState, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMyServiceRequests } from '../api/servicerequest_api';
import { formatShortDate } from '../utils/formatters';
import { ROUTES } from '../navigation/routes';

// Figma specifies Roboto (header) and Quicksand (chips). Fill these in with the
// font names you load in the app (e.g. 'Roboto-Bold', 'Quicksand-Medium').
// Left undefined, the platform default font is used.
const FONTS = {
    header: undefined, // Roboto Bold
    chip: undefined, // Quicksand Medium
};

// Filter tabs for the history list.
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
            <View style={styles.cardBody}>
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
                        <ActivityIndicator color="#021E79" style={{ marginTop: 32 }} />
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
                        <Text style={styles.header} accessibilityRole="header">
                            History
                        </Text>
                        <View style={styles.chipRow}>
                            {FILTERS.map((f, index) => {
                                const isActive = f.key === filter;
                                return (
                                    <TouchableOpacity
                                        key={f.key}
                                        style={[
                                            styles.chip,
                                            isActive && styles.chipActive,
                                            index > 0 && styles.chipSpacing,
                                        ]}
                                        onPress={() => setFilter(f.key)}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${f.label} filter`}
                                        accessibilityState={{ selected: isActive }}
                                    >
                                        <Text
                                            style={[styles.chipLabel, isActive && styles.chipLabelActive]}
                                            numberOfLines={1}
                                        >
                                            {f.label}
                                        </Text>
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
    // Figma: Roboto 700 / 24 / line-height 28 / #021E79
    header: {
        fontFamily: FONTS.header,
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
        marginBottom: 20,
    },

    // Filter tabs. Figma: pill (radius 20), 1px #B1A8A8 border, 32px tall,
    // three equal-width tabs; active = filled #021E79 with near-white text.
    chipRow: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    chip: {
        flex: 1,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        backgroundColor: '#FFFDFD',
    },
    chipSpacing: {
        marginLeft: 8,
    },
    chipActive: {
        backgroundColor: '#021E79',
    },
    chipLabel: {
        fontFamily: FONTS.chip,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        color: '#414141',
        textAlign: 'center',
    },
    chipLabelActive: {
        color: '#FFFAFA',
    },

    // History cards. Figma: white, 1px #C9C2C2 border, radius 14.
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#C9C2C2',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        paddingHorizontal: 16,
        minHeight: 80,
        marginBottom: 16,
    },
    cardBody: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '700',
        color: '#1F1F1F',
    },
    cardText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#414141',
        marginTop: 4,
    },
    cardStatus: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: '#021E79',
        marginLeft: 12,
    },
    emptyText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#595959',
        textAlign: 'center',
        marginTop: 32,
    },
});

export default History;