/**
 * Smoke test: the App renders without crashing.
 * The native-stack navigator is mocked since react-native-screens
 * requires native view managers that are unavailable under Jest.
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-navigation/native-stack', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');

  return {
    ...jest.requireActual('@react-navigation/native-stack'),
    createNativeStackNavigator: () => ({
      Navigator: ({ children }) => ReactMock.createElement(View, null, children),
      Screen: () => null,
    }),
  };
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
