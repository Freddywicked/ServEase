import React, { useRef, useState } from 'react';
import {
    View, Text, Image, ScrollView, Modal, Pressable, TouchableOpacity,
    PanResponder, StyleSheet, useWindowDimensions,
} from 'react-native';
import { TERMS_BLOCKS } from './TermsContent';

// The Figma frame is 402 x 1026 (see the "Sign Up" frame with the terms card). Sizes below are the
// Figma value times `s`, so the modal keeps the same proportions on any phone. Same picture as
// Figma: the Sign Up screen under a 50% white wash, the logo ABOVE the card, and a white card that
// floats over the middle of the form (soft border + shadow, so it reads as lifted instead of
// blending into the page) with the title, text and Done button inside it. The rest of the Sign Up
// screen (checkbox, Next, Log in) stays visible below the card. Flexbox lays the card out, so the
// logo, title, text and Done button can never overlap.
const DESIGN_W = 402;
const DESIGN_H = 1026;

// ---- One block of the terms text ----
const TermsBlock = ({ block }) => {
    switch (block.type) {
        case 'gap':
            return <View style={styles.gap} />;
        case 'b':
            return (
                <View style={styles.listRow}>
                    <Text style={[styles.text, styles.bulletMarker]}>•</Text>
                    <Text style={[styles.text, styles.listText]}>{block.text}</Text>
                </View>
            );
        case 'n':
            return (
                <View style={styles.listRow}>
                    <Text style={[styles.text, styles.numberMarker]}>{`${block.num}.`}</Text>
                    <Text style={[styles.text, styles.listText]}>{block.text}</Text>
                </View>
            );
        default: // 'p' and 'h'
            return <Text style={styles.text}>{block.text}</Text>;
    }
};

