/**
 * Customer home screen: the landing screen of the customer side, reached
 * after role selection (Customer) or directly after sign-in when the user
 * only has the customer role.
 *
 * Shows the personalized greeting, the "Create Service Request" quick
 * start, the active repair card and the latest notifications. Everything
 * for this screen (markup, behavior and styles) lives in this single file.
 *
 * Nothing is hardcoded - the profile, active repair and notifications are
 * fetched from the backend (getMe, getActiveRepair and getNotifications in
 * services/api.js) using the auth token passed via route params.
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from '@react-native-vector-icons/ionicons';
import {
  getActiveRepair,
  getMe,
  getNotifications,
  markNotificationRead,
} from '../services/api';

// Bottom navigation tabs. The active tab uses the white icon on the brand
// pill, inactive tabs use the colored icon.
const TABS = [
  {
    key: 'Home',
    label: 'Home',
    activeIcon: require('../assets/icon_home_white.png'),
    inactiveIcon: require('../assets/icon_home_colored.png'),
  },
  {
    key: 'Find',
    label: 'Find',
    activeIcon: require('../assets/icon_gear_white.png'),
    inactiveIcon: require('../assets/icon_gear_colored.png'),
  },
  {
    key: 'Track',
    label: 'Track',
    activeIcon: require('../assets/icon_tools_white.png'),
    inactiveIcon: require('../assets/icon_tools_colored.png'),
  },
  {
    key: 'Chat',
    label: 'Chat',
    activeIcon: require('../assets/icon_chatbubble_white.png'),
    inactiveIcon: require('../assets/icon_chatbubble_colored.png'),
  },
  {
    key: 'History',
    label: 'History',
    activeIcon: require('../assets/icon_history_white.png'),
    inactiveIcon: require('../assets/icon_history_colored.png'),
  },
  {
    key: 'Profile',
    label: 'Profile',
    activeIcon: require('../assets/icon_profile_white.png'),
    inactiveIcon: require('../assets/Icon_profile_colored.png'),
  },
];

/** "Juan Luna" -> "Juan". */
const firstNameOf = fullName => fullName?.trim().split(/\s+/)[0] || '';

