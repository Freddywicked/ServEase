import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNotifications } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';

const NOTIFICATION_LIMIT = 10;

// Figma: 337 x 243 white card, 10px radius, 35% black overlay, bell highlighted in a
// 42px white circle; the card's top edge sits 35.5px below the bell's centre.
const CARD_OFFSET_FROM_BELL_CENTER = 35.5;
const FALLBACK_OFFSET_FROM_SAFE_AREA = 87; // used when the bell position isn't passed in
const BELL_CIRCLE_SIZE = 42;
const BELL_ICON_SIZE = 27;

// Row text: a `title` field when the backend sends one, otherwise the first sentence of
// `message` is the bold line and the rest is the smaller line underneath.
const splitMessage = (item) => {
    if (item.title) return { heading: item.title, detail: item.message || '' };
    const message = item.message || '';
    const match = message.match(/^(.+?[.!?])\s+(.+)$/);
    return match ? { heading: match[1], detail: match[2] } : { heading: message, detail: '' };
};

/**
 * Popup shown when the bell icon is pressed.
 * Notifications are fetched from the backend every time the modal opens, so the list is
 * always fresh — and because the backend returns the signed-in user's own notifications,
 * a customer and a service provider each see different content in the same popup.
 *
 * `anchor` (optional) is the bell's { x, y, width, height } from measureInWindow; it lets
 * the popup highlight the bell and sit directly under it, like the design.
 */
const NotificationsModal = ({ visible, onClose, anchor }) => {
    const insets = useSafeAreaInsets();
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

    const cardTop = anchor
        ? anchor.y + anchor.height / 2 + CARD_OFFSET_FROM_BELL_CENTER
        : insets.top + FALLBACK_OFFSET_FROM_SAFE_AREA;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            {/* Tapping the dimmed backdrop closes the modal */}
            <Pressable style={styles.backdrop} onPress={onClose}>
                {anchor ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.bellCircle,
                            {
                                left: anchor.x + anchor.width / 2 - BELL_CIRCLE_SIZE / 2,
                                top: anchor.y + anchor.height / 2 - BELL_CIRCLE_SIZE / 2,
                            },
                        ]}
                    >
                        <Image source={require('../assets/icon_ringbell.png')} style={styles.bellIcon} />
                    </View>
                ) : null}

                {/* Inner Pressable swallows taps so touching the card doesn't close it */}
                <Pressable style={[styles.card, { top: cardTop }]} onPress={() => {}}>
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
                        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                            {notifications.map((item) => {
                                const { heading, detail } = splitMessage(item);
                                return (
                                    <View key={item.id} style={styles.item}>
                                        <Text style={styles.message} numberOfLines={1}>{heading}</Text>
                                        {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
                                        <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    bellCircle: {
        position: 'absolute',
        width: BELL_CIRCLE_SIZE,
        height: BELL_CIRCLE_SIZE,
        borderRadius: BELL_CIRCLE_SIZE / 2,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellIcon: {
        width: BELL_ICON_SIZE,
        height: BELL_ICON_SIZE,
        resizeMode: 'contain',
    },
    card: {
        position: 'absolute',
        left: 32,
        right: 32,
        height: 243,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingTop: 26,
        paddingHorizontal: 11,
    },
    title: {
        fontSize: 15,
        lineHeight: 18,
        fontWeight: '900',
        color: '#021E79',
        opacity: 0.7,
        marginLeft: 7,
        marginBottom: 9,
    },
    list: {
        paddingBottom: 11,
    },
    item: {
        height: 43,
        borderWidth: 1,
        borderColor: '#C9C2C2',
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 11,
        paddingTop: 5,
        marginBottom: 11,
    },
    message: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#3D3D3D',
        marginRight: 52, // keeps the text clear of the time on the right
    },
    detail: {
        fontSize: 9,
        lineHeight: 15,
        color: '#484040',
    },
    time: {
        position: 'absolute',
        right: 10,
        top: 14,
        fontSize: 10,
        lineHeight: 12,
        color: '#484040',
    },
    stateWrap: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    stateText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#817C7C',
        textAlign: 'center',
    },
});

export default NotificationsModal;