import React, { useState, useCallback, useRef } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform, StyleSheet, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ROUTES } from '../navigation/routes';
// The chat screens' own route names (same ones MessageCustomer.js navigates with).
import { ROUTES as MESSAGING_ROUTES } from '../constants/messaging';
import {
    getTrackedRequests,
    // [SCHEDULE PROPOSAL - DISABLED] acceptScheduleProposal,
    // [SCHEDULE PROPOSAL - DISABLED] rejectScheduleProposal,
    approveAdditionalPayment,
    deferAdditionalPayment,
    rejectAdditionalPayment,
    negotiateAdditionalPayment,
} from '../api/servicerequest_api';
import { formatDateTime } from '../utils/formatters';
import LinearGradient from 'react-native-linear-gradient';
// Shared "new" indicator state (also drives the Track icon on CustomerNavBar).
import { useTrackBadges, TAB_SOURCES, ACTION_CARD_TYPES } from '../utils/trackBadges';

/* ============================================================================
 * Track (Customer app) — "My Requests"
 * ----------------------------------------------------------------------------
 * Where the customer follows a service request after sending it. Everything here
 * comes from the backend, and most of it is data the SERVICE PROVIDER created from
 * their own app:
 *
 *   Customer-created                    Provider-created (shows up here)
 *   ----------------------------------  ------------------------------------------
 *   the request + AI diagnosis          quotation              (submitQuotation)
 *   (CreateServiceRequest flow)         new schedule proposal  (proposeSchedule)
 *                                       additional payment     (requestAdditionalPayment)
 *                                       progress / completed   (updateJobProgress / completeJob)
 *                                       decline + reason       (declineServiceRequest)
 *
 *   Load     GET  /service-requests/tracking  -> { sent, approved, ongoing, declined, done }
 *            (card shapes are documented above getTrackedRequests in serviceRequestApi.js)
 *   Respond  POST /service-requests/:id/schedule-proposals/:proposalId/accept | /reject
 *            POST /service-requests/:id/payment-requests/:paymentRequestId/approve | /reject
 *            Each one notifies the provider (their dashboard / incoming list update), then
 *            this screen reloads so what you see is always the server's current state.
 *
 *   Additional payment (provider asks for more money mid-job):
 *     Approve -> open a local confirmation modal; nothing is sent to the backend yet.
 *                  "Proceed to Payment" -> POST .../approve, then open Payment; the card disappears
 *                                          only after the linked payment is paid.
 *                  "Pay Later"         -> POST .../pay-later, which confirms and defers in one update.
 *                  X / Android back    -> close only; the request stays pending and Approve can reopen it.
 *     Decline -> two-step modal (one Modal, two steps, so there is no flicker between them):
 *                  1. "Warning!" step: "By declining the request, the additional parts and payment will not be
 *                     added to your repair." Confirm continues; the X (or Android back) cancels everything.
 *                  2. "Reason for Rejection" step: Send -> POST .../reject with { reason }.
 *                  Nothing is sent until the customer taps Send on step 2.
 *   Quotation approve/decline happens in RequestDetails (respondToQuotation in the API file).
 *
 * Tabs (customer-facing) and which tracking groups feed them:
 *   Pending    <- sent                 sent requests, INITIAL quotations being reviewed, price negotiations
 *   Active     <- approved + ongoing   confirmed appointments and repairs underway
 *   Completed  <- done                 finished services with payment settled
 *   Closed     <- declined             quotation declined by the customer, request declined by the provider,
 *                                      or a request cancelled by either side (see getClosedInfo)
 *
 * Inside Active there are two sections (underlined sub-tabs, per Figma):
 *   Quotations <- cards waiting on the customer's answer: additional-payment quotations for parts
 *                 (cardType 'payment': Approve / Negotiate / Decline). INITIAL quotations stay in
 *                 Pending and move to Active once approved.
 *   On-going   <- the active repairs with their tracking indicator (cardType 'timeline' / 'completed').
 *                 A repair with an additional payment waiting shows in BOTH sections (the payment
 *                 quotation in Quotations, its tracking indicator in On-going). Completed-but-unpaid
 *                 repairs stay here.
 * The tracking indicator is the one for the request's service location type (Shop-based or
 * Home-based); the backend builds the steps for that type, see getTimeline().
 *
 * [SCHEDULE PROPOSAL - DISABLED] The provider's "new schedule" card (Accept / Reject) was removed
 * because the customer can pick another schedule in RecommendServiceProvider. Search for the tag
 * "[SCHEDULE PROPOSAL - DISABLED]" in this file to find (and restore) every piece of it.
 *
 * Red indicators: ONE per status tab (Pending / Active / Completed / Closed), never on the Active
 * sub-tabs. A tab's count = cards in it the customer has not seen yet: a new card, or one the
 * provider just updated. Tapping the tab clears it. The Track icon on the nav bar has its own
 * indicator that clears when that icon is tapped. All of it lives in utils/trackBadges.js and is
 * derived from the loaded data; nothing is hard-coded.
 *
 * Reloads on focus, on pull-to-refresh, and every 15 seconds while focused, matching the web.
 * The FCM/Realtime hooks below can also trigger an immediate refresh when enabled.
 *
 * ========================================================================== */

// Fonts from the Figma spec. If a font is not loaded in the app, React Native falls back to the
// system font, so nothing breaks; adjust the names to match how the fonts are registered.
const FONTS = { quicksand: 'Quicksand', roboto: 'Roboto' };

// Figma: the four tabs sit 5px apart. A notification count above this shows as "99+".
const TAB_GAP = 5;
const MAX_BADGE_COUNT = 99;

// Figma "My Requests - Active/On-going" card measurements (design values, not data).
const TIMELINE_DOT_SIZE = 26; // status circles
const TIMELINE_STEP_GAP = 11; // space between two circles (37px pitch)
const TIMELINE_LINE_COLOR = '#D9D9D9'; // the thin line joining the circles
const FOOTER_BUTTON_GAP = 15; // space between View and Proceed to Payment
const POLL_INTERVAL_MS = 15000; // same live-refresh interval as the web Track screen

// Steps of the additional-payment decline flow: Decline -> warning -> reason -> Send.
const REJECT_STEP = { WARNING: 'warning', REASON: 'reason' };

// Customer-facing tabs. `sources` are the properties of the tracking response whose cards belong
// to the tab, so the backend contract (sent / approved / ongoing / declined / done) is unchanged.
const STATUS_FILTERS = [
    { key: 'pending', label: 'Pending', sources: TAB_SOURCES.pending },
    { key: 'active', label: 'Active', sources: TAB_SOURCES.active },
    { key: 'completed', label: 'Completed', sources: TAB_SOURCES.completed },
    { key: 'closed', label: 'Closed', sources: TAB_SOURCES.closed },
];

// Cards that sit waiting on the customer's answer are ACTION_CARD_TYPES (utils/trackBadges.js).
// [SCHEDULE PROPOSAL - DISABLED] 'schedule' used to be in that list.

// Sections inside the Active tab (labels only; the cards in each come from the backend).
const ACTIVE_SECTIONS = [
    { key: 'quotations', label: 'Quotations' },
    { key: 'ongoing', label: 'On-going' },
];

// Quotations section: everything that needs an answer. On-going section: every active repair, i.e.
// everything except the cards that only ask a question. A repair with an additional payment waiting
// has two cards: the 'payment' card (Quotations) and its own 'timeline' card (On-going).
const isQuotationCard = (request) => ACTION_CARD_TYPES.includes(request.cardType);
const isOngoingCard = (request) => !ACTION_CARD_TYPES.includes(request.cardType);

const getTabRequests = (groups, tab) => tab.sources.flatMap((source) => groups?.[source] ?? []);

