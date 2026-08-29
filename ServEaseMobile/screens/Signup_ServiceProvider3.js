/**
 * Service provider application - step 3 of 3: verification requirements.
 *
 * Collects the documents needed to verify the provider account (valid ID,
 * selfie verification, optional supporting documents) plus the required
 * agreements, then submits the whole application collected across steps 1
 * and 2.
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. State starts empty and nothing is hardcoded - the submit
 * handler is prepared for the backend integration (see the TODO below,
 * submitProviderApplication() in services/api.js).
 * @format
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from '@react-native-vector-icons/ionicons';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');
const UPLOAD_ICON = require('../assets/icon_uploadbutton.png');
const CHECKBOX_ICON = require('../assets/icon_checkbox.png');

const SignupServiceProvider3Screen = ({ navigation, route }) => {
  // Application data collected in steps 1 and 2.
  const application = route?.params?.application || {};

  const [validId, setValidId] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [supportingDocs, setSupportingDocs] = useState(null);
  const [certified, setCertified] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const handleUpload = setter => () => {
    // TODO: integrate a document/image picker, then store the picked file
    // ({ uri, name, type }) via `setter` and submit it with the application.
    Alert.alert('Coming soon', 'File upload will be available soon.');
  };

  const handleSubmit = () => {
    if (!application.firstName || !application.email) {
      Alert.alert(
        'Missing application details',
        'Please complete the previous application steps first.',
      );
      return;
    }
    // TODO: once the document/image picker is integrated, also require
    // `validId` and `selfie` before submitting - they are the credentials
    // used to verify the provider account.
    if (!certified || !agreedTerms) {
      Alert.alert(
        'Agreements required',
        'Please certify your information and agree to the Terms & Conditions.',
      );
      return;
    }
    // TODO: submit via services/api.js (submitProviderApplication(token,
    // application, { validId, selfie, supportingDocs })) once the backend
    // is integrated. The post-submit flow (verification status screen) is
    // not built yet, so for now the application returns to Login.
    Alert.alert(
      'Application submitted',
      'Your service provider application has been submitted.',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
    );
  };

  const renderUploadBox = (file, onPress, accessibilityLabel, description) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.uploadBox}
    >
      <Image
        source={UPLOAD_ICON}
        style={styles.uploadIcon}
        resizeMode="contain"
      />
      <View style={styles.uploadTextWrapper}>
        <Text style={styles.uploadTitle}>
          {file ? file.name : 'Tap to upload'}
        </Text>
        {file || description ? (
          <Text style={styles.uploadDescription}>
            {file ? 'File attached - tap to replace' : description}
          </Text>
        ) : null}
      </View>
      {file ? (
        <Icon name="checkmark-circle" size={20} color="#00BFA6" />
      ) : null}
    </TouchableOpacity>
  );

  const renderAgreement = (checked, onPress, text) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.agreementRow}
    >
      {checked ? (
        <View style={styles.checkboxChecked}>
          <Icon name="checkmark" size={13} color="#FFFFFF" />
        </View>
      ) : (
        <Image
          source={CHECKBOX_ICON}
          style={styles.checkboxImage}
          resizeMode="contain"
        />
      )}
      <Text style={styles.agreementText}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={LOGO_SOURCE}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="ServEase logo"
          />
          <Text style={styles.title}>Apply as Service Provider</Text>

          <View style={styles.progressRow}>
            {[1, 2, 3].map(step => (
              <View
                key={step}
                style={[
                  styles.progressSegment,
                  step === 3 && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Verification Requirements</Text>

          <Text style={styles.label}>Upload Valid ID</Text>
          {renderUploadBox(
            validId,
            handleUpload(setValidId),
            'Upload Valid ID',
            'Government-issued ID',
          )}

          <Text style={styles.label}>Selfie Verification</Text>
          {renderUploadBox(
            selfie,
            handleUpload(setSelfie),
            'Upload selfie verification',
          )}

          <Text style={styles.label}>Supporting Documents (Optional)</Text>
          {renderUploadBox(
            supportingDocs,
            handleUpload(setSupportingDocs),
            'Upload supporting documents',
          )}

          <Text style={[styles.label, styles.agreementsLabel]}>Agreements</Text>
          {renderAgreement(
            certified,
            () => setCertified(previous => !previous),
            'I certify that all information provided is true and correct.',
          )}
          {renderAgreement(
            agreedTerms,
            () => setAgreedTerms(previous => !previous),
            "I agree to ServEase's Terms & Conditions.",
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Submit application"
            style={styles.submitButtonWrapper}
          >
            <LinearGradient
              colors={['#0F6CD6', '#00BFA6']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E2A6E',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E9EBEF',
  },
  progressSegmentActive: {
    backgroundColor: '#0F6CD6',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E2A6E',
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#7C8499',
    marginBottom: 8,
  },
  agreementsLabel: {
    marginTop: 8,
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C9CDD4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  uploadIcon: {
    width: 26,
    height: 26,
    marginRight: 14,
  },
  uploadTextWrapper: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  uploadDescription: {
    fontSize: 12,
    color: '#A6ADB8',
    marginTop: 2,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  checkboxImage: {
    width: 18,
    height: 18,
  },
  checkboxChecked: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#0F6CD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreementText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 20,
  },
  submitButtonWrapper: {
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 24,
  },
  submitButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SignupServiceProvider3Screen;