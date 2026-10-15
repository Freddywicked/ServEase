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
 * Reloads on focus and on pull-to-refresh. For live updates the moment the provider acts,
 * see the commented Realtime subscription inside the component.
 *
 * ========================================================================== */

// Tab labels. `key` is the property of the tracking response that holds that tab's cards.
const STATUS_FILTERS = [
    { key: 'sent', label: 'Sent' },
    { key: 'approved', label: 'Approved' },
    { key: 'ongoing', label: 'On-going' },
    { key: 'declined', label: 'Declined' },
    { key: 'done', label: 'Done' },
];

// Badge text on the expandable cards. Not part of the card contract, so it is chosen by cardType;
// a backend-supplied `statusLabel` wins if one is ever sent.
const STATUS_TAG_BY_CARD_TYPE = { payment: 'In progress', timeline: 'In progress', completed: 'Completed' };

/* ============================================================================
 * BACKEND CHECKLIST for the On-going / Done tab indicators
 * (GET /service-requests/tracking, see getTrackedRequests in servicerequest_api.js)
 *
 * Track.js already handles the UI below. These are the fields the backend must send:
 *
 * 1. serviceType on every card -> 'home' or 'shop' (any value containing "home" / "shop").
 *    Picks the indicator variant. If missing, the backend's own timeline steps are shown as-is
 *    and only the payment rule is applied. (Field names also accepted: serviceMode, serviceLocation.)
 *
 * 2. A paid signal on every card (checked in this order; with none, the card counts as UNPAID):
 *      isPaid: true | false
 *      paymentStatus: 'paid' | 'pending' | ...
 *      remainingBalance: number            (<= 0 means paid; getPaymentDue's due.final can feed this)
 *    The backend currently files a provider-completed card under `done` as soon as completeJob
 *    runs. That is fine: Track.js shows it in On-going until it is paid, then in Done.
 *    (Cleaner option: have the backend return unpaid completed cards under `ongoing` itself.)
 *
 * 3. timeline step names (updateJobProgress -> timeline: [{ label, timestamp, done }]).
 *    Steps are matched by label (or key / id), so the labels must be exactly:
 *      home: "Preparing", "Service Provider is on the way", "Arrived at the Customer's location"
 *      shop: "Assessing", "Repairing", "Quality Checking"
 *    A step that doesn't match stays grey. A step is blue + check only when done: true.
 *
 * 4. Completion time: on the "Completed" step's timestamp, or card.completedAt (ISO).
 *    Shown under the grey Completed step on home-based cards while payment is pending.
 *    Shop-based cards show "Payment Pending" there instead.
 *
 * 5. Card for a finished job: cardType 'completed'. Track.js treats this as "provider finished,
 *    show Proceed to Payment until paid". Once paid, the button disappears and the Completed
 *    step turns blue.
 * ========================================================================== */

// ===========================================================================
// BACKEND TODO (GET /service-requests/tracking): fields this screen expects on each card.
// Until these exist the indicators fall back to the old behavior (see notes below).
//
// 1. serviceType: 'home' | 'shop'  (any value containing "home" or "shop" works)
//      Picks the indicator set in TIMELINE_TEMPLATES. Without it, the screen shows the backend's
//      own steps and only applies the payment rule.
//      Alternate field names also read: serviceMode, serviceLocation (see getServiceMode).
//
// 2. A paid signal, any ONE of (read in this order, see isRequestPaid):
//      isPaid: boolean | paymentStatus: 'paid' | remainingBalance: number (0 = paid)
//      Without one, a card always counts as unpaid, so it never moves to the Done tab.
//      getPaymentDue(requestId) already computes the remaining balance (due.final).
//
// 3. Grouping: the provider-finished card (cardType 'completed') may stay in `done` as it does
//      today. The screen shows it under On-going until it is paid, then under Done.
//      Optional: put unpaid ones in `ongoing` on the backend and this screen still works.
//
// 4. timeline step labels must match TIMELINE_TEMPLATES exactly (case/punctuation ignored):
//      home: Preparing | Service Provider is on the way | Arrived at the Customer's location | Completed
//      shop: Assessing | Repairing | Quality Checking | Completed
//      Each step: { label, timestamp (ISO) | null, done: boolean }. A step the provider has not
//      updated can be missing or done: false (it shows grey). Unmatched labels stay grey.
//      A 'key' or 'id' on each step (preparing, on_the_way, arrived, assessing, repairing,
//      quality_checking, completed) is matched too, which is safer than relying on labels.
//
// 5. Completion time: send it as the "Completed" step's timestamp, or as card.completedAt
//      (ISO). Shown in grey under Completed (home-based) while the balance is unpaid.
//
// The Completed step is only colored when the card is paid, even though the provider has
// finished (cardType 'completed'); "Proceed to Payment" shows only in that unpaid state.
// ===========================================================================

