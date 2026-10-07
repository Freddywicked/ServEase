// src/controllers/workflow_controllers.js
// The core customer <-> provider workflow, built on the tables from
// migrations/002_core_workflow_tables.sql. These are the endpoints the mobile
// app already calls (api/servicerequest_api.js and api/providerWork_api.js):
//
//   customer: GET /service-requests/active, GET /service-requests/tracking,
//             POST .../schedule-proposals/:pid/accept|reject,
//             POST .../payment-requests/:pid/approve|reject,
//             POST .../quotation/respond, POST .../payment, POST .../rating
//   provider: POST /provider/service-requests/:id/accept|decline|quotation|
//                  schedule-proposals|payment-requests|progress|complete,
//             GET /provider/dashboard, GET /provider/jobs(/:id),
//             PATCH /provider/jobs/:id/status, POST /provider/jobs/:id/additional-parts,
//             GET /provider/earnings
//   both:     GET /notifications, GET /service-providers (browse),
//             GET/POST /conversations(/:id/messages)
//
// Every state change also writes a NOTIFICATION row for the other party — that
// is how the two users "communicate" until FCM/Realtime is added.
const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const Request = require('../models/servicerequest_model');
const Workflow = require('../models/workflow_model');
const Provider = require('../models/provider_model');
const { getProviderFileUrl } = require('../utils/storage');

// The stage list the provider's Jobs screen offers; also the customer's timeline.
const JOB_STAGES = ['Assessing', 'Repairing', 'Quality Check', 'Completed'];

const peso = (n) => `PHP ${Number(n || 0).toFixed(2)}`;

// ---------- shared helpers ----------
const parseIdOr400 = (value) => {
  const requestNo = Request.parseRequestId(value);
  if (requestNo === null) throw new ApiError(400, 'Invalid request id');
  return requestNo;
};

// Loads a request and makes sure it belongs to the logged-in customer.
const getOwnedRequest = async (req) => {
  const row = await Request.findByRequestNo(parseIdOr400(req.params.requestId));
  if (!row || row.customer_id !== req.user.user_id) throw new ApiError(404, 'Service request not found');
  return row;
};

// Loads a request and makes sure the logged-in provider is a recipient of it.
const getProviderRequest = async (req) => {
  const row = await Request.findByRequestNo(parseIdOr400(req.params.requestId || req.params.jobId));
  if (!row) throw new ApiError(404, 'Service request not found');
  const recipient = await Request.findRecipient(row.request_id, req.user.user_id);
  if (!recipient) throw new ApiError(404, 'Service request not found');
  return { row, recipient };
};

const refOf = (row) => Request.formatRequestId(row.request_number);

const customerNameOf = async (row) => {
  const users = await Request.findUsersByIds([row.customer_id]);
  return users[row.customer_id]?.name || 'Customer';
};

// The provider this request is "with": the assigned one, else the first
// recipient that quoted/accepted, else the first recipient at all.
const pickProviderId = (row, recipients) =>
  row.provider_id ||
  (recipients.find((r) => r.status === 'quoted' || r.status === 'accepted') || recipients[0] || {}).provider_id ||
  null;

// ============================ NOTIFICATIONS ============================

// GET /api/notifications?limit -> { notifications: [{ id, type, message, requestId, readAt, createdAt }] }
const listNotifications = asyncHandler(async (req, res) => {
  const rows = await Workflow.listNotifications(req.user.user_id, req.query.limit);
  res.json({
    notifications: rows.map((n) => ({
      id: n.notification_id,
      type: n.type,
      message: n.message,
      requestId: n.request_id || null,
      readAt: n.read_at,
      createdAt: n.created_at,
    })),
  });
});

// ============================ CUSTOMER ============================

// GET /api/service-requests/active -> { activeRepair } (200 with null = none)
// The dashboard's "Active Repair" card: the newest request still in play.
const getActiveRepair = asyncHandler(async (req, res) => {
  const rows = (await Request.listForCustomer(req.user.user_id)).filter((r) =>
    ['Pending', 'Approved', 'In Progress'].includes(r.request_status)
  );
  const row = rows[0];
  if (!row) return res.json({ activeRepair: null });

  const recipients = await Request.listRecipients(row.request_id);
  const providerId = pickProviderId(row, recipients);
  const users = await Request.findUsersByIds([providerId].filter(Boolean));
  res.json({
    activeRepair: {
      requestId: refOf(row),
      requestNumber: refOf(row),
      status: row.request_status,
      statusLabel: row.request_status,
      category: row.category,
      providerName: users[providerId]?.name || null,
      createdAt: row.created_at,
    },
  });
});

// ---------------------------- TRACKING (customer) ----------------------------
// One call feeds the whole Track screen: cards grouped by tab
// { sent, approved, ongoing, declined, done }. Card shapes are the ones
// documented above getTrackedRequests in the mobile app's servicerequest_api.js.

const buildTimeline = (updates) =>
  JOB_STAGES.map((label) => {
    const hit = updates.find((u) => u.step === label);
    return { label, timestamp: hit ? hit.created_at : null, description: hit?.notes || null, done: Boolean(hit) };
  });

