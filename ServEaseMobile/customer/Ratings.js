import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { rateServiceRequest } from '../api/servicerequest_api';

/* ------------------------------------------------------------------ *
 * Design tokens (Figma). Every color, font and size used by the styles
 * below comes from here, so nothing is scattered through the screen.
 * If you already have a shared theme file, move these into it.
 * ------------------------------------------------------------------ */
const COLORS = {
    background: '#FFFFFF',
    title: '#021E79',
    text: '#292727',
    placeholder: '#9F9F9F',
    inputBorder: '#818080',
    inputBorderFocused: '#0255AF',
    buttonBorder: '#B1A8A8',
    gradientStart: '#0255AF',
    gradientEnd: '#04A5A5',
    onGradient: '#FFFFFF',
    error: '#C62828',
};

const FONTS = {
    titleBold: 'Roboto-Bold',
    labelSemi: 'Roboto-Medium',
    sfBold: 'SFPro-Bold',
    sfRegular: 'SFPro-Regular',
};

const SIZES = {
    star: 33,
    starGap: 11,
    inputHeight: 125,
    buttonWidth: 265,
    buttonHeight: 40,
    navBarClearance: 120, // room above the static bottom navbar
};

// The scale is derived from the number of stars, not typed in by hand.
const STAR_COUNT = 5;
const STAR_VALUES = Array.from({ length: STAR_COUNT }, (_, i) => i + 1);

const ASSETS = {
    back: require('../assets/icon_back_button.png'),
    starFilled: require('../assets/icon_star.png'),
    starEmpty: require('../assets/icon_star_grey.png'),
};

const TEXT = {
    title: 'Rating and Review',
    rate: 'Rate',
    review: 'Review',
    placeholder: 'Enter your review and sentiments here.',
    submit: 'Submit',
    ratingRequired: 'Please select a star rating.',
    failTitle: 'Could not send your review',
    failFallback: 'Please check your connection and try again.',
    cancel: 'Cancel',
    retry: 'Retry',
};

/**
 * Sends the review to the backend (one RATINGS row per request).
 * Runs outside the component so it keeps going after the screen closes.
 * Failures are surfaced with a Retry so a lost review never looks sent.
 */
const submitReview = async (requestId, payload) => {
    try {
        await rateServiceRequest(requestId, payload);
    } catch (error) {
        // 409 "already rated" = the review IS saved, nothing to report.
        if (error?.status === 409 && /already rated/i.test(error?.message || '')) return;

        Alert.alert(TEXT.failTitle, error?.message || TEXT.failFallback, [
            { text: TEXT.cancel, style: 'cancel' },
            { text: TEXT.retry, onPress: () => submitReview(requestId, payload) },
        ]);
    }
};

// A single star with a small press "pop" so a tap feels immediate.
const Star = ({ filled, onPress }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
        onPress();
        scale.setValue(0.8);
        Animated.spring(scale, {
            toValue: 1,
            friction: 4,
            tension: 160,
            useNativeDriver: true,
        }).start();
    };

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Animated.Image
                source={filled ? ASSETS.starFilled : ASSETS.starEmpty}
                style={[styles.starIcon, { transform: [{ scale }] }]}
            />
        </TouchableOpacity>
    );
};

