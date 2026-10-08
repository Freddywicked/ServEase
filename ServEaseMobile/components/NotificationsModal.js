import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNotifications } from '../api/servicerequest_api';
import { formatTimeAgo } from '../utils/formatters';

const NOTIFICATION_LIMIT = 10;

/**
 * Popup shown when the bell icon is pressed.
 * Notifications are fetched from the backend every time the modal opens,
 * so the list is always fresh.
 */
const NotificationsModal = ({ visible, onClose }) => {
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

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            {/* Tapping the dimmed backdrop closes the modal */}
            <Pressable style={styles.backdrop} onPress={onClose}>
                {/* Inner Pressable swallows taps so touching the card doesn't close it */}
                <Pressable style={[styles.card, { marginTop: insets.top + 100 }]} onPress={() => {}}>
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
                        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
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
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 12,
        maxHeight: '60%',
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