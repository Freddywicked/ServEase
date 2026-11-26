import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen, { ACCOUNT_CREATED_KEY } from '../screens/SplashScreen';
import { useAuth } from '../context/auth_context';

jest.mock('../context/auth_context', () => ({
  useAuth: jest.fn(),
  homeRouteFor: jest.fn(() => 'CustomerDashboard'),
}));

describe('SplashScreen authentication routing', () => {
  let renderer;
  let navigation;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    navigation = { replace: jest.fn(), navigate: jest.fn() };
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) =>
      key === ACCOUNT_CREATED_KEY ? 'true' : null
    );
  });

  afterEach(() => {
    if (renderer) ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  const renderSplash = async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<SplashScreen navigation={navigation} />);
    });
  };

  test('a restored authenticated session goes home instead of LoginScreen', async () => {
    useAuth.mockReturnValue({ user: { user_id: 'user-1' }, provider: null, restoring: false });
    await renderSplash();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(navigation.replace).toHaveBeenCalledWith('CustomerDashboard');
    expect(navigation.replace).not.toHaveBeenCalledWith('LoginScreen');
  });

  test('a returning device with no authenticated session goes to LoginScreen', async () => {
    useAuth.mockReturnValue({ user: null, provider: null, restoring: false });
    await renderSplash();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(navigation.replace).toHaveBeenCalledWith('LoginScreen');
  });

  test('splash waits for session restoration before choosing a route', async () => {
    useAuth.mockReturnValue({ user: null, provider: null, restoring: true });
    await renderSplash();
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(navigation.replace).not.toHaveBeenCalled();

    useAuth.mockReturnValue({ user: { user_id: 'user-1' }, provider: null, restoring: false });
    ReactTestRenderer.act(() => {
      renderer.update(<SplashScreen navigation={navigation} />);
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(navigation.replace).toHaveBeenCalledWith('CustomerDashboard');
  });
});
