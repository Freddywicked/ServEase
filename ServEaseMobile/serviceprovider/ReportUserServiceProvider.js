import React from 'react';
import ReportForm from '../components/ReportForm';
import { REPORT_TYPES, REPORTER_ROLES } from '../api/report_api';

// Opened from "Report a User" in ReportProblemServiceProvider.js.
// Submits to POST /reports with type 'user_report', reporter_role 'service_provider'
// (shows on the Admin side).
// Optional route params forwarded to the backend when a screen opens this form
// about a specific person: { reportedUserId, reportedUserName, serviceRequestId, returnTo }.
const ReportUserServiceProvider = ({ navigation, route }) => (
    <ReportForm
        navigation={navigation}
        route={route}
        type={REPORT_TYPES.USER_REPORT}
        typeLabel="User Report"
        showUserName
        reporterRole={REPORTER_ROLES.SERVICE_PROVIDER}
        defaultReturnTo="ServiceProviderProfile"
    />
);

export default ReportUserServiceProvider;