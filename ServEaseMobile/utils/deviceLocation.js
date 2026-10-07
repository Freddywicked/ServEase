import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

// Last-resort timer: if the native location call never settles (seen on some no-GMS
// phones), the screen must not stay on "Updating…" forever.
const LOCATION_WATCHDOG_MS = 20000;

const withWatchdog = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), ms)),
    ]);

// Asks for permission (if needed) and resolves with the device's coordinates.
// Rejects with Error('LOCATION_PERMISSION_DENIED') if the user says no.
export const getCurrentCoordinates = async () => {
    if (Platform.OS === 'ios') {
        const status = await Geolocation.requestAuthorization('whenInUse');
        if (status !== 'granted') {
            throw new Error('LOCATION_PERMISSION_DENIED');
        }
    } else {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('LOCATION_PERMISSION_DENIED');
        }
    }

    return withWatchdog(
        new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(
                (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
                (error) => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 10000,
                    // Honor/Huawei phones without Google Play Services hang forever on the
                    // fused provider (the timeout doesn't even fire); LocationManager
                    // works on every Android device.
                    forceLocationManager: true,
                },
            );
        }),
        LOCATION_WATCHDOG_MS
    );
};