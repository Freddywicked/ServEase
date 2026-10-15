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
 * fresh — and because the backend returns the signed-in user's own notifications, a customer
 * and a service provider each see different content.
 *
 * The list is a plain ScrollView (no Pressable wrapped around it), so it scrolls normally
 * once the notifications are taller than the dropdown.
 */
const NotificationsModal = ({ visible, onClose, top = DEFAULT_TOP }) => {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setLoadFailed(false);
        try {
            setNotifications(await getNotifications({ limit: NOTIFICATION_LIMIT }));
        } catch (error) {
            setLoadFailed(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

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
                <View style={styles.line} />

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
                        showsVerticalScrollIndicator
                        keyboardShouldPersistTaps="handled"
                    >
                        {notifications.map((item) => (
                            <View key={item.id}>
                                <View style={styles.item}>
                                    <Text style={styles.message}>{item.message}</Text>
                                    <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
                                </View>
                                <View style={styles.line} />
                            </View>
                        ))}
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
        maxHeight: 300, // taller than this -> the list scrolls
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        zIndex: 10,
        elevation: 8,
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: '#3F55A5',
        marginBottom: 8,
    },
    line: {
        height: 1,
        backgroundColor: '#8A8A8A',
    },
    list: {
        flexGrow: 0,
        flexShrink: 1,
    },
    item: {
        paddingVertical: 10,
    },
    message: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333333',
    },
    time: {
        fontSize: 11,
        color: '#666666',
        marginTop: 2,
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