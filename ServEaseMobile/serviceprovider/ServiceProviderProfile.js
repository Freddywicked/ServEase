// ServEaseMobile/provider/ServiceProviderProfile.js
//
// Service provider "Profile" screen (Figma: Profile - Service Provider).
// - Read-only view. Every Edit button opens the separate edit screen
//   (EditServiceProviderProfile) with the section to open.
// - Loads the signed-in provider's real profile from the backend
//   (see api/providerProfile.js) and refreshes it whenever the screen is focused,
//   so changes made on the edit screen show up right away.
// - The bottom navbar (Home / Find / Track / Chat / Profile) is NOT rendered here;
//   it stays in the shared static navbar, so this screen only leaves space for it.
//
// Icons use @expo/vector-icons. If the project uses react-native-vector-icons
// instead, change the three import lines marked ICONS.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // ICONS
import {
  clearSession,
  fetchMyProviderProfile,
  switchAccountMode,
} from '../api/providerProfile';

/* ------------------------------------------------------------------ */
/* Theme (values taken from the Figma)                                 */
/* ------------------------------------------------------------------ */
const COLORS = {
  title: '#021E79',
  text: '#484040',
  textStrong: '#000000',
  cardTitle: '#292727',
  border: '#818080',
  buttonBorder: '#55575B',
  star: '#FFDD03',
  avatar: '#D9D9D9',
  white: '#FFFFFF',
};

