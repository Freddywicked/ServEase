import React, { useRef, useState } from 'react';
import {
    View, Text, Image, ScrollView, Modal, Pressable, TouchableOpacity,
    PanResponder, StyleSheet, useWindowDimensions,
} from 'react-native';
import { TERMS_BLOCKS } from './TermsContent';

// The Figma frame is 402 x 1026. Every measurement below is the Figma value times `s`,
// so the modal keeps the same proportions on any phone.
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

    // Scrollbar geometry (Figma: track 15 x 401, thumb 8 x 25 with 1px inset).
    const trackH = px(401);
    const thumbH = px(25);
    const travel = trackH - thumbH - 2; // distance the thumb can move

    // Latest numbers for the PanResponder, which is created only once.
    const m = useRef({ maxScroll: 0, thumbTop: 0, travel });
    m.current.travel = travel;

    const setThumb = (top) => {
        m.current.thumbTop = top;
        setThumbTop(top);
    };

    // Keep the thumb in step with the text (finger scroll, momentum, or scrollTo).
    const handleScroll = (e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        const maxScroll = Math.max(contentSize.height - layoutMeasurement.height, 0);
        m.current.maxScroll = maxScroll;
        const ratio = maxScroll > 0 ? Math.min(Math.max(contentOffset.y / maxScroll, 0), 1) : 0;
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

    return (
        <View style={styles.backdrop}>
            <View style={{ width: px(DESIGN_W), height: px(DESIGN_H), alignSelf: 'center' }}>
                {/* Rectangle 23898: white card */}
                <View
                    style={{
                        position: 'absolute', left: px(23), top: px(181),
                        width: px(356), height: px(632), borderRadius: px(20), backgroundColor: '#FFFFFF',
                    }}
                />

                {/* Logo */}
                <Image
                    source={require('../assets/logo_servease.png')}
                    style={{ position: 'absolute', left: px(102), top: px(51), width: px(198), height: px(198), resizeMode: 'contain' }}
                />

                {/* Title */}
                <Text
                    style={[styles.title, { left: px(28), top: px(199), width: px(345), paddingLeft: px(11) }]}
                    numberOfLines={1}
                >
                    Terms of Service and Privacy Policy
                </Text>

                {/* Terms text */}
                <View style={{ position: 'absolute', left: px(57), top: px(234), width: px(287), height: px(519) }}>
                    <ScrollView
                        ref={scrollRef}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                    >
                        {TERMS_BLOCKS.map((block, i) => (
                            <TermsBlock key={i} block={block} />
                        ))}
                    </ScrollView>
                </View>

                {/* Scrollbar: tap the track to jump, drag the thumb to scroll */}
                <Pressable
                    style={[styles.track, { left: px(356), top: px(270), width: px(15), height: trackH }]}
                    onPress={(e) => moveThumbTo(e.nativeEvent.locationY - thumbH / 2)}
                >
                    <View
                        {...panResponder.panHandlers}
                        style={{ position: 'absolute', left: 0, right: 0, top: 1 + thumbTop, height: thumbH, alignItems: 'center' }}
                    >
                        <View style={{ width: px(8), height: thumbH, borderRadius: 4, backgroundColor: '#C1C1C1' }} />
                    </View>
                </Pressable>

                {/* Done button */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={onClose}
                    style={[styles.doneButton, { left: px(71), top: px(763), width: px(262), height: px(31) }]}
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
    backdrop: { flex: 1, backgroundColor: 'rgba(255,255,255,0.5)' },

    title: {
        position: 'absolute',
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 14,
        fontWeight: '700',
        color: '#18315B',
    },

    text: { fontSize: 10, lineHeight: 12, color: '#000000' },
    gap: { height: 12 },
    listRow: { flexDirection: 'row' },
    bulletMarker: { width: 8, marginLeft: 8, fontSize: 8 },
    numberMarker: { width: 14, marginLeft: 2 },
    listText: { flex: 1 },

    // Scrollbar track
    track: {
        position: 'absolute',
        backgroundColor: '#FAFAFA',
        borderLeftWidth: 1,
        borderLeftColor: '#E8E8E8',
        borderRightWidth: 1,
        borderRightColor: '#F0F0F0',
    },

    doneButton: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0255AF', // fallback where the gradient isn't supported
        backgroundImage: 'linear-gradient(to right, #0255AF, #04A5A5)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
    },
    doneText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});

export default TermsAndPrivacy;