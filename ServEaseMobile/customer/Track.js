import React, { useState, useCallback } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ROUTES } from '../navigation/routes';
import {
    getTrackedRequests,
    acceptScheduleProposal,
    rejectScheduleProposal,
    approveAdditionalPayment,
    rejectAdditionalPayment,
} from '../api/servicerequest_api';
import { formatDateTime } from '../utils/formatters';

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
 *     Approve -> POST .../approve, then the "Additional Payment Approved" modal:
 *                  "Proceed to Payment" -> Payment screen (stage 'additional', the extra amount)
 *                  "Pay Later" / X      -> nothing more to send: an approved-but-unpaid additional
 *                                          amount is added by the backend to the final payment
 *                                          (request.finalAmount) that "Proceed to Payment" uses.
 *     Reject  -> "Reason for rejection" modal; Confirm -> POST .../reject with { reason }.
 *                  Nothing is sent until the customer confirms.
 *   Quotation approve/decline happens in RequestDetails (respondToQuotation in the API file).
 *
 * Tabs (customer-facing) and which tracking groups feed them:
 *   Pending    <- sent                 sent requests, quotations being reviewed, price negotiations
 *   Active     <- approved + ongoing   confirmed appointments and repairs underway
 *   Completed  <- done                 finished services with payment settled
 *   Closed     <- declined             declined or cancelled requests
 *
 * Notification count on each tab = requests in that tab that need the customer's attention:
 * the backend flags one with `isUnread: true`, and anything waiting on the customer
 * (quotation to approve, new schedule, additional payment, unpaid final balance) counts too.
 * Counts are always derived from the loaded data; nothing is hard-coded.
 *
 * Reloads on focus and on pull-to-refresh. For live updates the moment the provider acts,
 * see the commented Realtime subscription inside the component.
 *
 * ========================================================================== */

// Fonts from the Figma spec. If a font is not loaded in the app, React Native falls back to the
// system font, so nothing breaks; adjust the names to match how the fonts are registered.
const FONTS = { quicksand: 'Quicksand', roboto: 'Roboto' };

// Figma: the four tabs sit 5px apart. A notification count above this shows as "99+".
const TAB_GAP = 5;
const MAX_BADGE_COUNT = 99;

// Customer-facing tabs. `sources` are the properties of the tracking response whose cards belong
// to the tab, so the backend contract (sent / approved / ongoing / declined / done) is unchanged.
const STATUS_FILTERS = [
    { key: 'pending', label: 'Pending', sources: ['sent'] },
    { key: 'active', label: 'Active', sources: ['approved', 'ongoing'] },
    { key: 'completed', label: 'Completed', sources: ['done'] },
    { key: 'closed', label: 'Closed', sources: ['declined'] },
];

// Cards that sit waiting on the customer's answer.
const ACTION_CARD_TYPES = ['quotation', 'schedule', 'payment'];

const getTabRequests = (groups, tab) => tab.sources.flatMap((source) => groups?.[source] ?? []);

// Accepts a tab key, or an old group key ('sent', 'approved', 'ongoing', 'declined', 'done') that
// the PayMongo deep link, Payment screen and Ratings screen may still pass as the `tab` param.
const findTab = (key) => STATUS_FILTERS.find((tab) => tab.key === key || tab.sources.includes(key));

// A request is paid once the customer settled the remaining balance, which is what moves it to
// Completed. A backend `isPaid` flag wins; the tab is the fallback.
const isPaidRequest = (request, tab) => request.isPaid ?? tab.key === 'completed';

const needsAttention = (request, tab) =>
    request.isUnread === true ||
    ACTION_CARD_TYPES.includes(request.cardType) ||
    (request.cardType === 'completed' && !isPaidRequest(request, tab));

const getTabNotificationCount = (groups, tab) =>
    getTabRequests(groups, tab).filter((request) => needsAttention(request, tab)).length;

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

// Magnifier drawn with Views so this screen does not depend on an icon asset.
const SearchIcon = () => (
    <View style={styles.searchIcon}>
        <View style={styles.searchIconCircle} />
        <View style={styles.searchIconHandle} />
    </View>
);

