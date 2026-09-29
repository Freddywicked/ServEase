import React from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Earnings';

// Bottom tab definitions — identical set/route names to Job.js / ServiceProviderChat.js.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'IncomingServiceRequest', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'MessageServiceProvider', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Hardcoded — backend isn't integrated yet. Swap these two figures out for a
// fetched summary (sum of this week's completed payments / sum of pending
// payments) once the API exists.
const EARNINGS_SUMMARY = {
    thisWeek: '₱8,150',
    pendingPayment: '₱1,300',
};

// Hardcoded per transaction — backend isn't integrated yet. The design left
// these rows blank (placeholder boxes), so this is a representative shape;
// swap it for a fetched transaction history once the API exists. Shape to
// match: { id, requestNumber, customerName, date, amount }
const RECENT_TRANSACTIONS = [
    { id: '1', requestNumber: 'SR-0001', customerName: 'Nikki Pie', date: 'Jun 27', amount: '₱1,500' },
    { id: '2', requestNumber: 'SR-0002', customerName: 'Dominic Alcantara', date: 'Jun 24', amount: '₱2,300' },
    { id: '3', requestNumber: 'SR-0003', customerName: 'Gabriela Lim', date: 'Jun 20', amount: '₱950' },
];

const Earnings = ({ navigation }) => {
    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleTransactionPress = (transactionId) => {
        // TODO: point this to an actual transaction-detail screen once it exists
        navigation.navigate('TransactionDetail', { transactionId });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Earnings</Text>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, styles.statCardSpacing]}>
                        <Text style={styles.statAmount}>{EARNINGS_SUMMARY.thisWeek}</Text>
                        <Text style={styles.statLabel}>This week</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statAmount}>{EARNINGS_SUMMARY.pendingPayment}</Text>
                        <Text style={styles.statLabel}>Pending Payment</Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>

                {RECENT_TRANSACTIONS.map((transaction) => (
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
                            <Text style={styles.transactionDate}>{transaction.date}</Text>
                        </View>
                        <Text style={styles.transactionAmount}>{transaction.amount}</Text>
                    </TouchableOpacity>
                ))}
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

export default Earnings;