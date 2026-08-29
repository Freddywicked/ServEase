/**
 * Render tests for the ServEase screens.
 * @format
 */

import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import SplashScreen from '../screens/Splash';
import LoginScreen from '../screens/Login';
import SignupScreen from '../screens/Signup';
import VerifyOTPScreen from '../screens/VerifyOTP';
import RoleSelectionScreen from '../screens/RoleSelection';
import SignupServiceProviderScreen from '../screens/Signup_ServiceProvider';
import SignupServiceProvider2Screen from '../screens/Signup_ServiceProvider2';
import SignupServiceProvider3Screen from '../screens/Signup_ServiceProvider3';
import CustomerHomeScreen from '../screens/CustomerHome';
import {
  getActiveRepair,
  getMe,
  getNotifications,
  login,
} from '../services/api';

// The screens talk to the backend through services/api.js - mock it so the
// tests never hit the network.
jest.mock('../services/api', () => ({
  login: jest.fn(),
  registerCustomer: jest.fn(() => Promise.resolve({ devOtp: '123456' })),
  verifyOtp: jest.fn(() => Promise.resolve({ token: 'token-123', user: {} })),
  resendOtp: jest.fn(() => Promise.resolve({ devOtp: '123456' })),
  getMe: jest.fn(),
  getActiveRepair: jest.fn(),
  getNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  getServiceCategories: jest.fn(() => Promise.resolve({ categories: [] })),
}));

jest.useFakeTimers();

beforeEach(() => {
  jest.clearAllMocks();
});

const createNavigation = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
});

const renderScreen = async (Screen, navigation) => {
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Screen navigation={navigation} />);
  });
  return renderer;
};

test('Splash renders correctly', async () => {
  const renderer = await renderScreen(SplashScreen, createNavigation());
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Splash shows the Get Started call-to-action', async () => {
  const renderer = await renderScreen(SplashScreen, createNavigation());

  const getStartedButton = renderer.root.findByProps({
    accessibilityLabel: 'Get Started',
  });
  expect(getStartedButton).toBeTruthy();
});

test('Splash routes to SignUp when Get Started is pressed', async () => {
  const navigation = createNavigation();
  const renderer = await renderScreen(SplashScreen, navigation);

  const getStartedButton = renderer.root.findByProps({
    accessibilityLabel: 'Get Started',
  });
  await ReactTestRenderer.act(async () => {
    getStartedButton.props.onPress();
  });

  expect(navigation.replace).toHaveBeenCalledWith('SignUp');
});

test('Login renders correctly', async () => {
  const renderer = await renderScreen(LoginScreen, createNavigation());
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Login requires email and password before signing in', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderScreen(LoginScreen, createNavigation());

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    signInButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Missing credentials',
    'Please enter your email and password.',
  );
  alertSpy.mockRestore();
});

