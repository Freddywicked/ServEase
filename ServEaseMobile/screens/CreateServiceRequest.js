import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const TOTAL_STEPS = 4;
const CURRENT_STEP = 1;

// Hardcoded for now — swap this out for a backend fetch once the categories
// API is integrated.
const CATEGORIES = [
    { key: 'HomeRepair', label: 'Home Repair' },
    { key: 'Automotive', label: 'Automotive' },
    { key: 'ITAndPhoneDeviceRepair', label: 'IT and Phone Device Repair' },
];

const CreateServiceRequest = ({ navigation }) => {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [hoveredCategory, setHoveredCategory] = useState(null);
    const [problemDescription, setProblemDescription] = useState('');
    const [photo, setPhoto] = useState(null);
    const [location, setLocation] = useState(null);

    const handleClose = () => {
        navigation.goBack();
    };

    const handleSelectCategory = (categoryKey) => {
        setSelectedCategory(categoryKey);
    };

    const handleUploadImage = () => {
        // TODO: hook this up to an image picker once the backend/storage is ready
    };

    const handleTurnOnLocation = () => {
        // TODO: request device location permission / fetch coordinates once
        // location services are integrated
    };

    const handleNext = () => {
        // TODO: validate the fields above and navigate to the next step of the
        // service request flow once it exists
        navigation.navigate('CreateServiceRequestStepTwo');
    };

    const renderCategoryButton = (category, containerStyle) => {
        // Gradient on select or hover (hover only fires on platforms/pointers
        // that support it, e.g. web or a trackpad — it's a no-op on touch-only
        // devices), plain white otherwise.
        const isActive = category.key === selectedCategory || category.key === hoveredCategory;

        return (
            <Pressable
                key={category.key}
                style={containerStyle}
                onPress={() => handleSelectCategory(category.key)}
                onHoverIn={() => setHoveredCategory(category.key)}
                onHoverOut={() => setHoveredCategory(null)}
            >
                {isActive ? (
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.categoryButton}
                    >
                        <Text style={styles.categoryButtonTextSelected}>{category.label}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.categoryButton, styles.categoryButtonInactive]}>
                        <Text style={styles.categoryButtonText}>{category.label}</Text>
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>Creating Service Request</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Image source={require('../assets/icon_close.png')} style={styles.closeIcon} />
                    </TouchableOpacity>
                </View>

                <View style={styles.progressBar}>
                    {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                        <Image
                            key={index}
                            source={
                                index < CURRENT_STEP
                                    ? require('../assets/icon_tab_colored.png')
                                    : require('../assets/icon_tab.png')
                            }
                            style={styles.progressSegment}
                            resizeMode="stretch"
                        />
                    ))}
                </View>

                <Text style={styles.questionTitle}>What needs fixing?</Text>
                <Text style={styles.questionSubtitle}>
                    Pick a category and tell us what's going on — the more detail, the better the diagnosis.
                </Text>

                <Text style={styles.sectionLabel}>Category</Text>
                <View style={styles.categoryList}>
                    <View style={styles.categoryRow}>
                        {renderCategoryButton(CATEGORIES[0], styles.categoryHalf)}
                        {renderCategoryButton(CATEGORIES[1], styles.categoryHalf)}
                    </View>
                    {renderCategoryButton(CATEGORIES[2], styles.categoryFull)}
                </View>

                <Text style={styles.sectionLabel}>Describe the Problem</Text>
                <TextInput
                    style={styles.problemInput}
                    placeholder="e.g. Screen cracked"
                    placeholderTextColor="#999999"
                    value={problemDescription}
                    onChangeText={setProblemDescription}
                    multiline
                />

                <Text style={styles.sectionLabel}>Photo (optional)</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={handleUploadImage} activeOpacity={0.85}>
                    {photo ? (
                        <Image source={{ uri: photo }} style={styles.uploadedImage} />
                    ) : (
                        <>
                            <Image source={require('../assets/icon_image.png')} style={styles.uploadIcon} />
                            <Text style={styles.uploadText}>Upload Image</Text>
                        </>
                    )}
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>Location</Text>
                {location ? (
                    <Image source={{ uri: location.mapImageUri }} style={styles.locationImage} />
                ) : (
                    <TouchableOpacity onPress={handleTurnOnLocation}>
                        <Text style={styles.turnOnLocationText}>Turn on location</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('AIDiagnosis')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.nextButton}
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1B2A8C',
    },
    closeButton: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 6,
    },
    closeIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    progressBar: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    progressSegment: {
        flex: 1,
        height: 6,
        marginRight: 6,
        borderRadius: 3,
    },
    questionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1B2A8C',
        marginBottom: 6,
    },
    questionSubtitle: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 18,
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 10,
    },
    categoryList: {
        marginBottom: 20,
    },
    categoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    categoryHalf: {
        width: '48%',
    },
    categoryFull: {
        width: '100%',
    },
    categoryButton: {
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryButtonInactive: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DDDDDD',
    },
    categoryButtonText: {
        fontSize: 15,
        color: '#333333',
        fontWeight: '700',
        textAlign: 'center',
    },
    categoryButtonTextSelected: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
    },
    problemInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 14,
        fontSize: 14,
        color: '#333333',
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    uploadBox: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        minHeight: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    uploadIcon: {
        width: 32,
        height: 32,
        resizeMode: 'contain',
        marginBottom: 8,
    },
    uploadText: {
        fontSize: 13,
        color: '#666666',
    },
    uploadedImage: {
        width: '100%',
        height: 140,
        borderRadius: 10,
        resizeMode: 'cover',
    },
    locationImage: {
        width: '100%',
        height: 110,
        borderRadius: 10,
        resizeMode: 'cover',
    },
    turnOnLocationText: {
        fontSize: 14,
        color: '#0255AF',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    footer: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
    },
    nextButton: {
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default CreateServiceRequest;