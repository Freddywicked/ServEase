import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'FindServiceProvider';

// Bottom tab definitions — same icon set and pattern as CustomerHome.js, just
// with Find as the active tab this time.
const TAB_ITEMS = [
    { key: 'CustomerDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'FindServiceProvider', label: 'Find', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Track', label: 'Track', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'MessageCustomer', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'History', label: 'History', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'CustomerProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

const CATEGORIES = ['All', 'Home Repair', 'Automotive', 'IT and Phone Repair'];

// Hardcoded per instructions for this round of frontend review — swap this
// out for a backend fetch of providers (filtered by category) once that API
// is ready.
const PROVIDERS_BY_CATEGORY = {
    'Home Repair': [
        {
            id: 'juan-dela-cruz',
            name: 'Juan Dela Cruz',
            specialty: 'Home Repair Specialist',
            verified: true,
            available: true,
            rating: 4.7,
            reviews: 62,
            experienceYears: 6,
            specialities: 'Plumbing and Carpentry',
            location: 'Naga City · 1.8 km away',
            availability: 'Mon-Sat, 8AM-5PM',
        },
        {
            id: 'ana-bautista',
            name: 'Ana Bautista',
            specialty: 'Home Repair Specialist',
            verified: true,
            available: false,
            rating: 4.6,
            reviews: 48,
            experienceYears: 4,
            specialities: 'Electrical and Painting',
            location: 'Naga City · 3.1 km away',
            availability: 'Mon-Fri, 9AM-6PM',
        },
    ],
    Automotive: [
        {
            id: 'carlos-reyes',
            name: 'Carlos Reyes',
            specialty: 'Automotive Technician',
            verified: true,
            available: true,
            rating: 4.9,
            reviews: 110,
            experienceYears: 8,
            specialities: 'Engine and Brake Repair',
            location: 'Naga City · 2.2 km away',
            availability: 'Mon-Sat, 8AM-6PM',
        },
        {
            id: 'liza-fernandez',
            name: 'Liza Fernandez',
            specialty: 'Automotive Technician',
            verified: true,
            available: true,
            rating: 4.5,
            reviews: 37,
            experienceYears: 3,
            specialities: 'Aircon and Electrical',
            location: 'Naga City · 4.0 km away',
            availability: 'Tue-Sun, 9AM-5PM',
        },
    ],
    'IT and Phone Repair': [
        {
            id: 'mika-santos',
            name: 'Mika Santos',
            specialty: 'IT and Phone Repair Technician',
            verified: true,
            available: true,
            rating: 4.8,
            reviews: 95,
            experienceYears: 5,
            specialities: 'IT and Phone Repair',
            location: 'Naga City · 2.5 km away',
            availability: 'Mon-Fri, 8AM-6PM',
        },
        {
            id: 'paolo-cruz',
            name: 'Paolo Cruz',
            specialty: 'IT and Phone Repair Technician',
            verified: true,
            available: false,
            rating: 4.4,
            reviews: 29,
            experienceYears: 2,
            specialities: 'Computer and Laptop Repair',
            location: 'Naga City · 1.2 km away',
            availability: 'Mon-Fri, 10AM-7PM',
        },
    ],
};

const ALL_PROVIDERS = Object.values(PROVIDERS_BY_CATEGORY).flat();

const FindServiceProvider = ({ navigation }) => {
    const [selectedCategory, setSelectedCategory] = useState('All');

    const providers = selectedCategory === 'All' ? ALL_PROVIDERS : PROVIDERS_BY_CATEGORY[selectedCategory];

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    const handleSelectCategory = (category) => {
        setSelectedCategory(category);
    };

    const handleProviderPress = (providerId) => {
        // TODO: point this to an actual provider profile screen once it exists
        navigation.navigate('ServiceProviderProfile', { providerId });
    };

    const renderProviderCard = (provider) => (
        <TouchableOpacity
            key={provider.id}
            style={styles.providerCard}
            onPress={() => handleProviderPress(provider.id)}
            activeOpacity={0.85}
        >
            <View style={styles.providerHeaderRow}>
                <Image source={require('../assets/icon_profile_photo.png')} style={styles.providerPhoto} />
                <View style={styles.providerNameWrap}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
                </View>
            </View>

            <View style={styles.badgeRow}>
                <View style={styles.verifiedBadge}>
                    <View style={styles.verifiedIconWrap}>
                        <Image source={require('../assets/icon_ellipse.png')} style={styles.verifiedEllipse} />
                        <Image source={require('../assets/icon_check.png')} style={styles.verifiedCheck} />
                    </View>
                    <Text style={styles.verifiedText}>Verified</Text>
                </View>
                {provider.available ? (
                    <View style={styles.availableBadge}>
                        <Text style={styles.availableText}>Available</Text>
                    </View>
                ) : (
                    <View style={styles.unavailableBadge}>
                        <Text style={styles.unavailableText}>Unavailable</Text>
                    </View>
                )}
            </View>

            <View style={styles.ratingRow}>
                <Image source={require('../assets/icon_star.png')} style={styles.starIcon} />
                <Text style={styles.ratingText}>{provider.rating}</Text>
                <Text style={styles.ratingDetail}>{provider.reviews} reviews</Text>
                <Text style={styles.ratingDetail}>{provider.experienceYears} years experience</Text>
            </View>

            <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Specialities: </Text>
                {provider.specialities}
            </Text>
            <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Location: </Text>
                {provider.location}
            </Text>
            <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Available: </Text>
                {provider.availability}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Find Service Providers</Text>
                <View style={styles.locationRow}>
                    <Image source={require('../assets/icon_location.png')} style={styles.locationIcon} />
                    <Text style={styles.locationText}>Naga City</Text>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryTabRow}
                >
                    {CATEGORIES.map((category) => {
                        const isSelected = category === selectedCategory;
                        return (
                            <TouchableOpacity
                                key={category}
                                style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                                onPress={() => handleSelectCategory(category)}
                            >
                                <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected]}>
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {providers.map(renderProviderCard)}
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
        marginBottom: 6,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    locationIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 4,
    },
    locationText: {
        fontSize: 13,
        color: '#666666',
    },
    categoryTabRow: {
        paddingBottom: 4,
        marginBottom: 16,
    },
    categoryTab: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    categoryTabSelected: {
        backgroundColor: '#0255AF',
        borderColor: '#0255AF',
    },
    categoryTabText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '600',
    },
    categoryTabTextSelected: {
        color: '#FFFFFF',
    },
    providerCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },
    providerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    providerPhoto: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    providerNameWrap: {
        flex: 1,
    },
    providerName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    providerSpecialty: {
        fontSize: 12,
        color: '#666666',
        marginTop: 2,
    },
    badgeRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D9E8FB',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 8,
    },
    verifiedIconWrap: {
        width: 16,
        height: 16,
        marginRight: 4,
    },
    verifiedEllipse: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
        tintColor: '#0255AF',
        position: 'absolute',
    },
    verifiedCheck: {
        width: 9,
        height: 9,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
        position: 'absolute',
        top: 3.5,
        left: 3.5,
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0255AF',
    },
    availableBadge: {
        backgroundColor: '#86FF8A',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 4,
        justifyContent: 'center',
    },
    availableText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0B4D0E',
    },
    unavailableBadge: {
        backgroundColor: '#F0F0F0',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 4,
        justifyContent: 'center',
    },
    unavailableText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888888',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    starIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 4,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
        marginRight: 10,
    },
    ratingDetail: {
        fontSize: 12,
        color: '#666666',
        marginRight: 10,
    },
    detailLine: {
        fontSize: 12,
        color: '#333333',
        marginBottom: 3,
    },
    detailLabel: {
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

export default FindServiceProvider;