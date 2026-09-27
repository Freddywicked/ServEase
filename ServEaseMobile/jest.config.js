module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native-linear-gradient|@react-native(-community)?|@react-navigation|@react-native-async-storage)/)',
  ],
};
