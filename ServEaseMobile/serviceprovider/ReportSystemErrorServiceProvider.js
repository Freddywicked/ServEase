import React from 'react';
import ReportForm from '../components/ReportForm';
import { REPORT_TYPES, REPORTER_ROLES } from '../api/report_api';

// Opened from "Report a System Error" in ReportProblemServiceProvider.js.
// Submits to POST /reports with type 'system_error', reporter_role 'service_provider'
// (shows on the Admin side).
const ReportSystemErrorServiceProvider = ({ navigation, route }) => (
    <ReportForm
        navigation={navigation}
        route={route}
        type={REPORT_TYPES.SYSTEM_ERROR}
        typeLabel="System Error"
        reporterRole={REPORTER_ROLES.SERVICE_PROVIDER}
        defaultReturnTo="ServiceProviderProfile"
    />
);

export default ReportSystemErrorServiceProvider;