// Accepts a tab key, or an old group key ('sent', 'approved', 'ongoing', 'declined', 'done') that
// the PayMongo deep link, Payment screen and Ratings screen may still pass as the `tab` param.
const findTab = (key) => STATUS_FILTERS.find((tab) => tab.key === key || tab.sources.includes(key));

// A request is paid once the customer settled the remaining balance, which is what moves it to
// Completed. A backend `isPaid` flag wins; the tab is the fallback.
const isPaidRequest = (request, tab) => request.isPaid ?? tab.key === 'completed';

// Badge text on the expandable cards. Not part of the card contract, so it is chosen by cardType;
// a backend-supplied `statusLabel` wins if one is ever sent.
const STATUS_TAG_BY_CARD_TYPE = { payment: 'In progress', timeline: 'In progress', completed: 'Completed' };
const getStatusTag = (request, isPaid) => {
    if (request.statusLabel) return request.statusLabel;
    // Provider marked it completed but the balance is unpaid: still in progress until paid.
    if (request.cardType === 'completed' && !isPaid) return 'In progress';
    return STATUS_TAG_BY_CARD_TYPE[request.cardType];
};

// The "Completed" step of a timeline (matched by id or label, whatever the backend sends).
const isCompletedStep = (step) =>
    String(step.id ?? '').toLowerCase() === 'completed' || String(step.label ?? '').trim().toLowerCase() === 'completed';

const formatPeso = (amount) => `₱${Number(amount ?? 0).toFixed(2)}`;

// Outcome of the customer's price negotiation on an additional payment, shown as a badge on the
// payment card (Figma "Negotiation Declined" / "Negotiation Approved"). `negotiationStatus` comes
// from the backend: 'requested' | 'accepted' | 'rejected'. A backend `negotiationLabel` wins.
const getNegotiationBadge = (request) => {
    if (request.negotiationLabel) return request.negotiationLabel;
    if (request.negotiationStatus === 'rejected') return 'Negotiation Declined';
    if (request.negotiationStatus === 'accepted') return 'Negotiation Approved';
    return null;
};

// One negotiation round per additional payment: once the provider answered (accepted or declined)
// the Negotiate button is gone and only Approve / Decline remain (Figma).
const isNegotiationAnswered = (request) =>
    request.negotiationStatus === 'accepted' || request.negotiationStatus === 'rejected';

// Closed tab wording. The backend says who closed the request (`closedBy`: 'customer' | 'provider')
// and how (`closedAction`: 'declined' | 'cancelled'); a backend `statusLabel` wins for the badge.
//   customer + declined  -> the customer declined the provider's quotation
//   customer + cancelled -> the customer cancelled the request
//   provider + declined  -> the provider declined the request
//   provider + cancelled -> the provider cancelled the request
const getClosedInfo = (request) => {
    const cancelled = String(request.closedAction ?? '').toLowerCase() === 'cancelled';
    const byCustomer = String(request.closedBy ?? '').toLowerCase() === 'customer';
    const provider = request.providerName || 'The service provider';
    let summary;
    if (byCustomer) {
        summary = cancelled ? 'You cancelled this request.' : `You declined the quotation from ${provider}.`;
    } else {
        summary = cancelled ? `${provider} cancelled this request.` : `${provider} declined this request.`;
    }
    return { label: request.statusLabel ?? (cancelled ? 'Cancelled' : 'Declined'), summary };
};

// "₱ 3000" style used by the additional-payment notice (Figma).
const formatPesoSpaced = (amount) => {
    const value = Number(amount ?? 0);
    return `₱ ${Number.isInteger(value) ? value : value.toFixed(2)}`;
};

// Shop-based and Home-based requests have different tracking indicators. The backend sends the
// request's service location type (`serviceLocationType`: 'home' | 'shop') and the matching steps.
const getLocationType = (request) => {
    const raw = String(request.serviceLocationType ?? request.locationType ?? request.serviceType ?? '').toLowerCase();
    if (raw.includes('home')) return 'home';
    if (raw.includes('shop')) return 'shop';
    return null;
};

// Picks the indicator that matches the request's service location type. `timelines` ({ home, shop })
// is preferred when the backend sends both; otherwise `timeline` is already the right one.
const getTimeline = (request) => {
    const type = getLocationType(request);
    return (type && request.timelines?.[type]) || request.timeline || [];
};

// Pulls together whichever text fields a card happens to have so search works
// the same way regardless of cardType, instead of assuming every request
// shares the same shape.
const getSearchableText = (request) =>
    [request.requestNumber, request.providerName, request.probableCause, request.reason]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

// Red count bubble on the top-right corner of a tab (Figma). Hidden when there is nothing new.
const NotificationBadge = ({ count }) => {
    if (!count) return null;
    return (
        <View style={styles.tabBadge} pointerEvents="none">
            <Text style={styles.tabBadgeText}>{count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count}</Text>
        </View>
    );
};

