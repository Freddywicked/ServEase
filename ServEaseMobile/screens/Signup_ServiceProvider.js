/**
 * Service provider application - step 1 of 3: personal details.
 *
 * The user arrives here from the RoleSelection screen after choosing
 * "Service Provider". The collected details are passed through the
 * remaining steps and submitted together at the final step so the
 * provider account can be verified.
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. The form is fully controlled state - fields start empty and
 * nothing is hardcoded. Submission is prepared for the backend integration
 * (see the TODO below, submitProviderApplication() in services/api.js).
 * @format
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');

const SignupServiceProviderScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
  });

  const updateField = key => value =>
    setForm(previous => ({ ...previous, [key]: value }));

  const handleNext = () => {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.dateOfBirth.trim() ||
      !form.gender.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.address.trim()
    ) {
      Alert.alert('Incomplete form', 'Please fill in all required fields.');
      return;
    }
    // TODO: validate the details against the backend once integrated. The
    // personal details are carried through the application steps and sent
    // with submitProviderApplication() (services/api.js) at the final step.
    navigation.navigate('Signup_ServiceProvider2', { personalDetails: form });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={LOGO_SOURCE}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="ServEase logo"
          />
          <Text style={styles.title}>Apply as Service Provider</Text>

          <View style={styles.progressRow}>
            {[1, 2, 3].map(step => (
              <View
                key={step}
                style={[
                  styles.progressSegment,
                  step === 1 && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Personal Details</Text>

          <Text style={styles.label}>First Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Juan"
              placeholderTextColor="#A6ADB8"
              value={form.firstName}
              onChangeText={updateField('firstName')}
            />
          </View>

          <Text style={styles.label}>Middle Name (Optional)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Middle name"
              placeholderTextColor="#A6ADB8"
              value={form.middleName}
              onChangeText={updateField('middleName')}
            />
          </View>

          <Text style={styles.label}>Last Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Luna"
              placeholderTextColor="#A6ADB8"
              value={form.lastName}
              onChangeText={updateField('lastName')}
            />
          </View>

          <Text style={styles.label}>Date of Birth</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#A6ADB8"
              value={form.dateOfBirth}
              onChangeText={updateField('dateOfBirth')}
            />
          </View>

          <Text style={styles.label}>Gender</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Male"
              placeholderTextColor="#A6ADB8"
              value={form.gender}
              onChangeText={updateField('gender')}
            />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="juanluna@gmail.com"
              placeholderTextColor="#A6ADB8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={updateField('email')}
            />
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="+63 912 345 6789"
              placeholderTextColor="#A6ADB8"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={updateField('phone')}
            />
          </View>

          <Text style={styles.label}>Address</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Street, Barangay, Municipality, Province"
              placeholderTextColor="#A6ADB8"
              value={form.address}
              onChangeText={updateField('address')}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.nextButtonWrapper}
          >
            <LinearGradient
              colors={['#0F6CD6', '#00BFA6']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E2A6E',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E9EBEF',
  },
  progressSegmentActive: {
    backgroundColor: '#0F6CD6',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E2A6E',
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#7C8499',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#C9CDD4',
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontSize: 14,
    color: '#1F2937',
  },
  nextButtonWrapper: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 24,
  },
  nextButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SignupServiceProviderScreen;