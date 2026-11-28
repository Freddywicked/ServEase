import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import Track from '../customer/Track';
import IncomingServiceRequest from '../serviceprovider/IncomingServiceRequest';
import Jobs from '../serviceprovider/Jobs';
import { getIncomingRequests, getTrackedRequests } from '../api/servicerequest_api';
import { getProviderJobs, getProviderJobQuotations } from '../api/providerWork_api';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => ReactModule.createElement(View, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('../api/servicerequest_api', () => ({
  getTrackedRequests: jest.fn(),
  getIncomingRequests: jest.fn(),
  approveAdditionalPayment: jest.fn(),
  rejectAdditionalPayment: jest.fn(),
  negotiateAdditionalPayment: jest.fn(),
}));

jest.mock('../api/providerWork_api', () => ({
  getProviderJobs: jest.fn(),
  getProviderJobQuotations: jest.fn(),
  acceptNegotiation: jest.fn(),
  rejectNegotiation: jest.fn(),
}));

jest.mock('../utils/providerTabBadges', () => ({
  subscribeToProviderTabActivity: jest.fn(() => jest.fn()),
}));

jest.mock('../utils/trackBadges', () => {
  const badgeApi = {
    counts: { pending: 0, active: 0, completed: 0, closed: 0, nav: 0 },
    sync: jest.fn(),
    markTabSeen: jest.fn(),
  };
  return {
    TAB_SOURCES: {
      pending: ['sent'],
      active: ['approved', 'ongoing'],
      completed: ['done'],
      closed: ['declined'],
    },
    ACTION_CARD_TYPES: ['quotation', 'payment'],
    useTrackBadges: () => badgeApi,
  };
});

const { act } = ReactTestRenderer;
const navigation = { navigate: jest.fn(), setParams: jest.fn() };
let renderer;

const renderScreen = async (screen) => {
  await act(async () => {
    renderer = ReactTestRenderer.create(screen);
  });
};

const screenText = () => {
  const collectText = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(collectText).join(' ');
    return collectText(node.children);
  };
  return collectText(renderer.toJSON());
};

const typeSearch = (placeholder, value) => {
  const input = renderer.root
    .findAllByType(TextInput)
    .find((node) => node.props.placeholder === placeholder);
  expect(input).toBeDefined();
  act(() => input.props.onChangeText(value));
  expect(input.props.value).toBe(value);
};

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  jest.clearAllMocks();
});

test('Track filters pending requests by provider name, handles no matches, and restores on clear', async () => {
  getTrackedRequests.mockResolvedValue({
    sent: [
      {
        id: 'track-1',
        requestId: 'SR-1001',
        requestNumber: 'SR-1001',
        providerName: 'Alpha Appliance',
        probableCause: 'Faulty capacitor',
        cardType: 'diagnosis',
        timeline: [],
      },
      {
        id: 'track-2',
        requestId: 'SR-1002',
        requestNumber: 'SR-1002',
        providerName: 'Beta Repair',
        probableCause: 'Broken fan',
        cardType: 'diagnosis',
        timeline: [],
      },
    ],
    approved: [],
    ongoing: [],
    declined: [],
    done: [],
  });
  await renderScreen(<Track navigation={navigation} route={{ params: {} }} />);

  expect(screenText()).toContain('SR-1001');
  expect(screenText()).toContain('SR-1002');

  typeSearch('Search request details', '  ALPHA appliance  ');
  expect(screenText()).toContain('SR-1001');
  expect(screenText()).not.toContain('SR-1002');

  typeSearch('Search request details', 'not-present');
  expect(screenText()).toContain('No pending requests');
  expect(screenText()).not.toContain('SR-1001');

  typeSearch('Search request details', '');
  expect(screenText()).toContain('SR-1001');
  expect(screenText()).toContain('SR-1002');
});

test('Track keeps an accepted unpaid request in Pending and opens initial payment', async () => {
  getTrackedRequests.mockResolvedValue({
    sent: [
      {
        id: 'track-initial',
        requestId: 'SR-1003',
        requestNumber: 'SR-1003',
        providerName: 'Initial Payment Repair',
        cardType: 'timeline',
        statusLabel: 'Awaiting initial payment',
        initialPaymentPaid: false,
        timeline: [],
      },
    ],
    approved: [],
    ongoing: [],
    declined: [],
    done: [],
  });
  await renderScreen(<Track navigation={navigation} route={{ params: {} }} />);

  expect(screenText()).toContain('SR-1003');
  expect(screenText()).toContain('Awaiting initial payment');
  const paymentButton = renderer.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(Text).some((text) => text.props.children === 'Proceed to Payment'));
  expect(paymentButton).toBeDefined();

  act(() => paymentButton.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('Payment', expect.objectContaining({
    requestId: 'SR-1003',
    paymentStage: 'initial',
  }));
});

