/* eslint-env jest */

// AsyncStorage is a native module, so swap in the official in-memory mock
// for tests. See https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest')
);
