module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/node_modules/@react-native-documents/picker/jest/build/jest/setup.js',
  ],
  moduleNameMapper: {
    '^@react-native-documents/picker$': '<rootDir>/node_modules/@react-native-documents/picker/jest/build/src/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native-image-picker|react-native-linear-gradient|@react-native(-community)?|@react-native-async-storage|@react-native-documents|@react-navigation)/)',
  ],
};
