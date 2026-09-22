import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
 
const RoleSelectionScreen = ({ navigation }) => {
    const handleSelectCustomer = () => {
        // TODO: point this to the actual customer home/dashboard screen name
        navigation.navigate('CustomerHome');
    };
 
    const handleSelectServiceProvider = () => {
        // TODO: point this to the first step of the Service Provider application
        navigation.navigate('ServiceProviderPersonalDetails');
    };
 
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image source={require('../assets/logo_servease.png')} style={styles.logo} />
 
                <Text style={styles.title}>Continue as</Text>
 
                <TouchableOpacity style={styles.roleButton} onPress={() => navigation.navigate('CustomerDashboard')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.roleButtonGradient}
                    >
                        <Text style={styles.roleButtonText}>Customer</Text>
                    </LinearGradient>
                </TouchableOpacity>
 
                <TouchableOpacity style={styles.roleButton} onPress={() => navigation.navigate('ServiceProviderPersonalDetails')}>
                    <LinearGradient
                        colors={['#0255AF', '#04A5A5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.roleButtonGradient}
                    >
                        <Text style={styles.roleButtonText}>Service Provider</Text>
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
    container: {
        flex: 1,
        paddingHorizontal: 28,
    },
    logo: {
        width: 90,
        height: 90,
        resizeMode: 'contain',
        alignSelf: 'center',
        marginTop: 60,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1B2A8C',
        textAlign: 'center',
        marginTop: 70,
        marginBottom: 28,
    },
    roleButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    roleButtonGradient: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    roleButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
 
export default RoleSelectionScreen;
 