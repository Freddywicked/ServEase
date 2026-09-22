import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import SplashScreen from './screens/SplashScreen';
import SignupScreen from './screens/SignupScreen';
import OTPVerification from './screens/OTPVerification';
import LoginScreen from './screens/LoginScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import ServiceProviderPersonalDetails from './screens/ServiceProviderPersonalDetails';
import ServiceProviderServiceCategory from './screens/ServiceProviderServiceCategory';
import ServiceProviderVerificationRequirements from './screens/ServiceProviderVerificationRequirements';
import CustomerDashboard from './screens/CustomerDashboard';
import CreateServiceRequest from './screens/CreateServiceRequest';
import AIDiagnosis from './screens/AIDiagnosis';
import AIResult from './screens/AIResult';
import RecommendServiceProvider from './screens/RecommendServiceProvider';
import SubmitServiceRequest from './screens/SubmitServiceRequest';
import FindServiceProvider from './screens/FindServiceProvider';
import Track from './screens/Track';
import Payment from './screens/Payment';
import Ratings from './screens/Ratings';
import RequestDetails from './screens/RequestDetails';
import MessageCustomer from './screens/MessageCustomer';
import ConversationCustomer from './screens/ConversationCustomer';
import History from './screens/History';
import CustomerProfile from './screens/CustomerProfile';
import ServiceProviderDashboard from './screens/ServiceProviderDashboard';
import IncomingServiceRequest from './screens/IncomingServiceRequest';
import Jobs from './screens/Jobs';
import JobUpdateStatus from './screens/JobUpdateStatus';
import JobAdditionalParts from './screens/JobAdditionalParts';
import ViewServiceRequest from './screens/ViewServiceRequest';
import MessageServiceProvider from './screens/MessageServiceProvider';
import ConversationServiceProvider from './screens/ConversationServiceProvider';
import Earnings from './screens/Earnings';
import ServiceProviderProfile from './screens/ServiceProviderProfile';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SplashScreen" component={SplashScreen}/>
        <Stack.Screen name="SignupScreen" component={SignupScreen}/>
        <Stack.Screen name="OTPVerification" component={OTPVerification}/>
        <Stack.Screen name="LoginScreen" component={LoginScreen}/>
        <Stack.Screen name="RoleSelectionScreen" component={RoleSelectionScreen}/>
        <Stack.Screen name="ServiceProviderPersonalDetails" component={ServiceProviderPersonalDetails}/>
        <Stack.Screen name="ServiceProviderServiceCategory" component={ServiceProviderServiceCategory}/>
        <Stack.Screen name="ServiceProviderVerificationRequirements" component={ServiceProviderVerificationRequirements}/>
        <Stack.Screen name="CustomerDashboard" component={CustomerDashboard}/>
        <Stack.Screen name="CreateServiceRequest" component={CreateServiceRequest}/>
        <Stack.Screen name="AIDiagnosis" component={AIDiagnosis}/>
        <Stack.Screen name="AIResult" component={AIResult}/>
        <Stack.Screen name="FindServiceProvider" component={FindServiceProvider}/>
        <Stack.Screen name="Track" component={Track}/>
        <Stack.Screen name="Payment" component={Payment}/>
        <Stack.Screen name="Ratings" component={Ratings}/>
        <Stack.Screen name="RequestDetails" component={RequestDetails}/>
        <Stack.Screen name="SubmitServiceRequest" component={SubmitServiceRequest}/>
        <Stack.Screen name="RecommendServiceProvider" component={RecommendServiceProvider}/>
        <Stack.Screen name="MessageCustomer" component={MessageCustomer}/>
        <Stack.Screen name="ConversationCustomer" component={ConversationCustomer}/>
        <Stack.Screen name="History" component={History}/>
        <Stack.Screen name="CustomerProfile" component={CustomerProfile}/>
        <Stack.Screen name="ServiceProviderDashboard" component={ServiceProviderDashboard}/>
        <Stack.Screen name="IncomingServiceRequest" component={IncomingServiceRequest}/>
        <Stack.Screen name="Jobs" component={Jobs}/>
        <Stack.Screen name="JobUpdateStatus" component={JobUpdateStatus}/>
        <Stack.Screen name="JobAdditionalParts" component={JobAdditionalParts}/>
        <Stack.Screen name="ViewServiceRequest" component={ViewServiceRequest}/>
        <Stack.Screen name="MessageServiceProvider" component={MessageServiceProvider}/>
        <Stack.Screen name="ConversationServiceProvider" component={ConversationServiceProvider}/>
        <Stack.Screen name="Earnings" component={Earnings}/>
        <Stack.Screen name="ServiceProviderProfile" component={ServiceProviderProfile}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;