// "Quotations | On-going" underlined sub-tabs shown under the Active pill (Figma).
// No indicator here: the red count lives on the status tab only.
const SectionTabs = ({ sections, selectedKey, onSelect }) => (
    <View style={styles.sectionTabRow}>
        {sections.map((section) => {
            const isSelected = section.key === selectedKey;
            return (
                <TouchableOpacity
                    key={section.key}
                    style={styles.sectionTab}
                    onPress={() => onSelect(section.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={section.label}
                >
                    <View style={styles.sectionTabLabelWrap}>
                        <Text style={[styles.sectionTabText, isSelected && styles.sectionTabTextSelected]}>{section.label}</Text>
                    </View>
                    <View style={[styles.sectionTabBar, isSelected && styles.sectionTabBarSelected]} />
                </TouchableOpacity>
            );
        })}
    </View>
);

// Magnifier drawn with Views so this screen does not depend on an icon asset.
const SearchIcon = () => (
    <View style={styles.searchIcon}>
        <View style={styles.searchIconCircle} />
        <View style={styles.searchIconHandle} />
    </View>
);

// Blue-to-teal gradient button used by the modals (Figma: 150x40, 10px radius, grey outline).
const GradientButton = ({ label, onPress, disabled, loading, style }) => (
    <TouchableOpacity
        style={[styles.gradientButton, disabled && styles.actionButtonDisabled, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
    >
        <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.gradientButtonText}>{label}</Text>}
    </TouchableOpacity>
);

const Track = ({ navigation, route }) => {
    const [selectedStatus, setSelectedStatus] = useState(STATUS_FILTERS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [groups, setGroups] = useState(null); // null until the first load finishes
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const trackingRequestRef = useRef(false);
    const [busyCardId, setBusyCardId] = useState(null);
    // `approvedPayment` is only a local snapshot for the confirmation modal. Accept does not
    // approve anything on the backend; that happens after the customer chooses a payment option.
    const [approvedPayment, setApprovedPayment] = useState(null);
    const [paymentChoiceInFlight, setPaymentChoiceInFlight] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    // Which step of the decline flow is showing: 'warning' first, then 'reason' after Confirm.
    const [rejectStep, setRejectStep] = useState(REJECT_STEP.WARNING);
    // Active tab sub-tab. null = not chosen yet, so the screen picks one from what is loaded.
    const [sectionChoice, setSectionChoice] = useState(null);
    // Price negotiation modal (additional payment). `negotiateTarget` is the card being negotiated.
    const [negotiateTarget, setNegotiateTarget] = useState(null);
    const [negotiateMessage, setNegotiateMessage] = useState('');
    const [negotiateAmount, setNegotiateAmount] = useState('');
    // Red indicators on the status tabs (shared with the nav bar's Track icon).
    const { counts: badgeCounts, sync: syncBadges, markTabSeen } = useTrackBadges();

    const loadTracking = useCallback(async ({ refresh = false, silent = false } = {}) => {
        // A manual refresh/action and the live poll must not overwrite each other out of order.
        if (trackingRequestRef.current) return;
        trackingRequestRef.current = true;
        if (!silent) {
            if (refresh) setIsRefreshing(true);
            else setIsLoading(true);
            setErrorMessage('');
        }
        try {
            const data = await getTrackedRequests();
            setGroups(data);
            syncBadges(data);
        } catch (error) {
            // Keep showing the last good cards when a background poll fails.
            if (!silent) setErrorMessage(error.message);
        } finally {
            trackingRequestRef.current = false;
            if (!silent) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [syncBadges]);

    // Reload every time the customer comes back to this tab (e.g. after sending a request).
    // A `tab` route param (from the PayMongo return deep link, the Payment screen or
    // Ratings) pre-selects the tab that matches what just happened — a completed
    // final payment opens Done — and is consumed so it doesn't stick afterwards.
    useFocusEffect(
        useCallback(() => {
            const tabKey = route?.params?.tab;
            const target = findTab(tabKey);
            const sectionKey = route?.params?.section ?? (tabKey === 'ongoing' ? 'ongoing' : null);
            if (target) {
                setSelectedStatus(target);
                if (sectionKey) setSectionChoice(sectionKey);
                navigation.setParams({ tab: undefined, section: undefined });
            }
            loadTracking();
        }, [loadTracking, navigation, route?.params?.tab, route?.params?.section]),
    );

    // Match the web's live tracking: poll only while this screen is focused and the app is active.
    // Background failures keep the last good cards; an in-flight action temporarily pauses polling.
    useFocusEffect(
        useCallback(() => {
            const timer = setInterval(() => {
                if (AppState.currentState === 'active' && !busyCardId) loadTracking({ silent: true });
            }, POLL_INTERVAL_MS);
            return () => clearInterval(timer);
        }, [busyCardId, loadTracking]),
    );

    // ---------------------------------------------------------------------
    // PROVIDER COMMUNICATION (comment block): live tracking. Refresh the moment the
    // service provider submits a quotation, proposes a schedule, asks for an additional
    // payment, marks "on the way" / "completed", or declines — without pull-to-refresh.
    // Uncomment once serviceRequestApi.js's Realtime helpers are enabled (needs the mobile
    // Supabase client). `user.id` is the customer's id from auth_context (useAuth()).
    //
    // useEffect(() => {
    //     if (!user?.id) return undefined;
    //     return subscribeToMyServiceRequests(user.id, () => loadTracking({ refresh: true }));
    // }, [user?.id, loadTracking]);
    //
    // (import { subscribeToMyServiceRequests } from '../api/serviceRequestApi';)
    // The FCM push the backend sends on each provider action can call loadTracking() too.
    // ---------------------------------------------------------------------

    const statusRequests = getTabRequests(groups, selectedStatus);
    const isActiveTab = selectedStatus.key === 'active';
    const quotationRequests = statusRequests.filter(isQuotationCard);
    const ongoingRequests = statusRequests.filter(isOngoingCard);
    // Until the customer taps a sub-tab: Quotations if anything waits on them, else On-going.
    const activeSection =
        sectionChoice ?? (quotationRequests.length > 0 || ongoingRequests.length === 0 ? 'quotations' : 'ongoing');
    const sectionRequests = isActiveTab
        ? activeSection === 'quotations'
            ? quotationRequests
            : ongoingRequests
        : statusRequests;
    const searchTerm = searchQuery.trim().toLowerCase();
    const visibleRequests = searchTerm
        ? sectionRequests.filter((request) => getSearchableText(request).includes(searchTerm))
        : sectionRequests;

    // Tapping a status tab opens it and clears that tab's red indicator (even if it is already open).
    const handleSelectStatus = (status) => {
        setSelectedStatus(status);
        markTabSeen(status.key);
    };

    const handleRequestPress = (request) => {
        // RequestDetails is where the quotation is approved/declined (respondToQuotation).
        navigation.navigate(ROUTES.REQUEST_DETAILS, { requestId: request.requestId, requestNumber: request.requestNumber });
    };

    // Sends the customer's answer to the backend (which notifies the provider), then reloads
    // so the card reflects the server's state. 409 = the provider changed or withdrew it.
    // `onSuccess` runs as soon as the server accepted the answer, before the reload.
    const runAction = async (cardId, action, failureTitle, onSuccess) => {
        if (busyCardId) return;
        setBusyCardId(cardId);
        try {
            await action();
            if (onSuccess) onSuccess();
            await loadTracking({ refresh: true });
        } catch (error) {
            if (error.status === 409) {
                Alert.alert('This request was updated', 'The service provider changed it. Showing the latest details.');
                loadTracking({ refresh: true });
            } else {
                Alert.alert(failureTitle, error.message);
            }
        } finally {
            setBusyCardId(null);
        }
    };

    // [SCHEDULE PROPOSAL - DISABLED] Accept / Reject of the provider's new schedule (restore with the card below).
    // const handleAcceptSchedule = (request) =>
    //     runAction(request.id, () => acceptScheduleProposal(request.requestId, request.proposalId), 'Could not accept the schedule');

    // const handleRejectSchedule = (request) =>
    //     runAction(request.id, () => rejectScheduleProposal(request.requestId, request.proposalId), 'Could not reject the schedule');

    const asApprovedPayment = (request) => ({
        id: request.id,
        requestId: request.requestId,
        requestNumber: request.requestNumber,
        providerName: request.providerName,
        paymentRequestId: request.paymentRequestId,
        paymentStatus: request.paymentStatus,
        amount: request.paymentAmount,
    });

    // Accept only asks for confirmation. Closing this modal leaves the request pending and allows
    // the customer to open it again without creating any backend or provider-side state change.
    const handleApprovePayment = (request) => setApprovedPayment(asApprovedPayment(request));

    // Decline starts the two-step flow: the warning modal first, then (after Confirm) the
    // "Reason for Rejection" modal. Nothing is sent until the customer taps Send on the second one.
    const handleRejectPayment = (request) => {
        setRejectReason('');
        setRejectStep(REJECT_STEP.WARNING);
        setRejectTarget(request);
    };

    // The X / Android back button on either step cancels the whole flow.
    const handleCloseRejectModal = () => {
        if (busyCardId) return;
        setRejectTarget(null);
        setRejectReason('');
        setRejectStep(REJECT_STEP.WARNING);
    };

    // Warning modal "Confirm": the customer has seen the warning, so ask for the reason.
    const handleConfirmDeclineWarning = () => {
        setRejectStep(REJECT_STEP.REASON);
    };

    const handleConfirmRejectPayment = () => {
        const reason = rejectReason.trim();
        if (!reason) {
            Alert.alert('Reason needed', 'Please tell the service provider why you are rejecting this payment.');
            return;
        }
        const target = rejectTarget;
        runAction(
            target.id,
            () => rejectAdditionalPayment(target.requestId, target.paymentRequestId, { reason }),
            'Could not reject the payment',
            () => {
                setRejectTarget(null);
                setRejectReason('');
                setRejectStep(REJECT_STEP.WARNING);
            },
        );
    };

    // Closing the confirmation is not a payment choice. A pending request stays pending; an
    // already-approved card remains available if the customer returned from checkout without paying.
    const handleCloseApprovedPayment = () => {
        if (!busyCardId) setApprovedPayment(null);
    };

    const handlePayAdditionalLater = (payment) => {
        const target = payment || approvedPayment;
        if (!target || busyCardId) return;
        setPaymentChoiceInFlight('later');
        // This endpoint confirms a pending request and defers it in one update. It also supports
        // an already-approved card when the customer previously chose Pay Now but did not pay.
        return runAction(
            target.id,
            () => deferAdditionalPayment(target.requestId, target.paymentRequestId),
            'Could not confirm Pay Later',
            () => setApprovedPayment(null),
        ).finally(() => setPaymentChoiceInFlight(null));
    };

    const handlePayAdditionalNow = (payment) => {
        const target = payment || approvedPayment;
        if (!target || busyCardId) return;
        setPaymentChoiceInFlight('now');
        return runAction(
            target.id,
            async () => {
                // An approved card must not be approved a second time when returning from checkout.
                if (target.paymentStatus !== 'approved') {
                    await approveAdditionalPayment(target.requestId, target.paymentRequestId);
                }
            },
            'Could not confirm the payment',
            () => {
                setApprovedPayment(null);
                navigation.navigate(ROUTES.PAYMENT, {
                    requestId: target.requestId,
                    requestNumber: target.requestNumber,
                    providerName: target.providerName,
                    paymentStage: 'additional',
                    paymentRequestId: target.paymentRequestId,
                    amount: target.amount,
                });
            },
        ).finally(() => setPaymentChoiceInFlight(null));
    };

    // Negotiate opens the "Request a Price Negotiation" modal.
    const handleNegotiatePayment = (request) => {
        setNegotiateMessage('');
        setNegotiateAmount('');
        setNegotiateTarget(request);
    };

    const handleCloseNegotiateModal = () => {
        setNegotiateTarget(null);
        setNegotiateMessage('');
        setNegotiateAmount('');
    };

    // Sends the counter-offer (POST /service-requests/:id/payment-requests/:pid/negotiate). The
    // provider answers it from Jobs > Active > Quotations: accepting replaces the payment's amount
    // with the suggestion, declining sends back a reason. The card shows the outcome after the reload.
    const handleConfirmNegotiation = () => {
        const target = negotiateTarget;
        if (!target) return;
        const message = negotiateMessage.trim();
        const proposedAmount = Number(negotiateAmount);
        if (!negotiateAmount.trim() || !Number.isFinite(proposedAmount) || proposedAmount <= 0) {
            Alert.alert('Enter a valid amount', 'The suggested amount must be greater than zero.');
            return;
        }
        if (!message) {
            Alert.alert('Reason needed', 'Please state a reason for your suggested amount.');
            return;
        }
        runAction(
            target.id,
            () => negotiateAdditionalPayment(target.requestId, target.paymentRequestId, { proposedAmount, message }),
            'Could not send your negotiation',
            handleCloseNegotiateModal,
        );
    };

    // Opens the conversation that belongs to THIS service request (its own request id), so each
    // request (SR-0000, SR-0001, ...) has its own thread with the provider.
    // The conversation id IS the request reference ("SR-0007"), the same id MessageCustomer.js passes.
    const handleMessageProvider = (request) => {
        navigation.navigate(MESSAGING_ROUTES.CONVERSATION_CUSTOMER, {
            conversationId: request.requestId ?? request.requestNumber,
            contactName: request.providerName,
            jobTitle: request.category,
        });
    };

    const handleProceedToPayment = (request) => {
        const awaitingInitialPayment = request.initialPaymentPaid === false;
        navigation.navigate(ROUTES.PAYMENT, {
            requestId: request.requestId,
            requestNumber: request.requestNumber,
            providerName: request.providerName,
            paymentStage: awaitingInitialPayment ? 'initial' : 'final',
            amount: awaitingInitialPayment ? undefined : request.finalAmount,
        });
    };

    const isRequestPaid = (request) => isPaidRequest(request, selectedStatus);

    // Indicator flow (see Figma):
    //  - every step stays GREY until the service provider updates it, then turns blue with a check;
    //  - the "Completed" step stays an uncolored (darker grey) dot until the customer has paid the
    //    remaining balance, even after the provider marked the job completed ("Payment Pending").
    const renderTimeline = (timeline, isPaid = false) => {
        const steps = timeline || [];
        return (
            <View style={styles.timelineWrap}>
                {/* One continuous line behind the circles (Figma), from the first circle's centre to the last. */}
                {steps.length > 1 && <View style={styles.timelineConnector} />}
                {steps.map((step, index) => {
                    const isCompleted = isCompletedStep(step);
                    const isDone = !!step.done && (!isCompleted || isPaid);
                    const providerCompleted = isCompleted && !!step.done && !isPaid;
                    const isLast = index === steps.length - 1;
                    // `subtext` is a note the backend wants shown instead of the date (e.g. the Home-based
                    // "Service provider is now heading to your door step" on the "on the way" step).
                    const subtext = providerCompleted
                        ? 'Payment Pending'
                        : isDone && step.subtext
                          ? step.subtext
                          : isDone && step.timestamp
                            ? formatDateTime(step.timestamp)
                            : step.description;
                    return (
                        <View key={step.id ?? `${step.label}-${index}`} style={[styles.timelineRow, !isLast && styles.timelineRowSpaced]}>
                            <View
                                style={[
                                    styles.timelineDot,
                                    isDone ? styles.timelineDotDone : isCompleted && styles.timelineDotCompletedPending,
                                ]}
                            >
                                {isDone && <Image source={require('../assets/icon_check.png')} style={styles.timelineCheckIcon} />}
                            </View>
                            <View style={styles.timelineTextWrap}>
                                <Text style={styles.timelineLabel}>{step.label}</Text>
                                {!!subtext && <Text style={styles.timelineSubtext}>{subtext}</Text>}
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderDiagnosisCard = (request) => (
        <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            onPress={() => handleRequestPress(request)}
            activeOpacity={0.85}
        >
            <View style={styles.cardTopRow}>
                <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                <View style={styles.badgePending}>
                    <Text style={styles.badgePendingText}>{request.statusLabel ?? selectedStatus.label}</Text>
                </View>
            </View>
            <Text style={styles.sentToLine}>
                sent to <Text style={styles.providerName}>{request.providerName}</Text>
            </Text>
            <View style={styles.headerRule} />

            {request.probableCause ? (
                <>
                    <Text style={styles.probableCauseLabel}>Probable Cause</Text>
                    <Text style={styles.probableCauseText}>{request.probableCause}</Text>

                    {request.confidencePercent !== null && request.confidencePercent !== undefined && (
                        <Text style={styles.confidenceText}>
                            {Math.round(Math.min(100, Math.max(0, request.confidencePercent)))}% AI Confidence based on similar reported cases
                        </Text>
                    )}
                </>
            ) : (
                <Text style={styles.progressCaption}>Waiting for the service provider to respond.</Text>
            )}
        </TouchableOpacity>
    );

    const renderQuotationCard = (request) => {
        // Labor Cost, Parts Cost and Service Fee are always listed in this order. Parts is 0.00 when the
        // provider set no price for parts; the service fee (platform fee) comes from the backend.
        const total =
            request.total ??
            Number(request.laborCost ?? 0) + Number(request.partsCost ?? 0) + Number(request.serviceFee ?? 0);
        return (
            // Preview only — tapping opens RequestDetails, which is where the real
            // Approve/Decline actions (and the scheduling + payment modals) live.
            <TouchableOpacity
                key={request.id}
                style={styles.requestCard}
                onPress={() => handleRequestPress(request)}
                activeOpacity={0.85}
            >
                <View style={styles.cardTopRow}>
                    <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                    <View style={styles.badgeOrange}>
                        <Text style={styles.badgeOrangeText}>Approve Quote?</Text>
                    </View>
                </View>
                <Text style={styles.sentToLine}>{request.providerName} sent a quotation</Text>

                <View style={styles.lineItemRow}>
                    <Text style={styles.lineItemLabel}>Labor Cost</Text>
                    <Text style={styles.lineItemAmount}>{formatPeso(request.laborCost)}</Text>
                </View>
                <View style={styles.lineItemRow}>
                    <Text style={styles.lineItemLabel}>Parts Cost</Text>
                    <Text style={styles.lineItemAmount}>{formatPeso(request.partsCost)}</Text>
                </View>
                <View style={styles.lineItemRow}>
                    <Text style={styles.lineItemLabel}>Service Fee</Text>
                    <Text style={styles.lineItemAmount}>{formatPeso(request.serviceFee)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.lineItemRow}>
                    <Text style={styles.lineItemLabelBold}>Total</Text>
                    <Text style={styles.lineItemAmountBold}>{formatPeso(total)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    // [SCHEDULE PROPOSAL - DISABLED] The provider's "New Schedule" card (Accept / Reject).
    // const renderScheduleCard = (request) => {
    //     const isBusy = busyCardId !== null;
    //     return (
    //         <View key={request.id} style={styles.requestCard}>
    //             <View style={styles.cardTopRow}>
    //                 <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
    //                 <View style={styles.badgeOrange}>
    //                     <Text style={styles.badgeOrangeText}>New Schedule</Text>
    //                 </View>
    //             </View>
    //             <Text style={styles.sentToLine}>{request.providerName} sent a new schedule.</Text>

    //             <Text style={styles.scheduleDateTime}>{formatDateTime(request.scheduledAt)}</Text>

    //             <Text style={styles.reasonLabel}>Reason for New Schedule</Text>
    //             <Text style={styles.reasonText}>{request.reason}</Text>

    //             <View style={styles.actionRow}>
    //                 <TouchableOpacity style={[styles.actionButton, styles.actionButtonAccept, isBusy && styles.actionButtonDisabled]} disabled={isBusy} onPress={() => handleAcceptSchedule(request)}>
    //                     <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>Accept</Text>
    //                 </TouchableOpacity>
    //                 <TouchableOpacity style={[styles.actionButton, styles.actionButtonReject, isBusy && styles.actionButtonDisabled]} disabled={isBusy} onPress={() => handleRejectSchedule(request)}>
    //                     <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>Reject</Text>
    //                 </TouchableOpacity>
    //             </View>
    //         </View>
    //     );
    // };

    // Header shared by the on-going / completed cards. The badge wraps under the request number
    // when it is too long for one line (e.g. "Additional payment requested") instead of running
    // off the screen.
    // On the additional-payment card the badge becomes "Negotiation Declined" / "Negotiation Approved"
    // once the service provider answered the customer's negotiation.
    const renderCardHeader = (request, showNegotiationBadge = false) => {
        const negotiationBadge = showNegotiationBadge ? getNegotiationBadge(request) : null;
        return (
            <>
                <View style={styles.cardTopRow}>
                    <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                    {negotiationBadge ? (
                        <View style={styles.badgeNegotiation}>
                            <Text style={styles.badgeNegotiationText}>{negotiationBadge}</Text>
                        </View>
                    ) : (
                        <View style={styles.badgeBlue}>
                            <Text style={styles.badgeBlueText}>{getStatusTag(request, isRequestPaid(request))}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.providerNameLine}>
                    {negotiationBadge ? `${request.providerName} sent a quotation` : request.providerName}
                </Text>
            </>
        );
    };

    // Shown once the customer chose "Pay Later": the amount waits on the final payment.
    const renderDeferredNote = (request) =>
        Number(request.deferredAdditionalAmount) > 0 ? (
            <Text style={styles.deferredNote}>
                {formatPeso(request.deferredAdditionalAmount)} additional payment will be added to your final payment.
            </Text>
        ) : null;

    // Additional payment quotation (Active > Quotations). The tracking indicator for the same request
    // is shown in On-going, so it is not repeated here.
    const renderPaymentCard = (request) => {
        const isBusy = busyCardId !== null;
        const awaitingPayment = request.paymentStatus === 'approved';
        return (
            <View key={request.id} style={styles.requestCard}>
                {renderCardHeader(request, true)}

                <View style={styles.paymentNotice}>
                    <View style={styles.paymentNoticeTextWrap}>
                        <Text style={styles.paymentNoticeTitle}>
                            {awaitingPayment ? 'Additional payment approved' : 'Additional payment needed'}
                        </Text>
                        <Text style={styles.paymentNoticeReason}>{request.paymentReason}</Text>
                    </View>
                    <View style={styles.paymentNoticeAmountWrap}>
                        <Text style={styles.paymentNoticeAmount}>{formatPesoSpaced(request.paymentAmount)}</Text>
                        <Text style={styles.paymentNoticeCaption}>{awaitingPayment ? 'awaiting payment' : 'due for approval'}</Text>
                    </View>
                </View>
                {renderNegotiationNote(request)}

                <View style={styles.paymentActionRow}>
                    {awaitingPayment ? (
                        <>
                            <TouchableOpacity
                                style={[styles.paymentActionButton, styles.paymentActionApprove, isBusy && styles.actionButtonDisabled]}
                                disabled={isBusy}
                                onPress={() => handlePayAdditionalNow(asApprovedPayment(request))}
                            >
                                <Text style={styles.paymentActionText}>Pay Now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.paymentActionButton, styles.paymentActionNegotiate, isBusy && styles.actionButtonDisabled]}
                                disabled={isBusy}
                                onPress={() => handlePayAdditionalLater(asApprovedPayment(request))}
                            >
                                <Text style={styles.paymentActionText}>Pay Later</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.paymentActionButton, styles.paymentActionApprove, isBusy && styles.actionButtonDisabled]}
                                disabled={isBusy}
                                onPress={() => handleApprovePayment(request)}
                            >
                                <Text style={styles.paymentActionText}>Approve</Text>
                            </TouchableOpacity>
                            {request.canNegotiate !== false && !isNegotiationAnswered(request) && (
                                <TouchableOpacity
                                    style={[styles.paymentActionButton, styles.paymentActionNegotiate, isBusy && styles.actionButtonDisabled]}
                                    disabled={isBusy}
                                    onPress={() => handleNegotiatePayment(request)}
                                >
                                    <Text style={styles.paymentActionText}>Negotiate</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.paymentActionButton, styles.paymentActionDecline, isBusy && styles.actionButtonDisabled]}
                                disabled={isBusy}
                                onPress={() => handleRejectPayment(request)}
                            >
                                <Text style={styles.paymentActionText}>Decline</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <View style={styles.cardDivider} />
                <TouchableOpacity onPress={() => handleMessageProvider(request)} style={styles.messageButton}>
                    <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // "View" opens RepairDetails (the expanded tracking with the provider's notes and media).
    const handleViewRepairDetails = (request) =>
        navigation.navigate(ROUTES.REPAIR_DETAILS, {
            requestId: request.requestId ?? request.requestNumber,
            requestNumber: request.requestNumber,
        });

    const renderViewButton = (request) => (
        <TouchableOpacity style={styles.viewButton} onPress={() => handleViewRepairDetails(request)} activeOpacity={0.85} accessibilityRole="button">
            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
    );

    const renderMessageButton = (request) => (
        <TouchableOpacity style={styles.footerButton} onPress={() => handleMessageProvider(request)} accessibilityRole="button">
            <Text style={styles.footerButtonText}>Message</Text>
        </TouchableOpacity>
    );

    // View + Message share one row when there is no payment button.
    const renderViewMessageButtons = (request) => (
        <View style={styles.footerButtonRow}>
            {renderViewButton(request)}
            {renderMessageButton(request)}
        </View>
    );

    // Figma: View and Proceed to Payment on the first row, Message alone on the row below, all
    // right-aligned. Three buttons on one row did not fit a phone's width and overlapped.
    const renderViewPaymentMessageButtons = (request) => (
        <View>
            <View style={styles.footerButtonRow}>
                {renderViewButton(request)}
                <TouchableOpacity
                    style={[styles.footerButton, styles.footerButtonWide]}
                    onPress={() => handleProceedToPayment(request)}
                    accessibilityRole="button"
                >
                    <Text style={styles.footerButtonText}>Proceed to Payment</Text>
                </TouchableOpacity>
            </View>
            <View style={[styles.footerButtonRow, styles.footerSecondRow]}>{renderMessageButton(request)}</View>
        </View>
    );

    // Outcome of the customer's price negotiation on an additional payment.
    const renderNegotiationNote = (request) => {
        if (!request.negotiationStatus) return null;
        let text = null;
        if (request.negotiationStatus === 'requested') {
            text = request.proposedAmount !== null && request.proposedAmount !== undefined
                ? `You suggested ${formatPesoSpaced(request.proposedAmount)}. Waiting for the service provider to answer.`
                : 'Your negotiation was sent. Waiting for the service provider to answer.';
        }
        // 'accepted' / 'rejected' are shown by the badge in the card header (Figma), not by a note.
        return text ? <Text style={styles.negotiationNote}>{text}</Text> : null;
    };

    const renderTimelineCard = (request) => (
        <View key={request.id} style={[styles.requestCard, styles.ongoingCard]}>
            {renderCardHeader(request)}
            {renderDeferredNote(request)}
            {renderTimeline(getTimeline(request), isRequestPaid(request))}

            <View style={styles.timelineDivider} />
            {request.initialPaymentPaid === false ? renderViewPaymentMessageButtons(request) : renderViewMessageButtons(request)}
        </View>
    );

    // Closed tab: quotation declined by the customer, request declined by the provider, or a
    // request cancelled by either side.
    const renderDeclinedCard = (request) => {
        const closed = getClosedInfo(request);
        return (
            <View key={request.id} style={styles.requestCard}>
                <View style={styles.cardTopRow}>
                    <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                    <View style={styles.badgeDeclined}>
                        <Text style={styles.badgeDeclinedText}>{closed.label}</Text>
                    </View>
                </View>
                <Text style={styles.sentToLine}>{closed.summary}</Text>
                {!!request.reason && (
                    <>
                        <Text style={styles.reasonLabel}>Reason</Text>
                        <Text style={styles.reasonText}>{request.reason}</Text>
                    </>
                )}
            </View>
        );
    };

    const renderCompletedCard = (request) => {
        const isPaid = isRequestPaid(request);
        return (
            <View key={request.id} style={[styles.requestCard, styles.ongoingCard]}>
                {renderCardHeader(request)}
                {!isPaid && renderDeferredNote(request)}
                {renderTimeline(getTimeline(request), isPaid)}

                <View style={styles.timelineDivider} />
                {isPaid ? renderViewMessageButtons(request) : renderViewPaymentMessageButtons(request)}
            </View>
        );
    };

    const renderRequestCard = (request, section) => {
        switch (request.cardType) {
            case 'quotation':
                return renderQuotationCard(request);
            // [SCHEDULE PROPOSAL - DISABLED] case 'schedule': return renderScheduleCard(request);
            case 'payment':
                // Additional-payment quotation (Active > Quotations). The repair's tracking indicator
                // is its own 'timeline' card in On-going.
                return renderPaymentCard(request);
            case 'timeline':
                return renderTimelineCard(request);
            case 'declined':
                return renderDeclinedCard(request);
            case 'completed':
                return renderCompletedCard(request);
            case 'diagnosis':
            default:
                return renderDiagnosisCard(request);
        }
    };

    const renderBody = () => {
        if (isLoading) {
            return <ActivityIndicator color="#0255AF" style={styles.loadingIndicator} />;
        }
        if (errorMessage) {
            return (
                <TouchableOpacity style={styles.emptyState} onPress={() => loadTracking()}>
                    <Text style={styles.emptyStateText}>{errorMessage} Tap to retry.</Text>
                </TouchableOpacity>
            );
        }
        if (visibleRequests.length === 0) {
            const emptyLabel = isActiveTab
                ? activeSection === 'quotations'
                    ? 'No quotations'
                    : 'No on-going repairs'
                : `No ${selectedStatus.label.toLowerCase()} requests`;
            return (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>{emptyLabel}</Text>
                </View>
            );
        }
        return visibleRequests.map((request) => renderRequestCard(request, isActiveTab ? activeSection : null));
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadTracking({ refresh: true })} />}
            >
                <Text style={styles.headerTitle}>My Requests</Text>

                <View style={styles.searchBox}>
                    <SearchIcon />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search request details"
                        placeholderTextColor="#727272"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                </View>

                <View style={styles.statusTabRow}>
                    {STATUS_FILTERS.map((status, index) => {
                        const isSelected = status.key === selectedStatus.key;
                        const count = badgeCounts[status.key] ?? 0;
                        return (
                            <View key={status.key} style={[styles.statusTabWrap, index > 0 && styles.statusTabWrapSpaced]}>
                                <TouchableOpacity
                                    style={[styles.statusTab, isSelected && styles.statusTabSelected]}
                                    onPress={() => handleSelectStatus(status)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isSelected }}
                                    accessibilityLabel={count ? `${status.label}, ${count} need attention` : status.label}
                                >
                                    <Text style={[styles.statusTabText, isSelected && styles.statusTabTextSelected]}>
                                        {status.label}
                                    </Text>
                                </TouchableOpacity>
                                <NotificationBadge count={count} />
                            </View>
                        );
                    })}
                </View>

                {isActiveTab && (
                    <SectionTabs
                        sections={ACTIVE_SECTIONS}
                        selectedKey={activeSection}
                        onSelect={setSectionChoice}
                    />
                )}

                {renderBody()}
            </ScrollView>

            {/* Accept opens this confirmation first; no approval is sent until an option is chosen. */}
            <Modal visible={!!approvedPayment} transparent animationType="fade" onRequestClose={handleCloseApprovedPayment}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, styles.modalCardApproved]}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseApprovedPayment}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitleApproved}>Confirm Additional Payment</Text>
                        <GradientButton
                            label="Proceed to Payment"
                            onPress={() => handlePayAdditionalNow(approvedPayment)}
                            disabled={busyCardId !== null}
                            loading={paymentChoiceInFlight === 'now'}
                            style={styles.gradientButtonSpaced}
                        />
                        <GradientButton
                            label="Pay Later"
                            onPress={() => handlePayAdditionalLater(approvedPayment)}
                            disabled={busyCardId !== null}
                            loading={paymentChoiceInFlight === 'later'}
                        />
                    </View>
                </View>
            </Modal>

            {/* Additional payment decline (Figma "Negotiation Rejection Modal"). One Modal with two steps:
                1) Warning!  2) Reason for Rejection. Using a single Modal (instead of closing one and opening
                another) avoids the iOS issue where a Modal opened in the same tick as another closes never appears. */}
            <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={handleCloseRejectModal}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseRejectModal}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>
                        {rejectStep === REJECT_STEP.WARNING ? (
                            <View style={styles.warningBody}>
                                <Text style={styles.warningTitle}>Warning!</Text>
                                <Text style={styles.warningMessage}>
                                    By declining the request, the additional parts and payment will not be added to your repair.
                                </Text>
                                <GradientButton
                                    label="Confirm"
                                    onPress={handleConfirmDeclineWarning}
                                    style={styles.gradientButtonWarning}
                                />
                            </View>
                        ) : (
                            <>
                                <Text style={styles.formModalTitle}>Reason for Rejection</Text>
                                <Text style={styles.formModalLabel}>State a proper reason for rejection.</Text>
                                <TextInput
                                    style={styles.formModalTextArea}
                                    value={rejectReason}
                                    onChangeText={setRejectReason}
                                    maxLength={500}
                                    placeholder="Enter your reason here."
                                    placeholderTextColor="#A8A3A3"
                                    multiline
                                    textAlignVertical="top"
                                />
                                <GradientButton
                                    label="Send"
                                    onPress={handleConfirmRejectPayment}
                                    disabled={!rejectReason.trim() || busyCardId !== null}
                                    loading={busyCardId !== null}
                                    style={styles.gradientButtonWide}
                                />
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Price negotiation (Figma "Price Negotiation"). Send sends the counter-offer to the service provider. */}
            <Modal visible={!!negotiateTarget} transparent animationType="fade" onRequestClose={handleCloseNegotiateModal}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseNegotiateModal}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>
                        <Text style={styles.formModalTitle}>Request a Price Negotiation</Text>

                        <Text style={styles.formModalLabel}>Suggest Amount</Text>
                        <TextInput
                            style={styles.formModalAmountInput}
                            value={negotiateAmount}
                            onChangeText={(text) => setNegotiateAmount(text.replace(/[^0-9.]/g, ''))}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#A8A3A3"
                        />

                        <Text style={styles.formModalLabel}>State a proper reason for price negotiation.</Text>
                        <TextInput
                            style={styles.formModalTextArea}
                            value={negotiateMessage}
                            onChangeText={setNegotiateMessage}
                            placeholder="Enter your reason here."
                            placeholderTextColor="#A8A3A3"
                            multiline
                            textAlignVertical="top"
                        />

                        <GradientButton
                            label="Send"
                            onPress={handleConfirmNegotiation}
                            disabled={busyCardId !== null}
                            loading={busyCardId !== null}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

// Shared pill shape for every status badge (Figma: 21px tall, 20px radius, grey outline).
const badgeShape = {
    minHeight: 21,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B1A8A8',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
};
const badgeTextBase = {
    fontFamily: FONTS.quicksand,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 17,
    color: '#FFFFFF',
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 25,
        paddingTop: 46, // Figma: title starts 108px down, below the 62px status bar the SafeAreaView already covers
        paddingBottom: 24,
    },
    headerTitle: {
        fontFamily: FONTS.roboto,
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 28,
        color: '#021E79',
        marginBottom: 18,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 37,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#9E9898',
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 18,
    },
    searchIcon: {
        width: 18,
        height: 18,
    },
    searchIconCircle: {
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 1.6,
        borderColor: '#9A9A9A',
    },
    searchIconHandle: {
        position: 'absolute',
        right: 0,
        bottom: 1.5,
        width: 6,
        height: 1.8,
        borderRadius: 1,
        backgroundColor: '#9A9A9A',
        transform: [{ rotate: '45deg' }],
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        paddingVertical: 0,
        fontFamily: FONTS.quicksand,
        fontSize: 10,
        fontWeight: '500',
        color: '#414141',
    },
    statusTabRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    statusTabWrap: {
        flex: 1, // four equal pills across the 346px row (Figma)
    },
    statusTabWrapSpaced: {
        marginLeft: TAB_GAP,
    },
    statusTab: {
        height: 29,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTabSelected: {
        backgroundColor: '#021E79',
    },
    statusTabText: {
        fontFamily: FONTS.quicksand,
        fontSize: 10,
        fontWeight: '500',
        lineHeight: 17,
        color: '#414141',
        includeFontPadding: false,
    },
    statusTabTextSelected: {
        color: '#FFFFFF',
    },
    tabBadge: {
        position: 'absolute',
        top: -6,
        right: -2,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        paddingHorizontal: 3,
        backgroundColor: '#C62828',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        lineHeight: 11,
        color: '#FFFFFF',
        includeFontPadding: false,
    },
    requestCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12,
        marginBottom: 14,
    },
    cardTopRow: {
        flexDirection: 'row',
        flexWrap: 'wrap', // a long badge drops under the request number instead of overflowing
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    requestNumber: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 22,
        color: '#292727',
    },
    sentToLine: {
        fontSize: 11,
        lineHeight: 13,
        color: '#484040',
        marginTop: 2,
        marginBottom: 7,
    },
    providerName: {
        fontWeight: '700',
        color: '#111111',
    },
    providerNameLine: {
        fontSize: 10,
        lineHeight: 17,
        color: '#5B5959',
        marginTop: -4, // Figma: the name tucks under the request number's 22px line box
        marginBottom: 2,
    },
    // Figma on-going card: 10px side padding (9 + the 1px border) and 15px below the last button.
    ongoingCard: {
        paddingHorizontal: 9,
        paddingBottom: 14,
    },
    headerRule: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        marginBottom: 6,
    },
    probableCauseLabel: {
        fontSize: 10,
        lineHeight: 12,
        color: '#484040',
        marginBottom: 4,
    },
    probableCauseText: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 16,
        color: '#484040',
        marginBottom: 5,
    },
    confidenceText: {
        fontSize: 9,
        fontWeight: '500',
        lineHeight: 11,
        color: '#484040',
    },
    progressCaption: {
        fontSize: 11,
        color: '#999999',
    },
    badgeOrange: {
        ...badgeShape,
        backgroundColor: '#BB8157',
    },
    badgeOrangeText: {
        ...badgeTextBase,
    },
    badgePending: {
        ...badgeShape,
        backgroundColor: '#DAC855',
    },
    badgePendingText: {
        ...badgeTextBase,
    },
    badgeDeclined: {
        ...badgeShape,
        backgroundColor: '#DA5555',
    },
    badgeDeclinedText: {
        ...badgeTextBase,
    },
    badgeBlue: {
        ...badgeShape,
        backgroundColor: '#577FBB',
        minHeight: 18, // Figma: 18px tall
        height: 18,
        paddingHorizontal: 10,
        maxWidth: '100%',
        marginBottom: 4,
    },
    badgeBlueText: {
        ...badgeTextBase,
        lineHeight: 15,
        includeFontPadding: false,
        flexShrink: 1,
    },
    // Figma: "Negotiation Declined" / "Negotiation Accepted" pill (#BB8157), same 18px height as the blue badge.
    badgeNegotiation: {
        ...badgeShape,
        backgroundColor: '#BB8157',
        minHeight: 18,
        height: 18,
        paddingHorizontal: 10,
        maxWidth: '100%',
        marginBottom: 4,
    },
    badgeNegotiationText: {
        ...badgeTextBase,
        lineHeight: 15,
        includeFontPadding: false,
        flexShrink: 1,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        marginTop: 6,
        marginBottom: 6,
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginTop: 12,
        marginBottom: 12,
    },
    lineItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lineItemLabel: {
        fontSize: 8,
        fontWeight: '600',
        lineHeight: 14,
        color: '#292727',
    },
    lineItemAmount: {
        fontSize: 8,
        lineHeight: 14,
        color: '#5B5959',
    },
    lineItemLabelBold: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#191818',
    },
    lineItemAmountBold: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#5B5959',
    },
    scheduleDateTime: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginVertical: 10,
    },
    reasonLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 2,
    },
    reasonText: {
        fontSize: 12,
        color: '#777777',
        marginBottom: 14,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '700',
    },
    actionButtonAccept: {
        backgroundColor: '#167713',
        borderColor: '#167713',
    },
    actionButtonReject: {
        backgroundColor: '#C62828',
        borderColor: '#C62828',
    },
    actionButtonTextLight: {
        color: '#FFFFFF',
    },
    paymentNotice: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#FFFED3',
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 8,
    },
    paymentNoticeTextWrap: {
        flex: 1,
        marginRight: 10,
    },
    paymentNoticeTitle: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#BB8157',
    },
    paymentNoticeReason: {
        fontSize: 7,
        lineHeight: 12,
        color: '#292727',
    },
    paymentNoticeAmountWrap: {
        alignItems: 'flex-end',
    },
    paymentNoticeAmount: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#292727',
    },
    paymentNoticeCaption: {
        fontSize: 7,
        lineHeight: 12,
        color: '#292727',
    },
    paymentActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    paymentActionButton: {
        width: 90,
        marginLeft: 10,
        height: 30,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentActionApprove: {
        backgroundColor: '#167713',
    },
    paymentActionNegotiate: {
        backgroundColor: '#DEBF6A',
    },
    paymentActionDecline: {
        backgroundColor: '#C62828',
    },
    paymentActionText: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#FFFFFF',
    },
    messageButton: {
        alignSelf: 'flex-end',
        minWidth: 90,
        height: 28,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        backgroundColor: '#FFFDFD',
        borderRadius: 10,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageButtonText: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#414141',
    },
    footerButtonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap', // safety net: buttons drop to the next line instead of overlapping
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    footerSecondRow: {
        marginTop: 12, // Figma: Message sits 12px under the View / Proceed row
    },
    footerButton: {
        minWidth: 90,
        height: 28,
        marginLeft: FOOTER_BUTTON_GAP,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        backgroundColor: '#FFFDFD',
        borderRadius: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerButtonWide: {
        minWidth: 120, // Figma: Proceed to Payment is 120 x 30
        height: 30,
    },
    // Figma gradient button (90 x 30): the LinearGradient fills it, the label sits on top.
    viewButton: {
        minWidth: 90,
        height: 30,
        marginLeft: FOOTER_BUTTON_GAP,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    viewButtonText: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#FFFFFF',
    },
    negotiationNote: {
        fontSize: 9,
        lineHeight: 15,
        color: '#5B5959',
        marginTop: 8,
    },
    footerButtonText: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#414141',
    },
    sectionTabRow: {
        flexDirection: 'row',
        marginTop: -4,
        marginBottom: 16,
    },
    sectionTab: {
        flex: 1,
        alignItems: 'stretch',
    },
    sectionTabLabelWrap: {
        alignSelf: 'center',
        marginBottom: 3,
    },
    sectionTabText: {
        fontFamily: FONTS.quicksand,
        fontSize: 10,
        fontWeight: '500',
        lineHeight: 17,
        color: '#292727',
        includeFontPadding: false,
    },
    sectionTabTextSelected: {
        fontWeight: '700',
    },
    sectionTabBar: {
        height: 3,
        borderRadius: 10,
        backgroundColor: '#D9D9D9',
    },
    sectionTabBarSelected: {
        backgroundColor: '#18315B',
    },
    timelineWrap: {
        position: 'relative',
    },
    // Figma: 1px #D9D9D9 line running behind the circles, centre of the first to centre of the last.
    timelineConnector: {
        position: 'absolute',
        left: TIMELINE_DOT_SIZE / 2 - 0.5,
        top: TIMELINE_DOT_SIZE / 2,
        bottom: TIMELINE_DOT_SIZE / 2,
        width: 1,
        backgroundColor: TIMELINE_LINE_COLOR,
    },
    timelineRow: {
        flexDirection: 'row',
        minHeight: TIMELINE_DOT_SIZE,
    },
    timelineRowSpaced: {
        marginBottom: TIMELINE_STEP_GAP,
    },
    timelineDot: {
        width: TIMELINE_DOT_SIZE,
        height: TIMELINE_DOT_SIZE,
        borderRadius: TIMELINE_DOT_SIZE / 2,
        backgroundColor: '#6B6B6B', // grey until the provider updates the status
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    timelineDotDone: {
        backgroundColor: '#577FBB',
    },
    timelineDotCompletedPending: {
        backgroundColor: '#414141', // "Completed" dot is darker grey until fully paid
    },
    timelineCheckIcon: {
        width: 10,
        height: 9,
        resizeMode: 'contain',
        tintColor: '#FFEFEF',
    },
    timelineTextWrap: {
        flex: 1,
    },
    timelineLabel: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 17,
        color: '#191818',
    },
    timelineSubtext: {
        fontSize: 8,
        lineHeight: 14,
        color: '#5B5959',
        marginTop: -5, // Figma: the date sits right under the label
    },
    // Figma: 1px rgba(0,0,0,0.4) rule, 12px above and below.
    timelineDivider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        marginTop: 12,
        marginBottom: 11,
    },
    emptyState: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 24,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
    },
    loadingIndicator: {
        marginTop: 20,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    deferredNote: {
        fontSize: 11,
        color: '#8A7A4A',
        backgroundColor: '#FCF3C8',
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
    },
    modalCloseButton: {
        alignSelf: 'flex-end',
        marginBottom: 6,
    },
    modalCloseIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 17,
        marginBottom: 16,
    },
    modalSectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 8,
    },
    // "Additional Payment Approved" modal (Figma: 13px bold title, two 150x40 gradient buttons 23px apart).
    modalCardApproved: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 28,
        borderRadius: 10,
    },
    modalTitleApproved: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 22,
        color: '#414141',
        textAlign: 'center',
        marginBottom: 20,
    },
    gradientButton: {
        alignSelf: 'center',
        width: 150,
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientButtonWide: {
        width: '77%',
        alignSelf: 'center',
    },
    // Shared by the rejection and negotiation modals (Figma).
    formModalTitle: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 22,
        color: '#414141',
        marginBottom: 6,
    },
    formModalLabel: {
        fontSize: 10,
        lineHeight: 17,
        color: '#5B5959',
        marginBottom: 6,
    },
    formModalAmountInput: {
        width: 100,
        height: 30,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 10,
        paddingVertical: 0,
        fontSize: 10,
        color: '#333333',
        marginBottom: 14,
    },
    formModalTextArea: {
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        padding: 10,
        fontSize: 10,
        color: '#333333',
        marginBottom: 18,
    },
    gradientButtonSpaced: {
        marginBottom: 23,
    },
    // Decline "Warning!" step (Figma: 15px bold title, 11px centred message, 231x37 gradient Confirm button).
    warningBody: {
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingBottom: 12,
    },
    warningTitle: {
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 26,
        color: '#414141',
        textAlign: 'center',
        marginBottom: 6,
    },
    warningMessage: {
        fontSize: 11,
        lineHeight: 19,
        color: '#5B5959',
        textAlign: 'center',
        marginBottom: 28,
    },
    gradientButtonWarning: {
        width: '100%',
        maxWidth: 231,
        height: 37,
    },
    gradientButtonText: {
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 20,
        color: '#FFFFFF',
    },
    modalPillButton: {
        alignSelf: 'center',
        minWidth: 160,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 24,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginBottom: 10,
    },
    modalPillButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 10,
        minHeight: 100,
        padding: 12,
        fontSize: 13,
        color: '#333333',
        marginBottom: 14,
    },
    negotiateTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#414141',
        marginBottom: 14,
    },
    negotiateLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#414141',
        marginBottom: 6,
    },
    negotiateMessageInput: {
        minHeight: 110,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        padding: 10,
        fontSize: 12,
        color: '#333333',
        marginBottom: 14,
    },
    negotiateAmountInput: {
        height: 36,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 10,
        paddingVertical: 0,
        fontSize: 12,
        color: '#333333',
        marginBottom: 18,
    },
    negotiateConfirmButton: {
        alignSelf: 'center',
        minWidth: 90,
        height: 28,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalConfirmButton: {
        alignSelf: 'flex-end',
        minWidth: 90,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 22,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
});

export default Track;