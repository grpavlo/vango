import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

export default function Skeleton({ style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.skeleton, { opacity }, style]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e1e9ee',
    borderRadius: 4,
  },
});
