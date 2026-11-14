import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { getNotifications } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';

const NOTIFICATION_LIMIT = 10;

// Where the dropdown starts, measured from the top of the screen's safe area. Figma: it opens
// just under the "What needs fixing today?" line and covers the top of the content below.
const DEFAULT_TOP = 107;

// Splits a notification into a bold first sentence and a smaller second line — used by the
// "Notifications" container on the dashboard. A `title` field wins when the backend sends one.
export const splitNotification = (item) => {
    if (item.title) return { heading: item.title, detail: item.message || '' };
    const message = item.message || '';
    const match = message.match(/^(.+?[.!?])\s+(.+)$/);
    return match ? { heading: match[1], detail: match[2] } : { heading: message, detail: '' };
};

/**
 * Dropdown shown under the header when the bell icon is pressed — NOT a modal: no dimmed
 * overlay, it simply floats over the screen. Render it as the LAST child of the screen's
 * SafeAreaView so it sits on top. Tapping anywhere outside it (or the bell again) closes it.
 *
 * Notifications are fetched from the backend every time it opens, so the list is always
 * fresh. Pass `audience` ('customer' | 'provider') so each dashboard lists only its own
 * role's notifications.
 *
 * Each notification is a rounded container (Figma): a bold first line, a smaller second line
 * and the time on the right. The card is a fixed height and the list scrolls inside it once
 * the notifications no longer fit.
 */
const NotificationsModal = ({ visible, onClose, top = DEFAULT_TOP, audience }) => {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setLoadFailed(false);
        try {
            setNotifications(await getNotifications({ limit: NOTIFICATION_LIMIT, audience }));
        } catch (error) {
            setLoadFailed(true);
        } finally {
            setIsLoading(false);
        }
    }, [audience]);

    useEffect(() => {
        if (visible) load();
    }, [visible, load]);

    if (!visible) return null;

    return (
        <>
            {/* Invisible layer behind the dropdown: a tap outside closes it. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close notifications" />

            <View style={[styles.popup, { top }]}>
                <Text style={styles.title}>NOTIFICATIONS</Text>

                {isLoading ? (
                    <ActivityIndicator color="#0255AF" style={styles.stateWrap} />
                ) : loadFailed ? (
                    <Pressable onPress={load} style={styles.stateWrap}>
                        <Text style={styles.stateText}>Couldn't load. Tap to retry.</Text>
                    </Pressable>
                ) : notifications.length === 0 ? (
                    <View style={styles.stateWrap}>
                        <Text style={styles.stateText}>No notifications yet</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.list}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {notifications.map((item) => {
                            const { heading, detail } = splitNotification(item);
                            return (
                                <View key={item.id} style={styles.item}>
                                    <View style={styles.itemTextWrap}>
                                        <Text style={styles.itemHeading}>{heading}</Text>
                                        {detail ? <Text style={styles.itemDetail}>{detail}</Text> : null}
                                    </View>
                                    <Text style={styles.itemTime}>{formatTimeAgo(item.createdAt)}</Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    popup: {
        position: 'absolute',
        left: 25,
        right: 25,
        height: 243, // Figma card height; taller content scrolls
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        paddingTop: 25,
        paddingHorizontal: 16,
        paddingBottom: 4,
        zIndex: 10,
        elevation: 8,
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    title: {
        marginLeft: 7,
        marginBottom: 9,
        fontSize: 15,
        lineHeight: 18,
        fontWeight: '900',
        color: '#021E79',
        opacity: 0.7,
    },
    list: {
        flex: 1,
    },
    // One notification container (Figma: 319 x 43, 1px #C9C2C2 border, radius 14, 11px apart).
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 43,
        marginBottom: 11,
        paddingVertical: 5,
        paddingLeft: 11,
        paddingRight: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#C9C2C2',
        borderRadius: 14,
    },
    itemTextWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    itemHeading: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#3D3D3D',
    },
    itemDetail: {
        fontSize: 9,
        lineHeight: 15,
        fontWeight: '400',
        color: '#484040',
        marginTop: -1,
    },
    itemTime: {
        marginLeft: 8,
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '400',
        color: '#484040',
    },
    stateWrap: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    stateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
    },
});

export default NotificationsModal;