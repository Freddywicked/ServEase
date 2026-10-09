import React, { useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/auth_context';
import CustomerNavBar from './components/CustomerNavBar';
import SplashScreen from './screens/SplashScreen';
import SignupScreen from './screens/SignupScreen';
import OTPVerification from './screens/OTPVerification';
import LoginScreen from './screens/LoginScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import ServiceProviderServiceCategory from './serviceprovider/ServiceProviderServiceCategory';
import ServiceProviderVerificationRequirements from './serviceprovider/ServiceProviderVerificationRequirements';
import CustomerDashboard from './customer/CustomerDashboard';
import CreateServiceRequest from './customer/CreateServiceRequest';
import AIDiagnosis from './customer/AIDiagnosis';
import AIResult from './customer/AIResult';
import RecommendServiceProvider from './customer/RecommendServiceProvider';
import SubmitServiceRequest from './customer/SubmitServiceRequest';
import FindServiceProvider from './customer/FindServiceProvider';
import ProviderDetails from './customer/ProviderDetails';
import Track from './customer/Track';
import Payment from './customer/Payment';
import Ratings from './customer/Ratings';
import RequestDetails from './customer/RequestDetails';
import MessageCustomer from './customer/MessageCustomer';
import ConversationCustomer from './customer/ConversationCustomer';
import History from './customer/History';
import CustomerProfile from './customer/CustomerProfile';
import ServiceProviderDashboard from './serviceprovider/ServiceProviderDashboard';
import IncomingServiceRequest from './serviceprovider/IncomingServiceRequest';
import Jobs from './serviceprovider/Jobs';
import JobUpdateStatus from './serviceprovider/JobUpdateStatus';
import JobAdditionalParts from './serviceprovider/JobAdditionalParts';
import ViewServiceRequest from './serviceprovider/ViewServiceRequest';
import MessageServiceProvider from './serviceprovider/MessageServiceProvider';
import ConversationServiceProvider from './serviceprovider/ConversationServiceProvider';
import Earnings from './serviceprovider/Earnings';
import ServiceProviderProfile from './serviceprovider/ServiceProviderProfile';

const Stack = createNativeStackNavigator();
// Lets the navbar (rendered outside the stack) navigate and know the focused screen.
const navigationRef = createNavigationContainerRef();

const App = () => {
  const [routeName, setRouteName] = useState();
  const syncRoute = () => setRouteName(navigationRef.getCurrentRoute()?.name);

  return (
    <SafeAreaProvider>
    {/* Dark icons on the white screens. Without this, a phone in dark mode (or a transparent
        status bar) can draw white icons on white, so the clock/battery look missing. */}
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <AuthProvider>
    <NavigationContainer ref={navigationRef} onReady={syncRoute} onStateChange={syncRoute}>
    <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SplashScreen" component={SplashScreen}/>
        <Stack.Screen name="SignupScreen" component={SignupScreen}/>
        <Stack.Screen name="OTPVerification" component={OTPVerification}/>
        <Stack.Screen name="LoginScreen" component={LoginScreen}/>
        <Stack.Screen name="RoleSelectionScreen" component={RoleSelectionScreen}/>
        <Stack.Screen name="ServiceProviderServiceCategory" component={ServiceProviderServiceCategory}/>
        <Stack.Screen name="ServiceProviderVerificationRequirements" component={ServiceProviderVerificationRequirements}/>
        <Stack.Screen name="CustomerDashboard" component={CustomerDashboard}/>
        <Stack.Screen name="CreateServiceRequest" component={CreateServiceRequest}/>
        <Stack.Screen name="AIDiagnosis" component={AIDiagnosis}/>
        <Stack.Screen name="AIResult" component={AIResult}/>
        <Stack.Screen name="FindServiceProvider" component={FindServiceProvider}/>
        <Stack.Screen name="ProviderDetails" component={ProviderDetails}/>
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
    </View>
    {/* Outside the stack, so it stays put while screens animate */}
    <CustomerNavBar navigationRef={navigationRef} routeName={routeName} />
    </View>
    </NavigationContainer>
    </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;