const getTracking = asyncHandler(async (req, res) => {
  const rows = await Request.listForCustomer(req.user.user_id);
  const requestIds = rows.map((r) => r.request_id);

  const [recipientLists, quotationLists, proposals, paymentRequests, progressRows, paymentRows] =
    await Promise.all([
      Promise.all(rows.map((r) => Request.listRecipients(r.request_id))),
      Promise.all(rows.map((r) => Request.listQuotations(r.request_id))),
      Workflow.listScheduleProposals(requestIds),
      Workflow.listPaymentRequests(requestIds),
      Workflow.listProgressUpdates(requestIds),
      Workflow.listPayments(requestIds),
    ]);

  const providerIds = [
    ...new Set(recipientLists.flat().map((r) => r.provider_id).filter(Boolean)),
  ];
  const users = await Request.findUsersByIds(providerIds);

  const groups = { sent: [], approved: [], ongoing: [], declined: [], done: [] };

  rows.forEach((row, i) => {
    const recipients = recipientLists[i];
    const quotes = Object.fromEntries(quotationLists[i].map((q) => [q.provider_id, q]));
    const providerId = pickProviderId(row, recipients);
    const providerName = users[providerId]?.name || 'Service provider';
    const base = {
      requestId: refOf(row),
      requestNumber: refOf(row),
      providerId,
      providerName,
    };
    const cardId = (suffix) => `${refOf(row)}-${suffix}`;
    const my = (list) => list.filter((x) => x.request_id === row.request_id);
    const updates = my(progressRows);
    const timeline = buildTimeline(updates);
    const quote = quotes[providerId];
    const quoteTotal = quote ? Number(quote.labor_cost || 0) + Number(quote.parts_cost || 0) : 0;
    const approvedExtras = my(paymentRequests)
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const ai = row.ai_diagnosis?.status === 'done' ? row.ai_diagnosis : null;

    if (row.request_status === 'Pending') {
      const quoted = recipients.filter((r) => r.status === 'quoted');
      if (quoted.length) {
        quoted.forEach((r) => {
          const q = quotes[r.provider_id];
          if (!q) return;
          groups.approved.push({
            ...base,
            id: cardId(`quotation-${r.provider_id}`),
            providerId: r.provider_id,
            providerName: users[r.provider_id]?.name || providerName,
            cardType: 'quotation',
            statusLabel: 'Quotation received',
            laborCost: Number(q.labor_cost || 0),
            partsCost: Number(q.parts_cost || 0),
            total: Number(q.labor_cost || 0) + Number(q.parts_cost || 0),
            notes: q.remarks || '',
          });
        });
      } else {
        groups.sent.push({
          ...base,
          id: cardId('diagnosis'),
          cardType: 'diagnosis',
          statusLabel: 'Sent',
          probableCause: ai?.probableCause || null,
          confidencePercent: ai?.confidencePercent ?? null,
        });
      }
      return;
    }

    if (row.request_status === 'Approved' || row.request_status === 'In Progress') {
      my(proposals)
        .filter((p) => p.status === 'pending')
        .forEach((p) =>
          groups.approved.push({
            ...base,
            id: cardId(`schedule-${p.proposal_id}`),
            cardType: 'schedule',
            statusLabel: 'New schedule proposed',
            proposalId: p.proposal_id,
            scheduledAt: p.scheduled_at,
            reason: p.reason || '',
          })
        );
      my(paymentRequests)
        .filter((p) => p.status === 'pending')
        .forEach((p) =>
          groups.ongoing.push({
            ...base,
            id: cardId(`payment-${p.payment_request_id}`),
            cardType: 'payment',
            statusLabel: 'Additional payment requested',
            paymentRequestId: p.payment_request_id,
            paymentAmount: Number(p.amount || 0),
            paymentReason: p.reason || '',
          })
        );
      groups.ongoing.push({
        ...base,
        id: cardId('timeline'),
        cardType: 'timeline',
        statusLabel: row.request_status,
        total: quoteTotal + approvedExtras,
        timeline,
      });
      return;
    }

    if (row.request_status === 'Completed') {
      groups.done.push({
        ...base,
        id: cardId('completed'),
        cardType: 'completed',
        statusLabel: 'Completed',
        finalAmount: quoteTotal + approvedExtras,
        timeline,
      });
      return;
    }

    if (row.request_status === 'Declined' || row.request_status === 'Rejected') {
      const declinedBy = recipients.find((r) => r.status === 'declined');
      groups.declined.push({
        ...base,
        id: cardId('declined'),
        cardType: 'declined',
        statusLabel: 'Declined',
        reason: declinedBy?.declined_reason || null,
      });
    }
    // 'Resolved' (fixed via AI) and 'Cancelled' are history, not tracking cards.
  });

  res.json(groups);
});

// -------------------- CUSTOMER ANSWERS (Track screen) --------------------

