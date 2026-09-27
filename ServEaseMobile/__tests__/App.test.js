/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// SplashScreen stays visible for at least this long before revealing the
// Get Started button (fresh install) or routing to login (returning user).
const SPLASH_DURATION_MS = 3000;

test('renders correctly', async () => {
  jest.useFakeTimers();
  let renderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  // Flush the splash screen's minimum display timer inside act() so no state
  // update fires after the test environment has been torn down.
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(SPLASH_DURATION_MS);
  });

  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
  jest.useRealTimers();
});