// A request counts as paid once the customer settled the remaining balance. The backend puts a
// provider-completed card in `done` as soon as the job is finished (before payment), so being in
// `done` does NOT mean paid; the card needs one of these fields, checked in order:
// isPaid, paymentStatus, remainingBalance. With none of them the card counts as unpaid.
const isRequestPaid = (request) => {
    if (typeof request.isPaid === 'boolean') return request.isPaid;
    if (request.paymentStatus) return String(request.paymentStatus).toLowerCase() === 'paid';
    if (request.remainingBalance !== undefined && request.remainingBalance !== null) {
        return Number(request.remainingBalance) <= 0;
    }
    return false;
};

const getStatusTag = (request) => {
    if (request.statusLabel) return request.statusLabel;
    // Finished repair but still waiting on the customer's payment: keep the "In progress" badge.
    if (request.cardType === 'completed' && !isRequestPaid(request)) return 'In progress';
    return STATUS_TAG_BY_CARD_TYPE[request.cardType];
};

// ---------------------------------------------------------------------------
// On-going tab indicators. Two variants, chosen by the request's service type:
//   home-based -> Preparing / Service Provider is on the way / Arrived / Completed
//   shop-based -> Assessing / Repairing / Quality Checking / Completed
// A step is grey until the provider updates it (then blue + check). "Completed" stays grey
// until the customer has paid the remaining balance.
// ---------------------------------------------------------------------------
const TIMELINE_TEMPLATES = {
    home: [
        { key: 'preparing', label: 'Preparing' },
        { key: 'on_the_way', label: 'Service Provider is on the way' },
        { key: 'arrived', label: "Arrived at the Customer's location" },
        { key: 'completed', label: 'Completed' },
    ],
    shop: [
        { key: 'assessing', label: 'Assessing' },
        { key: 'repairing', label: 'Repairing' },
        { key: 'quality_checking', label: 'Quality Checking' },
        { key: 'completed', label: 'Completed' },
    ],
};

const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');

// Returns 'home' | 'shop' | null. Adjust the field names to whatever the backend sends.
const getServiceMode = (request) => {
    const value = normalizeText(request.serviceType ?? request.serviceMode ?? request.serviceLocation);
    if (value.includes('home')) return 'home';
    if (value.includes('shop')) return 'shop';
    return null;
};

const buildTimeline = (request) => {
    const source = request.timeline || [];
    const mode = getServiceMode(request);
    const paid = isRequestPaid(request);
    // The provider has finished the job (completeJob) but the customer may not have paid yet.
    const jobFinished = request.cardType === 'completed';

    // "Completed" is grey (done: false) until the remaining balance is paid. While unpaid it still
    // shows when the provider finished (home-based) or "Payment Pending" (shop-based).
    const withPaymentGate = (step, isCompletedStep) => {
        if (!isCompletedStep) return step;
        const finished = jobFinished || !!step.done;
        const finishedAt = step.timestamp ?? request.completedAt ?? null;
        const showPending = !paid && finished && mode === 'shop';
        return {
            ...step,
            done: paid,
            timestamp: finished && !showPending ? finishedAt : null,
            description: showPending ? 'Payment Pending' : step.description,
        };
    };

    // Unknown service type: keep the backend's steps, only apply the payment rule.
    if (!mode) {
        return source.map((step) => withPaymentGate(step, normalizeText(step.label) === 'completed'));
    }

    return TIMELINE_TEMPLATES[mode].map((template) => {
        const match = source.find(
            (step) =>
                normalizeText(step.key ?? step.id) === normalizeText(template.key) ||
                normalizeText(step.label) === normalizeText(template.label),
        );
        const step = {
            id: template.key,
            label: template.label,
            done: !!match?.done,
            timestamp: match?.done ? match.timestamp : null,
            description: match?.description,
        };
        return withPaymentGate(step, template.key === 'completed');
    });
};

const formatPeso = (amount) => `₱${Number(amount ?? 0).toFixed(2)}`;

