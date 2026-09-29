import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

// Field definitions drive the form so inputs stay data-driven and easy to
// map to the backend payload once the signup API is integrated.
const INPUT_FIELDS = [
    { key: 'firstName', label: 'FIRST NAME', placeholder: 'Juan', autoCapitalize: 'words' },
    { key: 'middleName', label: 'MIDDLE NAME (OPTIONAL)', placeholder: 'Batumbakal', autoCapitalize: 'words' },
    { key: 'lastName', label: 'LAST NAME', placeholder: 'Batumbakal', autoCapitalize: 'words' },
    { key: 'dateOfBirth', label: 'DATE OF BIRTH', placeholder: 'MM/DD/YYYY', autoCapitalize: 'none' },
    { key: 'gender', label: 'GENDER', placeholder: 'Male', autoCapitalize: 'words' },
    { key: 'email', label: 'EMAIL ADDRESS', placeholder: 'juanluna@gmail.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'phone', label: 'PHONE NUMBER', placeholder: '+63 912 345 6789', keyboardType: 'phone-pad', autoCapitalize: 'none' },
    { key: 'address', label: 'ADDRESS', placeholder: 'Street, Barangay, Municipality, Province', autoCapitalize: 'words' },
];

const INITIAL_FORM = {
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
};

const ServiceProviderPersonalDetails = ({ navigation }) => {
    const [form, setForm] = useState(INITIAL_FORM);

    const updateField = (key, value) => {
        setForm((prevForm) => ({ ...prevForm, [key]: value }));
    };

    const handleNext = () => {
        // TODO: validate personal details before moving to the next step
        navigation.navigate('ServiceProviderServiceCategory', { personalDetails: form });
    };

    const renderField = ({ key, label, placeholder, keyboardType, autoCapitalize }) => (
        <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#B0B0B0"
                value={form[key]}
                onChangeText={(text) => updateField(key, text)}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
            />
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title}>Apply as Service Provider</Text>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                    <View style={styles.progressSegment} />
                    <View style={styles.progressSegment} />
                </View>

                <Text style={styles.sectionTitle}>Personal Details</Text>

                {INPUT_FIELDS.map(renderField)}

                <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('ServiceProviderServiceCategory')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.nextButtonGradient}
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        paddingHorizontal: 28,
        paddingBottom: 40,
    },
    logo: {
        width: 70,
        height: 70,
        resizeMode: 'contain',
        alignSelf: 'center',
        marginTop: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1B2A8C',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    progressContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 3,
    },
    progressSegmentActive: {
        backgroundColor: '#0255AF',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 14,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: '#555555',
        letterSpacing: 1,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#F9F9F9',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
    },
    nextButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
    },
    nextButtonGradient: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ServiceProviderPersonalDetails;