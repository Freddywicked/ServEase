import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Linking,
    FlatList,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProviderServiceRequest, submitQuotation, declineServiceRequest } from '../api/servicerequest_api';
import LinearGradient from 'react-native-linear-gradient';

const MAX_VISIBLE_TILES = 4;

// Roboto Bold = screen title (Figma). Android's system font already is Roboto; iOS needs assets/fonts/Roboto-Bold.ttf.
const FONT_ROBOTO_BOLD = Platform.OS === 'ios' ? { fontFamily: 'Roboto-Bold' } : { fontWeight: '700' };

// ---------------------------------------------------------------------------
// Display helpers (they only format what the backend sends)
// ---------------------------------------------------------------------------
// The backend's request `id` IS the reference ("SR-0001", Request.formatRequestId), and it is
// also what the provider endpoints take in their URLs. `requestNumber` is sent as well once the
// backend patch is in; until then `id` is used. A bare number becomes SR-0001, a "#" is dropped.
const getRequestNumber = (item, fallback = '') => {
    const raw = item?.requestNumber ?? item?.request_number ?? item?.referenceNumber ?? item?.reference ?? item?.id;
    const text = raw === null || raw === undefined ? '' : String(raw).replace(/^#/, '').trim();
    if (text) return /^\d+$/.test(text) ? `SR-${text.padStart(4, '0')}` : text;
    return fallback ? String(fallback) : '';
};

// 2 -> "2", 1.24 -> "1.2" (Figma: "2 km away", "1.2 km away")
const formatDistance = (km) => {
    if (km === null || km === undefined || km === '') return null;
    const value = Number(km);
    return Number.isFinite(value) ? String(Number(value.toFixed(1))) : null;
};

const VIDEO_EXTENSION = /\.(mp4|mov|m4v|3gp|webm|mkv)(\?|#|$)/i;

const normalizeAttachment = (entry, fallbackType) => {
    if (!entry) return null;
    const isString = typeof entry === 'string';
    const url = isString ? entry : entry.url || entry.uri || entry.publicUrl || entry.signedUrl;
    if (!url) return null;
    const declared = isString ? '' : String(entry.type || entry.mediaType || entry.mimeType || entry.mime_type || '').toLowerCase();
    let type;
    if (declared.startsWith('video')) type = 'video';
    else if (declared.startsWith('image') || declared === 'photo') type = 'image';
    else if (VIDEO_EXTENSION.test(url)) type = 'video';
    else type = fallbackType || 'image';
    return {
        url,
        type,
        thumbnailUrl: isString ? null : entry.thumbnailUrl || entry.thumbnail || entry.posterUrl || null,
    };
};

// Every file the customer attached, normalised to { url, type: 'image'|'video', thumbnailUrl }.
// Videos come first (Figma shows the video tile first). Accepts `attachments`/`media` (objects or
// URL strings), `photos`, and `video`/`videos`/`videoUrl`.
const getAttachments = (request) => {
    if (!request) return [];
    const collected = [];
    const add = (source, fallbackType) => {
        const list = Array.isArray(source) ? source : source ? [source] : [];
        list.forEach((entry) => {
            const normalized = normalizeAttachment(entry, fallbackType);
            if (normalized) collected.push(normalized);
        });
    };
    add(request.attachments);
    add(request.media);
    add(request.photos, 'image');
    add(request.videos, 'video');
    add(request.video, 'video');
    add(request.videoUrl, 'video');

    const seen = new Set();
    const unique = collected.filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
    });
    return [...unique.filter((item) => item.type === 'video'), ...unique.filter((item) => item.type !== 'video')];
};

// ---------------------------------------------------------------------------
// Full-screen photo viewer for the customer's attached photos. Swipe between photos; pinch to zoom (iOS).
// Videos are not shown here: they open in the device's video player (openVideo below).
//   images [{ url }]  the image attachments, in display order
// ---------------------------------------------------------------------------
const ImagePage = ({ uri, width, height }) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    return (
        <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
            <ScrollView
                style={{ width, height }}
                contentContainerStyle={{ width, height, justifyContent: 'center' }}
                maximumZoomScale={4}
                minimumZoomScale={1}
                bouncesZoom
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
            >
                <Image
                    source={{ uri }}
                    style={{ width, height }}
                    resizeMode="contain"
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onError={() => {
                        setFailed(true);
                        setLoading(false);
                    }}
                />
            </ScrollView>
            {loading && !failed ? <ActivityIndicator color="#FFFFFF" style={StyleSheet.absoluteFill} /> : null}
            {failed ? <Text style={styles.viewerErrorText}>This photo could not be loaded.</Text> : null}
        </View>
    );
};