test('Login toggles password visibility', async () => {
  const renderer = await renderScreen(LoginScreen, createNavigation());

  const toggle = renderer.root.findByProps({
    accessibilityLabel: 'Show password',
  });
  await ReactTestRenderer.act(async () => {
    toggle.props.onPress();
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Hide password' }),
  ).toBeTruthy();
});

test('Login routes to SignUp from the footer link', async () => {
  const navigation = createNavigation();
  const renderer = await renderScreen(LoginScreen, navigation);

  const signUpLink = renderer.root.findByProps({
    accessibilityLabel: 'Sign up',
  });
  await ReactTestRenderer.act(async () => {
    signUpLink.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('SignUp');
});

test('Login routes to CustomerHome when a customer signs in', async () => {
  login.mockResolvedValue({
    token: 'token-123',
    user: { fullName: 'Juan Luna', role: 'customer' },
  });
  const navigation = createNavigation();
  const renderer = await renderScreen(LoginScreen, navigation);

  const emailInput = renderer.root.findByProps({
    placeholder: 'Enter your email',
  });
  const passwordInput = renderer.root.findByProps({
    placeholder: 'Enter your password',
  });
  await ReactTestRenderer.act(async () => {
    emailInput.props.onChangeText('juanluna@gmail.com');
    passwordInput.props.onChangeText('secret123');
  });

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    await signInButton.props.onPress();
  });

  expect(login).toHaveBeenCalledWith('juanluna@gmail.com', 'secret123');
  expect(navigation.navigate).toHaveBeenCalledWith('CustomerHome', {
    token: 'token-123',
    user: { fullName: 'Juan Luna', role: 'customer' },
  });
});

test('Login routes to RoleSelection when a service provider signs in', async () => {
  login.mockResolvedValue({
    token: 'token-123',
    user: { fullName: 'Jose Rizal', role: 'service_provider' },
  });
  const navigation = createNavigation();
  const renderer = await renderScreen(LoginScreen, navigation);

  const emailInput = renderer.root.findByProps({
    placeholder: 'Enter your email',
  });
  const passwordInput = renderer.root.findByProps({
    placeholder: 'Enter your password',
  });
  await ReactTestRenderer.act(async () => {
    emailInput.props.onChangeText('jose@gmail.com');
    passwordInput.props.onChangeText('secret123');
  });

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    await signInButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('RoleSelection', {
    token: 'token-123',
    user: { fullName: 'Jose Rizal', role: 'service_provider' },
  });
});

test('Login routes to VerifyOTP when the account still needs verification', async () => {
  const otpError = new Error('Please verify your phone number before signing in.');
  otpError.status = 403;
  otpError.data = {
    requiresOtp: true,
    phone: '+63 912 345 6789',
    devOtp: '123456',
  };
  login.mockRejectedValue(otpError);
  const navigation = createNavigation();
  const renderer = await renderScreen(LoginScreen, navigation);

  const emailInput = renderer.root.findByProps({
    placeholder: 'Enter your email',
  });
  const passwordInput = renderer.root.findByProps({
    placeholder: 'Enter your password',
  });
  await ReactTestRenderer.act(async () => {
    emailInput.props.onChangeText('juanluna@gmail.com');
    passwordInput.props.onChangeText('secret123');
  });

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    await signInButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('VerifyOTP', {
    phone: '+63 912 345 6789',
    devOtp: '123456',
  });
});

test('Login shows the backend error when signing in fails', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  login.mockRejectedValue(new Error('Invalid email or password.'));
  const renderer = await renderScreen(LoginScreen, createNavigation());

  const emailInput = renderer.root.findByProps({
    placeholder: 'Enter your email',
  });
  const passwordInput = renderer.root.findByProps({
    placeholder: 'Enter your password',
  });
  await ReactTestRenderer.act(async () => {
    emailInput.props.onChangeText('juanluna@gmail.com');
    passwordInput.props.onChangeText('wrong-password');
  });

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    await signInButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Sign in failed',
    'Invalid email or password.',
  );
  alertSpy.mockRestore();
});

test('Signup renders correctly', async () => {
  const renderer = await renderScreen(SignupScreen, createNavigation());
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Signup requires all fields before proceeding', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderScreen(SignupScreen, createNavigation());

  const nextButton = renderer.root.findByProps({ accessibilityLabel: 'Next' });
  await ReactTestRenderer.act(async () => {
    nextButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Incomplete form',
    'Please fill in all required fields.',
  );
  alertSpy.mockRestore();
});

test('Signup routes back to Login from the footer link', async () => {
  const navigation = createNavigation();
  const renderer = await renderScreen(SignupScreen, navigation);

  const loginLink = renderer.root.findByProps({ accessibilityLabel: 'Log in' });
  await ReactTestRenderer.act(async () => {
    loginLink.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('Login');
});

test('Signup routes to VerifyOTP with the phone number once valid', async () => {
  const navigation = createNavigation();
  const renderer = await renderScreen(SignupScreen, navigation);

  const fillField = async (placeholder, value) => {
    const input = renderer.root.findByProps({ placeholder });
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText(value);
    });
  };

  await fillField('Juan Luna', 'Juan Luna');
  await fillField('juanluna@gmail.com', 'juanluna@gmail.com');
  await fillField('+63 912 345 6789', '+63 912 345 6789');
  await fillField('Create a password', 'secret123');
  await fillField('Confirm password', 'secret123');
  await fillField(
    'Street, Barangay, Municipality, Province',
    'Sample address',
  );

  const termsCheckbox = renderer.root.findByProps({
    accessibilityRole: 'checkbox',
  });
  await ReactTestRenderer.act(async () => {
    termsCheckbox.props.onPress();
  });

  const nextButton = renderer.root.findByProps({ accessibilityLabel: 'Next' });
  await ReactTestRenderer.act(async () => {
    await nextButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith(
    'VerifyOTP',
    expect.objectContaining({ phone: '+63 912 345 6789' }),
  );
});

test('VerifyOTP renders correctly', async () => {
  const renderer = await renderScreen(VerifyOTPScreen, createNavigation());
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('VerifyOTP shows the phone number passed from Signup', async () => {
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <VerifyOTPScreen
        navigation={createNavigation()}
        route={{ params: { phone: '+63 912 345 6789' } }}
      />,
    );
  });

  expect(
    renderer.root.findByProps({ children: '+63 912 345 6789' }),
  ).toBeTruthy();
});

test('VerifyOTP requires the full 6-digit code before signing in', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderScreen(VerifyOTPScreen, createNavigation());

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    signInButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Incomplete code',
    'Please enter the 6-digit verification code.',
  );
  alertSpy.mockRestore();
});

