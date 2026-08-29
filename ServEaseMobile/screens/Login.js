/**
 * Login screen: email/password sign-in against the backend, Google sign-in
 * placeholder, and links to sign-up and the service provider application.
 *
 * On successful sign-in a customer-only user goes straight to the customer
 * home screen (CustomerHome); a service provider picks a side on the Role
 * Selection screen. Accounts with an unverified phone number are routed
 * back to OTP verification.
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
import { login } from '../services/api';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing credentials',
        'Please enter your email and password.',
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const { token, user } = await login(email.trim(), password);
      // Service providers choose which side to use; customer-only users go
      // straight to the customer home screen.
      if (user.role === 'service_provider') {
        navigation.navigate('RoleSelection', { token, user });
      } else {
        navigation.navigate('CustomerHome', { token, user });
      }
    } catch (error) {
      // Pending accounts must verify their phone number first - the backend
      // responds 403 with { requiresOtp, phone } plus a fresh devOtp outside
      // production (SMS delivery is mocked).
      if (error.status === 403 && error.data?.requiresOtp) {
        navigation.navigate('VerifyOTP', {
          phone: error.data.phone,
          devOtp: error.data.devOtp,
        });
        return;
      }
      Alert.alert(
        'Sign in failed',
        error.status >= 500
          ? 'Our servers are having trouble right now. Please try again later.'
          : error.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    // TODO: integrate Google Sign-In once OAuth is set up.
    Alert.alert('Coming soon', 'Google sign-in will be available soon.');
  };

  const handleForgotPassword = () => {
    // TODO: wire up the forgot password flow once the backend supports it.
    Alert.alert('Coming soon', 'Forgot password will be available soon.');
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
          <Text style={styles.title}>Welcome, User!</Text>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <Icon
              name="mail-outline"
              size={18}
              color="#A6ADB8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#A6ADB8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Icon
              name="lock-closed-outline"
              size={18}
              color="#A6ADB8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#A6ADB8"
              secureTextEntry={isPasswordHidden}
              value={password}
              onChangeText={setPassword}
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

          <TouchableOpacity
            onPress={handleForgotPassword}
            style={styles.forgotPasswordWrapper}
          >
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSignIn}
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

          <TouchableOpacity
            onPress={() => navigation.navigate('Signup_ServiceProvider')}
            style={styles.providerLinkWrapper}
          >
            <Text style={styles.providerLink}>Sign as Service Provider</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={styles.googleButtonWrapper}
          >
            <LinearGradient
              colors={['#0F6CD6', '#00BFA6']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.googleButton}
            >
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{"Don't have an account? "}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Sign up"
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.footerLink}>Sign up</Text>
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
    marginTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E2A6E',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 32,
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
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontSize: 14,
    color: '#1F2937',
  },
  forgotPasswordWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPassword: {
    color: '#2E7CF6',
    fontSize: 13,
    fontWeight: '600',
  },
  signInButtonWrapper: {
    alignSelf: 'stretch',
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
  providerLinkWrapper: {
    alignSelf: 'center',
    marginTop: 16,
  },
  providerLink: {
    color: '#2E7CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#C9CDD4',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#A6ADB8',
    fontSize: 13,
  },
  googleButtonWrapper: {
    alignSelf: 'center',
    width: '55%',
    marginBottom: 28,
  },
  googleButton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 16,
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

export default LoginScreen;

