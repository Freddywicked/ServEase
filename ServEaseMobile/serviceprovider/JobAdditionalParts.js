import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notifyAdditionalParts } from '../api/providerWork_api';

const JobAdditionalParts = ({ navigation, route }) => {
    const jobId = route?.params?.jobId;

    const [additionalCost, setAdditionalCost] = useState('');
    const [notes, setNotes] = useState('');
    const [sending, setSending] = useState(false);

    const handleBack = () => {
        navigation.goBack();
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
            Alert.alert('Unable to send request', 'Please check your connection and try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Notify Additional Parts</Text>
                <Text style={styles.subtitle}>Explain the unexpected additional parts to the customer.</Text>

                <Text style={styles.fieldLabel}>Additional Cost (Peso)</Text>
                <TextInput
                    style={styles.costInput}
                    placeholder="0.00"
                    placeholderTextColor="#AAAAAA"
                    keyboardType="decimal-pad"
                    value={additionalCost}
                    onChangeText={setAdditionalCost}
                />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                    style={styles.notesInput}
                    placeholder="Parts needed, timeline..."
                    placeholderTextColor="#AAAAAA"
                    multiline
                    numberOfLines={4}
                    value={notes}
                    onChangeText={setNotes}
                />

                <TouchableOpacity
                    style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                    onPress={handleSendRequest}
                    disabled={sending}
                >
                    {sending ? (
                        <ActivityIndicator color="#111111" />
                    ) : (
                        <Text style={styles.sendButtonText}>Send Request</Text>
                    )}
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
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#444444',
        marginBottom: 22,
    },
    fieldLabel: {
        fontSize: 12,
        color: '#555555',
        marginBottom: 8,
    },
    costInput: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 14,
        color: '#111111',
        marginBottom: 20,
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
        marginBottom: 24,
    },
    sendButton: {
        borderWidth: 1,
        borderColor: '#DDDDDD',
        borderRadius: 24,
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    sendButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});

export default JobAdditionalParts;