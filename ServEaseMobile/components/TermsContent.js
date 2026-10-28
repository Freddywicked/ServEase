// Terms of Service and Privacy Policy text (from t_c.txt).
// Block types: 'p' paragraph, 'h' section heading, 'b' bullet, 'n' numbered item, 'gap' blank line.
// Edit the wording here; the modal renders whatever is in this list.
const p = (text) => ({ type: 'p', text });
const h = (text) => ({ type: 'h', text });
const b = (text) => ({ type: 'b', text });
const n = (num, text) => ({ type: 'n', num, text });
const gap = { type: 'gap' };

export const TERMS_BLOCKS = [
    p('ServEase is a mobile and web platform that connects Customers who need repairs (IT-related devices, phones, automotive, and home repair) with independent Service Providers. ServEase is not the repair provider. Service Providers are independent and are not employees or agents of ServEase.'),
    gap,
    p('By creating an account or using the app, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use ServEase. You must be at least 18 years old and able to enter a binding agreement.'),
    gap,

    h('1. Accounts and Roles'),
    b('You may register as a Customer or as a Service Provider.'),
    b('You must give accurate information and keep your login details secure. You are responsible for activity under your account.'),
    b('Service Providers must complete verification (identity and service credentials, as required) before accepting requests. ServEase may approve, reject, or revoke verification at its discretion.'),
    b('One person may not operate multiple accounts to avoid fees, ratings, or suspension.'),

    h('2. How a Job Works'),
    n(1, 'A Customer submits a service request, with a description and optional photos.'),
    n(2, 'Service Providers may send a quotation.'),
    n(3, 'The Customer may approve or reject a quotation. Approving it creates a binding job for the quoted scope and price.'),
    n(4, 'Progress is tracked in the app, and payments are made through the app.'),
    n(5, 'After completion, the Customer may rate the Service Provider.'),
    gap,
    p('If the scope of work changes, the Service Provider must send a revised quotation through the app, and the Customer must approve it before the extra work is done.'),

    h('3. Fees and Payments'),
    b('Quotation Approval Fee (Customer): a fixed fee of ₱20 per approved quotation, shown on the quotation screen before approval and added to the initial payment. It is not charged for submitting a request or for rejecting a quotation. It is refunded if the Service Provider cancels before the repair begins.'),
    b("Service Provider Fee: 3.5% of the approved quotation total, deducted from the Service Provider's payout. This includes payment processing costs on repair payments."),
    b('Payments are processed by PayMongo (e-wallet, card, and other supported methods). Payment processor terms also apply.'),
    b('Fees may change. We will give notice in the app before a change applies, and a change will not affect jobs already approved.'),
    b('Service Providers are responsible for their own taxes and permits.'),

    h('4. Cancellations and Refunds'),
    b("A Customer or Service Provider may cancel before the repair begins. If the Service Provider cancels, the Customer's payments and Quotation Approval Fee are refunded."),
    b('If the work has already started, cancellation and settlement of work already performed is agreed between both parties through the app, or decided by the Admin under Section 9.'),
    b('Refund timing depends on the payment method and payment processor.'),

    h('5. Keep Everything in the App (Anti-Circumvention)'),
    p('ServEase can only verify, record, and protect activity that happens inside the app. For this reason:'),
    b('No sharing of contact details to move a job off the app. Users must not share personal contact details (phone numbers, email addresses, social media accounts, messaging handles) in chat, quotations, photos, or any other part of the app in order to arrange, continue, or complete a job outside ServEase. This applies to Service Providers and Customers. Information needed to carry out an approved job, such as the service address and schedule, is shared through the app.'),
    b('No communication or payment outside the app for jobs found through ServEase, including paying cash or by direct transfer to avoid fees.'),
    b('No protection outside the app. If a transaction is taken outside ServEase, we cannot protect either party from fraud, non-payment, or poor workmanship, and the refund and dispute process does not apply to that job.'),
    b('To help enforce this, ServEase may mask contact details, scan messages for contact details or requests to go off-platform, and flag them for Admin review.'),

    h('6. Acceptable Use'),
    p('You must not:'),
    b('give false information, fake quotations, or fake reviews;'),
    b('harass, threaten, or discriminate against other users;'),
    b('request or take payment outside the app for jobs from ServEase;'),
    b("misuse the repairman locator or collect other users' data;"),
    b('upload unlawful, harmful, or infringing content;'),
    b("interfere with the app's security or operation."),

    h('7. Ratings, Reviews, and AI Features'),
    b('Customers may rate and review Service Providers after a completed job. Reviews must be honest and based on real experience.'),
    b("ServEase may analyze review text (sentiment analysis) to help show a Service Provider's reputation."),
    b("Any AI-generated fault diagnosis is a suggestion with a confidence score. It is not a guaranteed or professional diagnosis, and the Service Provider's own inspection controls."),

    h('8. Disputes'),
    b('Users should first try to settle a problem through in-app chat.'),
    b('If unresolved, either party may report the job to the Admin through the app. The Admin may review quotations, chat history, photos, repair status, and payment records, and may decide on a refund, partial refund, or release of payout.'),
    b("ServEase's decision on in-app disputes is made in good faith. This does not limit your rights under Philippine law."),

    h('9. Location and Privacy'),
    b('Location is used for the repairman locator only with your consent, and you may turn it off in your device settings.'),
    b('ServEase collects and uses personal data as described in the Privacy Policy, in line with the Data Privacy Act of 2012 (Republic Act No. 10173). You have the rights provided by that law, including access and correction.'),

    h('10. Violations and Account Action'),
    p('If ServEase finds or reasonably suspects a violation of these Terms, it may, depending on seriousness:'),
    n(1, 'send a warning;'),
    n(2, 'temporarily suspend the account;'),
    n(3, 'permanently remove the account and verification.'),
    p('ServEase may also withhold or recover fees and unpaid payouts connected to a circumvented or fraudulent job. You may appeal an action by contacting [support email].'),

    h('12. Responsibility and Liability'),
    b("Service Providers are responsible for the quality, safety, legality, and warranty of their work. ServEase does not guarantee the quality or outcome of any repair."),
    b('The app is provided "as is" and may have interruptions or errors. We work to keep it available but do not promise uninterrupted service.'),
    b("To the extent allowed by law, ServEase is not liable for indirect or consequential losses, or for damages caused by a Service Provider's work. Nothing here limits liability that cannot be limited by law."),
];