const SIDE = 24; // horizontal screen padding
const REVIEW_GAP = 10; // space between review cards
const NAVBAR_SPACE = 120; // keeps the last row clear of the static bottom navbar

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
const Stars = ({ count = 5, size = 11 }) => (
  <View style={styles.starsRow} accessibilityLabel={`${count} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Ionicons
        key={i}
        name={i < count ? 'star' : 'star-outline'}
        size={size}
        color={COLORS.star}
      />
    ))}
  </View>
);

const Chip = ({ label }) => (
  <View style={styles.chip}>
    <Text style={styles.chipText} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const Field = ({ label, children, style }) => (
  <View style={[styles.field, style]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const EditButton = ({ onPress, label }) => (
  <Pressable
    onPress={onPress}
    hitSlop={10}
    style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text style={styles.editButtonText}>Edit</Text>
  </Pressable>
);

const ReviewCard = ({ review, width }) => (
  <View style={[styles.reviewCard, { width }]}>
    <Text style={styles.reviewName}>{review.reviewer}</Text>
    <Stars count={review.rating} />
    <Text style={styles.reviewService}>Service Availed: {review.service}</Text>
    <Text style={styles.reviewComment} numberOfLines={2}>
      {review.comment}
    </Text>
  </View>
);

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
export default function ServiceProviderProfile({ navigation }) {
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      setProfile(await fetchMyProviderProfile());
    } catch (e) {
      setError(e.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    // refresh when coming back from the edit screen
    const unsubscribe = navigation?.addListener?.('focus', loadProfile);
    return unsubscribe;
  }, [loadProfile, navigation]);

  const reviewCardWidth = width - SIDE * 2;

  const goToEdit = (section) => {
    // section: 'photo' | 'account' | 'other'
    navigation?.navigate?.('EditServiceProviderProfile', { section, profile });
  };

  const handleSwitchToCustomer = async () => {
    try {
      await switchAccountMode('customer');
      navigation?.reset?.({ index: 0, routes: [{ name: 'CustomerDashboard' }] });
    } catch (e) {
      Alert.alert('Could not switch account', e.message || 'Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await clearSession();
          navigation?.reset?.({ index: 0, routes: [{ name: 'LoginScreen' }] });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.title} />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorTitle}>Could not load your profile</Text>
        <Text style={styles.errorText}>{error || 'Please try again.'}</Text>
        <Pressable
          onPress={() => {
            setLoading(true);
            loadProfile();
          }}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.screenTitle} accessibilityRole="header">
          Profile
        </Text>

        {/* Header: avatar + name */}
        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            {profile.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={34} color={COLORS.white} />
              </View>
            )}
            <Pressable
              onPress={() => goToEdit('photo')}
              hitSlop={10}
              style={({ pressed }) => [styles.avatarEdit, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <Ionicons name="create-outline" size={14} color="#1E1E1E" />
            </Pressable>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.fullName || '—'}
            </Text>
            <Text style={styles.specialty} numberOfLines={1}>
              {profile.specialty || '—'}
            </Text>
            {profile.yearsExperience != null && (
              <Text style={styles.experience}>
                {profile.yearsExperience} {Number(profile.yearsExperience) === 1 ? 'year' : 'years'} experience
              </Text>
            )}
          </View>
        </View>

        {/* AI Summary Insights */}
        {profile.aiSummary.positiveFeedbackPercent != null && (
        <View style={styles.insights}>
          <Text style={styles.insightsTitle}>AI Summary Insights</Text>
          <View style={styles.insightsRow}>
            <Text style={styles.insightsFeedback}>
              {profile.aiSummary.positiveFeedbackPercent}% Positive Feedback
            </Text>
            <View style={styles.chipsRow}>
              {profile.aiSummary.tags.map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
          </View>
        </View>
        )}

        {/* Rating summary */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={21} color={COLORS.star} />
          <Text style={styles.ratingValue}>{profile.rating != null ? Number(profile.rating).toFixed(1) : '—'}</Text>
          <Text style={styles.ratingCount}>{profile.reviewCount} {profile.reviewCount === 1 ? 'review' : 'reviews'}</Text>
        </View>

        {/* Reviews (swipe sideways; the next card peeks in) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={reviewCardWidth + REVIEW_GAP}
          decelerationRate="fast"
          style={styles.reviewsScroll}
          contentContainerStyle={styles.reviewsContent}
        >
          {profile.reviews.length > 0 ? (
            profile.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} width={reviewCardWidth} />
            ))
          ) : (
            <View style={[styles.reviewCard, styles.reviewEmpty, { width: reviewCardWidth }]}>
              <Text style={styles.reviewComment}>
                No reviews yet. Completed jobs will show customer reviews here.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Account Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Details</Text>
          <View style={styles.accountRow}>
            <Field label="Email Address" style={styles.accountEmail}>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {profile.account.email || '—'}
              </Text>
            </Field>
            <Field label="Address" style={styles.accountAddress}>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {profile.account.address || '—'}
              </Text>
            </Field>
            <EditButton onPress={() => goToEdit('account')} label="Edit account details" />
          </View>
        </View>

        {/* Other Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Other Details</Text>
          <View style={styles.otherRow}>
            <Field label="Availability" style={styles.otherCol}>
              <Text style={styles.fieldValue}>{profile.other.availabilityDays || '—'}</Text>
              <Text style={styles.fieldValue}>{profile.other.availabilityHours || '—'}</Text>
            </Field>
            <Field label="Company Address" style={styles.otherCol}>
              <Text style={styles.fieldValue}>{profile.other.companyAddress || '—'}</Text>
            </Field>
            <Field label="Company Name" style={styles.otherCol}>
              <Text style={styles.fieldValue}>{profile.other.companyName || '—'}</Text>
            </Field>
          </View>
          <View style={styles.otherEditWrap}>
            <EditButton onPress={() => goToEdit('other')} label="Edit other details" />
          </View>
        </View>

        {/* Switch account / Log out */}
        <Pressable
          onPress={handleSwitchToCustomer}
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Switch to customer"
        >
          <MaterialCommunityIcons name="account-switch" size={26} color="#1E1E1E" />
          <Text style={styles.actionText}>Switch to Customer</Text>
        </Pressable>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={27} color="#1E1E1E" />
          <Text style={styles.actionText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  content: {
    paddingHorizontal: SIDE,
    paddingTop: 44,
    paddingBottom: NAVBAR_SPACE,
  },
  pressed: { opacity: 0.6 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIDE },
  errorTitle: { fontSize: 16, lineHeight: 19, fontWeight: '700', color: COLORS.text },
  errorText: { fontSize: 12, lineHeight: 16, color: COLORS.text, textAlign: 'center', marginTop: 6 },
  retryButton: {
    marginTop: 16,
    height: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 12, fontWeight: '700', color: COLORS.textStrong },

  /* Title */
  screenTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 35,
  },

  /* Header */
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { width: 71, height: 71 },
  avatar: { width: 71, height: 71, borderRadius: 36 },
  avatarPlaceholder: {
    backgroundColor: COLORS.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, lineHeight: 19, fontWeight: '700', color: COLORS.text },
  specialty: {
    fontSize: 12,
    lineHeight: 14,
    fontStyle: 'italic',
    color: COLORS.text,
    marginTop: 4,
  },
  experience: { fontSize: 12, lineHeight: 14, color: COLORS.text, marginTop: 4 },

  /* AI Summary Insights */
  insights: { marginTop: 14, paddingHorizontal: 12 },
  insightsTitle: { fontSize: 12, lineHeight: 14, fontWeight: '700', color: COLORS.text },
  insightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
    rowGap: 6,
    marginTop: 4,
  },
  insightsFeedback: { fontSize: 12, lineHeight: 14, color: COLORS.text },
  chipsRow: { flexDirection: 'row', columnGap: 4 },
  chip: {
    minWidth: 98,
    height: 21,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 9, lineHeight: 11, textAlign: 'center', color: COLORS.text },

  /* Rating summary */
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingLeft: 4,
    columnGap: 6,
  },
  ratingValue: { fontSize: 12, lineHeight: 14, color: COLORS.text },
  ratingCount: { fontSize: 12, lineHeight: 14, color: COLORS.text },

  /* Reviews */
  starsRow: { flexDirection: 'row', columnGap: 0, marginTop: 1 },
  reviewsScroll: { marginTop: 7, marginHorizontal: -SIDE, flexGrow: 0 },
  reviewsContent: { paddingHorizontal: SIDE, columnGap: REVIEW_GAP },
  reviewCard: {
    minHeight: 83,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  reviewEmpty: { justifyContent: 'center' },
  reviewName: { fontSize: 11, lineHeight: 13, color: COLORS.text },
  reviewService: { fontSize: 9, lineHeight: 11, color: COLORS.text, marginTop: 3 },
  reviewComment: { fontSize: 8, lineHeight: 10, color: COLORS.text, marginTop: 3 },

  /* Cards */
  card: {
    marginTop: 10,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  cardTitle: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: COLORS.cardTitle },
  field: { marginTop: 10 },
  fieldLabel: { fontSize: 9, lineHeight: 15, color: COLORS.text },
  fieldValue: { fontSize: 9, lineHeight: 15, fontWeight: '700', color: COLORS.textStrong },

  accountRow: { flexDirection: 'row', alignItems: 'flex-end', columnGap: 8 },
  accountEmail: { flex: 1 },
  accountAddress: { flex: 1 },

  otherRow: { flexDirection: 'row', columnGap: 8 },
  otherCol: { flex: 1 },
  otherEditWrap: { alignItems: 'flex-end', marginTop: 4 },

  editButton: {
    width: 52,
    height: 24,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { fontSize: 9, fontWeight: '700', color: COLORS.textStrong },

  /* Switch account / Log out */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    minHeight: 27,
    marginTop: 14,
    paddingLeft: 6,
  },
  actionText: { fontSize: 13, lineHeight: 16, color: COLORS.text },
});