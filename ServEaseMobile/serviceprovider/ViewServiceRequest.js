import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const ACTIVE_TAB = 'Requests';

// Bottom tab definitions — identical set/route names to ServiceProviderDashboard.js
// and IncomingServiceRequest.js, with Requests as the active tab since this screen
// is reached from within that flow.
const TAB_ITEMS = [
    { key: 'ServiceProviderDashboard', label: 'Home', activeIcon: require('../assets/icon_home_white.png'), inactiveIcon: require('../assets/icon_home_colored.png') },
    { key: 'Requests', label: 'Requests', activeIcon: require('../assets/icon_tools_white.png'), inactiveIcon: require('../assets/icon_tools_colored.png') },
    { key: 'Jobs', label: 'Jobs', activeIcon: require('../assets/icon_gear_white.png'), inactiveIcon: require('../assets/icon_gear_colored.png') },
    { key: 'Chat', label: 'Chat', activeIcon: require('../assets/icon_chatbubble_white.png'), inactiveIcon: require('../assets/icon_chatbubble_colored.png') },
    { key: 'Earnings', label: 'Earnings', activeIcon: require('../assets/icon_history_white.png'), inactiveIcon: require('../assets/icon_history_colored.png') },
    { key: 'ServiceProviderProfile', label: 'Profile', activeIcon: require('../assets/icon_profile_white.png'), inactiveIcon: require('../assets/icon_profile_colored.png') },
];

// Possible-cause list — hardcoded per the design, backend isn't integrated yet.
const POSSIBLE_CAUSES = ['Dirty air filter', 'Refrigerant leak', 'Compressor issue'];

