import React from 'react';
import { Image, Text, TouchableOpacity, View, StyleSheet } from 'react-native';

const MAX_DISPLAY = 99;

// Shared bell + red badge for the Customer and Service Provider dashboards.
// Shows nothing when count is 0, the number up to 99, and "+99" above that.
const NotificationBell = ({ count = 0, onPress, style }) => {
    const hasUnread = count > 0;
    const overflow = count > MAX_DISPLAY;
    const label = overflow ? `+${MAX_DISPLAY}` : String(count);

    return (
        <TouchableOpacity
            onPress={onPress}
            style={style}
            accessibilityRole="button"
            accessibilityLabel={hasUnread ? `Notifications, ${label} new` : 'Notifications'}
        >
            <Image source={require('../assets/icon_ringbell.png')} style={styles.bellIcon} />
            {hasUnread && (
                <View style={[styles.badge, overflow && styles.badgeWide]}>
                    <Text style={[styles.badgeText, overflow && styles.badgeTextWide]}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    bellIcon: {
        width: 27,
        height: 27,
        resizeMode: 'contain',
    },
    badge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 12,
        height: 12,
        borderRadius: 6,
        paddingHorizontal: 2,
        backgroundColor: '#C61E1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeWide: {
        top: -4,
        right: -5,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 7,
        lineHeight: 9,
        fontWeight: '500',
        textAlign: 'center',
        includeFontPadding: false,
    },
    badgeTextWide: {
        fontSize: 6.5,
    },
});

export default NotificationBell;