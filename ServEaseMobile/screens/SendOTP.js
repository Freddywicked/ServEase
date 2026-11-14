import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OTP_CHANNELS, maskPhone, maskEmail } from '../utils/otpChannel';

// Only reachable from SignupScreen, which passes the validated form.
// The contact details shown here (and the one the code is sent to) come from that form.
const SendOTP = ({ navigation, route }) => {
    const form = route.params?.form;
    const hasForm = !!form;

    // Built from the form the user filled in; an option only exists if its contact exists.
    const options = useMemo(() => {
        if (!form) return [];
        const list = [];
        if (form.phone) {
            list.push({
                channel: OTP_CHANNELS.SMS,
                title: 'Text message (SMS)',
                masked: maskPhone(form.phone),
                description: 'Send a 6-digit code via SMS',
                buttonLabel: 'Send code via SMS',
                iconSelected: require('../assets/icon_phone_white.png'),
                iconUnselected: require('../assets/icon_phone_colored.png'),
            });
        }
        if (form.email) {
            list.push({
                channel: OTP_CHANNELS.EMAIL,
                title: 'Email address',
                masked: maskEmail(form.email),
                description: 'Send a 6-digit code via email',
                buttonLabel: 'Send code via email',
                iconSelected: require('../assets/icon_email_white.png'),
                iconUnselected: require('../assets/icon_email_colored.png'),
            });
        }
        return list;
    }, [form]);

    const [selected, setSelected] = useState(route.params?.channel || OTP_CHANNELS.SMS);

    useEffect(() => {
        if (!hasForm) navigation.replace('SignupScreen');
    }, [hasForm, navigation]);

    // Keep the selection valid if the preferred option is not available.
    useEffect(() => {
        if (options.length && !options.some((o) => o.channel === selected)) {
            setSelected(options[0].channel);
        }
    }, [options, selected]);

    if (!hasForm) return null;

    const current = options.find((o) => o.channel === selected);

    const handleSend = () => {
        if (!current) return;
        // OTPVerification sends the code through the backend using the chosen channel.
        navigation.navigate('OTPVerification', {
            fromSignup: true,
            form,
            channel: current.channel,
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
                <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    Create your account
                </Text>
                <Text style={styles.subtitle}>Verify your identity</Text>
                <Text style={styles.helper}>Where should we send your 6-digit security code?</Text>

                {options.map((option) => {
                    const isSelected = option.channel === selected;
                    return (
                        <TouchableOpacity
                            key={option.channel}
                            activeOpacity={0.8}
                            style={[styles.card, isSelected && styles.cardSelected]}
                            onPress={() => setSelected(option.channel)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                        >
                            <View style={[styles.iconBox, isSelected ? styles.iconBoxSelected : styles.iconBoxIdle]}>
                                <Image
                                    source={isSelected ? option.iconSelected : option.iconUnselected}
                                    style={styles.icon}
                                />
                            </View>

                            <View style={styles.textBlock}>
                                <Text style={styles.cardTitle}>{option.title}</Text>
                                <Text style={styles.cardMasked}>{option.masked}</Text>
                                <Text style={styles.cardDescription}>{option.description}</Text>
                            </View>

                            <View style={[styles.radio, isSelected && styles.radioSelected]}>
                                {isSelected ? <View style={styles.radioDot} /> : null}
                            </View>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    style={[styles.button, !current && styles.buttonDisabled]}
                    onPress={handleSend}
                    disabled={!current}
                >
                    <Text style={styles.buttonText}>{current ? current.buttonLabel : 'Send code'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    container: { paddingHorizontal: 36, paddingBottom: 40 },

    logo: { width: 198, height: 198, resizeMode: 'contain', alignSelf: 'center' },
    title: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: '#021E79', textAlign: 'center', alignSelf: 'stretch', marginTop: -19 },
    subtitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', color: '#292727', marginTop: 25 },
    helper: { fontSize: 12, lineHeight: 14, color: '#626262', marginTop: 13, marginBottom: 33 },

    card: {
        width: '100%',
        height: 87,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#C4C4C4',
        backgroundColor: '#FFFFFF',
        marginBottom: 23,
    },
    cardSelected: { backgroundColor: '#E6EBF9', borderColor: '#021E79' },

    iconBox: {
        position: 'absolute',
        left: 13,
        top: 11,
        width: 35,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBoxSelected: { backgroundColor: '#021E79' },
    iconBoxIdle: { backgroundColor: '#D9D9D9' },
    icon: { width: 23, height: 23, resizeMode: 'contain' },

    textBlock: { position: 'absolute', left: 56, top: 16, right: 56 },
    cardTitle: { fontSize: 12, lineHeight: 14, fontWeight: '700', letterSpacing: 0.24, color: '#000000' },
    cardMasked: { fontSize: 12, lineHeight: 14, fontWeight: '700', letterSpacing: 0.24, color: '#3F3F3F', marginTop: 3 },
    cardDescription: { fontSize: 12, lineHeight: 14, color: '#626262', marginTop: 3 },

    radio: {
        position: 'absolute',
        right: 22,
        top: 12,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: '#C4C4C4',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: { backgroundColor: '#021E79', borderColor: '#021E79' },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },

    button: {
        alignSelf: 'center',
        width: '100%',
        height: 46,
        marginTop: 11,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.3)',
        backgroundColor: '#0255AF', // fallback where the gradient isn't supported
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default SendOTP;