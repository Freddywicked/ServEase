import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyOTP from './pages/OTPVerification'
import RoleSelection from './pages/RoleSelection'
import ServiceCategory from './serviceprovider/ServiceCategory'
import VerificationRequirements from './serviceprovider/VerificationRequirements'
import AdminDashboard from './admin/AdminDashboard'
import UserManagement from './admin/UserManagement'
import CustomerDashboard from './customer/CustomerDashboard'
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
import ServiceProviderDashboard from './serviceprovider/ServiceProviderDashboard'
import IncomingServiceRequest from './serviceprovider/IncomingServiceRequest'
import ServiceRequestDetails from './serviceprovider/ServiceRequestDetails'

function App() {
  return (
    
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/role-selection" element={<RoleSelection />} />
        

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
        {/* TODO: add more customer routes here as they're built, e.g. /customer/providers */}

        {/* Service Provider */}
        <Route path="/serviceprovider/service-category" element={<ServiceCategory />} />
        <Route path="/serviceprovider/service-category/verification-requirements" element={<VerificationRequirements />} />
        <Route path="/serviceprovider/dashboard" element={<ServiceProviderDashboard />} />
        <Route path="/serviceprovider/requests" element={<IncomingServiceRequest />} />
        <Route path="/serviceprovider/requests/:requestId" element={<ServiceRequestDetails />} />
        {/* TODO: import and add more service provider routes here as they're built, e.g. /serviceprovider/jobs, /serviceprovider/messages, /serviceprovider/earnings */}
      </Routes>
    </BrowserRouter>
    
  )
}

export default App