// POST /api/service-requests/:requestId/schedule-proposals/:proposalId/accept | /reject
const answerScheduleProposal = (answer) =>
  asyncHandler(async (req, res) => {
    const row = await getOwnedRequest(req);
    const proposal = await Workflow.findScheduleProposal(req.params.proposalId);
    if (!proposal || proposal.request_id !== row.request_id) throw new ApiError(404, 'Schedule proposal not found');
    if (proposal.status !== 'pending') throw new ApiError(409, 'This proposal was already answered');

    await Workflow.updateScheduleProposal(proposal.proposal_id, {
      status: answer,
      responded_at: new Date().toISOString(),
    });
    if (answer === 'accepted') {
      // The proposed slot becomes the appointment (SERVICE_REQUEST.date / time).
      const when = new Date(proposal.scheduled_at);
      await Request.update(row.request_number, {
        date: when.toISOString().slice(0, 10),
        time: when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
    }
    const customerName = await customerNameOf(row);
    await Workflow.notify({
      userId: proposal.provider_id,
      type: answer === 'accepted' ? 'schedule_accepted' : 'schedule_rejected',
      message:
        answer === 'accepted'
          ? `${customerName} accepted your proposed schedule for ${refOf(row)}.`
          : `${customerName} declined your proposed schedule for ${refOf(row)}.`,
      requestId: row.request_id,
    });
    res.json({ ok: true, status: answer });
  });

// POST /api/service-requests/:requestId/payment-requests/:paymentRequestId/approve | /reject
const answerPaymentRequest = (answer) =>
  asyncHandler(async (req, res) => {
    const row = await getOwnedRequest(req);
    const pr = await Workflow.findPaymentRequest(req.params.paymentRequestId);
    if (!pr || pr.request_id !== row.request_id) throw new ApiError(404, 'Payment request not found');
    if (pr.status !== 'pending') throw new ApiError(409, 'This payment request was already answered');

    await Workflow.updatePaymentRequest(pr.payment_request_id, {
      status: answer,
      responded_at: new Date().toISOString(),
    });
    const customerName = await customerNameOf(row);
    await Workflow.notify({
      userId: pr.provider_id,
      type: answer === 'approved' ? 'payment_approved' : 'payment_rejected',
      message:
        answer === 'approved'
          ? `${customerName} approved the additional ${peso(pr.amount)} for ${refOf(row)}.`
          : `${customerName} declined the additional ${peso(pr.amount)} for ${refOf(row)}.`,
      requestId: row.request_id,
    });
    res.json({ ok: true, status: answer });
  });

// POST /api/service-requests/:requestId/quotation/respond  body: { approve }
// approve: the request is booked with that provider (ERD: "Accepted by").
// decline: that quote is refused; the request stays Pending so the customer can
// pick another provider.
const respondToQuotation = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  const approve = Boolean(req.body.approve);

  const recipients = await Request.listRecipients(row.request_id);
  const quoted = recipients.find((r) => r.status === 'quoted');
  if (!quoted) throw new ApiError(409, 'There is no open quotation for this request');

  const customerName = await customerNameOf(row);
  if (approve) {
    await Request.updateRecipient(row.request_id, quoted.provider_id, {
      status: 'accepted',
      responded_at: new Date().toISOString(),
    });
    await Request.update(row.request_number, { request_status: 'Approved', provider_id: quoted.provider_id });
    await Workflow.notify({
      userId: quoted.provider_id,
      type: 'quotation_accepted',
      message: `${customerName} accepted your quotation for ${refOf(row)}. You can start the job.`,
      requestId: row.request_id,
    });
  } else {
    await Request.updateRecipient(row.request_id, quoted.provider_id, {
      status: 'declined',
      declined_reason: 'The customer declined the quotation',
      responded_at: new Date().toISOString(),
    });
    await Workflow.notify({
      userId: quoted.provider_id,
      type: 'quotation_declined',
      message: `${customerName} declined your quotation for ${refOf(row)}.`,
      requestId: row.request_id,
    });
  }
  res.json({ ok: true, approved: approve });
});

// POST /api/service-requests/:requestId/payment  body: { amount, method, stage }
// With PAYMONGO_SECRET_KEY set this creates a PayMongo Checkout Session and returns
// its checkoutUrl — the app opens it (GCash / QR Ph / card) and then polls
// GET .../payment-status. Without keys (local dev) the payment is recorded as paid
// directly so the flow can still be tested end to end.
const PAYMENT_METHODS = ['gcash', 'qrph', 'card'];

const paymongo = require('../utils/paymongo');
const config = require('../config');

// Marks a payment paid exactly once and tells the provider.
const markPaymentPaid = async (payment, paymongoPaymentId = null) => {
  if (payment.status === 'paid') return payment;
  const updated = await Workflow.updatePayment(payment.payment_id, {
    status: 'paid',
    ...(paymongoPaymentId ? { paymongo_payment_id: paymongoPaymentId } : {}),
  });
  const row = (await Request.findByIds([payment.request_id]))[0];
  if (row) {
    const recipients = await Request.listRecipients(row.request_id);
    const providerId = pickProviderId(row, recipients);
    if (providerId) {
      await Workflow.notify({
        userId: providerId,
        type: 'payment_received',
        message: `Payment received for ${refOf(row)}: ${peso(payment.amount)} via ${String(payment.method).toUpperCase()}.`,
        requestId: row.request_id,
      });
    }
  }
  return updated;
};

const payForRequest = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  const amount = Number(req.body.amount);
  const method = String(req.body.method || '').toLowerCase();
  const stage = ['initial', 'final', 'additional'].includes(req.body.stage) ? req.body.stage : 'final';
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'Enter a valid amount');
  if (!PAYMENT_METHODS.includes(method)) throw new ApiError(400, 'Choose a payment method');

  // ---- No PayMongo key: dev mode, record the payment straight away. ----
  if (!config.paymongo.secretKey) {
    const payment = await Workflow.addPayment({ request_id: row.request_id, amount, method, stage, status: 'paid' });
    const recipients = await Request.listRecipients(row.request_id);
    const providerId = pickProviderId(row, recipients);
    if (providerId) {
      await Workflow.notify({
        userId: providerId,
        type: 'payment_received',
        message: `Payment received for ${refOf(row)}: ${peso(amount)} via ${method.toUpperCase()}.`,
        requestId: row.request_id,
      });
    }
    return res.status(201).json({ payment: { id: payment.payment_id, amount, method, stage, status: 'paid' } });
  }

  // ---- PayMongo Checkout Session ----
  const payment = await Workflow.addPayment({ request_id: row.request_id, amount, method, stage, status: 'pending' });
  try {
    const session = await paymongo.createCheckoutSession({
      amount,
      method,
      description: `ServEase ${refOf(row)} — ${stage === 'initial' ? 'initial fee' : stage === 'additional' ? 'additional payment' : 'service payment'}`,
      referenceNumber: payment.payment_id, // the webhook finds our row through this
      successUrl: `${config.baseUrl}/api/payments/return?status=success&ref=${payment.payment_id}`,
      cancelUrl: `${config.baseUrl}/api/payments/return?status=cancelled&ref=${payment.payment_id}`,
    });
    await Workflow.updatePayment(payment.payment_id, { checkout_session_id: session.id });
    return res.status(201).json({
      payment: { id: payment.payment_id, amount, method, stage, status: 'pending' },
      checkoutUrl: session.attributes.checkout_url,
    });
  } catch (err) {
    await Workflow.updatePayment(payment.payment_id, { status: 'failed' }).catch(() => {});
    throw new ApiError(502, `Could not start the payment: ${err.message}`);
  }
});

