/**
 * Sign-up screen: account details, valid ID upload and terms agreement.
 * Submits to the backend (registerCustomer() in services/api.js) and moves
 * to OTP verification once the backend responds with an OTP challenge.
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. The form is fully controlled state - fields start empty and
 * nothing is hardcoded.
 * @format
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import Icon from '@react-native-vector-icons/ionicons';
import { registerCustomer } from '../services/api';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');
const UPLOAD_ICON = require('../assets/icon_uploadbutton.png');
const CHECKBOX_ICON = require('../assets/icon_checkbox.png');

const SignupScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
  });
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [isConfirmPasswordHidden, setIsConfirmPasswordHidden] = useState(true);
  const [validId, setValidId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = key => value =>
    setForm(previous => ({ ...previous, [key]: value }));

  const handleUploadId = () => {
    // TODO: integrate a document/image picker, then store the picked file
    // ({ uri, name, type }) in `validId` state and submit it with the form.
    Alert.alert('Coming soon', 'ID upload will be available soon.');
  };

  const handleNext = async () => {
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password ||
      !form.address.trim()
    ) {
      Alert.alert('Incomplete form', 'Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (!agreed) {
      Alert.alert(
        'Terms required',
        'Please agree to the Terms of Service and Privacy Policy.',
      );
      return;
    }
    setIsSubmitting(true);
    try {
      // Registers the account; the backend sends a 6-digit OTP to the phone
      // (echoed back as devOtp outside production while SMS is mocked).
      const data = await registerCustomer(form, validId);
      navigation.navigate('VerifyOTP', {
        phone: form.phone.trim(),
        devOtp: data.devOtp,
      });
    } catch (error) {
      Alert.alert(
        'Sign up failed',
        error.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
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
          <Text style={styles.title}>Create your account</Text>

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Juan Luna"
              placeholderTextColor="#A6ADB8"
              value={form.fullName}
              onChangeText={updateField('fullName')}
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

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#A6ADB8"
              secureTextEntry={isPasswordHidden}
              value={form.password}
              onChangeText={updateField('password')}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                isPasswordHidden ? 'Show password' : 'Hide password'
              }
              hitSlop={8}
              onPress={() => setIsPasswordHidden(previous => !previous)}
            >
              <Icon
                name={isPasswordHidden ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#A6ADB8"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#A6ADB8"
              secureTextEntry={isConfirmPasswordHidden}
              value={form.confirmPassword}
              onChangeText={updateField('confirmPassword')}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                isConfirmPasswordHidden
                  ? 'Show confirm password'
                  : 'Hide confirm password'
              }
              hitSlop={8}
              onPress={() => setIsConfirmPasswordHidden(previous => !previous)}
            >
              <Icon
                name={
                  isConfirmPasswordHidden ? 'eye-outline' : 'eye-off-outline'
                }
                size={20}
                color="#A6ADB8"
              />
            </TouchableOpacity>
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

          <Text style={styles.label}>Upload Valid ID</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleUploadId}
            accessibilityRole="button"
            accessibilityLabel="Upload Valid ID"
            style={styles.uploadBox}
          >
            <Image
              source={UPLOAD_ICON}
              style={styles.uploadIcon}
              resizeMode="contain"
            />
            <View style={styles.uploadTextWrapper}>
              <Text style={styles.uploadTitle}>
                {validId ? validId.name : 'Tap to upload'}
              </Text>
              <Text style={styles.uploadDescription}>
                {validId
                  ? 'File attached - tap to replace'
                  : 'Government-issued ID'}
              </Text>
            </View>
            {validId ? (
              <Icon name="checkmark-circle" size={20} color="#00BFA6" />
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setAgreed(previous => !previous)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            style={styles.termsRow}
          >
            {agreed ? (
              <View style={styles.checkboxChecked}>
                <Icon name="checkmark" size={13} color="#FFFFFF" />
              </View>
            ) : (
              <Image
                source={CHECKBOX_ICON}
                style={styles.checkboxImage}
                resizeMode="contain"
              />
            )}
            <Text style={styles.termsText}>
              {"I agree to ServEase's "}
              <Text
                style={styles.termsLink}
                onPress={() =>
                  Alert.alert(
                    'Coming soon',
                    'Terms of Service will be available soon.',
                  )
                }
              >
                Terms of Service
              </Text>
              {' and '}
              <Text
                style={styles.termsLink}
                onPress={() =>
                  Alert.alert(
                    'Coming soon',
                    'Privacy Policy will be available soon.',
                  )
                }
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            disabled={isSubmitting}
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
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.nextButtonText}>Next</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Log in"
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.footerLink}>Log in</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 28,
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
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C9CDD4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  uploadIcon: {
    width: 26,
    height: 26,
    marginRight: 14,
  },
  uploadTextWrapper: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  uploadDescription: {
    fontSize: 12,
    color: '#A6ADB8',
    marginTop: 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 24,
  },
  checkboxImage: {
    width: 18,
    height: 18,
  },
  checkboxChecked: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#0F6CD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2E7CF6',
    fontWeight: '600',
  },
  nextButtonWrapper: {
    alignSelf: 'stretch',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#1F2937',
    fontSize: 14,
  },
  footerLink: {
    color: '#2E7CF6',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignupScreen;