const Ratings = ({ navigation, route }) => {
    // Both values come from the screen that opened this one (Track), which
    // loads them from the backend. Nothing is typed in here.
    const requestId = route?.params?.requestId;
    const requestNumber = route?.params?.requestNumber || requestId || '';

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [ratingError, setRatingError] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // A ref blocks double-taps instantly (state updates are async).
    const sendingRef = useRef(false);
    const isMounted = useRef(true);
    useEffect(() => () => { isMounted.current = false; }, []);

    const goToDone = () => navigation.navigate('Track', { tab: 'done' });

    const handleBack = () => {
        Keyboard.dismiss();
        navigation.goBack();
    };

    const handleSelectRating = (value) => {
        setRating(value);
        if (ratingError) setRatingError(false);
    };

    const handleSendReview = () => {
        if (sendingRef.current) return;

        if (!requestId) {
            goToDone();
            return;
        }
        if (rating === 0) {
            setRatingError(true);
            return;
        }

        sendingRef.current = true;
        setIsSending(true);
        Keyboard.dismiss();

        // Fire without waiting, then leave right away so the user never sits
        // on a frozen screen while the server does its work.
        submitReview(requestId, { rating, review: reviewText.trim() });
        goToDone();

        // Only matters if this screen stays mounted (e.g. nested navigator).
        setTimeout(() => {
            sendingRef.current = false;
            if (isMounted.current) setIsSending(false);
        }, 600);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* keyboardShouldPersistTaps: without it the first tap on Submit
                    only closes the keyboard and the second tap submits. */}
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Image source={ASSETS.back} style={styles.backIcon} />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>{TEXT.title}</Text>

                    {requestNumber ? (
                        <Text style={styles.requestNumber}>Request #{requestNumber}</Text>
                    ) : null}

                    <Text style={styles.fieldLabel}>{TEXT.rate}</Text>
                    <View style={styles.starsRow}>
                        {STAR_VALUES.map((value) => (
                            <Star
                                key={value}
                                filled={value <= rating}
                                onPress={() => handleSelectRating(value)}
                            />
                        ))}
                    </View>
                    {ratingError ? <Text style={styles.errorText}>{TEXT.ratingRequired}</Text> : null}

                    <Text style={[styles.fieldLabel, styles.reviewLabel]}>{TEXT.review}</Text>
                    <TextInput
                        style={[styles.reviewInput, isFocused && styles.reviewInputFocused]}
                        placeholder={TEXT.placeholder}
                        placeholderTextColor={COLORS.placeholder}
                        multiline
                        textAlignVertical="top"
                        value={reviewText}
                        onChangeText={setReviewText}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />

                    <TouchableOpacity
                        onPress={handleSendReview}
                        activeOpacity={0.85}
                        disabled={isSending}
                        style={styles.submitWrapper}
                    >
                        <LinearGradient
                            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.submitButton, isSending && styles.submitButtonSending]}
                        >
                            {isSending ? (
                                <ActivityIndicator size="small" color={COLORS.onGradient} />
                            ) : (
                                <Text style={styles.submitButtonText}>{TEXT.submit}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: SIZES.navBarClearance,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginLeft: 2,
    },
    backIcon: {
        width: 12,
        height: 19,
        resizeMode: 'contain',
    },
    headerTitle: {
        marginTop: 15,
        marginLeft: 2,
        fontFamily: FONTS.titleBold,
        fontWeight: '700',
        fontSize: 24,
        lineHeight: 28,
        color: COLORS.title,
    },
    requestNumber: {
        marginTop: 21,
        marginLeft: 2,
        fontFamily: FONTS.sfBold,
        fontWeight: '700',
        fontSize: 16,
        lineHeight: 27,
        color: COLORS.text,
    },
    fieldLabel: {
        marginTop: 16,
        marginLeft: 2,
        fontFamily: FONTS.labelSemi,
        fontWeight: '600',
        fontSize: 14,
        lineHeight: 16,
        color: COLORS.text,
    },
    starsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SIZES.starGap,
    },
    starIcon: {
        width: SIZES.star,
        height: SIZES.star,
        resizeMode: 'contain',
        marginHorizontal: SIZES.starGap / 2,
    },
    errorText: {
        marginTop: 8,
        textAlign: 'center',
        fontFamily: FONTS.sfRegular,
        fontSize: 12,
        color: COLORS.error,
    },
    reviewLabel: {
        marginTop: 36,
        marginBottom: 12,
    },
    reviewInput: {
        height: SIZES.inputHeight,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: 10,
        padding: 14,
        backgroundColor: COLORS.background,
        fontFamily: FONTS.sfRegular,
        fontSize: 12,
        lineHeight: 14,
        color: COLORS.text,
    },
    reviewInputFocused: {
        borderColor: COLORS.inputBorderFocused,
    },
    submitWrapper: {
        alignSelf: 'center',
        marginTop: 42,
    },
    submitButton: {
        width: SIZES.buttonWidth,
        height: SIZES.buttonHeight,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonSending: {
        opacity: 0.85,
    },
    submitButtonText: {
        fontFamily: FONTS.sfBold,
        fontWeight: '700',
        fontSize: 12,
        lineHeight: 20,
        color: COLORS.onGradient,
    },
});

export default Ratings;