const ViewServiceRequest = ({ navigation }) => {
    const [showApprovedModal, setShowApprovedModal] = useState(false);
    const [laborCost, setLaborCost] = useState('');
    const [partsCost, setPartsCost] = useState('');
    const [notes, setNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleBack = () => {
        navigation.goBack();
    };

    const handleViewLocation = () => {
        // TODO: open the device's maps app with the customer's coordinates once available
    };

    const handleDecline = () => {
        setShowRejectModal(true);
    };

    const handleAccept = () => {
        setShowApprovedModal(true);
    };

    const handleCloseModal = () => {
        setShowApprovedModal(false);
    };

    const handleCloseRejectModal = () => {
        setShowRejectModal(false);
    };

    const handleSendRejection = () => {
        // TODO: call the decline-request endpoint once it exists, sending rejectReason
        setShowRejectModal(false);
    };

    const handleAddPart = () => {
        // TODO: add another parts line item once multi-part entry is designed
    };

    const handleSendQuote = () => {
        // TODO: call the send-quote endpoint once it exists, sending laborCost/partsCost/notes
        setShowApprovedModal(false);
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

                <Text style={styles.headerTitle}>Service Request</Text>
                <Text style={styles.requestNumber}>Request #SR-0001</Text>

                <Text style={styles.sectionLabel}>Customer Information</Text>
                <View style={styles.customerRow}>
                    <Image source={require('../assets/icon_profile_photo.png')} style={styles.customerAvatar} />
                    <View style={styles.customerInfo}>
                        <Text style={styles.customerName}>Dominic Alcantara</Text>
                        <View style={styles.addressRow}>
                            <Text style={styles.customerAddress}>123 Maple St QC Manila</Text>
                            <TouchableOpacity style={styles.distanceInline} onPress={handleViewLocation}>
                                <Image source={require('../assets/icon_pinloc.png')} style={styles.pinIcon} />
                                <Text style={styles.distanceText}>1.2 km away</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Customer Concern</Text>
                <Text style={styles.concernText}>
                    Customer Narration about the devices problem lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </Text>
                <View style={styles.photoPlaceholder} />

                <Text style={styles.sectionLabel}>AI Diagnosis (Preliminary)</Text>
                <View style={styles.aiBanner}>
                    <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                    <Text style={styles.aiBannerText}>AI suggests capacitor failure (82% confidence)</Text>
                </View>

                <Text style={styles.causesLabel}>Possible causes:</Text>
                {POSSIBLE_CAUSES.map((cause) => (
                    <Text key={cause} style={styles.causeItem}>{cause}</Text>
                ))}

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
                        <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleAccept} activeOpacity={0.85}>
                        <LinearGradient
                            colors={['#0255AF', '#04A5A5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.acceptButton}
                        >
                            <Text style={styles.acceptButtonText}>Accept</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
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

            <Modal
                visible={showApprovedModal}
                transparent
                animationType="fade"
                onRequestClose={handleCloseModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Service Request Approved</Text>
                            <TouchableOpacity onPress={handleCloseModal}>
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Send a pre-repair quotation to the customer.</Text>

                        <View style={styles.costRow}>
                            <View style={styles.costField}>
                                <Text style={styles.inputLabel}>Labor (Peso)</Text>
                                <TextInput
                                    style={styles.costInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#AAAAAA"
                                    keyboardType="decimal-pad"
                                    value={laborCost}
                                    onChangeText={setLaborCost}
                                />
                            </View>
                            <View style={styles.costField}>
                                <Text style={styles.inputLabel}>Parts (Peso)</Text>
                                <TextInput
                                    style={styles.costInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#AAAAAA"
                                    keyboardType="decimal-pad"
                                    value={partsCost}
                                    onChangeText={setPartsCost}
                                />
                            </View>
                            <TouchableOpacity style={styles.addPartButton} onPress={handleAddPart}>
                                <Image source={require('../assets/icon_add_circle.png')} style={styles.addIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Notes</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Parts needed, timeline....."
                            placeholderTextColor="#AAAAAA"
                            multiline
                            numberOfLines={3}
                            value={notes}
                            onChangeText={setNotes}
                        />

                        <TouchableOpacity style={styles.sendQuoteButton} onPress={handleSendQuote}>
                            <Text style={styles.sendQuoteText}>Send Quote</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showRejectModal}
                transparent
                animationType="fade"
                onRequestClose={handleCloseRejectModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Reason for Rejection</Text>
                            <TouchableOpacity onPress={handleCloseRejectModal}>
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>State a proper reason for rejection.</Text>

                        <TextInput
                            style={styles.rejectReasonInput}
                            placeholder="Enter your reason here."
                            placeholderTextColor="#AAAAAA"
                            multiline
                            numberOfLines={4}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                        />

                        <TouchableOpacity style={styles.rejectSendButton} onPress={handleSendRejection}>
                            <Text style={styles.rejectSendButtonText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        marginBottom: 14,
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#444444',
        marginTop: 18,
        marginBottom: 10,
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    customerAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 12,
        backgroundColor: '#E5E5E5',
    },
    customerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    customerName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 3,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    customerAddress: {
        fontSize: 12,
        color: '#666666',
    },
    distanceInline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 6,
    },
    pinIcon: {
        width: 12,
        height: 12,
        resizeMode: 'contain',
        marginRight: 4,
    },
    distanceText: {
        fontSize: 12,
        color: '#0255AF',
        textDecorationLine: 'underline',
    },
    concernText: {
        fontSize: 13,
        color: '#444444',
        lineHeight: 19,
        marginBottom: 14,
    },
    photoPlaceholder: {
        height: 90,
        backgroundColor: '#D9D9D9',
        borderRadius: 8,
    },
    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 25,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    aiIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 8,
    },
    aiBannerText: {
        flex: 1,
        flexShrink: 1,
        fontSize: 12,
        color: '#FFFFFF',
    },
    causesLabel: {
        fontSize: 12,
        color: '#666666',
        marginTop: 16,
        marginBottom: 6,
    },
    causeItem: {
        fontSize: 13,
        fontWeight: '700',
        color: '#222222',
        marginBottom: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 30,
    },
    declineButton: {
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 26,
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    declineButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
    },
    acceptButton: {
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 30,
        alignItems: 'center',
    },
    acceptButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 20,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    modalTitle: {
        flex: 1,
        marginRight: 10,
        fontSize: 17,
        fontWeight: '800',
        color: '#111111',
    },
    modalCloseIcon: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
        marginTop: 2,
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 16,
    },
    costRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    costField: {
        flex: 1,
        marginRight: 10,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#555555',
        marginBottom: 6,
    },
    costInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 10,
        fontSize: 13,
        color: '#111111',
    },
    addPartButton: {
        paddingBottom: 10,
        paddingHorizontal: 2,
    },
    addIcon: {
        width: 26,
        height: 26,
        resizeMode: 'contain',
    },
    notesInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: '#111111',
        minHeight: 70,
        textAlignVertical: 'top',
        marginBottom: 18,
    },
    sendQuoteButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    sendQuoteText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    rejectReasonInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: '#111111',
        minHeight: 90,
        textAlignVertical: 'top',
        marginBottom: 18,
    },
    rejectSendButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    rejectSendButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
});

export default ViewServiceRequest;