const MediaViewerModal = ({ visible, images = [], initialIndex = 0, onClose }) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(initialIndex);

    useEffect(() => {
        if (visible) setIndex(initialIndex);
    }, [visible, initialIndex]);

    if (!images.length) return null;

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.viewerContainer}>
                <FlatList
                    data={images}
                    keyExtractor={(item, position) => `${item.url}-${position}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={Math.min(initialIndex, images.length - 1)}
                    getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
                    onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
                    renderItem={({ item }) => <ImagePage uri={item.url} width={width} height={height} />}
                />

                <View style={[styles.viewerTopBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                    <Text style={styles.viewerCounter}>
                        {Math.min(index + 1, images.length)} / {images.length}
                    </Text>
                    <TouchableOpacity
                        style={styles.viewerCloseButton}
                        onPress={onClose}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Close photo viewer"
                    >
                        <Image source={require('../assets/icon_close.png')} style={styles.viewerCloseIcon} />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Keep digits and a single decimal point (max 2 decimals) in the peso inputs.
const sanitizeAmount = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const ViewServiceRequest = ({ navigation, route }) => {
    // Passed by IncomingServiceRequest.js. The request detail is
    // GET /provider/service-requests/:id -> { id, requestNumber, customer, concern, photos/video,
    // appointment, ai, canApprove }.
    const requestId = route?.params?.requestId;
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [acting, setActing] = useState(false);

    const [showApprovedModal, setShowApprovedModal] = useState(false);
    const [laborCost, setLaborCost] = useState('');
    const [partsCost, setPartsCost] = useState('');
    const [notes, setNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [viewer, setViewer] = useState({ visible: false, index: 0 });

    // "Accept" on the list opens this screen with the quotation modal already showing.
    const autoOpenQuotationRef = useRef(!!route?.params?.openQuotation);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!requestId) {
                setLoadError('Missing request id');
                setLoading(false);
                return;
            }
            try {
                const data = await getProviderServiceRequest(requestId);
                if (cancelled) return;
                setRequest(data);
                if (autoOpenQuotationRef.current && data?.canApprove !== false) setShowApprovedModal(true);
                autoOpenQuotationRef.current = false;
            } catch (error) {
                if (!cancelled) setLoadError(error.message || 'Could not load the request.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId]);

    const attachments = useMemo(() => getAttachments(request), [request]);
    const images = useMemo(() => attachments.filter((item) => item.type !== 'video'), [attachments]);
    const visibleTiles = attachments.slice(0, MAX_VISIBLE_TILES);
    const hiddenCount = Math.max(attachments.length - MAX_VISIBLE_TILES, 0);

    const handleBack = () => {
        navigation.goBack();
    };

    const handleViewLocation = () => {
        // Open Google Maps on the customer's pin, or on their address when there is no pin.
        const { latitude, longitude, address } = request?.customer || {};
        const query = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined
            ? `${latitude},${longitude}`
            : address;
        if (query) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
    };

    // Photos open in the in-app viewer; videos open in the device's video player.
    const openVideo = async (url) => {
        try {
            await Linking.openURL(url);
        } catch (error) {
            Alert.alert('Could not play the video', 'No app on this device could open the video. Please try again.');
        }
    };

    const handleOpenAttachment = (position) => {
        const item = attachments[position];
        if (!item) return;
        if (item.type === 'video') {
            openVideo(item.url);
        } else {
            setViewer({ visible: true, index: Math.max(images.indexOf(item), 0) });
        }
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

    // Decline: the customer is notified (with the reason) so they can pick another provider.
    const handleSendRejection = async () => {
        if (acting) return;
        if (!rejectReason.trim()) {
            Alert.alert('Reason needed', 'Please tell the customer why you are declining.');
            return;
        }
        setActing(true);
        try {
            await declineServiceRequest(requestId, { reason: rejectReason.trim() });
            setShowRejectModal(false);
            navigation.goBack();
        } catch (error) {
            setActing(false);
            Alert.alert('Could not decline', error.message);
        }
    };

    // Accepting = sending the quotation. The backend marks the request accepted + quoted, moves it
    // to the provider's Pending tab, and puts the quotation card + a notification on the customer's Track.
    const handleSendQuote = async () => {
        if (acting) return;
        const labor = Number(laborCost) || 0;
        const parts = Number(partsCost) || 0;
        if (labor + parts <= 0) {
            Alert.alert('Missing price', 'Enter a labor or parts cost first.');
            return;
        }
        setActing(true);
        try {
            await submitQuotation(requestId, { laborCost: labor, partsCost: parts, remarks: notes.trim() });
            setShowApprovedModal(false);
            Alert.alert('Quotation sent', 'The customer has been notified.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            setActing(false);
            Alert.alert('Could not send the quotation', error.message);
        }
    };

    const possibleCauses = request?.ai?.possibleCauses || [];
    const customer = request?.customer || {};
    const distance = formatDistance(request?.distanceKm ?? customer.distanceKm);
    const mapLabel = distance !== null ? `${distance} km away` : customer.address ? 'View map' : null;
    // Decline / Accept only while the request is still waiting on this provider (not once quoted).
    const canRespond = request?.canApprove !== false && request?.status !== 'quoted';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <View style={styles.backChevron} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Service Request</Text>

                {loading ? (
                    <ActivityIndicator color="#0255AF" style={{ marginTop: 24 }} />
                ) : loadError ? (
                    <Text style={styles.concernText}>{loadError}</Text>
                ) : !request ? null : (
                    <>
                        <Text style={styles.requestNumber}>
                            Request #{getRequestNumber(request, route?.params?.requestNumber)}
                        </Text>

                        <Text style={styles.sectionLabel}>Customer Information</Text>
                        <View style={styles.customerRow}>
                            {customer.avatarUrl ? (
                                <Image source={{ uri: customer.avatarUrl }} style={styles.customerAvatar} />
                            ) : (
                                <View style={styles.customerAvatar} />
                            )}
                            <View style={styles.customerInfo}>
                                <Text style={styles.customerName}>{customer.name || 'Customer'}</Text>
                                <View style={styles.addressRow}>
                                    <Text style={styles.customerAddress}>{customer.address || 'No address given'}</Text>
                                    {mapLabel ? (
                                        <TouchableOpacity style={styles.distanceInline} onPress={handleViewLocation} accessibilityRole="link">
                                            <Image source={require('../assets/icon_pinloc.png')} style={styles.pinIcon} />
                                            <Text style={styles.distanceText}>{mapLabel}</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        <Text style={styles.sectionLabel}>Customer Concern</Text>
                        <Text style={styles.concernText}>{request.concern}</Text>

                        {attachments.length > 0 ? (
                            <View style={styles.mediaRow}>
                                {visibleTiles.map((item, position) => {
                                    const isVideo = item.type === 'video';
                                    const isLastTile = position === MAX_VISIBLE_TILES - 1;
                                    const showMore = isLastTile && hiddenCount > 0;
                                    const previewUrl = isVideo ? item.thumbnailUrl : item.thumbnailUrl || item.url;
                                    return (
                                        <TouchableOpacity
                                            key={`${item.url}-${position}`}
                                            style={[styles.mediaTile, isLastTile && styles.mediaTileLast]}
                                            activeOpacity={0.8}
                                            onPress={() => handleOpenAttachment(position)}
                                            accessibilityRole="button"
                                            accessibilityLabel={
                                                showMore
                                                    ? `Open attachment, ${hiddenCount} more`
                                                    : isVideo
                                                        ? 'Play attached video'
                                                        : 'View attached photo'
                                            }
                                        >
                                            {previewUrl ? (
                                                <Image source={{ uri: previewUrl }} style={styles.mediaImage} />
                                            ) : null}
                                            {isVideo ? (
                                                <View style={styles.playOverlay}>
                                                    <Image source={require('../assets/icon_play_white.png')} style={styles.playIcon} />
                                                </View>
                                            ) : null}
                                            {showMore ? (
                                                <View style={styles.moreOverlay}>
                                                    <Text style={styles.moreText}>+{hiddenCount}</Text>
                                                </View>
                                            ) : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : null}

                        {request.ai && (
                            <>
                                <Text style={[styles.sectionLabel, attachments.length > 0 && styles.sectionLabelAfterMedia]}>AI Diagnosis (Preliminary)</Text>
                                <View style={styles.aiBanner}>
                                    <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                                    <Text style={styles.aiBannerText}>
                                        AI suggests {request.ai.diagnosis} ({request.ai.confidence}% confidence)
                                    </Text>
                                </View>

                                {possibleCauses.length > 0 ? (
                                    <>
                                        <Text style={styles.causesLabel}>Possible causes:</Text>
                                        {possibleCauses.map((cause) => (
                                            <Text key={cause} style={styles.causeItem}>{cause}</Text>
                                        ))}
                                    </>
                                ) : null}
                            </>
                        )}

                        {canRespond ? (
                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.declineButton} onPress={handleDecline} disabled={acting} accessibilityRole="button">
                                    <Text style={styles.actionButtonText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.85} disabled={acting} accessibilityRole="button">
                                    <Text style={styles.actionButtonText}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </>
                )}
            </ScrollView>

            <MediaViewerModal
                visible={viewer.visible}
                images={images}
                initialIndex={viewer.index}
                onClose={() => setViewer((current) => ({ ...current, visible: false }))}
            />

            {/* Service Request Approved: send the pre-repair quotation */}
            <Modal visible={showApprovedModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Service Request Approved</Text>
                            <TouchableOpacity onPress={handleCloseModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Send a pre-repair quotation to the customer.</Text>

                        <View style={styles.costRow}>
                            <View style={[styles.costField, styles.costFieldSpacing]}>
                                <Text style={styles.costLabel}>Labor (Peso)</Text>
                                <TextInput
                                    style={styles.costInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#B7B7B7"
                                    keyboardType="decimal-pad"
                                    value={laborCost}
                                    onChangeText={(text) => setLaborCost(sanitizeAmount(text))}
                                />
                            </View>
                            <View style={styles.costField}>
                                <Text style={styles.costLabel}>Parts (Peso)</Text>
                                <TextInput
                                    style={styles.costInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#B7B7B7"
                                    keyboardType="decimal-pad"
                                    value={partsCost}
                                    onChangeText={(text) => setPartsCost(sanitizeAmount(text))}
                                />
                            </View>
                        </View>

                        <Text style={styles.notesLabel}>Notes</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Parts needed, timeline....."
                            placeholderTextColor="#B7B7B7"
                            multiline
                            numberOfLines={3}
                            value={notes}
                            onChangeText={setNotes}
                        />

                        <TouchableOpacity
                            style={[styles.modalPrimaryButton, acting && styles.modalPrimaryButtonDisabled]}
                            onPress={handleSendQuote}
                            disabled={acting}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            {acting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.modalPrimaryButtonText}>Send Quotation</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Reason for Rejection */}
            <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={handleCloseRejectModal}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Reason for Rejection</Text>
                            <TouchableOpacity onPress={handleCloseRejectModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
                                <Image source={require('../assets/icon_close.png')} style={styles.modalCloseIcon} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>State a proper reason for rejection.</Text>

                        <TextInput
                            style={styles.rejectReasonInput}
                            placeholder="Enter your reason here."
                            placeholderTextColor="#B7B7B7"
                            multiline
                            numberOfLines={4}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            maxLength={500}
                        />

                        <TouchableOpacity
                            style={[styles.modalPrimaryButton, (acting || !rejectReason.trim()) && styles.modalPrimaryButtonDisabled]}
                            onPress={handleSendRejection}
                            disabled={acting || !rejectReason.trim()}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                        >
                            <LinearGradient colors={['#0255AF', '#04A5A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                            {acting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={[styles.modalPrimaryButtonText, styles.sendRejectionText]}>Send</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
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
        paddingVertical: 8,
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    // Figma: thin black chevron
    backChevron: {
        width: 12,
        height: 12,
        marginLeft: 6,
        borderLeftWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: '#000000',
        transform: [{ rotate: '45deg' }],
    },
    headerTitle: {
        fontSize: 24,
        lineHeight: 28,
        ...FONT_ROBOTO_BOLD,
        color: '#021E79',
        marginBottom: 30,
    },
    requestNumber: {
        fontSize: 13,
        lineHeight: 22,
        fontWeight: '700',
        color: '#292727',
        marginBottom: 6,
    },
    sectionLabel: {
        fontSize: 11,
        lineHeight: 19,
        fontWeight: '700',
        color: '#5B5959',
        marginTop: 18,
        marginBottom: 6,
    },
    sectionLabelAfterMedia: {
        marginTop: 10,
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    customerAvatar: {
        width: 49,
        height: 49,
        borderRadius: 25,
        marginRight: 14,
        backgroundColor: '#D9D9D9',
    },
    customerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    customerName: {
        fontSize: 11,
        lineHeight: 19,
        fontWeight: '700',
        color: '#5B5959',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    customerAddress: {
        flex: 1,
        fontSize: 11,
        lineHeight: 19,
        color: '#5B5959',
    },
    distanceInline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    pinIcon: {
        width: 10,
        height: 10,
        resizeMode: 'contain',
        marginRight: 3,
    },
    distanceText: {
        fontSize: 9,
        lineHeight: 15,
        color: '#5B5959',
        textDecorationLine: 'underline',
    },
    concernText: {
        fontSize: 9,
        lineHeight: 15,
        color: '#292727',
    },

    // Attachments: up to 4 tiles, 63 x 90, 12 apart, row centred; #D9D9D9 until the file loads
    mediaRow: {
        flexDirection: 'row',
        alignSelf: 'center',
        marginTop: 10,
    },
    mediaTile: {
        width: 63,
        height: 90,
        marginRight: 12,
        borderRadius: 4,
        backgroundColor: '#D9D9D9',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mediaTileLast: {
        marginRight: 0,
    },
    mediaImage: {
        ...StyleSheet.absoluteFillObject,
        resizeMode: 'cover',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        width: 25,
        height: 25,
        resizeMode: 'contain',
    },
    moreOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        width: '91%',
        minHeight: 34,
        backgroundColor: '#262728',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    aiIcon: {
        width: 10,
        height: 10,
        resizeMode: 'contain',
        marginRight: 6,
    },
    aiBannerText: {
        flex: 1,
        flexShrink: 1,
        fontSize: 9,
        lineHeight: 15,
        color: '#FFFFFF',
    },
    causesLabel: {
        fontSize: 9,
        lineHeight: 15,
        color: '#292727',
        marginTop: 16,
    },
    causeItem: {
        fontSize: 9,
        lineHeight: 15,
        fontWeight: '700',
        color: '#292727',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 40,
        paddingRight: '7.5%',
    },
    declineButton: {
        width: 78,
        height: 32,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#C62828',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 9,
    },
    acceptButton: {
        width: 78,
        height: 32,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        backgroundColor: '#167713',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // Modals: 345 wide, 1px #818080, radius 10, 35% black overlay
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 345,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#818080',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 18,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    modalTitle: {
        flex: 1,
        marginRight: 10,
        fontSize: 13,
        lineHeight: 22,
        fontWeight: '700',
        color: '#414141',
    },
    modalCloseIcon: {
        width: 15,
        height: 15,
        resizeMode: 'contain',
        marginTop: 4,
    },
    modalSubtitle: {
        fontSize: 10,
        lineHeight: 17,
        color: '#5B5959',
        marginBottom: 12,
    },
    costRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    costField: {
        width: 75,
    },
    costFieldSpacing: {
        marginRight: 28,
    },
    costLabel: {
        fontSize: 8,
        lineHeight: 14,
        color: '#5B5959',
        marginBottom: 4,
    },
    costInput: {
        height: 30,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 6,
        backgroundColor: '#FFFDFD',
        paddingVertical: 0,
        paddingHorizontal: 8,
        fontSize: 10,
        color: '#292727',
    },
    notesLabel: {
        fontSize: 10,
        lineHeight: 17,
        color: '#5B5959',
        marginBottom: 4,
    },
    notesInput: {
        height: 70,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 6,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 10,
        lineHeight: 17,
        color: '#292727',
        textAlignVertical: 'top',
        marginBottom: 18,
    },
    rejectReasonInput: {
        height: 80,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 6,
        backgroundColor: '#FFFDFD',
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 10,
        lineHeight: 17,
        color: '#292727',
        textAlignVertical: 'top',
        marginBottom: 18,
    },
    // Figma gradient button: the LinearGradient fills it, the label sits on top.
    modalPrimaryButton: {
        alignSelf: 'center',
        width: '85%',
        height: 40,
        borderWidth: 1,
        borderColor: '#B1A8A8',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalPrimaryButtonDisabled: {
        opacity: 0.6,
    },
    modalPrimaryButtonText: {
        fontSize: 10,
        lineHeight: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sendRejectionText: {
        fontSize: 12,
        lineHeight: 20,
    },

    // Photo viewer
    viewerContainer: {
        flex: 1,
        backgroundColor: '#000000',
    },
    viewerTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewerCounter: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    viewerCloseButton: {
        position: 'absolute',
        right: 20,
        bottom: 12,
    },
    viewerCloseIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: '#FFFFFF',
    },
    viewerErrorText: {
        position: 'absolute',
        fontSize: 13,
        color: '#FFFFFF',
    },
});

export default ViewServiceRequest;