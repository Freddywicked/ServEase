/**
 * OTP verification screen: six-box phone verification code input.
 * A hidden TextInput captures the digits while styled boxes display them.
 * Verifies the code against the backend (verifyOtp() in services/api.js);
 * on success the account becomes active and the user continues to sign in.
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. The code starts empty and nothing is hardcoded - the phone
 * number (and, outside production, the dev OTP while SMS delivery is
 * mocked) arrive via route params from the Signup/Login screens.
 * @format
 */

import React, { useRef, useState } from 'react';
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { verifyOtp } from '../services/api';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');

const OTP_LENGTH = 6;

const VerifyOTPScreen = ({ navigation, route }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  // The phone number being verified, passed from the Signup screen (or from
  // Login when an unverified account tries to sign in).
  const phone = route?.params?.phone || '';
  // Outside production the backend echoes the OTP back (SMS delivery is
  // mocked) so the flow can be tested without an SMS provider.
  const devOtp = route?.params?.devOtp || '';

  const handleChange = text => {
    setCode(text.replace(/[^0-9]/g, ''));
  };

  const handleVerify = async () => {
    if (code.length < OTP_LENGTH) {
      Alert.alert(
        'Incomplete code',
        'Please enter the 6-digit verification code.',
      );
      return;
    }
    setIsSubmitting(true);
    try {
      // Verifies the code; the backend activates the account and responds
      // with { token, user }. The user continues by signing in.
      await verifyOtp(phone, code);
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert(
        'Verification failed',
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
          <Text style={styles.subtitle}>Verify your Phone number</Text>
          {phone ? <Text style={styles.phoneText}>{phone}</Text> : null}
          {devOtp ? (
            <Text
              style={styles.devOtpText}
            >{`Development code: ${devOtp}`}</Text>
          ) : null}

          <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
            <View style={styles.otpRow}>
              {Array.from({ length: OTP_LENGTH }, (_, index) => {
                const isActive = index === code.length;
                return (
                  <View
                    key={index}
                    style={[styles.otpBox, isActive && styles.otpBoxActive]}
                  >
                    <Text style={styles.otpDigit}>{code[index] || ''}</Text>
                  </View>
                );
              })}
            </View>
          </TouchableWithoutFeedback>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
            accessibilityLabel="Verification code"
          />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleVerify}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
            style={styles.signInButtonWrapper}
          >
            <LinearGradient
              colors={['#0F6CD6', '#00BFA6']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.signInButton}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
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
    marginTop: 12,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  phoneText: {
    fontSize: 13,
    color: '#7C8499',
    marginTop: 4,
  },
  devOtpText: {
    fontSize: 12,
    color: '#2E7CF6',
    fontWeight: '600',
    marginTop: 8,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 28,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E9EBEF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  otpBoxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F6CD6',
  },
  otpDigit: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  signInButtonWrapper: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  signInButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VerifyOTPScreen;