import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

/* ============================================================================
 * Shared building blocks for CustomerDashboard and ServiceProviderDashboard.
 * Measurements come straight from the Figma export (402 x 874 frame):
 *   section container  352 wide, 1px #C9C2C2 border, 14px radius
 *   item card          43 tall, 1px #C9C2C2 border, 14px radius, 6px gap
 *   title 12/700 #414141 · "View All" 9/700 #18315B
 *   item title 10/700 #3D3D3D · item summary 9/400 #484040
 * ========================================================================== */

// Container with a title on the left and a "View All" text button on the right (omitted when
// no `onActionPress` is given — the Notifications container has none).
export const DashboardSection = ({ title, actionLabel = 'View All', onActionPress, style, children }) => (
    <View style={[styles.section, style]}>
        <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            {onActionPress ? (
                <TouchableOpacity
                    onPress={onActionPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${actionLabel} ${title}`}
                >
                    <Text style={styles.action}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
        {children}
    </View>
);

// One rounded row inside a container: "Roof Leakage | #SR-0000" + a one-line summary.
export const DashboardItem = ({ title, summary, onPress, isFirst }) => (
    <TouchableOpacity
        style={[styles.item, isFirst ? styles.itemFirst : styles.itemNext]}
        activeOpacity={0.85}
        onPress={onPress}
        disabled={!onPress}
    >
        <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
        {summary ? <Text style={styles.itemSummary} numberOfLines={1}>{summary}</Text> : null}
    </TouchableOpacity>
);

// Placeholder that occupies the same space as two item cards, so the container keeps its size.
export const DashboardEmpty = ({ message, loading = false, onPress }) => (
    <TouchableOpacity style={styles.empty} activeOpacity={0.7} onPress={onPress} disabled={!onPress}>
        {loading ? <ActivityIndicator color="#0255AF" /> : <Text style={styles.emptyText}>{message}</Text>}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    section: {
        borderWidth: 1,
        borderColor: '#C9C2C2',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 11,
        paddingBottom: 13,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 20,
    },
    title: {
        fontSize: 12,
        lineHeight: 20,
        fontWeight: '700',
        color: '#414141',
    },
    action: {
        fontSize: 9,
        lineHeight: 15,
        fontWeight: '700',
        color: '#18315B',
    },
    item: {
        height: 43,
        borderWidth: 1,
        borderColor: '#C9C2C2',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 11,
        paddingTop: 5,
    },
    itemFirst: {
        marginTop: 12,
    },
    itemNext: {
        marginTop: 6,
    },
    itemTitle: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#3D3D3D',
    },
    itemSummary: {
        fontSize: 9,
        lineHeight: 15,
        color: '#484040',
    },
    empty: {
        height: 92,
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#817C7C',
        textAlign: 'center',
    },
});