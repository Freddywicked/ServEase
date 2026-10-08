import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomerNavBar from '../components/CustomerNavBar';
import { ROUTES } from '../navigation/routes';
import { getCategories, browseServiceProviders } from '../api/servicerequest_api';

// Category chips and provider cards both come from the backend now:
//   GET /categories          -> the chips ('All' + the live category labels)
//   GET /service-providers   -> verified providers, filtered server-side by category
// Nothing here is hardcoded sample data anymore.

const FindServiceProvider = ({ navigation }) => {
    const [categories, setCategories] = useState(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [providers, setProviders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const loadProviders = useCallback(async (category) => {
        setIsLoading(true);
        setLoadError('');
        try {
            const list = await browseServiceProviders({ category: category === 'All' ? undefined : category });
            setProviders(list);
        } catch (error) {
            setProviders([]);
            setLoadError(error.message || 'Could not load service providers.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Categories once on mount; providers on mount and whenever the category changes.
    useEffect(() => {
        getCategories()
            .then((list) => setCategories(['All', ...list.map((c) => c.label)]))
            .catch(() => {}); // chips fall back to just 'All'
    }, []);

    useEffect(() => {
        loadProviders(selectedCategory);
    }, [selectedCategory, loadProviders]);

    const handleSelectCategory = (category) => {
        setSelectedCategory(category);
    };

    // Tapping a provider starts a service request — that flow asks for the category,
    // problem, photo and schedule, then recommends this provider's colleagues too.
    const handleProviderPress = () => {
        navigation.navigate(ROUTES.CREATE_SERVICE_REQUEST);
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
                <Text style={styles.ratingText}>{provider.rating ?? '—'}</Text>
                <Text style={styles.ratingDetail}>{provider.reviews} reviews</Text>
                {provider.experienceYears != null && (
                    <Text style={styles.ratingDetail}>{provider.experienceYears} years experience</Text>
                )}
            </View>

            <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Specialities: </Text>
                {provider.specialities || provider.specialty}
            </Text>
            {!!provider.locationName && (
                <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Location: </Text>
                    {provider.locationName}
                </Text>
            )}
            {!!provider.availabilitySchedule && (
                <Text style={styles.detailLine}>
                    <Text style={styles.detailLabel}>Available: </Text>
                    {provider.availabilitySchedule}
                </Text>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Find Service Providers</Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryTabRow}
                >
                    {categories.map((category) => {
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

                {isLoading ? (
                    <ActivityIndicator color="#0255AF" style={{ marginTop: 24 }} />
                ) : loadError ? (
                    <TouchableOpacity onPress={() => loadProviders(selectedCategory)}>
                        <Text style={styles.emptyText}>Couldn't load providers. Tap to retry.{'\n'}{loadError}</Text>
                    </TouchableOpacity>
                ) : providers.length === 0 ? (
                    <Text style={styles.emptyText}>No verified service providers in this category yet.</Text>
                ) : (
                    providers.map(renderProviderCard)
                )}
            </ScrollView>

            <CustomerNavBar activeTab="FindServiceProvider" />
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
    emptyText: {
        fontSize: 13,
        color: '#777777',
        textAlign: 'center',
        marginTop: 24,
        lineHeight: 19,
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
});

export default FindServiceProvider;