// GET /api/service-requests/:requestId/payment-status -> { payment: { status, ... } }
// The Payment screen polls this after the customer returns from the PayMongo page.
// Checks PayMongo directly, so confirmation works even before the webhook exists.
const getPaymentStatus = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  const payment = await Workflow.latestPaymentForRequest(row.request_id);
  if (!payment) throw new ApiError(404, 'No payment started for this request');

  let current = payment;
  if (current.status === 'pending' && current.checkout_session_id && config.paymongo.secretKey) {
    try {
      const session = await paymongo.getCheckoutSession(current.checkout_session_id);
      if (paymongo.sessionIsPaid(session)) {
        const paid = session.attributes.payments?.find((p) => p?.attributes?.status === 'paid');
        current = await markPaymentPaid(current, paid?.id || null);
      }
    } catch (err) {
      console.error('[paymongo] status check failed:', err.message); // keep serving the stored status
    }
  }
  res.json({
    payment: {
      id: current.payment_id,
      status: current.status,
      amount: Number(current.amount),
      method: current.method,
      stage: current.stage,
    },
  });
});

// POST /api/payments/webhook — called by PayMongo, not by the apps. Verifies the
// signature when PAYMONGO_WEBHOOK_SECRET is set.
const paymongoWebhook = asyncHandler(async (req, res) => {
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  if (!paymongo.verifyWebhookSignature(raw, req.headers['paymongo-signature'])) {
    throw new ApiError(401, 'Bad webhook signature');
  }
  const event = req.body?.data;
  const type = event?.attributes?.type;
  const session = event?.attributes?.data; // for checkout_session.payment.paid this is the session

  if (type === 'checkout_session.payment.paid' || type === 'payment.paid') {
    const sessionId = session?.id?.startsWith('cs_') ? session.id : null;
    const reference = session?.attributes?.reference_number || null;
    let payment = reference ? await Workflow.findPaymentById(reference) : null;
    if (!payment && sessionId) payment = await Workflow.findPaymentByCheckoutId(sessionId);
    if (payment) await markPaymentPaid(payment, session?.attributes?.payments?.[0]?.id || null);
    else console.warn('[paymongo] webhook for unknown payment', reference || sessionId);
  }
  res.json({ received: true });
});

