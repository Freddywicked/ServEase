import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rateServiceRequest } from '../api/servicerequest_api';

const STAR_VALUES = [1, 2, 3, 4, 5];

const Ratings = ({ navigation, route }) => {
    const requestId = route?.params?.requestId;
    const requestNumber = route?.params?.requestNumber || requestId || '';

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleBack = () => {
        navigation.goBack();
    };

    const handleSelectRating = (value) => {
        setRating(value);
    };

    // Saved as a RATINGS row on the backend (one per request); the provider is
    // notified and their average rating updates everywhere it is shown.
    const handleSendReview = async () => {
        if (isSending) return;
        if (!requestId) {
            navigation.navigate('Track');
            return;
        }
        if (rating === 0) {
            Alert.alert('Pick a rating', 'Tap 1 to 5 stars first.');
            return;
        }
        setIsSending(true);
        try {
            await rateServiceRequest(requestId, { rating, review: reviewText.trim() });
            navigation.navigate('Track');
        } catch (error) {
            setIsSending(false);
            // 409 = already rated — just move on.
            if (error.status === 409) {
                navigation.navigate('Track');
            } else {
                Alert.alert('Could not send your review', error.message);
            }
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
});

export default Ratings;