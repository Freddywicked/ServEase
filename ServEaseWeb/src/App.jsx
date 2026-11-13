import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SendOTP from './pages/SendOTP'
import VerifyOTP from './pages/OTPVerification'
import CompleteProfile from './pages/CompleteProfile'
import ForgotPassword from './pages/ForgotPassword'
import OTPForgotPassword from './pages/OTPForgotPassword'
import NewPassword from './pages/NewPassword'
import ServiceCategory from './serviceprovider/ServiceCategory'
import VerificationRequirements from './serviceprovider/VerificationRequirements'
import AdminDashboard from './admin/AdminDashboard'
import UserManagement from './admin/UserManagement'
import CustomerDashboard from './customer/CustomerDashboard'
import CustomerProfile from './customer/CustomerProfile'
import CustomerEditProfile from './customer/CustomerEditProfile'
import CreateServiceRequest from './customer/CreateServiceRequest'
import AIDiagnosis_Skip from './customer/AIDiagnosis_Skip'
import AIResult from './customer/AIResult'
import RecommendServiceProvider from './customer/RecommendServiceProvider'
import SubmitServiceRequest from './customer/SubmitServiceRequest'
import TrackRequest from './customer/TrackRequest'
import MyRequestDetails from './customer/MyRequestDetails'
import Payment from './customer/Payment'
import Rating from './customer/Rating'
import History from './customer/History'
import FindServiceProvider from './customer/FindServiceProvider'
import ServiceProviderDetails from './customer/ServiceProviderDetails'
import ServiceProviderDashboard from './serviceprovider/ServiceProviderDashboard'
import IncomingServiceRequest from './serviceprovider/IncomingServiceRequest'
import ServiceRequestDetails from './serviceprovider/ServiceRequestDetails'
import ActiveJobs from './serviceprovider/ActiveJobs'
import Earnings from './serviceprovider/Earnings'
import ServiceProviderProfile from './serviceprovider/ServiceProviderProfile'

function App() {
  return (
    
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* Signup -> choose where to receive the OTP (SMS / email) -> verify the code */}
        <Route path="/send-otp" element={<SendOTP />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        {/* First-time Google sign-ins land here to add + verify their phone number */}
        <Route path="/complete-profile" element={<CompleteProfile />} />
        {/* Forgot password flow: request code -> verify code -> set new password */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-password/verify" element={<OTPForgotPassword />} />
        <Route path="/forgot-password/new-password" element={<NewPassword />} />


        {/* Admin */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        {/* TODO: add more admin routes here as they're built */}

        {/* Customer */}
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/customer/requests/new" element={<CreateServiceRequest />} />
        <Route path="/customer/requests/new/diagnosis" element={<AIDiagnosis_Skip />} />
        <Route path="/customer/requests/new/ai-result" element={<AIResult />} />
        <Route path="/customer/requests/new/recommend-providers" element={<RecommendServiceProvider />} />
        <Route path="/customer/requests/new/request-submitted" element={<SubmitServiceRequest />} />
        {/* Same screens under the paths CustomerSidebar already treats as part of the create-request flow */}
        <Route path="/customer/recommended-providers" element={<RecommendServiceProvider />} />
        <Route path="/customer/request-submitted" element={<SubmitServiceRequest />} />
        <Route path="/customer/requests" element={<TrackRequest />} />
        <Route path="/customer/requests/:requestId" element={<MyRequestDetails />} />
        <Route path="/customer/requests/:requestId/payment" element={<Payment />} />
        <Route path="/customer/requests/:requestId/review" element={<Rating />} />
        <Route path="/customer/history" element={<History />} />
        <Route path="/customer/providers" element={<FindServiceProvider />} />
        <Route path="/customer/providers/:providerId" element={<ServiceProviderDetails />} />
        {/* Customer Profile Routes */}
        <Route path="/customer/profile" element={<CustomerProfile />} />
        <Route path="/customer/profile/edit" element={<CustomerEditProfile />} />

        {/* Service Provider */}
        <Route path="/serviceprovider/service-category" element={<ServiceCategory />} />
        <Route path="/serviceprovider/service-category/verification-requirements" element={<VerificationRequirements />} />
        <Route path="/serviceprovider/dashboard" element={<ServiceProviderDashboard />} />
        <Route path="/serviceprovider/requests" element={<IncomingServiceRequest />} />
        <Route path="/serviceprovider/requests/:requestId" element={<ServiceRequestDetails />} />
        <Route path="/serviceprovider/jobs" element={<ActiveJobs />} />
        <Route path="/serviceprovider/earnings" element={<Earnings />} />
        {/* Opened from the ServiceProviderSidebar account dropdown (name + email) */}
        <Route path="/serviceprovider/profile" element={<ServiceProviderProfile />} />
      </Routes>
    </BrowserRouter>
    
  )
}

export default App