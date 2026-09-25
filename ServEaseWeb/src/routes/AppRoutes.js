import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import SignIn from "../pages/auth/SignIn";
import SignUp from "../pages/auth/SignUp";
import PhoneVerification from "../pages/auth/PhoneVerification";
import RoleSelection from "../pages/auth/RoleSelection";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ProviderApply from "../pages/provider/ProviderApply";
import ProviderCategory from "../pages/provider/ProviderCategory";
import ProviderVerification from "../pages/provider/ProviderVerification";
import ProviderPending from "../pages/provider/ProviderPending";
import {
  ProviderDashboard,
  ProviderRequests,
  RequestDetail,
  ProviderJobs,
} from "../pages/provider/ProviderWorkspace";
import {
  ProviderMessages,
  ProviderEarnings,
  ProviderProfile,
  ProviderCalendar,
} from "../pages/provider/ProviderExtras";
import CustomerDashboard from "../pages/customer/CustomerDashboard";
import CreateRequest from "../pages/customer/CreateRequest";
import Providers from "../pages/customer/Providers";
import Profile from "../pages/customer/Profile";
import ServiceProviderProfile from "../pages/customer/ServiceProviderProfile";
import {
  Requests,
  Quote,
  Payment,
  Messages,
  History,
  RequestSent,
} from "../pages/customer/CustomerPages";
import AdminDashboard from "../pages/admin/AdminDashboard";
import UserManagement from "../pages/admin/UserManagement";
import DocumentViewer from "../pages/DocumentViewer";
import "../pages/admin/admin.css";
import "../pages/admin/user-management.css";
import "../pages/admin/dashboard.css";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify-phone" element={<PhoneVerification />} />
      <Route path="/role-select" element={<RoleSelection />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/provider/apply" element={<ProviderApply />} />
      <Route path="/provider/category" element={<ProviderCategory />} />
      <Route path="/provider/verify" element={<ProviderVerification />} />
      <Route path="/provider/pending" element={<ProviderPending />} />
      <Route path="/provider/dashboard" element={<ProviderDashboard />} />
      <Route path="/provider/requests" element={<ProviderRequests />} />
      <Route path="/provider/requests/:id" element={<RequestDetail />} />
      <Route path="/provider/jobs" element={<ProviderJobs />} />
      <Route path="/provider/messages" element={<ProviderMessages />} />
      <Route path="/provider/earnings" element={<ProviderEarnings />} />
      <Route path="/provider/profile" element={<ProviderProfile />} />
      <Route path="/provider/calendar" element={<ProviderCalendar />} />
      <Route path="/customer/dashboard" element={<CustomerDashboard />} />
      <Route path="/customer/request" element={<CreateRequest />} />
      <Route path="/customer/providers" element={<Providers />} />
      <Route
        path="/customer/providers/profile"
        element={<ServiceProviderProfile />}
      />
      <Route path="/customer/profile" element={<Profile />} />
      <Route path="/customer/requests" element={<Requests />} />
      <Route path="/customer/quote" element={<Quote />} />
      <Route path="/customer/payment" element={<Payment />} />
      <Route path="/customer/messages" element={<Messages />} />
      <Route path="/customer/history" element={<History />} />
      <Route path="/customer/request/sent" element={<RequestSent />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/users" element={<UserManagement />} />
      <Route path="/manuscript" element={<DocumentViewer />} />
      <Route path="*" element={<Navigate to="/signin" />} />
    </Routes>
  );
}

export default AppRoutes;
