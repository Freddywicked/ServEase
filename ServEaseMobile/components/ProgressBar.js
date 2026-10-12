import React from 'react';
import { View, StyleSheet } from 'react-native';

/* Shared step indicator for the Create Service Request flow
 * (Figma: 4 segments, 9px tall, 10px radius, 4px gaps).
 * Every step screen renders this instead of its own copy, so the bar can
 * never differ between screens.
 *
 *   <ProgressBar currentStep={2} />   // 2 of 4 segments filled
 */

const TOTAL_STEPS = 4;

const ProgressBar = ({ currentStep, totalSteps = TOTAL_STEPS }) => (
    <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }).map((_, index) => (
            <View
                key={index}
                style={[
                    styles.progressSegment,
                    index < currentStep ? styles.progressSegmentFilled : styles.progressSegmentEmpty,
                    index < totalSteps - 1 && styles.progressSegmentSpacing,
                ]}
            />
        ))}
    </View>
);

const styles = StyleSheet.create({
    progressBar: {
        flexDirection: 'row',
        marginBottom: 21,
    },
    progressSegment: {
        flex: 1,
        height: 9,
        borderRadius: 10,
    },
    progressSegmentFilled: {
        backgroundColor: '#0255AF',
    },
    progressSegmentEmpty: {
        backgroundColor: '#D9D9D9',
    },
    progressSegmentSpacing: {
        marginRight: 4,
    },
});

export default ProgressBar;