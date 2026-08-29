/**
 * Root stack navigator for ServEase.
 * Screens are added here as they are built.
 * @format
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/Splash';
import LoginScreen from '../screens/Login';
import SignupScreen from '../screens/Signup';
import VerifyOTPScreen from '../screens/VerifyOTP';
import RoleSelectionScreen from '../screens/RoleSelection';
import SignupServiceProviderScreen from '../screens/Signup_ServiceProvider';
import SignupServiceProvider2Screen from '../screens/Signup_ServiceProvider2';
import SignupServiceProvider3Screen from '../screens/Signup_ServiceProvider3';
import CustomerHomeScreen from '../screens/CustomerHome';

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <Stack.Navigator
    initialRouteName="Splash"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="SignUp" component={SignupScreen} />
    <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
    <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
    <Stack.Screen
      name="Signup_ServiceProvider"
      component={SignupServiceProviderScreen}
    />
    <Stack.Screen
      name="Signup_ServiceProvider2"
      component={SignupServiceProvider2Screen}
    />
    <Stack.Screen
      name="Signup_ServiceProvider3"
      component={SignupServiceProvider3Screen}
    />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} />
  </Stack.Navigator>
);

export default AppNavigator;