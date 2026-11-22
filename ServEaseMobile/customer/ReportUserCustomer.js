import React from 'react';
import ReportForm from '../components/ReportForm';
import { REPORT_TYPES } from '../api/report_api';

// Opened from "Report a User" in ReportProblemCustomer.js.
// Submits to POST /reports with type 'user_report' (shows on the Admin side).
// Optional route params forwarded to the backend when a screen opens this form
// about a specific person: { reportedUserId, reportedUserName, serviceRequestId, returnTo }.
const ReportUserCustomer = ({ navigation, route }) => (
    <ReportForm
        navigation={navigation}
        route={route}
        type={REPORT_TYPES.USER_REPORT}
        typeLabel="User Report"
        showUserName
    />
);

export default ReportUserCustomer;