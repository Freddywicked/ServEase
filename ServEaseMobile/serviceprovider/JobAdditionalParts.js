import React, { useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notifyAdditionalParts } from '../api/providerWork_api';
import LinearGradient from 'react-native-linear-gradient';

// Fonts from the Figma (same convention as IncomingServiceRequest.js).
const FONT_ROBOTO_BOLD = Platform.OS === 'ios' ? { fontFamily: 'Roboto-Bold' } : { fontWeight: '700' };
const FONT_QUICKSAND_MEDIUM = { fontFamily: 'Quicksand-Medium' };


// Notify Additional Parts (Service Provider). Sends the extra cost + note to
// POST /provider/jobs/:id/additional-parts; the customer then answers it from Track
// (Active > Quotations: Approve / Negotiate / Decline).
const JobAdditionalParts = ({ navigation, route }) => {
    const jobId = route?.params?.jobId;

    const [additionalCost, setAdditionalCost] = useState('');
    const [notes, setNotes] = useState('');
    const [sending, setSending] = useState(false);

    const handleBack = () => navigation.goBack();

    // Keep digits and a single decimal point (the keypad can still paste anything).
    const handleCostChange = (text) => {
        const cleaned = text.replace(/[^0-9.]/g, '');
        const [whole, ...rest] = cleaned.split('.');
        setAdditionalCost(rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole);
    };

    const handleSendRequest = async () => {
        if (sending) return;
        const amount = Number(additionalCost);
        if (!additionalCost.trim() || Number.isNaN(amount) || amount <= 0) {
            Alert.alert('Enter the additional cost', 'Please enter an amount greater than zero.');
            return;
        }
        if (!jobId) {
            Alert.alert('Unable to send request', 'This job could not be identified. Go back and try again.');
            return;
        }
        setSending(true);
        try {
            await notifyAdditionalParts(jobId, { additionalCost: amount, notes: notes.trim() });
            Alert.alert('Request sent', 'The customer has been notified about the additional parts.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            Alert.alert('Unable to send request', error?.message || 'Please check your connection and try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Image source={require('../assets/icon_back_button.png')} style={styles.backIcon} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Notify Additional Parts</Text>
                <Text style={styles.subtitle}>Explain the unexpected additional parts to the customer.</Text>

                <Text style={styles.fieldLabel}>Additional Cost (Peso)</Text>
                <TextInput
                    style={styles.costInput}
                    placeholder="0.00"
                    placeholderTextColor="#736E6E"
                    keyboardType="decimal-pad"
                    value={additionalCost}
                    onChangeText={handleCostChange}
                />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                    style={styles.notesInput}
                    placeholder="Parts needed, timeline..."
                    placeholderTextColor="#8B8686"
                    multiline
                    numberOfLines={4}
                    value={notes}
                    onChangeText={setNotes}
                />

                <TouchableOpacity
                    style={[styles.sendButton, sending && styles.buttonDisabled]}
                    onPress={handleSendRequest}
                    disabled={sending}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.gradientButtonText}>Send Request</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16, marginBottom: 4 },
    backIcon: { width: 11, height: 19, resizeMode: 'contain' },
    scrollContent: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 24 },
    headerTitle: { ...FONT_ROBOTO_BOLD, fontSize: 24, lineHeight: 28, color: '#021E79', marginTop: 8, marginBottom: 14 },
    subtitle: { fontSize: 12, lineHeight: 20, fontWeight: '700', color: '#5B5959', marginBottom: 24 },
    fieldLabel: { fontSize: 12, lineHeight: 20, color: '#5B5959', marginBottom: 6 },
    costInput: {
        alignSelf: 'flex-start',
        width: 137,
        height: 36,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 12,
        paddingVertical: 0,
        fontSize: 12,
        color: '#1C1B1B',
        marginBottom: 20,
    },
    notesInput: {
        height: 85,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 12,
        color: '#1C1B1B',
        textAlignVertical: 'top',
        marginBottom: 32,
    },
    sendButton: {
        alignSelf: 'center',
        width: '80%',
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Figma gradient button: the LinearGradient fills it, the label sits on top.
    gradientButtonText: { fontSize: 12, lineHeight: 20, fontWeight: '700', color: '#FFFFFF' },
    buttonDisabled: { opacity: 0.55 },
});

export default JobAdditionalParts;