test('VerifyOTP only accepts digits in the code input', async () => {
  const renderer = await renderScreen(VerifyOTPScreen, createNavigation());

  const codeInput = renderer.root.findByProps({
    accessibilityLabel: 'Verification code',
  });
  await ReactTestRenderer.act(async () => {
    codeInput.props.onChangeText('12ab34');
  });

  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Verification code' })
      .props.value,
  ).toBe('1234');
});

test('VerifyOTP routes to Login once the code is complete', async () => {
  const navigation = createNavigation();
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <VerifyOTPScreen
        navigation={navigation}
        route={{ params: { phone: '+63 912 345 6789' } }}
      />,
    );
  });

  const codeInput = renderer.root.findByProps({
    accessibilityLabel: 'Verification code',
  });
  await ReactTestRenderer.act(async () => {
    codeInput.props.onChangeText('123456');
  });

  const signInButton = renderer.root.findByProps({
    accessibilityLabel: 'Sign In',
  });
  await ReactTestRenderer.act(async () => {
    await signInButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('Login');
});

test('VerifyOTP shows the development code passed from Signup', async () => {
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <VerifyOTPScreen
        navigation={createNavigation()}
        route={{
          params: { phone: '+63 912 345 6789', devOtp: '123456' },
        }}
      />,
    );
  });

  expect(
    renderer.root.findByProps({ children: 'Development code: 123456' }),
  ).toBeTruthy();
});

test('RoleSelection renders correctly', async () => {
  const renderer = await renderScreen(RoleSelectionScreen, createNavigation());
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('RoleSelection routes to CustomerHome when Customer is pressed', async () => {
  const navigation = createNavigation();
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <RoleSelectionScreen
        navigation={navigation}
        route={{
          params: {
            token: 'token-123',
            user: { fullName: 'Juan Luna', role: 'customer' },
          },
        }}
      />,
    );
  });

  const customerButton = renderer.root.findByProps({
    accessibilityLabel: 'Continue as Customer',
  });
  await ReactTestRenderer.act(async () => {
    customerButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('CustomerHome', {
    token: 'token-123',
    user: { fullName: 'Juan Luna', role: 'customer' },
  });
});

test('RoleSelection starts the provider application when Service Provider is pressed', async () => {
  const navigation = createNavigation();
  const renderer = await renderScreen(RoleSelectionScreen, navigation);

  const providerButton = renderer.root.findByProps({
    accessibilityLabel: 'Continue as Service Provider',
  });
  await ReactTestRenderer.act(async () => {
    providerButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('Signup_ServiceProvider');
});

test('Signup_ServiceProvider renders correctly', async () => {
  const renderer = await renderScreen(
    SignupServiceProviderScreen,
    createNavigation(),
  );
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Signup_ServiceProvider requires the personal details before continuing', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderScreen(
    SignupServiceProviderScreen,
    createNavigation(),
  );

  const nextButton = renderer.root.findByProps({ accessibilityLabel: 'Next' });
  await ReactTestRenderer.act(async () => {
    nextButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Incomplete form',
    'Please fill in all required fields.',
  );
  alertSpy.mockRestore();
});

test('Signup_ServiceProvider carries the details to step 2', async () => {
  const navigation = createNavigation();
  const renderer = await renderScreen(SignupServiceProviderScreen, navigation);

  const fillField = async (placeholder, value) => {
    const input = renderer.root.findByProps({ placeholder });
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText(value);
    });
  };

  await fillField('Juan', 'Juan');
  await fillField('Luna', 'Luna');
  await fillField('MM/DD/YYYY', '01/01/1990');
  await fillField('Male', 'Male');
  await fillField('juanluna@gmail.com', 'juanluna@gmail.com');
  await fillField('+63 912 345 6789', '+63 912 345 6789');
  await fillField(
    'Street, Barangay, Municipality, Province',
    'Sample address',
  );

  const nextButton = renderer.root.findByProps({ accessibilityLabel: 'Next' });
  await ReactTestRenderer.act(async () => {
    nextButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('Signup_ServiceProvider2', {
    personalDetails: {
      firstName: 'Juan',
      middleName: '',
      lastName: 'Luna',
      dateOfBirth: '01/01/1990',
      gender: 'Male',
      email: 'juanluna@gmail.com',
      phone: '+63 912 345 6789',
      address: 'Sample address',
    },
  });
});

test('Signup_ServiceProvider2 renders correctly', async () => {
  const renderer = await renderScreen(
    SignupServiceProvider2Screen,
    createNavigation(),
  );
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Signup_ServiceProvider2 requires a category before continuing', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderScreen(
    SignupServiceProvider2Screen,
    createNavigation(),
  );

  const nextButton = renderer.root.findByProps({ accessibilityLabel: 'Next' });
  await ReactTestRenderer.act(async () => {
    nextButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'No category selected',
    'Please select at least one service category.',
  );
  alertSpy.mockRestore();
});

test('Signup_ServiceProvider3 renders correctly', async () => {
  const renderer = await renderScreen(
    SignupServiceProvider3Screen,
    createNavigation(),
  );
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Signup_ServiceProvider3 requires the agreements before submitting', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SignupServiceProvider3Screen
        navigation={createNavigation()}
        route={{
          params: {
            application: { firstName: 'Juan', email: 'juanluna@gmail.com' },
          },
        }}
      />,
    );
  });

  const submitButton = renderer.root.findByProps({
    accessibilityLabel: 'Submit application',
  });
  await ReactTestRenderer.act(async () => {
    submitButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Agreements required',
    'Please certify your information and agree to the Terms & Conditions.',
  );
  alertSpy.mockRestore();
});

test('Signup_ServiceProvider3 submits and routes to Login', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const navigation = createNavigation();
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SignupServiceProvider3Screen
        navigation={navigation}
        route={{
          params: {
            application: { firstName: 'Juan', email: 'juanluna@gmail.com' },
          },
        }}
      />,
    );
  });

  // TouchableOpacity renders an inner Touchable with the same props, so
  // match only the composite component to avoid toggling a row twice.
  const checkboxes = renderer.root
    .findAllByProps({ accessibilityRole: 'checkbox' })
    .filter(node => node.type === TouchableOpacity);
  for (const checkbox of checkboxes) {
    await ReactTestRenderer.act(async () => {
      checkbox.props.onPress();
    });
  }

  const submitButton = renderer.root.findByProps({
    accessibilityLabel: 'Submit application',
  });
  await ReactTestRenderer.act(async () => {
    submitButton.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Application submitted',
    'Your service provider application has been submitted.',
    [{ text: 'OK', onPress: expect.any(Function) }],
  );
  alertSpy.mockRestore();
});