/** "in_progress" -> "In Progress". */
const formatStatus = status =>
  String(status || '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Relative timestamp for notifications/repairs, e.g. "2h ago". */
const formatRelativeTime = isoDate => {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return 'Just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
};

const CustomerHomeScreen = ({ navigation, route }) => {
  // Auth context passed from Login/RoleSelection once the backend issued it.
  const token = route?.params?.token || null;

  const [user, setUser] = useState(route?.params?.user || null);
  const [activeRepair, setActiveRepair] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadHomeData = useCallback(
    async ({ refresh = false } = {}) => {
      // Without a token there is nothing to fetch - show the empty states.
      if (!token) {
        setIsLoading(false);
        return;
      }
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError('');
      try {
        const [meResult, repairResult, notificationsResult] =
          await Promise.all([
            getMe(token),
            getActiveRepair(token),
            getNotifications(token),
          ]);
        setUser(meResult.user);
        setActiveRepair(repairResult.booking || null);
        setNotifications(notificationsResult.notifications || []);
      } catch (error) {
        setLoadError(error.message || 'Something went wrong.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const firstName = firstNameOf(user?.fullName);
  const unreadCount = notifications.filter(item => !item.readAt).length;

  const handleCreateRequest = () => {
    // TODO: navigate to the service request flow once it is built.
    Alert.alert(
      'Coming soon',
      'Service request creation will be available soon.',
    );
  };

  const handleOpenNotifications = () => {
    // TODO: navigate to the full notifications screen once it is built.
    Alert.alert(
      'Coming soon',
      'The full notifications screen will be available soon.',
    );
  };

  const handleNotificationPress = notification => {
    if (!token || notification.readAt) {
      return;
    }
    // Optimistically mark as read, then persist via the backend.
    setNotifications(current =>
      current.map(item =>
        item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    markNotificationRead(token, notification.id).catch(() => {
      // Best-effort: the next refresh restores the server state.
    });
  };

  const handleTabPress = tab => {
    if (tab.key === 'Home') {
      return; // Already on the home screen.
    }
    // TODO: navigate to the Find/Track/Chat/History/Profile screens once
    // they are built.
    Alert.alert('Coming soon', `${tab.label} will be available soon.`);
  };

  const renderActiveRepair = () => {
    if (!activeRepair) {
      return (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyText}>No Active Repair</Text>
        </View>
      );
    }
    return (
      <View style={styles.card}>
        <View style={styles.repairHeader}>
          <Text style={styles.repairService}>
            {activeRepair.serviceName || 'Service Request'}
          </Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {formatStatus(activeRepair.status)}
            </Text>
          </View>
        </View>
        {activeRepair.providerName ? (
          <Text style={styles.repairMeta}>
            Provider: {activeRepair.providerName}
          </Text>
        ) : null}
        {activeRepair.description ? (
          <Text style={styles.repairDescription} numberOfLines={2}>
            {activeRepair.description}
          </Text>
        ) : null}
        <Text style={styles.repairTimestamp}>
          Updated {formatRelativeTime(activeRepair.updatedAt)}
        </Text>
      </View>
    );
  };

  const renderNotifications = () => {
    if (!notifications.length) {
      return (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      );
    }
    return notifications.map(notification => (
      <TouchableOpacity
        key={notification.id}
        activeOpacity={0.85}
        onPress={() => handleNotificationPress(notification)}
        accessibilityRole="button"
        accessibilityLabel={`Notification: ${notification.message}`}
        style={styles.card}
      >
        <View style={styles.notificationRow}>
          {!notification.readAt && <View style={styles.unreadDot} />}
          <Text
            style={[
              styles.notificationMessage,
              !notification.readAt && styles.notificationMessageUnread,
            ]}
          >
            {notification.message}
          </Text>
        </View>
        <Text style={styles.notificationTime}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {firstName ? `Welcome, ${firstName}!` : 'Welcome!'}
          </Text>
          <Text style={styles.subtitle}>What needs fixing today?</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenNotifications}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={styles.bellButton}
        >
          <Icon name="notifications-outline" size={26} color="#1E2A6E" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F6CD6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadHomeData({ refresh: true })}
              colors={['#0F6CD6']}
              tintColor="#0F6CD6"
            />
          }
        >
          {loadError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => loadHomeData()}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text style={styles.errorRetry}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Quick Start</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreateRequest}
            accessibilityRole="button"
            accessibilityLabel="Create Service Request"
            style={styles.requestButtonWrapper}
          >
            <LinearGradient
              colors={['#0F6CD6', '#00BFA6']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.requestButton}
            >
              <Text style={styles.requestButtonText}>
                Create Service Request
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Active Repair</Text>
          {renderActiveRepair()}

          <Text style={styles.sectionLabel}>Notifications</Text>
          {renderNotifications()}
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        {TABS.map(tab => {
          const isActive = tab.key === 'Home';
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.85}
              onPress={() => handleTabPress(tab)}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label} tab`}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.tabIconWrapper,
                  isActive && styles.tabIconActive,
                ]}
              >
                <Image
                  source={isActive ? tab.activeIcon : tab.inactiveIcon}
                  resizeMode="contain"
                  style={styles.tabIcon}
                />
              </View>
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E2A6E',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
  },
  bellButton: {
    padding: 8,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#F5C2C0',
    borderRadius: 10,
    backgroundColor: '#FDECEA',
    padding: 14,
    marginTop: 20,
  },
  errorText: {
    color: '#B3261E',
    fontSize: 13,
  },
  errorRetry: {
    color: '#2E7CF6',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#7C8499',
    marginTop: 24,
    marginBottom: 10,
  },
  requestButtonWrapper: {
    alignSelf: 'stretch',
  },
  requestButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#C9CDD4',
    marginTop: 28,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E2E5EA',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
  },
  emptyCard: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#A6ADB8',
    fontSize: 13,
  },
  repairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repairService: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 12,
  },
  statusChip: {
    borderRadius: 999,
    backgroundColor: '#E8F1FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    color: '#0F6CD6',
    fontSize: 11,
    fontWeight: '700',
  },
  repairMeta: {
    color: '#1F2937',
    fontSize: 13,
    marginTop: 8,
  },
  repairDescription: {
    color: '#7C8499',
    fontSize: 13,
    marginTop: 4,
  },
  repairTimestamp: {
    color: '#A6ADB8',
    fontSize: 11,
    marginTop: 10,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F6CD6',
    marginRight: 8,
  },
  notificationMessage: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
  },
  notificationMessageUnread: {
    fontWeight: '600',
  },
  notificationTime: {
    color: '#A6ADB8',
    fontSize: 11,
    marginTop: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E5EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabIconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: '#0F6CD6',
  },
  tabIcon: {
    width: 22,
    height: 22,
  },
  tabLabel: {
    fontSize: 11,
    color: '#1F2937',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#0F6CD6',
    fontWeight: '700',
  },
});

export default CustomerHomeScreen;




