import React, { useRef, useState, useImperativeHandle } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Pressable, View } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const BottomSheet = React.forwardRef(function BottomSheet({
  collapsedHeight = 110,
  children,
  style,
}, ref) {
  const expandedOffset = SCREEN_HEIGHT * 0.1;
  const collapsedOffset = SCREEN_HEIGHT - collapsedHeight;

  const [expanded, setExpanded] = useState(false);
  const translateY = useRef(new Animated.Value(collapsedOffset)).current;
  const lastOffset = useRef(collapsedOffset);

  useImperativeHandle(ref, () => ({
    expand,
    collapse,
  }));

  function expand() {
    setExpanded(true);
    Animated.spring(translateY, {
      toValue: expandedOffset,
      useNativeDriver: true,
    }).start(() => {
      lastOffset.current = expandedOffset;
    });
  }

  function collapse() {
    setExpanded(false);
    Animated.spring(translateY, {
      toValue: collapsedOffset,
      useNativeDriver: true,
    }).start(() => {
      lastOffset.current = collapsedOffset;
    });
  }

  function toggle() {
    expanded ? collapse() : expand();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        let newY = lastOffset.current + gesture.dy;
        newY = Math.max(expandedOffset, Math.min(collapsedOffset, newY));
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldExpand = gesture.dy < 0 && Math.abs(gesture.dy) > 40;
        const shouldCollapse = gesture.dy > 0 && Math.abs(gesture.dy) > 40;
        if (shouldExpand) {
          expand();
        } else if (shouldCollapse) {
          collapse();
        } else {
          toggle();
        }
      },
    })
  ).current;

  const containerStyle = [
    styles.container,
    style,
    { height: SCREEN_HEIGHT, transform: [{ translateY }] },
  ];

  return (
    <Animated.View style={containerStyle} {...panResponder.panHandlers}>
      <Pressable onPress={toggle} style={styles.handleContainer}>
        <View style={styles.handle} />
      </Pressable>
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 6,
    elevation: 24,
  },
  handleContainer: { alignItems: 'center', paddingTop: 8 },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: '#ccc' },
});

export default BottomSheet;
