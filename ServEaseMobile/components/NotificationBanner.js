// components/NotificationBanner.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationBannerStore } from '../utils/notificationBannerStore';
import { formatTimeAgo, openNotification } from '../utils/notificationActions';

const LOGO = require('../assets/servease_icon.png');

const AUTO_DISMISS_MS = 5000;
const HIDDEN_OFFSET = -160;

/* ------------------------------------------------------------------ */
/* Presentational card (reusable, e.g. for the NotificationsModal list) */
/* ------------------------------------------------------------------ */
export function NotificationCard({ title, message, timeLabel, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${message}. ${timeLabel || ''}`}
      accessibilityHint={onPress ? 'Opens the notification' : undefined}
      style={[styles.card, style]}
    >
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />

      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>

      {!!timeLabel && <Text style={styles.time}>{timeLabel}</Text>}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* App-level banner                                                    */
/* ------------------------------------------------------------------ */
export default function NotificationBanner({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const current = useNotificationBannerStore((s) => s.current);
  const dismissNotification = useNotificationBannerStore(
    (s) => s.dismissNotification
  );

  const [shown, setShown] = useState(null);
  const shownRef = useRef(null);
  const timerRef = useRef(null);
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(
    (key) => {
      clearTimer();
      Animated.timing(translateY, {
        toValue: HIDDEN_OFFSET,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          shownRef.current = null;
          setShown(null);
          dismissNotification(key);
        }
      });
    },
    [clearTimer, dismissNotification, translateY]
  );

  const startTimer = useCallback(
    (key) => {
      clearTimer();
      timerRef.current = setTimeout(() => hide(key), AUTO_DISMISS_MS);
    },
    [clearTimer, hide]
  );

  // A new notification arrived: show it (replacing any current one).
  useEffect(() => {
    if (!current) return;

    const wasVisible = !!shownRef.current;
    shownRef.current = current;
    setShown(current);

    translateY.stopAnimation();
    translateY.setValue(wasVisible ? -28 : HIDDEN_OFFSET);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    startTimer(current.key);
  }, [current, startTimer, translateY]);

  useEffect(() => clearTimer, [clearTimer]);

  // Swipe up to dismiss.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          clearTimer();
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, g) => translateY.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          const key = shownRef.current?.key;
          if (g.dy < -24 || g.vy < -0.6) {
            hide(key);
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            startTimer(key);
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          startTimer(shownRef.current?.key);
        },
      }),
    [clearTimer, hide, startTimer, translateY]
  );

  const handlePress = useCallback(() => {
    const notification = shownRef.current;
    if (!notification) return;
    clearTimer();
    openNotification(navigationRef, notification);
    hide(notification.key);
  }, [clearTimer, hide, navigationRef]);

  if (!shown) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { paddingTop: insets.top + 8 }]}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={{ transform: [{ translateY }] }}
        {...panResponder.panHandlers}
      >
        <NotificationCard
          title={shown.title}
          message={shown.message}
          timeLabel={formatTimeAgo(shown.createdAt)}
          onPress={handlePress}
        />
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles (from the Figma CSS + screenshot)                            */
/* ------------------------------------------------------------------ */
const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.25)',
  textShadowOffset: { width: 0, height: 4 },
  textShadowRadius: 10,
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    backgroundColor: '#F5F8FA',
    borderRadius: 20,
    // box-shadow: 0px 4px 10px rgba(0,0,0,0.25)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  logo: {
    width: 30,
    height: 30,
  },
  textBlock: {
    flex: 1,
    marginLeft: 17,
  },
  title: {
    fontFamily: 'Roboto',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 18,
    color: '#18315B',
    marginRight: 44, // keep clear of the time label
    ...TEXT_SHADOW,
  },
  message: {
    fontFamily: 'Roboto',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 15,
    color: '#414141',
    ...TEXT_SHADOW,
  },
  time: {
    position: 'absolute',
    top: 8,
    right: 15,
    fontFamily: 'Roboto',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 14,
    color: '#414141',
    ...TEXT_SHADOW,
  },
});