// Pulls together whichever text fields a card happens to have so search works
// the same way regardless of cardType, instead of assuming every request
// shares the same shape.
const getSearchableText = (request) =>
    [request.requestNumber, request.providerName, request.probableCause, request.reason]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

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
            const target = STATUS_FILTERS.find((filter) => filter.key === tabKey);
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

    // The backend files a provider-completed card under `done` right away. Here it only stays in
    // Done once its remaining balance is paid; until then it is shown in On-going.
    const displayGroups = (() => {
        if (!groups) return groups;
        const done = groups.done ?? [];
        return {
            ...groups,
            ongoing: [...(groups.ongoing ?? []), ...done.filter((request) => !isRequestPaid(request))],
            done: done.filter((request) => isRequestPaid(request)),
        };
    })();

    const statusRequests = displayGroups?.[selectedStatus.key] ?? [];
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
            paymentStage: 'final',
            amount: request.finalAmount,
        });
    };

    const renderTimeline = (request) => {
        const steps = buildTimeline(request);
        // The vertical connector is only part of the home-based design.
        const showConnector = getServiceMode(request) === 'home';
        return steps.map((step, index) => (
            <View key={step.id ?? `${step.label}-${index}`} style={styles.timelineRow}>
                {showConnector && index < steps.length - 1 && (
                    <View style={[styles.timelineConnector, step.done && steps[index + 1].done && styles.timelineConnectorDone]} />
                )}
                <View style={[styles.timelineDot, !step.done && styles.timelineDotPending]}>
                    {step.done && <Image source={require('../assets/icon_check.png')} style={styles.timelineCheckIcon} />}
                </View>
                <View style={styles.timelineTextWrap}>
                    <Text style={[styles.timelineLabel, !step.done && styles.timelineLabelPending]}>{step.label}</Text>
                    {(step.timestamp || step.description) ? (
                        <Text style={styles.timelineSubtext}>
                            {step.timestamp ? formatDateTime(step.timestamp) : step.description}
                        </Text>
                    ) : null}
                </View>
            </View>
        ));
    };

    const renderDiagnosisCard = (request) => (
        <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            onPress={() => handleRequestPress(request)}
            activeOpacity={0.85}
        >
            <Text style={styles.requestNumber}>Request #{request.requestNumber}</Text>
            <Text style={styles.sentToLine}>
                sent to <Text style={styles.providerName}>{request.providerName}</Text>
            </Text>

            {request.probableCause ? (
                <>
                    <Text style={styles.probableCauseLabel}>Probable Cause</Text>
                    <Text style={styles.probableCauseText}>{request.probableCause}</Text>

                    {request.confidencePercent !== null && request.confidencePercent !== undefined && (
                        <>
                            <View style={styles.progressRow}>
                                <View style={styles.progressTrack}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            { width: `${Math.min(100, Math.max(0, request.confidencePercent))}%` },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressPercent}>{request.confidencePercent}%</Text>
                            </View>
                            <Text style={styles.progressCaption}>Confidence based on similar reported cases</Text>
                        </>
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
                    <Text style={styles.badgeBlueText}>{getStatusTag(request)}</Text>
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
                        {renderTimeline(request)}
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
            {renderTimeline(request)}

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
                    <Text style={styles.badgeDeclinedText}>Declined</Text>
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

    const renderCompletedCard = (request) => (
        <View key={request.id} style={styles.requestCard}>
            {renderCardHeader(request)}
            {renderDeferredNote(request)}
            {renderTimeline(request)}

            <View style={styles.cardDivider} />
            <View style={styles.actionRow}>
                {!isRequestPaid(request) && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleProceedToPayment(request)}>
                        <Text style={styles.actionButtonText}>Proceed to Payment</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionButton} onPress={() => handleMessageProvider(request)}>
                    <Text style={styles.actionButtonText}>Message</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

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

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search request details..."
                    placeholderTextColor="#999999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.statusTabRow}
                >
                    {STATUS_FILTERS.map((status) => {
                        const isSelected = status.key === selectedStatus.key;
                        const count = displayGroups?.[status.key]?.length;
                        return (
                            <TouchableOpacity
                                key={status.key}
                                style={[styles.statusTab, isSelected && styles.statusTabSelected]}
                                onPress={() => handleSelectStatus(status)}
                            >
                                <Text style={[styles.statusTabText, isSelected && styles.statusTabTextSelected]}>
                                    {status.label}{count !== undefined ? ` (${count})` : ''}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

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

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    searchInput: {
        backgroundColor: '#EFEFEF',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
        marginBottom: 16,
    },
    statusTabRow: {
        paddingBottom: 4,
        marginBottom: 20,
    },
    statusTab: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    statusTabSelected: {
        backgroundColor: '#021E79',
        borderColor: '#021E79',
    },
    statusTabText: {
        fontSize: 13,
        color: '#333333',
        fontWeight: '600',
    },
    statusTabTextSelected: {
        color: '#FFFFFF',
    },
    requestCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
    },
    cardTopRow: {
        flexDirection: 'row',
        flexWrap: 'wrap', // a long badge drops under the request number instead of overflowing
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 4,
    },
    sentToLine: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 12,
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
    probableCauseLabel: {
        fontSize: 11,
        color: '#888888',
        marginBottom: 2,
    },
    probableCauseText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 10,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E5E5E5',
        overflow: 'hidden',
        marginRight: 8,
    },
    progressFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#0255AF',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333333',
    },
    progressCaption: {
        fontSize: 11,
        color: '#999999',
    },
    badgeOrange: {
        backgroundColor: '#BB8157',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    badgeOrangeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    badgeDeclined: {
        backgroundColor: '#DA5555',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: 4,
    },
    badgeDeclinedText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    badgeBlue: {
        backgroundColor: '#5C7CC9',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
        maxWidth: '100%',
        marginBottom: 4,
    },
    badgeBlueText: {
        flexShrink: 1,
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
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
        backgroundColor: '#577FBB',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    timelineDotPending: {
        backgroundColor: '#646565',
    },
    timelineConnector: {
        position: 'absolute',
        left: 11.5,
        top: 24,
        bottom: -12,
        width: 1,
        backgroundColor: '#D9D9D9',
    },
    timelineConnectorDone: {
        backgroundColor: '#577FBB',
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
    timelineLabelPending: {
        color: '#414141',
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