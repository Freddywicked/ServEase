/* eslint-env jest */

// AsyncStorage is a native module, so swap in the official in-memory mock
// for tests. See https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest')
);

// Native geolocation has no Jest native module. Screens only need this interface
// when location is explicitly requested, so tests can provide per-test callbacks.
jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    requestAuthorization: jest.fn(async () => 'granted'),
  },
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    save: jest.fn(),
    saveAsset: jest.fn(),
  },
}));
