/**
 * Jest setup: mocks for native modules used across the app.
 * @format
 */

/* eslint-env jest */

jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockLinearGradient = ({ children, style }) =>
    React.createElement(View, { style }, children);

  return { __esModule: true, default: MockLinearGradient };
});

jest.mock('@react-native-vector-icons/ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockIcon = ({ name, style }) => React.createElement(Text, { style }, name);

  return { __esModule: true, default: MockIcon };
});

jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock');
  return mock.default || mock;
});
