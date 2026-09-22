import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const SERVICE_CATEGORIES = [
    'IT-Related Device Repair',
    'Phone Repair',
    'Automotive Services',
    'Home Repair Services',
];

// Placeholder sub-service options — these should be populated dynamically
// based on the category(ies) selected above once the service catalog is
// available from the backend.
const SUB_SERVICE_PLACEHOLDERS = [
    'Service category related services based on clicked above',
    'Service category related services based on clicked above',
    'Service category related services based on clicked above',
];

const ServiceProviderServiceCategory = ({ navigation, route }) => {
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedSubServices, setSelectedSubServices] = useState([]);
    const [othersSelected, setOthersSelected] = useState(false);
    const [otherService, setOtherService] = useState('');
    const [yearsOfExperience, setYearsOfExperience] = useState('');
    const [offersHomeServices, setOffersHomeServices] = useState(null); // 'yes' | 'no'

    const toggleCategory = (category) => {
        setSelectedCategories((prev) =>
            prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
        );
    };

    const toggleSubService = (index) => {
        setSelectedSubServices((prev) =>
            prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
        );
    };

    const handleNext = () => {
        // TODO: validate service category selections before moving to the next step
        navigation.navigate('ServiceProviderVerification', {
            ...route.params,
            serviceCategory: {
                selectedCategories,
                selectedSubServices,
                othersSelected,
                otherService,
                yearsOfExperience,
                offersHomeServices,
            },
        });
    };

    const renderCheckbox = (key, label, checked, onToggle) => (
        <TouchableOpacity key={key} style={styles.checkboxRow} onPress={onToggle}>
            <View style={styles.checkboxBox}>
                <Image source={require('../assets/icon_checkbox.png')} style={styles.checkboxIcon} />
                {checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
        </TouchableOpacity>
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
                    <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                    <View style={styles.progressSegment} />
                </View>

                <Text style={styles.sectionTitle}>Service Category</Text>

                {SERVICE_CATEGORIES.map((category) =>
                    renderCheckbox(category, category, selectedCategories.includes(category), () => toggleCategory(category))
                )}

                <Text style={styles.subLabel}>WHAT SERVICES DO YOU PROVIDE?</Text>

                {SUB_SERVICE_PLACEHOLDERS.map((label, index) =>
                    renderCheckbox(`sub-${index}`, label, selectedSubServices.includes(index), () => toggleSubService(index))
                )}

                {renderCheckbox('others', 'Others (specify)', othersSelected, () => setOthersSelected((prev) => !prev))}

                <TextInput
                    style={styles.input}
                    placeholder="Services"
                    placeholderTextColor="#B0B0B0"
                    value={otherService}
                    onChangeText={setOtherService}
                />

                <View style={styles.field}>
                    <Text style={styles.label}>YEARS OF EXPERIENCE</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#B0B0B0"
                        value={yearsOfExperience}
                        onChangeText={setYearsOfExperience}
                        keyboardType="number-pad"
                    />
                </View>

                <Text style={styles.subLabel}>DO YOU OFFER HOME SERVICES?</Text>
                {renderCheckbox('home-yes', 'Yes', offersHomeServices === 'yes', () => setOffersHomeServices('yes'))}
                {renderCheckbox('home-no', 'No', offersHomeServices === 'no', () => setOffersHomeServices('no'))}

                <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('ServiceProviderVerificationRequirements')}>
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
    subLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#555555',
        letterSpacing: 1,
        marginTop: 12,
        marginBottom: 10,
    },
    field: {
        marginTop: 14,
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
        marginTop: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    checkboxIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    checkmark: {
        position: 'absolute',
        fontSize: 13,
        fontWeight: '700',
        color: '#0255AF',
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 13,
        color: '#333333',
    },
    nextButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 16,
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

export default ServiceProviderServiceCategory;