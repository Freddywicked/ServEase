import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Linking,
    Alert,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getRepairDetails } from '../api/servicerequest_api';
import { formatDateTime } from '../utils/formatters';

/* ============================================================================
 * RepairDetails (Customer app) — expanded tracking of ONE request
 * ----------------------------------------------------------------------------
 * Opened from the "View" button on a Track > Active > On-going card
 * (navigate('RepairDetails', { requestId })).
 *
 * Everything comes from GET /service-requests/:id/repair-details:
 *   steps  -> the request's own step list (shop-based or home-based), each with `done` + time
 *   updates under a step -> what the service provider pushed from JobUpdateStatus:
 *                           the note, up to 4 photos and 1 video
 * No step, text, photo or time is hard-coded here. The only sentence this screen writes itself is
 * "The repair status was updated at <time>." for an update that came without a note.
 * ========================================================================== */

// Fonts from the Figma (same convention as IncomingServiceRequest.js).
const FONT_ROBOTO_BOLD = Platform.OS === 'ios' ? { fontFamily: 'Roboto-Bold' } : { fontWeight: '700' };
const FONT_QUICKSAND_MEDIUM = { fontFamily: 'Quicksand-Medium' };

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const MAX_TILES = 4;
const TILE_WIDTH = 70;
const TILE_HEIGHT = 90;