const Track = ({ navigation, route }) => {
    const [selectedStatus, setSelectedStatus] = useState(STATUS_FILTERS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [groups, setGroups] = useState(null); // null until the first load finishes
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [busyCardId, setBusyCardId] = useState(null);
    // Additional-payment modals. `approvedPayment` is a snapshot taken when the customer approves
    // (so the modal survives the reload that follows); `rejectTarget` is the card being rejected.
    const [approvedPayment, setApprovedPayment] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const loadTracking = useCallback(async ({ refresh = false } = {}) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setErrorMessage('');
        try {
            setGroups(await getTrackedRequests());
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Reload every time the customer comes back to this tab (e.g. after sending a request).
    // A `tab` route param (from the PayMongo return deep link, the Payment screen or
    // Ratings) pre-selects the tab that matches what just happened — a completed
    // final payment opens Done — and is consumed so it doesn't stick afterwards.
    useFocusEffect(
        useCallback(() => {
            const tabKey = route?.params?.tab;
            const target = findTab(tabKey);
            if (target) {
                setSelectedStatus(target);
                navigation.setParams({ tab: undefined });
            }
            loadTracking();
        }, [loadTracking, navigation, route?.params?.tab]),
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
    const visibleRequests = searchQuery.trim()
        ? statusRequests.filter((request) => getSearchableText(request).includes(searchQuery.trim().toLowerCase()))
        : statusRequests;

    const handleSelectStatus = (status) => {
        setSelectedStatus(status);
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

    const handleAcceptSchedule = (request) =>
        runAction(request.id, () => acceptScheduleProposal(request.requestId, request.proposalId), 'Could not accept the schedule');

    const handleRejectSchedule = (request) =>
        runAction(request.id, () => rejectScheduleProposal(request.requestId, request.proposalId), 'Could not reject the schedule');

    const handleApprovePayment = (request) =>
        runAction(
            request.id,
            () => approveAdditionalPayment(request.requestId, request.paymentRequestId),
            'Could not approve the payment',
            () =>
                setApprovedPayment({
                    requestId: request.requestId,
                    requestNumber: request.requestNumber,
                    providerName: request.providerName,
                    paymentRequestId: request.paymentRequestId,
                    amount: request.paymentAmount,
                }),
        );

    // Reject opens the "Reason for rejection" modal; nothing is sent until Confirm.
    const handleRejectPayment = (request) => {
        setRejectReason('');
        setRejectTarget(request);
    };

    const handleCloseRejectModal = () => {
        if (busyCardId) return;
        setRejectTarget(null);
        setRejectReason('');
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
            },
        );
    };

    // "Pay Later" (and the X): the approval already stands; the unpaid amount is added to the
    // final payment by the backend, so there is nothing to send.
    const handlePayAdditionalLater = () => {
        setApprovedPayment(null);
    };

    const handlePayAdditionalNow = () => {
        const payment = approvedPayment;
        setApprovedPayment(null);
        navigation.navigate(ROUTES.PAYMENT, {
            requestId: payment.requestId,
            requestNumber: payment.requestNumber,
            providerName: payment.providerName,
            paymentStage: 'additional',
            paymentRequestId: payment.paymentRequestId,
            amount: payment.amount,
        });
    };

    const handleMessageProvider = (request) => {
        // Re-uses the existing Chat -> Conversation flow so the customer can
        // message this provider directly about the request.
        navigation.navigate(ROUTES.CONVERSATION, {
            senderName: request.providerName,
            providerId: request.providerId,
            requestId: request.requestId,
        });
    };

    const handleProceedToPayment = (request) => {
        navigation.navigate(ROUTES.PAYMENT, {
            requestId: request.requestId,
            requestNumber: request.requestNumber,
            providerName: request.providerName,
            paymentStage: 'final',
            amount: request.finalAmount,
        });
    };

    const isRequestPaid = (request) => isPaidRequest(request, selectedStatus);

    // Indicator flow (see Figma):
    //  - every step stays GREY until the service provider updates it, then turns blue with a check;
    //  - the "Completed" step stays an uncolored (darker grey) dot until the customer has paid the
    //    remaining balance, even after the provider marked the job completed ("Payment Pending").
    const renderTimeline = (timeline, isPaid = false) =>
        (timeline || []).map((step, index) => {
            const isCompleted = isCompletedStep(step);
            const isDone = !!step.done && (!isCompleted || isPaid);
            const providerCompleted = isCompleted && !!step.done && !isPaid;
            const subtext = providerCompleted
                ? 'Payment Pending'
                : isDone && step.timestamp
                  ? formatDateTime(step.timestamp)
                  : step.description;
            return (
                <View key={step.id ?? `${step.label}-${index}`} style={styles.timelineRow}>
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
        });

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
        const hasParts = Number(request.partsCost) > 0;
        const total = request.total ?? Number(request.laborCost ?? 0) + Number(request.partsCost ?? 0);
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
                {hasParts && (
                    <View style={styles.lineItemRow}>
                        <Text style={styles.lineItemLabel}>Parts Cost</Text>
                        <Text style={styles.lineItemAmount}>{formatPeso(request.partsCost)}</Text>
                    </View>
                )}
                <View style={styles.divider} />
                <View style={styles.lineItemRow}>
                    <Text style={styles.lineItemLabelBold}>Total</Text>
                    <Text style={styles.lineItemAmountBold}>{formatPeso(total)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderScheduleCard = (request) => {
        const isBusy = busyCardId !== null;
        return (
            <View key={request.id} style={styles.requestCard}>
                <View style={styles.cardTopRow}>
                    <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                    <View style={styles.badgeOrange}>
                        <Text style={styles.badgeOrangeText}>New Schedule</Text>
                    </View>
                </View>
                <Text style={styles.sentToLine}>{request.providerName} sent a new schedule.</Text>

                <Text style={styles.scheduleDateTime}>{formatDateTime(request.scheduledAt)}</Text>

                <Text style={styles.reasonLabel}>Reason for New Schedule</Text>
                <Text style={styles.reasonText}>{request.reason}</Text>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonAccept, isBusy && styles.actionButtonDisabled]} disabled={isBusy} onPress={() => handleAcceptSchedule(request)}>
                        <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonReject, isBusy && styles.actionButtonDisabled]} disabled={isBusy} onPress={() => handleRejectSchedule(request)}>
                        <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Header shared by the on-going / completed cards. The badge wraps under the request number
    // when it is too long for one line (e.g. "Additional payment requested") instead of running
    // off the screen.
    const renderCardHeader = (request) => (
        <>
            <View style={styles.cardTopRow}>
                <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                <View style={styles.badgeBlue}>
                    <Text style={styles.badgeBlueText}>{getStatusTag(request, isRequestPaid(request))}</Text>
                </View>
            </View>
            <Text style={styles.providerNameLine}>{request.providerName}</Text>
        </>
    );

    // Shown once the customer chose "Pay Later": the amount waits on the final payment.
    const renderDeferredNote = (request) =>
        Number(request.deferredAdditionalAmount) > 0 ? (
            <Text style={styles.deferredNote}>
                {formatPeso(request.deferredAdditionalAmount)} additional payment will be added to your final payment.
            </Text>
        ) : null;

    const renderPaymentCard = (request) => {
        const isBusy = busyCardId !== null;
        return (
            <View key={request.id} style={styles.requestCard}>
                {renderCardHeader(request)}

                <View style={styles.paymentNotice}>
                    <View style={styles.paymentNoticeTextWrap}>
                        <Text style={styles.paymentNoticeTitle}>Additional payment needed</Text>
                        <Text style={styles.paymentNoticeReason}>{request.paymentReason}</Text>
                    </View>
                    <View style={styles.paymentNoticeAmountWrap}>
                        <Text style={styles.paymentNoticeAmount}>₱{Number(request.paymentAmount).toLocaleString()}</Text>
                        <Text style={styles.paymentNoticeCaption}>Due for approval</Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonAccept, isBusy && styles.actionButtonDisabled]} disabled={isBusy} onPress={() => handleApprovePayment(request)}>
                        <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonReject, isBusy && styles.actionButtonDisabled]} disabled={isBusy} onPress={() => handleRejectPayment(request)}>
                        <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>Reject</Text>
                    </TouchableOpacity>
                </View>

                {request.timeline?.length > 0 && (
                    <>
                        <View style={styles.cardDivider} />
                        {renderTimeline(request.timeline, isRequestPaid(request))}
                    </>
                )}

                <View style={styles.cardDivider} />
                <TouchableOpacity onPress={() => handleMessageProvider(request)} style={styles.messageButton}>
                    <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderTimelineCard = (request) => (
        <View key={request.id} style={styles.requestCard}>
            {renderCardHeader(request)}
            {renderDeferredNote(request)}
            {renderTimeline(request.timeline, isRequestPaid(request))}

            <View style={styles.cardDivider} />
            <TouchableOpacity onPress={() => handleMessageProvider(request)} style={styles.messageButton}>
                <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
        </View>
    );

    const renderDeclinedCard = (request) => (
        <View key={request.id} style={styles.requestCard}>
            <View style={styles.cardTopRow}>
                <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
                <View style={styles.badgeDeclined}>
                    <Text style={styles.badgeDeclinedText}>{request.statusLabel ?? selectedStatus.label}</Text>
                </View>
            </View>
            <Text style={styles.sentToLine}>{request.providerName} declined this request.</Text>
            {!!request.reason && (
                <>
                    <Text style={styles.reasonLabel}>Reason</Text>
                    <Text style={styles.reasonText}>{request.reason}</Text>
                </>
            )}
        </View>
    );

    const renderCompletedCard = (request) => {
        const isPaid = isRequestPaid(request);
        return (
            <View key={request.id} style={styles.requestCard}>
                {renderCardHeader(request)}
                {!isPaid && renderDeferredNote(request)}
                {renderTimeline(request.timeline, isPaid)}

                <View style={styles.cardDivider} />
                {isPaid ? (
                    <TouchableOpacity onPress={() => handleMessageProvider(request)} style={styles.messageButton}>
                        <Text style={styles.messageButtonText}>Message</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleProceedToPayment(request)}>
                            <Text style={styles.actionButtonText}>Proceed to Payment</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleMessageProvider(request)}>
                            <Text style={styles.actionButtonText}>Message</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderRequestCard = (request) => {
        switch (request.cardType) {
            case 'quotation':
                return renderQuotationCard(request);
            case 'schedule':
                return renderScheduleCard(request);
            case 'payment':
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
            return (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No {selectedStatus.label.toLowerCase()} requests</Text>
                </View>
            );
        }
        return visibleRequests.map(renderRequestCard);
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
                        const count = getTabNotificationCount(groups, status);
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

                {renderBody()}
            </ScrollView>

            {/* Additional payment approved: pay now (payment gateway) or pay later (added to the final payment). */}
            <Modal visible={!!approvedPayment} transparent animationType="fade" onRequestClose={handlePayAdditionalLater}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handlePayAdditionalLater}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Additional Payment Approved</Text>
                        <Text style={styles.modalSubtitle}>
                            {approvedPayment ? `${formatPeso(approvedPayment.amount)} — ` : ''}
                            pay now, or pay later and it will be added to your final payment.
                        </Text>
                        <TouchableOpacity style={styles.modalPillButton} onPress={handlePayAdditionalNow}>
                            <Text style={styles.modalPillButtonText}>Proceed to Payment</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalPillButton} onPress={handlePayAdditionalLater}>
                            <Text style={styles.modalPillButtonText}>Pay Later</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Additional payment rejection: a reason is collected before anything is sent. */}
            <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={handleCloseRejectModal}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalCard}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseRejectModal}>
                            <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                        </TouchableOpacity>
                        <Text style={styles.modalSectionLabel}>Reason for rejection</Text>
                        <TextInput
                            style={styles.reasonInput}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            textAlignVertical="top"
                            placeholder="Tell the service provider why"
                            placeholderTextColor="#999999"
                        />
                        <TouchableOpacity
                            style={[styles.modalConfirmButton, (!rejectReason.trim() || busyCardId !== null) && styles.actionButtonDisabled]}
                            disabled={!rejectReason.trim() || busyCardId !== null}
                            onPress={handleConfirmRejectPayment}
                        >
                            {busyCardId !== null ? (
                                <ActivityIndicator color="#333333" />
                            ) : (
                                <Text style={styles.modalPillButtonText}>Confirm</Text>
                            )}
                        </TouchableOpacity>
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
        fontSize: 13,
        color: '#666666',
        marginBottom: 12,
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
        backgroundColor: '#5C7CC9',
        maxWidth: '100%',
        marginBottom: 4,
    },
    badgeBlueText: {
        ...badgeTextBase,
        flexShrink: 1,
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 8,
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
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    lineItemAmount: {
        fontSize: 13,
        color: '#666666',
    },
    lineItemLabelBold: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    lineItemAmountBold: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
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
        backgroundColor: '#FCF3C8',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    paymentNoticeTextWrap: {
        flex: 1,
        marginRight: 10,
    },
    paymentNoticeTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#B4622A',
        marginBottom: 2,
    },
    paymentNoticeReason: {
        fontSize: 11,
        color: '#8A7A4A',
    },
    paymentNoticeAmountWrap: {
        alignItems: 'flex-end',
    },
    paymentNoticeAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    paymentNoticeCaption: {
        fontSize: 10,
        color: '#8A7A4A',
    },
    messageButton: {
        alignSelf: 'flex-end',
        borderWidth: 1,
        borderColor: '#DDDDDD',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageButtonText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '700',
    },
    timelineRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    timelineDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#6B6B6B', // grey until the provider updates the status
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    timelineDotDone: {
        backgroundColor: '#5C7CC9',
    },
    timelineDotCompletedPending: {
        backgroundColor: '#3F3F3F', // "Completed" dot is darker grey until fully paid
    },
    timelineCheckIcon: {
        width: 12,
        height: 12,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
    },
    timelineTextWrap: {
        flex: 1,
    },
    timelineLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },
    timelineSubtext: {
        fontSize: 11,
        color: '#999999',
        marginTop: 1,
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