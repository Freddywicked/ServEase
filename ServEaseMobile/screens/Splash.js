/**
 * Splash screen: brand gradient background, the centered ServEase logo
 * and a "Get Started" call-to-action that starts the onboarding flow
 * (Splash -> SignUp -> VerifyOTP -> Login).
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. It renders no data, so nothing is fetched or hardcoded -
 * the backend integration will be added later.
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
import LinearGradient from 'react-native-linear-gradient';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');

const SplashScreen = ({ navigation }) => {
  const handleGetStarted = () => {
    navigation.replace('SignUp');
  };

  return (
    <LinearGradient
      colors={['#00C9A7', '#0B5CAD', '#00C9A7']}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <View style={styles.logoWrapper}>
        <Image
          source={LOGO_SOURCE}
          resizeMode="contain"
          style={styles.logo}
          accessibilityLabel="ServEase logo"
        />
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleGetStarted}
        accessibilityRole="button"
        accessibilityLabel="Get Started"
        style={styles.buttonWrapper}
      >
        <LinearGradient
          colors={['#0F6CD6', '#00BFA6']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 56,
  },
  logoWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 190,
    height: 190,
  },
  buttonWrapper: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  button: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SplashScreen;
