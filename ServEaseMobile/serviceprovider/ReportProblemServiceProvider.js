import React from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ReportProblemServiceProvider = ({ navigation, route }) => {
    // Forward any context (reportedUserId, serviceRequestId, returnTo) to the chosen form.
    const params = route?.params;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.headerTitle}>Report a Problem</Text>
                <Text style={styles.question}>What type of report are you going to submit?</Text>

                <TouchableOpacity
                    style={[styles.card, styles.systemCard]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ReportSystemErrorServiceProvider', params)}
                >
                    <Image source={require('../assets/icon_report_yellow.png')} style={styles.cardIcon} />
                    <Text style={styles.cardLabel}>Report a System Error</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, styles.userCard]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ReportUserServiceProvider', params)}
                >
                    <Image source={require('../assets/icon_report_yellow.png')} style={styles.cardIcon} />
                    <Text style={styles.cardLabel}>Report a User</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const SF = Platform.OS === 'ios' ? undefined : 'SF Pro';

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: {
        paddingLeft: 24,
        paddingRight: 32, // Figma cards are 346 wide on a 402 frame
        paddingTop: 46,
        paddingBottom: 140, // clears the static bottom navbar
    },
    headerTitle: {
        fontFamily: 'Roboto',
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: '#021E79',
    },
    question: {
        marginTop: 19,
        fontFamily: 'Roboto',
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '500',
        color: '#292727',
    },
    card: {
        height: 135,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    systemCard: {
        marginTop: 83,
        backgroundColor: '#3B75B3',
    },
    userCard: {
        marginTop: 42,
        backgroundColor: '#04A5A5',
    },
    cardIcon: {
        position: 'absolute',
        left: 51,
        top: '50%',
        marginTop: -14,
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    cardLabel: {
        fontFamily: SF,
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
});

export default ReportProblemServiceProvider;