test('CustomerHome renders correctly', async () => {
  const renderer = await renderScreen(CustomerHomeScreen, createNavigation());
  expect(renderer).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('CustomerHome loads the profile, active repair and notifications from the backend', async () => {
  getMe.mockResolvedValue({
    user: { fullName: 'Juan Luna', role: 'customer' },
  });
  getActiveRepair.mockResolvedValue({
    booking: {
      id: 'booking-1',
      status: 'in_progress',
      serviceName: 'SCREEN REPLACEMENT',
      providerName: 'Jose',
      description: 'Cracked screen on a phone.',
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  });
  getNotifications.mockResolvedValue({
    notifications: [
      {
        id: 'notification-1',
        message: 'Jose updated status to "Parts sourced"',
        readAt: null,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
  });

  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CustomerHomeScreen
        navigation={createNavigation()}
        route={{ params: { token: 'token-123' } }}
      />,
    );
  });
  // Flush the data fetch triggered on mount.
  await ReactTestRenderer.act(async () => {});

  expect(getMe).toHaveBeenCalledWith('token-123');
  expect(getActiveRepair).toHaveBeenCalledWith('token-123');
  expect(getNotifications).toHaveBeenCalledWith('token-123');
  expect(
    renderer.root.findByProps({ children: 'Welcome, Juan!' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ children: 'SCREEN REPLACEMENT' }),
  ).toBeTruthy();
  expect(renderer.root.findByProps({ children: 'In Progress' })).toBeTruthy();
  expect(
    renderer.root.findByProps({
      children: 'Jose updated status to "Parts sourced"',
    }),
  ).toBeTruthy();
  expect(renderer.root.findByProps({ children: '2h ago' })).toBeTruthy();
});

test('CustomerHome shows the empty states without an active repair or notifications', async () => {
  getMe.mockResolvedValue({
    user: { fullName: 'Juan Luna', role: 'customer' },
  });
  getActiveRepair.mockResolvedValue({ booking: null });
  getNotifications.mockResolvedValue({ notifications: [] });

  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CustomerHomeScreen
        navigation={createNavigation()}
        route={{ params: { token: 'token-123' } }}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {});

  expect(
    renderer.root.findByProps({ children: 'No Active Repair' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ children: 'No notifications yet' }),
  ).toBeTruthy();
});

test('CustomerHome keeps the unbuilt tabs as placeholders', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderScreen(CustomerHomeScreen, createNavigation());

  const profileTab = renderer.root.findByProps({
    accessibilityLabel: 'Profile tab',
  });
  await ReactTestRenderer.act(async () => {
    profileTab.props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Coming soon',
    'Profile will be available soon.',
  );
  alertSpy.mockRestore();
});

