import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Track';

// Bottom tab definitions — copied verbatim from Track.js so the route keys match.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const STAR_VALUES = [1, 2, 3, 4, 5];

const Ratings = ({ navigation, route }) => {
    const requestNumber = route?.params?.requestNumber || 'SR-0000';

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');

    const handleBack = () => {
        navigation.goBack();
    };

    const handleSelectRating = (value) => {
        setRating(value);
    };

    const handleSendReview = () => {
        // TODO: submit { requestNumber, rating, reviewText } to the backend once the API exists
        navigation.navigate('Track');
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
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Rating and Review</Text>

                <Text style={styles.requestNumber}>Request #{requestNumber}</Text>

                <Text style={styles.fieldLabel}>Rate</Text>
                <View style={styles.starsRow}>
                    {STAR_VALUES.map((value) => (
                        <TouchableOpacity key={value} onPress={() => handleSelectRating(value)} activeOpacity={0.7}>
                            <Image
                                source={value <= rating ? require('../assets/icon_star.png') : require('../assets/icon_star_grey.png')}
                                style={styles.starIcon}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.fieldLabel}>Review</Text>
                <TextInput
                    style={styles.reviewInput}
                    placeholder="Enter your review and sentiments here."
                    placeholderTextColor="#AAAAAA"
                    multiline
                    numberOfLines={4}
                    value={reviewText}
                    onChangeText={setReviewText}
                />

                <TouchableOpacity style={styles.sendButton} onPress={handleSendReview}>
                    <Text style={styles.sendButtonText}>Send</Text>
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
    backIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    requestNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#222222',
        marginBottom: 10,
    },
    starsRow: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    starIcon: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
        marginRight: 8,
    },
    reviewInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
        color: '#111111',
        minHeight: 90,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    sendButton: {
        alignSelf: 'flex-end',
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 28,
        backgroundColor: '#FFFFFF',
    },
    sendButtonText: {
        fontSize: 13,
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

export default Ratings;