// "June 24, 2026, 9:12 AM"
const formatLongDateTime = (iso) => {
    const date = new Date(iso);
    if (!iso || Number.isNaN(date.getTime())) return '';
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const RepairDetails = ({ navigation, route }) => {
    const requestId = route?.params?.requestId ?? route?.params?.requestNumber;

    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [viewer, setViewer] = useState(null); // { images: [url], index }

    const load = useCallback(async () => {
        if (!requestId) {
            setLoadFailed(true);
            return;
        }
        try {
            setDetails(await getRepairDetails(requestId));
            setLoadFailed(false);
        } catch (error) {
            setLoadFailed(true);
        }
    }, [requestId]);

    // Reload whenever the screen regains focus so new provider updates show up.
    useFocusEffect(
        useCallback(() => {
            load().finally(() => setLoading(false));
        }, [load]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleBack = () => navigation.goBack();

    const handleOpenMedia = (media, item) => {
        if (item.type === 'video') {
            Linking.openURL(item.url).catch(() => Alert.alert('Unable to play video', 'Please try again later.'));
            return;
        }
        const images = media.filter((m) => m.type === 'image').map((m) => m.url);
        setViewer({ images, index: Math.max(images.indexOf(item.url), 0) });
    };

    // ----- pieces -----
    const renderMediaStrip = (media) => {
        const shown = media.slice(0, MAX_TILES);
        const extra = media.length - MAX_TILES;
        return (
            <View style={styles.mediaRow}>
                {shown.map((item, index) => {
                    const isLast = index === shown.length - 1;
                    return (
                        <TouchableOpacity
                            key={`${item.url}-${index}`}
                            style={[styles.mediaTile, index < shown.length - 1 && styles.mediaTileSpacing]}
                            onPress={() => handleOpenMedia(media, item)}
                            activeOpacity={0.85}
                        >
                            {item.type === 'video' ? (
                                <View style={styles.videoTile}>
                                    <View style={styles.playTriangle} />
                                </View>
                            ) : (
                                <Image source={{ uri: item.url }} style={styles.mediaImage} />
                            )}
                            {isLast && extra > 0 ? (
                                <View style={styles.moreOverlay}>
                                    <Text style={styles.moreText}>+{extra}</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderUpdate = (update) => {
        const hasMedia = update.media && update.media.length > 0;
        const text = update.note || `The repair status was updated at ${formatLongDateTime(update.createdAt)}.`;
        return (
            <View key={update.id} style={styles.updateBlock}>
                {update.note || hasMedia ? <Text style={styles.noteTitle}>Service Provider’s Note</Text> : null}
                <Text style={styles.noteText}>{text}</Text>
                {hasMedia ? renderMediaStrip(update.media) : null}
            </View>
        );
    };

    const renderStep = (step, index, steps) => {
        const isLast = index === steps.length - 1;
        return (
            <View key={step.key} style={styles.stepRow}>
                <View style={styles.railColumn}>
                    <View style={[styles.stepCircle, step.done ? styles.stepCircleDone : styles.stepCirclePending]}>
                        {step.done ? <View style={styles.check} /> : null}
                    </View>
                    {!isLast ? <View style={styles.railLine} /> : null}
                </View>
                <View style={[styles.stepBody, isLast && styles.stepBodyLast]}>
                    <Text style={[styles.stepLabel, !step.done && styles.stepLabelPending]}>{step.label}</Text>
                    {step.done && step.timestamp ? (
                        <Text style={styles.stepTime}>{formatDateTime(step.timestamp)}</Text>
                    ) : null}
                    {step.updates.map(renderUpdate)}
                </View>
            </View>
        );
    };

    const renderBody = () => {
        if (loading) return <ActivityIndicator style={styles.loader} color="#0255AF" />;
        if (loadFailed && !details) {
            return (
                <TouchableOpacity style={styles.errorBanner} onPress={load}>
                    <Text style={styles.errorBannerText}>Couldn’t load the repair details. Tap to retry.</Text>
                </TouchableOpacity>
            );
        }
        if (!details) return null;
        return (
            <>
                <View style={styles.requestHeader}>
                    <View style={styles.requestHeaderText}>
                        <Text style={styles.requestNumber}>Request #{details.requestNumber}</Text>
                        <Text style={styles.providerName}>{details.providerName}</Text>
                    </View>
                    {details.statusLabel ? (
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>{details.statusLabel}</Text>
                        </View>
                    ) : null}
                </View>
                {loadFailed ? (
                    <TouchableOpacity style={styles.errorBanner} onPress={load}>
                        <Text style={styles.errorBannerText}>Couldn’t refresh. Tap to retry.</Text>
                    </TouchableOpacity>
                ) : null}
                <View style={styles.timeline}>{details.steps.map(renderStep)}</View>
            </>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
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
                <Text style={styles.headerTitle}>My Requests</Text>
                {renderBody()}
            </ScrollView>

            {/* Full-screen photo viewer (swipe through this update's photos). */}
            <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
                <View style={styles.viewerBackdrop}>
                    <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Text style={styles.viewerCloseText}>×</Text>
                    </TouchableOpacity>
                    {viewer ? (
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            contentOffset={{ x: viewer.index * Dimensions.get('window').width, y: 0 }}
                        >
                            {viewer.images.map((uri) => (
                                <View key={uri} style={styles.viewerPage}>
                                    <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
                                </View>
                            ))}
                        </ScrollView>
                    ) : null}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const WINDOW_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16, marginBottom: 4 },
    backIcon: { width: 11, height: 19, resizeMode: 'contain' },
    scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 },
    headerTitle: { ...FONT_ROBOTO_BOLD, fontSize: 24, lineHeight: 28, color: '#021E79', marginTop: 8, marginBottom: 16 },

    requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
    requestHeaderText: { flex: 1, paddingRight: 10 },
    requestNumber: { fontSize: 16, lineHeight: 27, fontWeight: '700', color: '#292727' },
    providerName: { fontSize: 10, lineHeight: 17, color: '#5B5959' },
    statusBadge: {
        backgroundColor: '#577FBB',
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 20,
        paddingVertical: 1,
        paddingHorizontal: 14,
        marginTop: 4,
    },
    statusBadgeText: { ...FONT_QUICKSAND_MEDIUM, fontSize: 10, lineHeight: 17, fontWeight: '500', color: '#FFFFFF' },

    // Timeline
    timeline: { paddingLeft: 0 },
    stepRow: { flexDirection: 'row' },
    railColumn: { width: 26, alignItems: 'center' },
    stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    stepCircleDone: { backgroundColor: '#577FBB' },
    stepCirclePending: { backgroundColor: '#414141' },
    check: {
        width: 11,
        height: 6,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: '#FFEFEF',
        transform: [{ rotate: '-45deg' }, { translateY: -1 }],
    },
    railLine: { flex: 1, width: 1, backgroundColor: '#D9D9D9', marginVertical: 2 },
    stepBody: { flex: 1, paddingLeft: 12, paddingBottom: 26 },
    stepBodyLast: { paddingBottom: 0 },
    stepLabel: { fontSize: 10, lineHeight: 17, fontWeight: '700', color: '#191818', marginTop: 2 },
    stepLabelPending: { color: '#414141' },
    stepTime: { fontSize: 8, lineHeight: 14, color: '#5B5959' },

    updateBlock: { marginTop: 10 },
    noteTitle: { fontSize: 11, lineHeight: 19, fontWeight: '700', color: '#5B5959' },
    noteText: { fontSize: 9, lineHeight: 15, color: '#292727', marginBottom: 8 },

    mediaRow: { flexDirection: 'row' },
    mediaTile: { width: TILE_WIDTH, height: TILE_HEIGHT, backgroundColor: '#D9D9D9', overflow: 'hidden' },
    mediaTileSpacing: { marginRight: 17 },
    mediaImage: { width: '100%', height: '100%' },
    videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9D9D9' },
    playTriangle: {
        width: 0,
        height: 0,
        borderTopWidth: 10,
        borderBottomWidth: 10,
        borderLeftWidth: 16,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: '#3F3F3F',
        marginLeft: 4,
    },
    moreOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreText: { fontSize: 15, lineHeight: 26, fontWeight: '700', color: '#FFFFFF' },

    loader: { marginTop: 30 },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: { fontSize: 13, color: '#555555' },

    viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
    viewerClose: { position: 'absolute', top: 48, right: 20, zIndex: 2 },
    viewerCloseText: { fontSize: 36, lineHeight: 38, color: '#FFFFFF' },
    viewerPage: { width: WINDOW_WIDTH, alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: WINDOW_WIDTH, height: '80%' },
});

export default RepairDetails;