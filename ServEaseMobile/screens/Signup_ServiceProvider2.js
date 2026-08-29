/**
 * Service provider application - step 2 of 3: service category.
 *
 * Categories and their services are loaded from the backend
 * (getServiceCategories() in services/api.js) - nothing is hardcoded.
 * The services list only shows services that belong to the categories the
 * user has ticked, plus a free-text "Others (specify)" option.
 *
 * Everything for this screen (markup, behavior and styles) lives in this
 * single file. All inputs are fully controlled state. The selections are
 * passed to the final step and submitted with submitProviderApplication().
 * @format
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from '@react-native-vector-icons/ionicons';
import { getServiceCategories } from '../services/api';

const LOGO_SOURCE = require('../assets/ServEaseLogo.png');
const CHECKBOX_ICON = require('../assets/icon_checkbox.png');

/** Works with either Mongo-style (_id) or plain (id/name) identifiers. */
const getId = item => item?._id || item?.id || item?.name;

const CheckboxRow = ({ checked, onPress, label }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    style={styles.checkboxRow}
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
    <Text style={styles.checkboxLabel}>{label}</Text>
  </TouchableOpacity>
);

const SignupServiceProvider2Screen = ({ navigation, route }) => {
  // Personal details collected in step 1, carried through to the submit.
  const personalDetails = route?.params?.personalDetails || {};

  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [otherSpecified, setOtherSpecified] = useState(false);
  const [otherServices, setOtherServices] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [offersHomeService, setOffersHomeService] = useState(null);

  useEffect(() => {
    let isMounted = true;
    // Categories (with their services) come from the backend. Until it is
    // integrated the list simply stays empty - nothing is hardcoded.
    getServiceCategories()
      .then(data => {
        if (!isMounted) {
          return;
        }
        const list = Array.isArray(data) ? data : data?.categories;
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        // Backend not integrated yet - leave the list empty.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleCategory = category => {
    const id = getId(category);
    if (selectedCategories.includes(id)) {
      // Deselecting a category also drops its services from the selection.
      const removedServiceIds = (category.services || []).map(getId);
      setSelectedServices(previous =>
        previous.filter(serviceId => !removedServiceIds.includes(serviceId)),
      );
      setSelectedCategories(previous =>
        previous.filter(categoryId => categoryId !== id),
      );
    } else {
      setSelectedCategories(previous => [...previous, id]);
    }
  };

  const toggleService = service => {
    const id = getId(service);
    setSelectedServices(previous =>
      previous.includes(id)
        ? previous.filter(serviceId => serviceId !== id)
        : [...previous, id],
    );
  };

  // Only services of the ticked categories are offered for selection.
  const availableServices = categories
    .filter(category => selectedCategories.includes(getId(category)))
    .flatMap(category => category.services || []);

  const handleNext = () => {
    if (selectedCategories.length === 0) {
      Alert.alert(
        'No category selected',
        'Please select at least one service category.',
      );
      return;
    }
    if (
      selectedServices.length === 0 &&
      !(otherSpecified && otherServices.trim())
    ) {
      Alert.alert(
        'No services selected',
        'Please select the services you provide or specify others.',
      );
      return;
    }
    if (otherSpecified && !otherServices.trim()) {
      Alert.alert(
        'Missing details',
        'Please specify the other services you provide.',
      );
      return;
    }
    if (!yearsExperience.trim()) {
      Alert.alert('Missing details', 'Please enter your years of experience.');
      return;
    }
    if (!offersHomeService) {
      Alert.alert(
        'Missing details',
        'Please indicate whether you offer home services.',
      );
      return;
    }
    // TODO: selections are validated against the backend once integrated.
    // Everything is submitted with submitProviderApplication()
    // (services/api.js) at the final step.
    navigation.navigate('Signup_ServiceProvider3', {
      application: {
        ...personalDetails,
        categories: selectedCategories,
        services: selectedServices,
        otherServices: otherSpecified ? otherServices.trim() : '',
        yearsExperience: yearsExperience.trim(),
        offersHomeService,
      },
    });
  };

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
                  step === 2 && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Service Category</Text>

          {categories.map(category => (
            <CheckboxRow
              key={getId(category)}
              checked={selectedCategories.includes(getId(category))}
              onPress={() => toggleCategory(category)}
              label={category.name}
            />
          ))}
          {categories.length === 0 ? (
            <Text style={styles.helperText}>
              Service categories will appear here once loaded from the
              backend.
            </Text>
          ) : null}

          <Text style={[styles.label, styles.groupLabel]}>
            What services do you provide?
          </Text>
          {availableServices.map(service => (
            <CheckboxRow
              key={getId(service)}
              checked={selectedServices.includes(getId(service))}
              onPress={() => toggleService(service)}
              label={service.name}
            />
          ))}
          {categories.length > 0 && selectedCategories.length === 0 ? (
            <Text style={styles.helperText}>
              Select a category above to see its services.
            </Text>
          ) : null}

          <CheckboxRow
            checked={otherSpecified}
            onPress={() => setOtherSpecified(previous => !previous)}
            label="Others (specify)"
          />
          <View
            style={[
              styles.inputRow,
              !otherSpecified && styles.inputRowDisabled,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Services"
              placeholderTextColor="#A6ADB8"
              value={otherServices}
              onChangeText={setOtherServices}
              editable={otherSpecified}
            />
          </View>

          <Text style={styles.label}>Years of Experience</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#A6ADB8"
              keyboardType="number-pad"
              value={yearsExperience}
              onChangeText={setYearsExperience}
            />
          </View>

          <Text style={styles.label}>Do you offer home services?</Text>
          <CheckboxRow
            checked={offersHomeService === 'yes'}
            onPress={() => setOffersHomeService('yes')}
            label="Yes"
          />
          <CheckboxRow
            checked={offersHomeService === 'no'}
            onPress={() => setOffersHomeService('no')}
            label="No"
          />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={styles.nextButtonWrapper}
          >
            <LinearGradient
              colors={['#0F6CD6', '#00BFA6']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
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
  groupLabel: {
    marginTop: 8,
  },
  checkboxRow: {
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
  checkboxLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#7C8499',
    lineHeight: 18,
  },
  helperText: {
    fontSize: 13,
    color: '#A6ADB8',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#C9CDD4',
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  inputRowDisabled: {
    backgroundColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontSize: 14,
    color: '#1F2937',
  },
  nextButtonWrapper: {
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 24,
  },
  nextButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SignupServiceProvider2Screen;