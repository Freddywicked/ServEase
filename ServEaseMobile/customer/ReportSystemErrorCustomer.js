import React from 'react';
import ReportForm from '../components/ReportForm';
import { REPORT_TYPES } from '../api/report_api';

// Opened from "Report a System Error" in ReportProblemCustomer.js.
// Submits to POST /reports with type 'system_error' (shows on the Admin side).
const ReportSystemErrorCustomer = ({ navigation, route }) => (
    <ReportForm
        navigation={navigation}
        route={route}
        type={REPORT_TYPES.SYSTEM_ERROR}
        typeLabel="System Error"
    />
);

export default ReportSystemErrorCustomer;