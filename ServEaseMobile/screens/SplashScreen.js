import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';

const SplashScreen = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('SignupScreen')}>
                <View style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>Get Started</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundImage: 'linear-gradient(#00BABA 0%, #0255AF 55%, #04A5A5 100%)',
    },
    logo: {
        width: 220,
        height: 170,
        resizeMode: 'contain',
        position: 'absolute',
        top: '38%',
    },
    button: {
        position: 'absolute',
        bottom: 60,
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        paddingVertical: 15,
        paddingHorizontal: 80,
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
    },
    buttonText: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default SplashScreen;