test('IncomingServiceRequest searches request details and restores all requests on clear', async () => {
  getIncomingRequests.mockResolvedValue([
    {
      id: 'SR-2001',
      customerName: 'Alice Cruz',
      concern: 'Refrigerator is not cooling',
      status: 'new',
      createdAt: '2026-11-20T08:00:00Z',
    },
    {
      id: 'SR-2002',
      customerName: 'Bob Santos',
      concern: 'Washing machine is leaking',
      status: 'new',
      createdAt: '2026-11-21T08:00:00Z',
    },
  ]);
  await renderScreen(<IncomingServiceRequest navigation={navigation} />);

  typeSearch('Search request details', '  NOT COOLING ');
  expect(screenText()).toContain('SR-2001');
  expect(screenText()).not.toContain('SR-2002');

  typeSearch('Search request details', 'not-present');
  expect(screenText()).toContain('No requests match your search');
  expect(screenText()).not.toContain('SR-2001');

  typeSearch('Search request details', '');
  expect(screenText()).toContain('SR-2001');
  expect(screenText()).toContain('SR-2002');
});


test('Jobs filters active jobs by current step and restores them on clear', async () => {
  getProviderJobs.mockResolvedValue({
    jobs: [
      {
        id: 'job-1',
        requestNumber: 'SR-3001',
        customerName: 'Carla Reyes',
        currentStepLabel: 'Compressor replacement',
        status: 'Active',
        statusLabel: 'In progress',
        stages: [],
      },
      {
        id: 'job-2',
        requestNumber: 'SR-3002',
        customerName: 'Dan Lim',
        currentStepLabel: 'Final testing',
        status: 'Active',
        statusLabel: 'In progress',
        stages: [],
      },
    ],
  });
  getProviderJobQuotations.mockResolvedValue({ quotations: [] });
  await renderScreen(<Jobs navigation={navigation} />);

  typeSearch('Search job details', '  COMPRESSOR replacement ');
  expect(screenText()).toContain('SR-3001');
  expect(screenText()).not.toContain('SR-3002');

  typeSearch('Search job details', 'not-present');
  expect(screenText()).toContain('No jobs found');
  expect(screenText()).not.toContain('SR-3001');

  typeSearch('Search job details', '');
  expect(screenText()).toContain('SR-3001');
  expect(screenText()).toContain('SR-3002');
});

test('Jobs also filters quotation cards by the customer message', async () => {
  getProviderJobs.mockResolvedValue({ jobs: [] });
  getProviderJobQuotations.mockResolvedValue({
    quotations: [
      {
        paymentRequestId: 'payment-1',
        jobId: 'SR-4001',
        requestNumber: 'SR-4001',
        customerName: 'Eva Gomez',
        customerMessage: 'Please use the original compressor',
        proposedAmount: 1200,
      },
      {
        paymentRequestId: 'payment-2',
        jobId: 'SR-4002',
        requestNumber: 'SR-4002',
        customerName: 'Fred Tan',
        customerMessage: 'Can we reduce the labor charge?',
        proposedAmount: 800,
      },
    ],
  });
  await renderScreen(<Jobs navigation={navigation} />);

  const quotationsTab = renderer.root
    .findAllByType(TouchableOpacity)
    .find(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some((text) => text.props.children === 'Quotations'),
    );
  expect(quotationsTab).toBeDefined();
  act(() => quotationsTab.props.onPress());

  typeSearch('Search job details', '  ORIGINAL compressor ');
  expect(screenText()).toContain('SR-4001');
  expect(screenText()).not.toContain('SR-4002');

  typeSearch('Search job details', 'not-present');
  expect(screenText()).toContain('No quotations found');
  expect(screenText()).not.toContain('SR-4001');

  typeSearch('Search job details', '');
  expect(screenText()).toContain('SR-4001');
  expect(screenText()).toContain('SR-4002');
});
