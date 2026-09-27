import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TAB = 'Jobs';

// Bottom tab definitions — identical set/route names to Job.js.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'Requests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Placeholder stage list for the dropdown — the design only shows "Repairing"
// as the current value, so this is a reasonable stand-in set. Swap it for the
// real list of job stages once the backend defines one.
const STAGE_OPTIONS = ['Assessing', 'Repairing', 'Testing', 'Completed'];

const JobUpdateStatus = ({ navigation }) => {
    const [currentStage, setCurrentStage] = useState('Repairing');
    const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
    const [notes, setNotes] = useState('');

    const handleBack = () => {
        navigation.goBack();
    };

    const handleToggleStageMenu = () => {
        setIsStageMenuOpen((prev) => !prev);
    };

    const handleSelectStage = (stage) => {
        setCurrentStage(stage);
        setIsStageMenuOpen(false);
    };

    const handleUploadImage = () => {
        // TODO: wire up an image picker package (e.g. react-native-image-picker) once one is approved/installed
    };

    const handlePushUpdate = () => {
        // TODO: call the update-job-status endpoint once it exists, sending currentStage/notes/photo
    };

    const handleTabPress = (tabKey) => {
        if (tabKey === ACTIVE_TAB) return;
        // TODO: confirm these screen names once the rest of the tabs are built
        navigation.navigate(tabKey);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Update Status</Text>

                <Text style={styles.fieldLabel}>Current stage</Text>
                <TouchableOpacity style={styles.dropdownField} onPress={handleToggleStageMenu} activeOpacity={0.8}>
                    <Text style={styles.dropdownValueText}>{currentStage}</Text>
                    <Image
                        source={require('../assets/icon_dropdown.png')}
                        style={[styles.dropdownIcon, isStageMenuOpen && styles.dropdownIconOpen]}
                    />
                </TouchableOpacity>
                {isStageMenuOpen ? (
                    <View style={styles.dropdownMenu}>
                        {STAGE_OPTIONS.map((stage) => (
                            <TouchableOpacity
                                key={stage}
                                style={styles.dropdownOption}
                                onPress={() => handleSelectStage(stage)}
                            >
                                <Text style={styles.dropdownOptionText}>{stage}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : null}

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                    style={styles.notesInput}
                    placeholder="Timeline, update, etc..."
                    placeholderTextColor="#AAAAAA"
                    multiline
                    numberOfLines={4}
                    value={notes}
                    onChangeText={setNotes}
                />

                <TouchableOpacity style={styles.uploadBox} onPress={handleUploadImage} activeOpacity={0.8}>
                    <Image source={require('../assets/icon_image.png')} style={styles.uploadIcon} />
                    <Text style={styles.uploadText}>Upload Image</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.pushUpdateButton} onPress={handlePushUpdate}>
                    <Text style={styles.pushUpdateText}>Push Update</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.tabBar}>
                {TAB_ITEMS.map((tab) => {
                    const isActive = tab.key === ACTIVE_TAB;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => handleTabPress(tab.key)}
                        >
                            <View style={isActive ? styles.tabItemActive : styles.tabItemInactive}>
                                <Image
                                    source={isActive ? tab.activeIcon : tab.inactiveIcon}
                                    style={styles.tabIcon}
                                />
                                <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}>
                                    {tab.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
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
    backButton: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    backArrow: {
        fontSize: 30,
        color: '#111111',
        fontWeight: '400',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 12,
        color: '#555555',
        marginBottom: 8,
    },
    dropdownField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        alignSelf: 'flex-start',
        minWidth: 150,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
    },
    dropdownValueText: {
        fontSize: 14,
        color: '#111111',
    },
    dropdownIcon: {
        width: 12,
        height: 12,
        resizeMode: 'contain',
    },
    dropdownIconOpen: {
        transform: [{ rotate: '180deg' }],
    },
    dropdownMenu: {
        alignSelf: 'flex-start',
        minWidth: 150,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
    },
    dropdownOption: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    dropdownOptionText: {
        fontSize: 14,
        color: '#333333',
    },
    notesInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
        color: '#111111',
        minHeight: 90,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    uploadBox: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 10,
        paddingVertical: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    uploadIcon: {
        width: 36,
        height: 36,
        resizeMode: 'contain',
        marginBottom: 8,
    },
    uploadText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#555555',
    },
    pushUpdateButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    pushUpdateText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
    },
    tabItemInactive: {
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    tabItemActive: {
        alignItems: 'center',
        backgroundColor: '#0255AF',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginHorizontal: 4,
    },
    tabIcon: {
        width: 22,
        height: 22,
        resizeMode: 'contain',
        marginBottom: 2,
    },
    tabLabel: {
        fontSize: 11,
        color: '#555555',
    },
    tabLabelActive: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default JobUpdateStatus;