// GET /api/payments/return — the browser lands here after PayMongo checkout.
const paymentReturn = (req, res) => {
  const ok = req.query.status === 'success';
  res.send(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<body style="font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f4f7fb">` +
      `<div style="text-align:center;padding:24px">` +
      `<h1 style="color:#1B2A8C">${ok ? 'Payment submitted' : 'Payment cancelled'}</h1>` +
      `<p>${ok ? 'You can now return to the ServEase app — your receipt will appear in a moment.' : 'No charge was made. Return to the ServEase app to try again.'}</p>` +
      `</div></body>`
  );
};

// POST /api/service-requests/:requestId/rating  body: { rating (1-5), review }
const rateRequest = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  if (row.request_status !== 'Completed') throw new ApiError(409, 'You can rate once the job is completed');

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, 'Pick 1 to 5 stars');
  const review = String(req.body.review || '').trim();

  const existing = await Workflow.findRatingForRequest(row.request_id);
  if (existing) throw new ApiError(409, 'You already rated this service');

  const recipients = await Request.listRecipients(row.request_id);
  const providerId = pickProviderId(row, recipients);
  if (!providerId) throw new ApiError(409, 'This request has no provider to rate');

  const saved = await Workflow.addRating({
    request_id: row.request_id,
    provider_id: providerId,
    customer_id: req.user.user_id,
    rating,
    review: review || null,
  });
  await Workflow.notify({
    userId: providerId,
    type: 'rating_received',
    message: `${await customerNameOf(row)} rated you ${rating}/5 for ${refOf(row)}.`,
    requestId: row.request_id,
  });
  res.status(201).json({ rating: { id: saved.rating_id, rating, review } });
});

// ============================ PROVIDER ACTIONS ============================
// Everything here makes the customer's Track screen / dashboard / notifications
// move — this is the provider half of the conversation.

// POST /api/provider/service-requests/:requestId/accept
// The provider commits to the request; a quotation is still expected afterwards
// (the mobile ViewServiceRequest screen collects it right after).
const acceptRequest = asyncHandler(async (req, res) => {
  const { row, recipient } = await getProviderRequest(req);
  if (recipient.status !== 'sent') throw new ApiError(409, 'You already responded to this request');

  await Request.updateRecipient(row.request_id, req.user.user_id, {
    status: 'accepted',
    responded_at: new Date().toISOString(),
  });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'request_accepted',
    message: `A service provider accepted ${refOf(row)} and is preparing your quotation.`,
    requestId: row.request_id,
  });
  res.json({ ok: true });
});

// POST /api/provider/service-requests/:requestId/decline  body: { reason }
const declineRequest = asyncHandler(async (req, res) => {
  const { row, recipient } = await getProviderRequest(req);
  if (!['sent', 'accepted'].includes(recipient.status)) {
    throw new ApiError(409, 'You already responded to this request');
  }
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new ApiError(400, 'State a reason for rejection');

  await Request.updateRecipient(row.request_id, req.user.user_id, {
    status: 'declined',
    declined_reason: reason,
    responded_at: new Date().toISOString(),
  });
  // The request goes back to the customer so they can pick another provider.
  await Request.update(row.request_number, { request_status: 'Declined' });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'request_declined',
    message: `A service provider declined ${refOf(row)}: ${reason}`,
    requestId: row.request_id,
  });
  res.json({ ok: true });
});

// POST /api/provider/service-requests/:requestId/quotation  body: { laborCost, partsCost, remarks }
// (Same data as the web app's /quote; this path is what the mobile app calls.)
const sendQuotation = asyncHandler(async (req, res) => {
  const { row, recipient } = await getProviderRequest(req);
  if (!['sent', 'accepted'].includes(recipient.status)) {
    throw new ApiError(409, 'You already responded to this request');
  }
  const labor = Number(req.body.laborCost) || 0;
  const parts = Number(req.body.partsCost) || 0;
  if (labor < 0 || parts < 0 || labor + parts <= 0) throw new ApiError(400, 'Enter a labor or item price');

  const quote = await Request.addQuotation({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    labor_cost: labor,
    parts_cost: parts,
    remarks: String(req.body.remarks || '').trim() || null,
  });
  await Request.updateRecipient(row.request_id, req.user.user_id, {
    status: 'quoted',
    responded_at: new Date().toISOString(),
  });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'quotation_received',
    message: `You received a quotation for ${refOf(row)}: ${peso(labor + parts)}.`,
    requestId: row.request_id,
  });
  res.status(201).json({ quotation: { id: quote.quotation_id, labor, parts, total: labor + parts } });
});

// POST /api/provider/service-requests/:requestId/schedule-proposals  body: { scheduledAt, reason }
const proposeSchedule = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  const scheduledAt = new Date(req.body.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new ApiError(400, 'Pick a valid date and time');

  const proposal = await Workflow.addScheduleProposal({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    scheduled_at: scheduledAt.toISOString(),
    reason: String(req.body.reason || '').trim() || null,
  });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'schedule_proposal',
    message: `New schedule proposed for ${refOf(row)}: ${scheduledAt.toLocaleString('en-PH')}. Open Track to answer.`,
    requestId: row.request_id,
  });
  res.status(201).json({ proposal: { id: proposal.proposal_id, scheduledAt: proposal.scheduled_at, status: 'pending' } });
});

// POST /api/provider/service-requests/:requestId/payment-requests  body: { amount, reason }
const requestAdditionalPayment = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'Enter a valid amount');
  const reason = String(req.body.reason || '').trim();

  const pr = await Workflow.addPaymentRequest({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    amount,
    reason: reason || null,
  });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'payment_request',
    message: `Additional payment requested for ${refOf(row)}: ${peso(amount)}${reason ? ` — ${reason}` : ''}. Open Track to answer.`,
    requestId: row.request_id,
  });
  res.status(201).json({ paymentRequest: { id: pr.payment_request_id, amount, status: 'pending' } });
});

// POST /api/provider/service-requests/:requestId/progress  body: { step, notes? }
const updateJobProgress = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  const step = String(req.body.step || '').trim();
  if (!JOB_STAGES.includes(step)) throw new ApiError(400, `Stage must be one of: ${JOB_STAGES.join(', ')}`);

  await Workflow.addProgressUpdate({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    step,
    notes: String(req.body.notes || '').trim() || null,
  });
  // The first pushed step starts the job.
  if (row.request_status === 'Approved') {
    await Request.update(row.request_number, { request_status: 'In Progress' });
  }
  await Workflow.notify({
    userId: row.customer_id,
    type: 'progress_update',
    message: `${refOf(row)} update: ${step}.`,
    requestId: row.request_id,
  });
  res.status(201).json({ ok: true, step });
});

// POST /api/provider/service-requests/:requestId/complete
const completeJob = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  if (row.request_status === 'Completed') throw new ApiError(409, 'This job is already completed');

  const updates = await Workflow.listProgressUpdates([row.request_id]);
  if (!updates.some((u) => u.step === 'Completed')) {
    await Workflow.addProgressUpdate({ request_id: row.request_id, provider_id: req.user.user_id, step: 'Completed' });
  }
  await Request.update(row.request_number, { request_status: 'Completed' });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'job_completed',
    message: `${refOf(row)} is done! Open Track to proceed to payment.`,
    requestId: row.request_id,
  });
  res.json({ ok: true });
});

// ===================== PROVIDER DASHBOARD / JOBS / EARNINGS =====================

// Requests this provider is involved in, newest first, with their recipient rows.
const providerRequests = async (providerId, statuses) => {
  const recipients = await Request.listRecipientsForProvider(providerId, statuses);
  const rows = await Request.findByIds(recipients.map((r) => r.request_id));
  const byId = Object.fromEntries(rows.map((r) => [r.request_id, r]));
  return recipients
    .map((recipient) => ({ row: byId[recipient.request_id], recipient }))
    .filter((x) => x.row)
    .sort((a, b) => new Date(b.row.created_at) - new Date(a.row.created_at));
};

const toJobDto = (row, customer, updates, payments) => {
  const doneSteps = (updates || []).map((u) => u.step);
  const lastIndex = doneSteps.reduce((max, step) => Math.max(max, JOB_STAGES.indexOf(step)), -1);
  const status =
    row.request_status === 'Completed' ? 'Done' : row.request_status === 'Pending' ? 'Pending' : 'Active';
  return {
    id: refOf(row),
    requestNumber: refOf(row),
    customerName: customer?.name || 'Customer',
    createdAt: row.created_at,
    status,
    statusLabel: status,
    aiSuggestion: row.ai_diagnosis?.status === 'done' ? row.ai_diagnosis.probableCause : null,
    stages: JOB_STAGES,
    currentStepIndex: Math.max(lastIndex, 0),
    currentStepLabel: lastIndex >= 0 ? JOB_STAGES[lastIndex] : 'Not started',
    progressPaymentPaid: (payments || []).length > 0,
  };
};

// GET /api/provider/dashboard
const getProviderDashboard = asyncHandler(async (req, res) => {
  const providerId = req.user.user_id;
  const involved = await providerRequests(providerId, ['sent', 'accepted', 'quoted']);

  const active = involved.filter(({ row }) => ['Approved', 'In Progress'].includes(row.request_status));
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const thisMonth = involved.filter(({ recipient }) => new Date(recipient.sent_at) >= startOfMonth);
  const pending = involved.filter(({ recipient }) => recipient.status === 'sent');

  const [ratingMap, notifications, customerMap] = await Promise.all([
    Request.listRatingsForProviders([providerId]),
    Workflow.listNotifications(providerId, 5),
    Request.findUsersByIds(involved.map(({ row }) => row.customer_id)),
  ]);
  const rating = ratingMap[providerId] || null;
  const newest = active[0];

  res.json({
    stats: {
      activeJobs: active.length,
      jobsThisMonth: thisMonth.length,
      rating: rating ? Math.round(rating.rating * 10) / 10 : null,
    },
    activeRepair: newest
      ? {
          requestId: refOf(newest.row),
          statusLabel: newest.row.request_status,
          customerName: customerMap[newest.row.customer_id]?.name || 'Customer',
        }
      : null,
    notifications: notifications.map((n) => ({ id: n.notification_id, message: n.message, createdAt: n.created_at })),
    pendingRequests: pending.map(({ row }) => ({
      id: refOf(row),
      requestNumber: refOf(row),
      customerName: customerMap[row.customer_id]?.name || 'Customer',
    })),
  });
});

// GET /api/provider/jobs
const listJobs = asyncHandler(async (req, res) => {
  const involved = await providerRequests(req.user.user_id, ['accepted', 'quoted']);
  const requestIds = involved.map(({ row }) => row.request_id);
  const [customerMap, progressRows, paymentRows] = await Promise.all([
    Request.findUsersByIds(involved.map(({ row }) => row.customer_id)),
    Workflow.listProgressUpdates(requestIds),
    Workflow.listPayments(requestIds),
  ]);
  res.json({
    jobs: involved.map(({ row }) =>
      toJobDto(
        row,
        customerMap[row.customer_id],
        progressRows.filter((u) => u.request_id === row.request_id),
        paymentRows.filter((p) => p.request_id === row.request_id)
      )
    ),
  });
});

// GET /api/provider/jobs/:jobId
const getJob = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  const updates = await Workflow.listProgressUpdates([row.request_id]);
  const lastIndex = updates.reduce((max, u) => Math.max(max, JOB_STAGES.indexOf(u.step)), -1);
  res.json({
    job: { id: refOf(row), stages: JOB_STAGES, currentStage: lastIndex >= 0 ? JOB_STAGES[lastIndex] : '' },
  });
});

// PATCH /api/provider/jobs/:jobId/status  { stage, notes, photo? } (multipart when a photo is attached)
const updateJobStatus = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  const stage = String(req.body.stage || '').trim();
  if (!JOB_STAGES.includes(stage)) throw new ApiError(400, `Stage must be one of: ${JOB_STAGES.join(', ')}`);

  let photoPath = null;
  if (req.file) photoPath = await Request.uploadPhoto(req.user.user_id, req.file);

  await Workflow.addProgressUpdate({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    step: stage,
    notes: String(req.body.notes || '').trim() || null,
    photo_path: photoPath,
  });
  if (row.request_status === 'Approved') {
    await Request.update(row.request_number, { request_status: 'In Progress' });
  }
  if (stage === 'Completed' && row.request_status !== 'Completed') {
    await Request.update(row.request_number, { request_status: 'Completed' });
  }
  await Workflow.notify({
    userId: row.customer_id,
    type: 'progress_update',
    message: `${refOf(row)} update: ${stage}.`,
    requestId: row.request_id,
  });
  res.json({ ok: true, stage });
});

// POST /api/provider/jobs/:jobId/additional-parts  { additionalCost, notes }
const notifyAdditionalParts = asyncHandler(async (req, res) => {
  const { row } = await getProviderRequest(req);
  const amount = Number(req.body.additionalCost);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'Enter a valid cost');
  const notes = String(req.body.notes || '').trim();

  const pr = await Workflow.addPaymentRequest({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    amount,
    reason: notes || null,
  });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'payment_request',
    message: `Additional parts for ${refOf(row)}: ${peso(amount)}${notes ? ` — ${notes}` : ''}. Open Track to answer.`,
    requestId: row.request_id,
  });
  res.status(201).json({ paymentRequest: { id: pr.payment_request_id, amount, status: 'pending' } });
});

// GET /api/provider/earnings
const getEarnings = asyncHandler(async (req, res) => {
  const providerId = req.user.user_id;
  const involved = await providerRequests(providerId, ['accepted', 'quoted']);
  const requestIds = involved.map(({ row }) => row.request_id);

  const [payments, paymentRequests, quotationLists, customerMap] = await Promise.all([
    Workflow.listPayments(requestIds),
    Workflow.listPaymentRequests(requestIds),
    Promise.all(involved.map(({ row }) => Request.listQuotations(row.request_id))),
    Request.findUsersByIds(involved.map(({ row }) => row.customer_id)),
  ]);

  const paymentsFor = (id) => payments.filter((x) => x.request_id === id);
  const prsFor = (id) => paymentRequests.filter((x) => x.request_id === id);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const transactions = [];
  let pendingPayment = 0;

  involved.forEach(({ row }, i) => {
    const quote = quotationLists[i].find((q) => q.provider_id === providerId);
    const due =
      (quote ? Number(quote.labor_cost || 0) + Number(quote.parts_cost || 0) : 0) +
      prsFor(row.request_id)
        .filter((p) => p.status === 'approved')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paidRows = paymentsFor(row.request_id).filter((p) => p.status === 'paid');
    const paid = paidRows.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    pendingPayment += Math.max(0, due - paid);
    paidRows.forEach((p) =>
      transactions.push({
        id: p.payment_id,
        requestNumber: refOf(row),
        customerName: customerMap[row.customer_id]?.name || 'Customer',
        date: p.created_at,
        amount: Number(p.amount),
      })
    );
  });

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({
    summary: {
      thisWeek: transactions.filter((t) => new Date(t.date) >= weekAgo).reduce((sum, t) => sum + t.amount, 0),
      pendingPayment,
    },
    transactions,
  });
});

// ===================== CONVERSATIONS (customer <-> provider chat) =====================
// One thread per service request. The conversation id IS the request reference
// ("SR-0007") — the mobile flow sends each request to a single provider.

// Requests the viewer can chat about + their role in each ('customer' | 'provider').
const conversationsFor = async (userId) => {
  const asCustomer = (await Request.listForCustomer(userId)).map((row) => ({ row, viewer: 'customer' }));
  const asProvider = (await providerRequests(userId, ['sent', 'accepted', 'quoted'])).map(({ row }) => ({
    row,
    viewer: 'provider',
  }));
  return [...asCustomer, ...asProvider];
};

// The other chat participant: for the customer it's the assigned/quoted provider,
// for the provider it's the customer.
const otherPartyOf = async (row, viewer) => {
  if (viewer === 'provider') {
    const users = await Request.findUsersByIds([row.customer_id]);
    return { userId: row.customer_id, name: users[row.customer_id]?.name || 'Customer', photoUrl: null };
  }
  const recipients = await Request.listRecipients(row.request_id);
  const providerId = pickProviderId(row, recipients);
  if (!providerId) return null;
  const [users, provider] = await Promise.all([
    Request.findUsersByIds([providerId]),
    Provider.findProfile(providerId),
  ]);
  return {
    userId: providerId,
    name: users[providerId]?.name || provider?.company_name || 'Service provider',
    // profile_photo is a private storage path; sign it so the app can render it.
    photoUrl: provider ? await getProviderFileUrl(provider.profile_photo) : null,
  };
};

const toMessageDto = (m, providerIdSet) => ({
  id: m.message_id,
  text: m.body,
  sender: providerIdSet.has(m.sender_id) ? 'provider' : 'customer',
  senderId: m.sender_id,
  createdAt: m.created_at,
});

// GET /api/conversations
const listConversations = asyncHandler(async (req, res) => {
  const entries = await conversationsFor(req.user.user_id);
  const messages = await Workflow.listMessagesForRequests(entries.map(({ row }) => row.request_id));
  const latestByRequest = {};
  messages.forEach((m) => {
    latestByRequest[m.request_id] = m; // ordered by created_at — last one wins
  });

  const conversations = [];
  for (const { row, viewer } of entries) {
    const other = await otherPartyOf(row, viewer);
    if (!other) continue; // request not sent to any provider yet — no one to chat with
    const latest = latestByRequest[row.request_id];
    const unread = viewer === 'provider' ? latest && !latest.seen_by_provider : latest && !latest.seen_by_customer;
    conversations.push({
      id: refOf(row),
      name: other.name,
      avatarUrl: other.photoUrl,
      lastMessage: latest ? latest.body : '',
      hasUnread: Boolean(unread && latest.sender_id !== req.user.user_id),
      jobTitle: row.category,
      isOnline: false, // no presence system yet
    });
  }
  conversations.sort((a, b) => (a.id < b.id ? 1 : -1));
  res.json({ conversations });
});

// Loads the thread and proves the viewer is a participant. :id is "SR-0007".
const getConversation = async (req) => {
  const row = await Request.findByRequestNo(parseIdOr400(req.params.id));
  if (!row) throw new ApiError(404, 'Conversation not found');
  if (row.customer_id === req.user.user_id) return { row, viewer: 'customer' };
  const recipient = await Request.findRecipient(row.request_id, req.user.user_id);
  if (recipient) return { row, viewer: 'provider' };
  throw new ApiError(404, 'Conversation not found');
};

// GET /api/conversations/:id/messages  (also marks the thread read for the viewer)
const listMessages = asyncHandler(async (req, res) => {
  const { row, viewer } = await getConversation(req);
  const messages = await Workflow.listMessages(row.request_id);
  await Workflow.markMessagesSeen(row.request_id, viewer);

  const recipients = await Request.listRecipients(row.request_id);
  const providerIdSet = new Set(recipients.map((r) => r.provider_id));
  res.json({ messages: messages.map((m) => toMessageDto(m, providerIdSet)) });
});

// POST /api/conversations/:id/messages  { text }
const sendMessage = asyncHandler(async (req, res) => {
  const { row, viewer } = await getConversation(req);
  const text = String(req.body.text || '').trim();
  if (!text) throw new ApiError(400, 'Type a message first');
  if (text.length > 2000) throw new ApiError(400, 'Messages are limited to 2000 characters');

  const saved = await Workflow.addMessage({
    request_id: row.request_id,
    sender_id: req.user.user_id,
    body: text,
    seen_by_customer: viewer === 'customer',
    seen_by_provider: viewer === 'provider',
  });

  // Ping the other side (their Messages list shows the unread dot on next load).
  const other = await otherPartyOf(row, viewer);
  if (other) {
    const me = await Request.findUsersByIds([req.user.user_id]);
    await Workflow.notify({
      userId: other.userId,
      type: 'new_message',
      message: `${me[req.user.user_id]?.name || 'Someone'} sent you a message about ${refOf(row)}.`,
      requestId: row.request_id,
    });
  }

  const recipients = await Request.listRecipients(row.request_id);
  res.status(201).json({ message: toMessageDto(saved, new Set(recipients.map((r) => r.provider_id))) });
});

// ===================== PROVIDER AVAILABILITY (dashboard calendar) =====================
// Stored 24-hour 'HH:00'. The web app reads the 12-hour-labelled map; the mobile
// app reads `slots` ('YYYY-MM-DDTHH:00' strings).

const to24h = (slot) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(slot || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  if (/PM/i.test(m[3] || '') && h !== 12) h += 12;
  if (/AM/i.test(m[3] || '') && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

const to12h = (slot24) => {
  const h = Number(slot24.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
};

const availabilityPayload = (rows) => {
  const availability = {};
  const slots = [];
  rows.forEach((r) => {
    const date = String(r.date).slice(0, 10);
    (availability[date] ||= {})[to12h(r.slot)] = 'unavailable';
    slots.push(`${date}T${r.slot}`);
  });
  return { availability, slots };
};

// GET /api/providers/availability -> { availability: {...}, slots: [...] }
const getAvailability = asyncHandler(async (req, res) => {
  res.json(availabilityPayload(await Workflow.listUnavailableSlots(req.user.user_id)));
});

// PUT /api/providers/availability  { date, slot, status: 'unavailable' | 'available' }
const setAvailability = asyncHandler(async (req, res) => {
  const date = String(req.body.date || '').slice(0, 10);
  const slot = to24h(req.body.slot);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'date must be YYYY-MM-DD');
  if (!slot) throw new ApiError(400, 'slot must be HH:00 or hh:00 AM/PM');

  await Workflow.setUnavailableSlot(req.user.user_id, date, slot, req.body.status !== 'available');
  res.json(availabilityPayload(await Workflow.listUnavailableSlots(req.user.user_id)));
});

// ===================== BROWSE PROVIDERS (customer Find screen) =====================

// GET /api/service-providers?category&search -> { providers: [...] }
// Verified providers only; category matches against specialization names,
// punctuation-insensitive, so 'IT and Phone Repair' also matches 'IT-Related
// Device Repair' and 'Phone Repair' specializations via word overlap below.
const browseProviders = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const wantedCategory = String(req.query.category || '').trim();

  const providers = await Request.listVerifiedProviders();
  const [users, ratings] = await Promise.all([
    Request.findUsersByIds(providers.map((p) => p.user_id)),
    Request.listRatingsForProviders(providers.map((p) => p.user_id)),
  ]);

  // Words shared between the picked category label and a specialization name,
  // ignoring filler words — 'IT and Phone Repair' -> matches 'it', 'phone', 'repair'.
  const STOP = new Set(['and', 'the', 'a', 'an', 'of', 'services', 'service', 'repair']);
  const keywords = wantedCategory.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

  const matches = (p) => {
    const name = users[p.user_id]?.name || p.company_name || '';
    if (search) {
      const hay = [name, p.company_name, ...p.specializations].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (wantedCategory && wantedCategory.toLowerCase() !== 'all') {
      return p.specializations.some((s) => {
        const spec = s.toLowerCase();
        return keywords.some((k) => spec.includes(k));
      });
    }
    return true;
  };

  const list = [];
  for (const p of providers.filter(matches)) {
    if (p.user_id === req.user.user_id) continue;
    const rating = ratings[p.user_id];
    list.push({
      id: p.user_id,
      name: users[p.user_id]?.name || p.company_name || 'Service provider',
      specialty: p.specializations[0] || 'Service provider',
      specialities: p.specializations.join(', '),
      verified: true,
      available: true,
      rating: rating ? Math.round(rating.rating * 10) / 10 : null,
      reviews: rating?.reviewCount || 0,
      experienceYears: p.years_of_experience ?? null,
      locationName: p.company_address || '',
      availabilitySchedule: p.availability || '',
      offersHomeServices: Boolean(p.offers_home_service),
      photoUrl: await getProviderFileUrl(p.profile_photo),
    });
  }
  list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  res.json({ providers: list });
});

module.exports = {
  listNotifications,
  getActiveRepair,
  getTracking,
  answerScheduleProposal,
  answerPaymentRequest,
  respondToQuotation,
  payForRequest,
  getPaymentStatus,
  paymongoWebhook,
  paymentReturn,
  rateRequest,
  acceptRequest,
  declineRequest,
  sendQuotation,
  proposeSchedule,
  requestAdditionalPayment,
  updateJobProgress,
  completeJob,
  getProviderDashboard,
  listJobs,
  getJob,
  updateJobStatus,
  notifyAdditionalParts,
  getEarnings,
  listConversations,
  listMessages,
  sendMessage,
  getAvailability,
  setAvailability,
  browseProviders,
};
