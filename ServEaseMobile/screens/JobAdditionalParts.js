import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Jobs';

// Bottom tab definitions — identical set/route names to Job.js.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'Requests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const JobAdditionalParts = ({ navigation }) => {
    const [additionalCost, setAdditionalCost] = useState('');
    const [notes, setNotes] = useState('');

    const handleBack = () => {
        navigation.goBack();
    };

    const handleSendRequest = () => {
        // TODO: call the notify-additional-parts endpoint once it exists, sending additionalCost/notes
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Notify Additional Parts</Text>
                <Text style={styles.subtitle}>Explain the unexpected additional parts to the customer.</Text>

                <Text style={styles.fieldLabel}>Additional Cost (Peso)</Text>
                <TextInput
                    style={styles.costInput}
                    placeholder="0.00"
                    placeholderTextColor="#AAAAAA"
                    keyboardType="decimal-pad"
                    value={additionalCost}
                    onChangeText={setAdditionalCost}
                />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                    style={styles.notesInput}
                    placeholder="Parts needed, timeline..."
                    placeholderTextColor="#AAAAAA"
                    multiline
                    numberOfLines={4}
                    value={notes}
                    onChangeText={setNotes}
                />

                <TouchableOpacity style={styles.sendButton} onPress={handleSendRequest}>
                    <Text style={styles.sendButtonText}>Send Request</Text>
                </TouchableOpacity>
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
    backButton: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    backArrow: {
        fontSize: 30,
        color: '#111111',
        fontWeight: '400',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#444444',
        marginBottom: 22,
    },
    fieldLabel: {
        fontSize: 12,
        color: '#555555',
        marginBottom: 8,
    },
    costInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 14,
        color: '#111111',
        marginBottom: 20,
    },
    notesInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
        color: '#111111',
        minHeight: 90,
        textAlignVertical: 'top',
        marginBottom: 24,
    },
    sendButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    sendButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
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

export default JobAdditionalParts;