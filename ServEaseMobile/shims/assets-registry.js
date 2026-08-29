/**
 * Compatibility shim for @react-native-vector-icons dynamic font loading.
 *
 * The icon packages import `getAssetByID` from the legacy
 * `@react-native/assets-registry/registry` module, which no longer exists in
 * React Native 0.87 - the registry now lives at a private path inside the
 * `react-native` package. Metro redirects the legacy module here (see
 * `metro.config.js`).
 * @format
 */

// The asset registry is only available at this private path in RN 0.87.
// eslint-disable-next-line @react-native/no-deep-imports
import { AssetRegistry } from 'react-native/src/private/assets/AssetRegistry';

export const getAssetByID = AssetRegistry.getAssetByID;

export default AssetRegistry;
