import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import NotificationBanner, { NotificationCard } from '../components/NotificationBanner';
import { openNotification } from '../utils/notificationActions';
import { useNotificationBannerStore } from '../utils/notificationBannerStore';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../utils/notificationActions', () => ({
  formatTimeAgo: jest.fn(() => 'Just now'),
  openNotification: jest.fn(),
}));

describe('NotificationBanner', () => {
  let renderer;

  beforeEach(() => {
    jest.useFakeTimers();
    openNotification.mockReset();
    useNotificationBannerStore.setState({ current: null, receivedTick: 0 });
  });

  afterEach(() => {
    if (renderer) ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  test('renders a pushed notification and opens it when tapped', () => {
    const navigationRef = { isReady: () => true };
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<NotificationBanner navigationRef={navigationRef} />);
    });
    expect(renderer.root.findAllByType(NotificationCard)).toHaveLength(0);

    ReactTestRenderer.act(() => {
      useNotificationBannerStore.getState().showNotification({
        id: 'banner-component-test-id',
        title: 'ServEase',
        message: 'You received a quotation.',
        type: 'quotation_received',
        requestId: 'SR-0007',
      });
    });

    const card = renderer.root.findByType(NotificationCard);
    expect(card.props.title).toBe('ServEase');
    expect(card.props.message).toBe('You received a quotation.');

    ReactTestRenderer.act(() => card.props.onPress());
    expect(openNotification).toHaveBeenCalledWith(
      navigationRef,
      expect.objectContaining({ id: 'banner-component-test-id', requestId: 'SR-0007' })
    );
  });
});
