import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

// One range for every radius in the app (provider home-service range AND customer
// search radius). Keep these in step with MAX_RADIUS_KM on the backend.
export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 100;
export const RADIUS_STEP_KM = 5;
export const DEFAULT_PROVIDER_RADIUS_KM = 10;
export const DEFAULT_CUSTOMER_RADIUS_KM = 15;

// Requires: npm i @react-native-community/slider (native module -> rebuild the app).
//
// `onChange(km)` fires when the user LETS GO of the slider, not on every tick, so a
// screen can save or re-search in it without sending a request per step. The label
// still updates live while dragging.
const RadiusSlider = ({ label, value, onChange, disabled = false }) => {
    const [liveValue, setLiveValue] = useState(value);

    // Follow the parent when it changes the value (e.g. after the saved profile loads).
    useEffect(() => {
        setLiveValue(value);
    }, [value]);

    return (
        <View style={styles.wrap}>
            <View style={styles.labelRow}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>{liveValue} km</Text>
            </View>
            <Slider
                style={styles.slider}
                minimumValue={MIN_RADIUS_KM}
                maximumValue={MAX_RADIUS_KM}
                step={RADIUS_STEP_KM}
                value={value}
                disabled={disabled}
                minimumTrackTintColor="#0255AF"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#0255AF"
                onValueChange={setLiveValue}
                onSlidingComplete={(km) => onChange?.(km)}
            />
            <View style={styles.scaleRow}>
                <Text style={styles.scaleText}>{MIN_RADIUS_KM} km</Text>
                <Text style={styles.scaleText}>{MAX_RADIUS_KM} km</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { width: '100%' },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: '#333333' },
    value: { fontSize: 13, fontWeight: '700', color: '#0255AF' },
    slider: { width: '100%', height: 36 },
    scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
    scaleText: { fontSize: 10, color: '#999999' },
});

export default RadiusSlider;