// Mounted fresh each time the modal opens, so the scroll position and thumb always start at the top.
const TermsBody = ({ onClose }) => {
    const { width, height } = useWindowDimensions();
    const s = Math.min(width / DESIGN_W, height / DESIGN_H);
    const px = (v) => v * s;

    const scrollRef = useRef(null);
    const [thumbTop, setThumbTop] = useState(0);
    // Height of the text area (measured), which is also the height of the scrollbar track.
    const [trackH, setTrackH] = useState(px(401));

    // Scrollbar geometry (Figma: track 15 wide, thumb 8 x 25 with 1px inset).
    const thumbH = px(25);
    const travel = Math.max(trackH - thumbH - 2, 0); // distance the thumb can move

    // Latest numbers for the PanResponder, which is created only once.
    const m = useRef({ maxScroll: 0, contentH: 0, viewH: 0, thumbTop: 0, travel });
    m.current.travel = travel;

    const updateMaxScroll = () => {
        m.current.maxScroll = Math.max(m.current.contentH - m.current.viewH, 0);
    };

    const setThumb = (top) => {
        m.current.thumbTop = top;
        setThumbTop(top);
    };

    // Keep the thumb in step with the text (finger scroll, momentum, or scrollTo).
    const handleScroll = (e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        m.current.contentH = contentSize.height;
        m.current.viewH = layoutMeasurement.height;
        updateMaxScroll();
        const ratio = m.current.maxScroll > 0 ? Math.min(Math.max(contentOffset.y / m.current.maxScroll, 0), 1) : 0;
        setThumb(ratio * m.current.travel);
    };

    // Move the thumb to `top` and scroll the text to match.
    const moveThumbTo = (top) => {
        const clamped = Math.min(Math.max(top, 0), m.current.travel);
        const ratio = m.current.travel > 0 ? clamped / m.current.travel : 0;
        setThumb(clamped);
        scrollRef.current?.scrollTo({ y: ratio * m.current.maxScroll, animated: false });
    };

    // Drag the thumb.
    const dragStart = useRef(0);
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => { dragStart.current = m.current.thumbTop; },
            onPanResponderMove: (_, g) => moveThumbTo(dragStart.current + g.dy),
        })
    ).current;

    // Card sides sit 23/402 of the screen width in from the edges, like Figma.
    const sideMargin = (width * 23) / DESIGN_W;

    return (
        // 50% white wash over the Sign Up screen (Figma "Rectangle 3518").
        <View style={[styles.backdrop, { paddingTop: px(55) }]}>
            {/* Logo, above the card (it ends before the card begins) */}
            <Image
                source={require('../assets/logo_servease.png')}
                style={{ width: px(116), height: px(116), resizeMode: 'contain' }}
            />

            {/* The floating card (Figma: top 181, height 632, radius 20) */}
            <View
                style={[
                    styles.card,
                    { marginTop: px(10), marginHorizontal: sideMargin, height: px(632), borderRadius: px(20) },
                ]}
            >
                {/* Title */}
                <Text style={[styles.title, { marginTop: px(18), marginBottom: px(18) }]}>
                    Terms of Service and Privacy Policy
                </Text>

                {/* Terms text + scrollbar */}
                <View
                    style={[styles.bodyRow, { marginLeft: px(34), marginRight: px(8) }]}
                    onLayout={(e) => setTrackH(e.nativeEvent.layout.height)}
                >
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1, marginRight: px(12) }}
                        onScroll={handleScroll}
                        onContentSizeChange={(_, h) => { m.current.contentH = h; updateMaxScroll(); }}
                        onLayout={(e) => { m.current.viewH = e.nativeEvent.layout.height; updateMaxScroll(); }}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                    >
                        {TERMS_BLOCKS.map((block, i) => (
                            <TermsBlock key={i} block={block} />
                        ))}
                    </ScrollView>

                    {/* Scrollbar: tap the track to jump, drag the thumb to scroll */}
                    <Pressable
                        style={[styles.track, { width: px(15), height: trackH }]}
                        onPress={(e) => moveThumbTo(e.nativeEvent.locationY - thumbH / 2)}
                    >
                        <View
                            {...panResponder.panHandlers}
                            style={{ position: 'absolute', left: 0, right: 0, top: 1 + thumbTop, height: thumbH, alignItems: 'center' }}
                        >
                            <View style={{ width: px(8), height: thumbH, borderRadius: 4, backgroundColor: '#C1C1C1' }} />
                        </View>
                    </Pressable>
                </View>

                {/* Done button (Figma: 262 x 31) */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={onClose}
                    style={[
                        styles.doneButton,
                        { marginTop: px(10), marginBottom: px(19), marginHorizontal: px(48), height: Math.max(px(31), 34) },
                    ]}
                >
                    <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const TermsAndPrivacy = ({ visible, onClose }) => (
    <Modal
        transparent
        animationType="fade"
        visible={visible}
        statusBarTranslucent
        onRequestClose={onClose}
    >
        <TermsBody onClose={onClose} />
    </Modal>
);

const styles = StyleSheet.create({
    // Rectangle 3518: white at 50% over the Sign Up screen
    backdrop: { flex: 1, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center' },

    card: {
        alignSelf: 'stretch',
        backgroundColor: '#FFFFFF',
        // A white card on a white wash has no edge of its own, so give it one: a hairline border
        // and a soft shadow make it read as floating above the Sign Up screen.
        borderWidth: 1,
        borderColor: '#E1E5EA',
        elevation: 12,
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },

    title: {
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '700',
        color: '#18315B',
    },

    bodyRow: { flex: 1, flexDirection: 'row' },

    text: { fontSize: 10, lineHeight: 12, color: '#000000' },
    gap: { height: 12 },
    listRow: { flexDirection: 'row' },
    bulletMarker: { width: 8, marginLeft: 8, fontSize: 8 },
    numberMarker: { width: 14, marginLeft: 2 },
    listText: { flex: 1 },

    // Scrollbar track
    track: {
        backgroundColor: '#FAFAFA',
        borderLeftWidth: 1,
        borderLeftColor: '#E8E8E8',
        borderRightWidth: 1,
        borderRightColor: '#F0F0F0',
    },

    doneButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0255AF', // fallback where the gradient isn't supported
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
    },
    doneText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});

export default TermsAndPrivacy;