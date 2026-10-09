import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCategories, browseServiceProviders } from '../api/servicerequest_api';

// Icons (assets folder). NOTE: icon_location.png is the map-pin next to the address.
const ICON_PIN = require('../assets/icon_location.png');
const ICON_ELLIPSE = require('../assets/icon_ellipse.png');
const ICON_CHECK = require('../assets/icon_check.png');

const SEARCH_DEBOUNCE_MS = 400;

// Fixed chips shown first. The category chips after them come from the backend.
const STATIC_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'available', label: 'Available' },
    { id: 'top_rated', label: 'Top-rated' },
];

/* ============================================================================
 * Find Service Providers (Customer app)
 * ----------------------------------------------------------------------------
 *   GET /categories          -> category chips (after All / Available / Top-rated)
 *   GET /service-providers   -> verified providers. Query params sent from here:
 *                                 search     text typed in the search bar (debounced)
 *                                 category   selected category chip label
 *                                 available  true when the "Available" chip is selected
 *                                 sort       'rating' when the "Top-rated" chip is selected
 *
 * Every change to the search text or the selected chip re-fetches from the backend.
 * ========================================================================== */

const FindServiceProvider = ({ navigation }) => {
    const [categories, setCategories] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState(STATIC_FILTERS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [providers, setProviders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const latestRequest = useRef(0); // ignores responses that arrive after a newer request

    const filterChips = [
        ...STATIC_FILTERS,
        ...categories.map((label) => ({ id: `category:${label}`, label, category: label })),
    ];

    const loadProviders = useCallback(async (filter, query) => {
        const requestId = ++latestRequest.current;
        setIsLoading(true);
        setLoadError('');
        try {
            const params = {};
            const search = query.trim();
            if (search) params.search = search;
            if (filter.category) params.category = filter.category;
            if (filter.id === 'available') params.available = true;
            if (filter.id === 'top_rated') params.sort = 'rating';

            let list = await browseServiceProviders(params);

            // Safety net in case the endpoint ignores `available` / `sort`.
            if (filter.id === 'available') list = list.filter((provider) => provider.available);
            if (filter.id === 'top_rated') list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

            if (requestId !== latestRequest.current) return;
            setProviders(list);
        } catch (error) {
            if (requestId !== latestRequest.current) return;
            setProviders([]);
            setLoadError(error.message || 'Could not load service providers.');
        } finally {
            if (requestId === latestRequest.current) setIsLoading(false);
        }
    }, []);

    // Category chips: once on mount (the row falls back to just the fixed chips).
    useEffect(() => {
        getCategories()
            .then((list) => setCategories(list.map((c) => c.label)))
            .catch(() => {});
    }, []);

    // Providers: on mount and whenever the search text or selected chip changes.
    // Typing waits briefly so the backend isn't hit on every keystroke.
    useEffect(() => {
        const timer = setTimeout(
            () => loadProviders(selectedFilter, searchQuery),
            searchQuery.trim() ? SEARCH_DEBOUNCE_MS : 0,
        );
        return () => clearTimeout(timer);
    }, [selectedFilter, searchQuery, loadProviders]);

    const handleProviderPress = (provider) => {
        // `provider` is passed along so the details screen can show the basics instantly
        // while it loads the full profile (reviews, AI summary, ...) from the backend.
        navigation.navigate('ProviderDetails', { providerId: provider.id, provider });
    };

    const renderProviderCard = (provider) => (
        <TouchableOpacity
            key={provider.id}
            style={styles.providerCard}
            onPress={() => handleProviderPress(provider)}
            activeOpacity={0.85}
        >
            <View style={styles.cardTopRow}>
                <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>

                <View style={styles.badgeRow}>
                    <View style={styles.verifiedBadge}>
                        <View style={styles.verifiedIconWrap}>
                            <Image source={ICON_ELLIPSE} style={styles.verifiedEllipse} />
                            <Image source={ICON_CHECK} style={styles.verifiedCheck} />
                        </View>
                        <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                    <View style={[styles.availabilityBadge, provider.available ? styles.availableBadge : styles.unavailableBadge]}>
                        <Text style={styles.availabilityText}>{provider.available ? 'Available' : 'Unavailable'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.locationRow}>
                <Image source={ICON_PIN} style={styles.pinIcon} />
                <Text style={styles.locationText} numberOfLines={1}>{provider.locationName}</Text>
            </View>

            <Text style={styles.reviewsText}>Reviews ({provider.rating ?? '—'})</Text>

            <Text style={styles.viewProfileText}>View Profile</Text>
        </TouchableOpacity>
    );

    const renderBody = () => {
        if (isLoading) return <ActivityIndicator color="#0255AF" style={styles.loader} />;
        if (loadError) {
            return (
                <TouchableOpacity onPress={() => loadProviders(selectedFilter, searchQuery)}>
                    <Text style={styles.emptyText}>Couldn't load providers. Tap to retry.{'\n'}{loadError}</Text>
                </TouchableOpacity>
            );
        }
        if (providers.length === 0) {
            return (
                <Text style={styles.emptyText}>
                    {searchQuery.trim()
                        ? `No service providers found for "${searchQuery.trim()}".`
                        : 'No verified service providers found.'}
                </Text>
            );
        }
        return providers.map(renderProviderCard);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.headerTitle}>Find Service Providers</Text>

                <View style={styles.searchWrap}>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search services or service providers..."
                        placeholderTextColor="rgba(0, 0, 0, 0.34)"
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        clearButtonMode="while-editing"
                        // One line, fixed 14px: the bar is a fixed 45px tall, so letting the phone's
                        // font-size setting scale the text made the placeholder wrap and get cut off.
                        multiline={false}
                        numberOfLines={1}
                        allowFontScaling={false}
                    />
                    {/* Figma's 1px outline (radius 8) drawn over the full input; it doesn't take touches. */}
                    <View pointerEvents="none" style={styles.searchOutline} />
                </View>

                {/* Scrolls sideways when the chips don't fit the screen width */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipRow}
                >
                    {filterChips.map((chip) => {
                        const isSelected = chip.id === selectedFilter.id;
                        return (
                            <TouchableOpacity
                                key={chip.id}
                                style={[styles.chip, isSelected && styles.chipSelected]}
                                onPress={() => setSelectedFilter(chip)}
                            >
                                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{chip.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={styles.list}>{renderBody()}</View>
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
        paddingTop: 28,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
        paddingHorizontal: 24,
        marginBottom: 10,
    },
    // Figma "Input": 24px side margins, 45px tall, #EAEAEA, radius 30.
    searchWrap: {
        marginHorizontal: 24,
        height: 45,
    },
    searchInput: {
        height: 45,
        backgroundColor: '#EAEAEA',
        borderRadius: 30,
        paddingLeft: 20, // Figma text starts ~5.5% in
        paddingRight: 12,
        paddingVertical: 0,
        fontSize: 14,
        fontWeight: '500',
        color: '#000000',
        textAlignVertical: 'center',
        includeFontPadding: false,
    },
    searchOutline: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(31, 29, 29, 0.12)',
        borderRadius: 8,
    },
    chipScroll: {
        marginTop: 20,
        flexGrow: 0,
    },
    chipRow: {
        paddingHorizontal: 26,
        paddingRight: 40,
    },
    chip: {
        height: 32,
        paddingHorizontal: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFDFD',
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        marginRight: 8,
    },
    chipSelected: {
        backgroundColor: '#021E79',
    },
    chipText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#414141',
    },
    chipTextSelected: {
        color: '#FFFFFF',
    },
    list: {
        marginTop: 34,
        paddingHorizontal: 26,
    },
    loader: {
        marginTop: 24,
    },
    emptyText: {
        fontSize: 13,
        color: '#777777',
        textAlign: 'center',
        marginTop: 24,
        lineHeight: 19,
    },
    providerCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 20,
        paddingTop: 9,
        paddingBottom: 8,
        paddingLeft: 11,
        paddingRight: 6,
        marginBottom: 13,
        minHeight: 88,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    providerName: {
        flex: 1,
        fontSize: 13,
        lineHeight: 16,
        fontWeight: '700',
        color: '#484040',
        marginRight: 6,
    },
    badgeRow: {
        flexDirection: 'row',
    },
    verifiedBadge: {
        width: 70,
        height: 19,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(2, 85, 175, 0.46)',
        borderRadius: 10,
        paddingLeft: 2,
        marginRight: 4,
    },
    verifiedIconWrap: {
        width: 14,
        height: 14,
        marginRight: 6,
    },
    verifiedEllipse: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        tintColor: '#0255AF',
        position: 'absolute',
    },
    verifiedCheck: {
        width: 7,
        height: 7,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
        position: 'absolute',
        top: 3.5,
        left: 3.5,
    },
    verifiedText: {
        fontSize: 10,
        lineHeight: 12,
        color: '#0255AF',
    },
    availabilityBadge: {
        width: 70,
        height: 19,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    availableBadge: {
        backgroundColor: '#2E7D32',
    },
    unavailableBadge: {
        backgroundColor: '#C62828',
    },
    availabilityText: {
        fontSize: 10,
        lineHeight: 12,
        color: '#FFFFFF',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    pinIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        opacity: 0.88,
        marginRight: 4,
    },
    locationText: {
        flex: 1,
        fontSize: 11,
        lineHeight: 13,
        color: '#484040',
    },
    reviewsText: {
        fontSize: 11,
        lineHeight: 13,
        color: '#484040',
        textDecorationLine: 'underline',
        marginTop: 3,
    },
    viewProfileText: {
        fontSize: 9,
        lineHeight: 11,
        color: '#484040',
        textAlign: 'center',
        textDecorationLine: 'underline',
        marginTop: 2,
    },
});

export default FindServiceProvider;