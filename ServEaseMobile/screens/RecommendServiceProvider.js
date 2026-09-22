import React, { useState, useRef, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const TOTAL_STEPS = 4;
const CURRENT_STEP = 3;

// Hardcoded per instructions for this round of frontend review — swap this
// out for a backend fetch of matched providers once that API is ready.
const SERVICE_PROVIDERS = [
    {
        id: 'mark-rivera',
        name: 'Mark Rivera',
        specialty: 'Phone Repair',
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
        id: 'sylvia-lee',
        name: 'Sylvia Lee',
        specialty: 'Phone Repair',
        verified: true,
        available: true,
        rating: 4.8,
        reviews: 95,
        experienceYears: 5,
        specialities: 'IT and Phone Repair',
        location: 'Naga City · 2.5 km away',
        availability: 'Mon-Fri, 8AM-6PM',
    },
];

const RecommendServiceProvider = ({ navigation, route }) => {
    const [selectedProviderId, setSelectedProviderId] = useState(SERVICE_PROVIDERS[0].id);
    const [isReloading, setIsReloading] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;
    const reloadTimeoutRef = useRef(null);

    useEffect(() => {
        if (!isReloading) {
            return undefined;
        }
        spinValue.setValue(0);
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spinAnimation.start();
        return () => spinAnimation.stop();
    }, [isReloading, spinValue]);

    useEffect(() => {
        return () => {
            if (reloadTimeoutRef.current) {
                clearTimeout(reloadTimeoutRef.current);
            }
        };
    }, []);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleClose = () => {
        navigation.goBack();
    };

    const handleSelectProvider = (id) => {
        setSelectedProviderId(id);
    };

    const handleFindAnother = () => {
        // TEMPORARY: simulates re-searching for matched providers until the
        // real backend search endpoint is integrated. Shows the same
        // hardcoded providers again once the reload finishes.
        setIsReloading(true);
        reloadTimeoutRef.current = setTimeout(() => {
            setSelectedProviderId(SERVICE_PROVIDERS[0].id);
            setIsReloading(false);
        }, 1500);
    };

    const renderProviderCard = (provider) => {
        const isSelected = provider.id === selectedProviderId;
        return (
            <TouchableOpacity
                key={provider.id}
                style={[styles.providerCard, isSelected && styles.providerCardSelected]}
                onPress={() => handleSelectProvider(provider.id)}
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
                    {provider.available && (
                        <View style={styles.availableBadge}>
                            <Text style={styles.availableText}>Available</Text>
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
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Creating Service Request</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Image source={require('../assets/icon_close.png')} style={styles.closeIcon} />
                    </TouchableOpacity>
                </View>

                <View style={styles.progressBar}>
                    {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                        <Image
                            key={index}
                            source={
                                index < CURRENT_STEP
                                    ? require('../assets/icon_tab_colored.png')
                                    : require('../assets/icon_tab.png')
                            }
                            style={styles.progressSegment}
                            resizeMode="stretch"
                        />
                    ))}
                </View>

                <Text style={styles.questionTitle}>Recommended Service Providers</Text>
                <Text style={styles.questionSubtitle}>
                    Matched by specialization, customer satisfaction sentiments, ratings and distance from you.
                </Text>

                {isReloading ? (
                    <View style={styles.reloadingSection}>
                        <Animated.Image
                            source={require('../assets/icon_loading.png')}
                            style={[styles.reloadingIcon, { transform: [{ rotate: spin }] }]}
                        />
                        <Text style={styles.reloadingText}>Finding service providers…</Text>
                    </View>
                ) : (
                    <>
                        {SERVICE_PROVIDERS.map(renderProviderCard)}

                        <TouchableOpacity onPress={() => navigation.navigate('SubmitServiceRequest')}>
                            <LinearGradient
                                colors={['#0255AF', '#04A5A5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.requestButton}
                            >
                                <Text style={styles.requestButtonText}>Request Quotation</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleFindAnother} style={styles.findAnotherWrap}>
                            <Text style={styles.findAnotherText}>Find another Service Provider</Text>
                        </TouchableOpacity>
                    </>
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    closeButton: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 6,
    },
    closeIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    progressBar: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    progressSegment: {
        flex: 1,
        height: 6,
        marginRight: 6,
        borderRadius: 3,
    },
    questionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 6,
    },
    questionSubtitle: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 18,
        marginBottom: 20,
    },
    reloadingSection: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    reloadingIcon: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
        marginBottom: 12,
    },
    reloadingText: {
        fontSize: 13,
        color: '#666666',
    },
    providerCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },
    providerCardSelected: {
        borderColor: '#04A5A5',
        borderWidth: 2,
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
    requestButton: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 16,
    },
    requestButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    findAnotherWrap: {
        alignItems: 'center',
    },
    findAnotherText: {
        fontSize: 14,
        color: '#111111',
        textDecorationLine: 'underline',
    },
});

export default RecommendServiceProvider;