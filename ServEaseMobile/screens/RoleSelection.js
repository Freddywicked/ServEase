/**
 * Role selection screen: shown right after the user signs in so they choose
 * how to continue using ServEase (Sign Up -> OTP verification -> Login ->
 * Role Selection).
 *
 * Customer -> continues to the customer home screen (CustomerHome).
 * Service Provider -> starts the multi-step service provider application
 * (Signup_ServiceProvider 1-3) where additional credentials are collected
 * for account verification.
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. The auth token and user profile issued by the backend at
 * sign-in are passed through to the customer home as route params.
 * @format
 */

import React from 'react';
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');

const RoleSelectionScreen = ({ navigation, route }) => {
  const handleCustomer = () => {
    // Continue to the customer side, carrying the auth token and profile
    // issued by the backend at sign-in.
    navigation.navigate('CustomerHome', {
      token: route?.params?.token,
      user: route?.params?.user,
    });
  };

  const handleServiceProvider = () => {
    // TODO: persist the chosen role via services/api.js once the backend is
    // integrated. The application collects extra credentials used to verify
    // the provider account.
    navigation.navigate('Signup_ServiceProvider');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.content}>
        <Image
          source={LOGO_SOURCE}
          resizeMode="contain"
          style={styles.logo}
          accessibilityLabel="ServEase logo"
        />
        <Text style={styles.title}>Continue as</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleCustomer}
          accessibilityRole="button"
          accessibilityLabel="Continue as Customer"
          style={styles.roleButtonWrapper}
        >
          <LinearGradient
            colors={['#0F6CD6', '#00BFA6']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.roleButton}
          >
            <Text style={styles.roleButtonText}>Customer</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleServiceProvider}
          accessibilityRole="button"
          accessibilityLabel="Continue as Service Provider"
          style={styles.roleButtonWrapper}
        >
          <LinearGradient
            colors={['#0F6CD6', '#00BFA6']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.roleButton}
          >
            <Text style={styles.roleButtonText}>Service Provider</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginTop: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E2A6E',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  roleButtonWrapper: {
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  roleButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RoleSelectionScreen;
