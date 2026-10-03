import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const SERVICE_CATEGORIES = [
    'IT-Related Device Repair',
    'Phone Repair',
    'Automotive Services',
    'Home Repair Services',
];

// Only this category triggers the services dropdown.
const HOME_REPAIR_CATEGORY = 'Home Repair Services';

// TODO (backend): replace with the service catalog fetched from the backend
// (e.g. GET /service-catalog?category=Home Repair Services). Keep the labels
// in sync with the values the backend stores.
const HOME_REPAIR_SERVICES = [
    'Plumbing',
    'Carpentry',
    'Electrical',
    'Appliance Repair',
    'General Handyman',
];

const ServiceProviderServiceCategory = ({ navigation, route }) => {
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [homeRepairServices, setHomeRepairServices] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [otherServiceInput, setOtherServiceInput] = useState('');
    const [otherServices, setOtherServices] = useState([]);
    const [yearsOfExperience, setYearsOfExperience] = useState('');
    const [offersHomeServices, setOffersHomeServices] = useState(null); // 'yes' | 'no'

    const isHomeRepairSelected = selectedCategories.includes(HOME_REPAIR_CATEGORY);

    const toggleCategory = (category) => {
        const isSelected = selectedCategories.includes(category);

        setSelectedCategories((prev) =>
            isSelected ? prev.filter((item) => item !== category) : [...prev, category]
        );

        // Unchecking Home Repair removes the dropdown, so clear its selections
        // to make sure they are never sent to the backend.
        if (isSelected && category === HOME_REPAIR_CATEGORY) {
            setHomeRepairServices([]);
            setDropdownOpen(false);
        }
    };

    const toggleHomeRepairService = (service) => {
        setHomeRepairServices((prev) =>
            prev.includes(service) ? prev.filter((item) => item !== service) : [...prev, service]
        );
    };

    const addOtherService = () => {
        const value = otherServiceInput.trim();
        if (!value) return;
        const exists = otherServices.some((item) => item.toLowerCase() === value.toLowerCase());
        if (!exists) {
            setOtherServices((prev) => [...prev, value]);
        }
        setOtherServiceInput('');
    };

    const removeOtherService = (service) => {
        setOtherServices((prev) => prev.filter((item) => item !== service));
    };

    const handleNext = () => {
        // Include any typed-but-not-yet-added "Other Services" text.
        const pending = otherServiceInput.trim();
        const finalOtherServices =
            pending && !otherServices.some((item) => item.toLowerCase() === pending.toLowerCase())
                ? [...otherServices, pending]
                : otherServices;

        // Required-field validation before moving to the next step.
        if (selectedCategories.length === 0) {
            Alert.alert('Service Category Required', 'Please select at least one service category.');
            return;
        }
        if (isHomeRepairSelected && homeRepairServices.length === 0 && finalOtherServices.length === 0) {
            Alert.alert('Services Required', 'Please select the home repair services you provide.');
            return;
        }
        if (!yearsOfExperience.trim()) {
            Alert.alert('Years of Experience Required', 'Please enter your years of experience.');
            return;
        }
        if (offersHomeServices === null) {
            Alert.alert('Home Services Required', 'Please indicate whether you offer home services.');
            return;
        }

        // Payload for the backend. The next screen
        // (ServiceProviderVerificationRequirements) receives this through
        // route.params.serviceCategory and must include it in the request that
        // submits the provider application.
        navigation.navigate('ServiceProviderVerificationRequirements', {
            ...route.params,
            serviceCategory: {
                selectedCategories,
                // Empty array unless Home Repair Services is checked.
                homeRepairServices: isHomeRepairSelected ? homeRepairServices : [],
                otherServices: finalOtherServices,
                yearsOfExperience, // string, as before
                offersHomeServices, // 'yes' | 'no', as before
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
                    <View style={styles.progressSegment} />
                </View>

                <Text style={styles.sectionTitle}>Service Category</Text>

                {SERVICE_CATEGORIES.map((category) =>
                    renderCheckbox(category, category, selectedCategories.includes(category), () => toggleCategory(category))
                )}

                <Text style={styles.subLabel}>WHAT SERVICES DO YOU PROVIDE?</Text>

                {/* Dropdown container: rendered only when Home Repair Services is checked */}
                {isHomeRepairSelected && (
                    <View style={styles.dropdownWrapper}>
                        <TouchableOpacity
                            style={styles.dropdown}
                            activeOpacity={0.8}
                            onPress={() => setDropdownOpen((prev) => !prev)}
                        >
                            <Text
                                style={[
                                    styles.dropdownText,
                                    homeRepairServices.length === 0 && styles.dropdownPlaceholder,
                                ]}
                                numberOfLines={1}
                            >
                                {homeRepairServices.length > 0 ? homeRepairServices.join(', ') : 'Services'}
                            </Text>
                            <Image
                                source={require('../assets/icon_dropdown.png')}
                                style={[styles.dropdownIcon, dropdownOpen && styles.dropdownIconOpen]}
                            />
                        </TouchableOpacity>

                        {dropdownOpen && (
                            <View style={styles.dropdownList}>
                                {HOME_REPAIR_SERVICES.map((service) => {
                                    const checked = homeRepairServices.includes(service);
                                    return (
                                        <TouchableOpacity
                                            key={service}
                                            style={styles.dropdownItem}
                                            onPress={() => toggleHomeRepairService(service)}
                                        >
                                            <Text style={[styles.dropdownItemText, checked && styles.dropdownItemTextActive]}>
                                                {service}
                                            </Text>
                                            {checked && <Text style={styles.dropdownItemCheck}>✓</Text>}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.addRow}>
                    <TextInput
                        style={[styles.input, styles.addInput]}
                        placeholder="Other Services"
                        placeholderTextColor="#B0B0B0"
                        value={otherServiceInput}
                        onChangeText={setOtherServiceInput}
                        onSubmitEditing={addOtherService}
                        returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.addButton} onPress={addOtherService}>
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {otherServices.length > 0 && (
                    <View style={styles.chipsContainer}>
                        {otherServices.map((service) => (
                            <TouchableOpacity
                                key={service}
                                style={styles.chip}
                                onPress={() => removeOtherService(service)}
                            >
                                <Text style={styles.chipText}>{service}</Text>
                                <Text style={styles.chipRemove}>✕</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.field}>
                    <Text style={styles.label}>YEARS OF EXPERIENCE</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor="#B0B0B0"
                        value={yearsOfExperience}
                        onChangeText={(text) => setYearsOfExperience(text.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                    />
                </View>

                <Text style={styles.subLabel}>DO YOU OFFER HOME SERVICES?</Text>
                {renderCheckbox('home-yes', 'Yes', offersHomeServices === 'yes', () => setOffersHomeServices('yes'))}
                {renderCheckbox('home-no', 'No', offersHomeServices === 'no', () => setOffersHomeServices('no'))}

                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
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

    // Dropdown
    dropdownWrapper: {
        marginBottom: 12,
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dropdownText: {
        flex: 1,
        fontSize: 14,
        color: '#333333',
        marginRight: 8,
    },
    dropdownPlaceholder: {
        color: '#B0B0B0',
    },
    dropdownIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    dropdownIconOpen: {
        transform: [{ rotate: '180deg' }],
    },
    dropdownList: {
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        paddingVertical: 6,
        elevation: 3,
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    dropdownItemText: {
        fontSize: 13,
        color: '#333333',
    },
    dropdownItemTextActive: {
        color: '#0255AF',
        fontWeight: '600',
    },
    dropdownItemCheck: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0255AF',
    },

    // Other services + Add button
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addInput: {
        flex: 1,
        marginRight: 10,
    },
    addButton: {
        backgroundColor: '#2F353D',
        borderRadius: 10,
        paddingHorizontal: 22,
        paddingVertical: 13,
        elevation: 2,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F1FB',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    chipText: {
        fontSize: 12,
        color: '#0255AF',
    },
    chipRemove: {
        fontSize: 11,
        color: '#0255AF',
        marginLeft: 8,
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