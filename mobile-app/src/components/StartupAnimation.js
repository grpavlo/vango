import React, { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors } from './Colors';

const createValue = () => new Animated.Value(0);

export default function StartupAnimation({ play = true, showSpinner = false, onFinish }) {
  const { width } = useWindowDimensions();
  const boxOne = useRef(createValue()).current;
  const boxTwo = useRef(createValue()).current;
  const boxThree = useRef(createValue()).current;
  const pickupDrive = useRef(createValue()).current;
  const logoOpacity = useRef(createValue()).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const smokeOne = useRef(createValue()).current;
  const smokeTwo = useRef(createValue()).current;
  const smokeThree = useRef(createValue()).current;

  const offscreenRight = Math.max(width * 1.15, 430);

  useEffect(() => {
    if (!play) {
      boxOne.setValue(1);
      boxTwo.setValue(1);
      boxThree.setValue(1);
      pickupDrive.setValue(1);
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      return undefined;
    }

    const values = [boxOne, boxTwo, boxThree, pickupDrive, logoOpacity, smokeOne, smokeTwo, smokeThree];
    values.forEach((value) => value.setValue(0));
    logoScale.setValue(0.92);

    const createSmokePulse = (value) =>
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 820,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]);

    const smokeLoop = Animated.loop(
      Animated.stagger(180, [
        createSmokePulse(smokeOne),
        createSmokePulse(smokeTwo),
        createSmokePulse(smokeThree),
      ])
    );

    smokeLoop.start();

    const intro = Animated.sequence([
      Animated.delay(180),
      Animated.timing(boxOne, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.25)),
        useNativeDriver: true,
      }),
      Animated.delay(80),
      Animated.timing(boxTwo, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.delay(70),
      Animated.timing(boxThree, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.15)),
        useNativeDriver: true,
      }),
      Animated.delay(180),
      Animated.timing(pickupDrive, {
        toValue: 1,
        duration: 2350,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(350),
    ]);

    intro.start(({ finished }) => {
      smokeLoop.stop();
      if (finished) {
        onFinish?.();
      }
    });

    return () => {
      intro.stop();
      smokeLoop.stop();
    };
  }, [
    boxOne,
    boxThree,
    boxTwo,
    logoOpacity,
    logoScale,
    onFinish,
    play,
    pickupDrive,
    smokeOne,
    smokeThree,
    smokeTwo,
  ]);

  const pickupTranslateX = pickupDrive.interpolate({
    inputRange: [0, 0.38, 0.5, 1],
    outputRange: [0, 0, 12, offscreenRight],
  });
  const pickupOpacity = pickupDrive.interpolate({
    inputRange: [0, 0.86, 1],
    outputRange: [1, 1, 0],
  });
  const smokeOpacity = pickupDrive.interpolate({
    inputRange: [0, 0.42, 0.48, 0.95, 1],
    outputRange: [0, 0, 1, 1, 0],
  });
  const pickupBounce = boxThree.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [0, 0, 5],
  });

  const boxAnimations = useMemo(
    () => [
      {
        value: boxOne,
        source: require('../../assets/boxGreen.png'),
        style: styles.boxGreenImage,
        start: { x: -35, y: -164, rotate: '-12deg' },
        end: { x: -4, y: 9, rotate: '6deg' },
      },
      {
        value: boxTwo,
        source: require('../../assets/box.png'),
        style: styles.boxTanImage,
        start: { x: 54, y: -190, rotate: '11deg' },
        end: { x: 43, y: 7, rotate: '-5deg' },
      },
      {
        value: boxThree,
        source: require('../../assets/boxBlue.png'),
        style: styles.boxBlueImage,
        start: { x: 16, y: -220, rotate: '8deg' },
        end: { x: 17, y: -45, rotate: '3deg' },
      },
    ],
    [boxOne, boxThree, boxTwo]
  );

  const renderFlyingBox = ({ value, source, style, start, end }) => {
    const translateX = value.interpolate({
      inputRange: [0, 1],
      outputRange: [start.x, end.x],
    });
    const translateY = value.interpolate({
      inputRange: [0, 0.72, 1],
      outputRange: [start.y, start.y - 18, end.y],
    });
    const rotate = value.interpolate({
      inputRange: [0, 1],
      outputRange: [start.rotate, end.rotate],
    });
    const scale = value.interpolate({
      inputRange: [0, 0.74, 1],
      outputRange: [0.9, 1.05, 1],
    });
    const opacity = value.interpolate({
      inputRange: [0, 0.12, 1],
      outputRange: [0, 1, 1],
    });

    return (
      <Animated.Image
        key={`${start.x}-${start.y}`}
        source={source}
        style={[
          styles.cargoBox,
          style,
          {
            opacity,
            transform: [{ translateX }, { translateY }, { rotate }, { scale }],
          },
        ]}
        resizeMode="contain"
      />
    );
  };

  const renderSmoke = (value, extraStyle) => {
    const translateX = value.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -42],
    });
    const translateY = value.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -13],
    });
    const scale = value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1.35],
    });
    const opacity = value.interpolate({
      inputRange: [0, 0.18, 1],
      outputRange: [0, 0.42, 0],
    });

    return (
      <Animated.View
        style={[
          styles.smokePuff,
          extraStyle,
          {
            opacity,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        {showSpinner ? (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View
        style={[
          styles.scene,
          {
            opacity: pickupOpacity,
            transform: [{ translateX: pickupTranslateX }],
          },
        ]}
      >
        <Animated.View style={[styles.cargoWrap, { transform: [{ translateY: pickupBounce }] }]}>
          {boxAnimations.map(renderFlyingBox)}
        </Animated.View>

        <Animated.View style={[styles.pickupImageWrap, { transform: [{ translateY: pickupBounce }] }]}>
          <Image source={require('../../assets/picap.png')} style={styles.pickupImage} />
        </Animated.View>

        <Animated.View style={[styles.smokeWrap, { opacity: smokeOpacity }]}>
          {renderSmoke(smokeOne, styles.smokeOne)}
          {renderSmoke(smokeTwo, styles.smokeTwo)}
          {renderSmoke(smokeThree, styles.smokeThree)}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#F7FFF5',
  },
  logoWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 240,
    height: 130,
    resizeMode: 'contain',
  },
  spinnerWrap: {
    marginTop: 14,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  scene: {
    width: 330,
    height: 230,
    justifyContent: 'flex-end',
  },
  pickupImageWrap: {
    position: 'absolute',
    left: 0,
    bottom: 18,
    width: 330,
    height: 160,
    overflow: 'hidden',
    zIndex: 3,
  },
  pickupImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cargoWrap: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 330,
    height: 230,
    zIndex: 2,
  },
  cargoBox: {
    position: 'absolute',
    left: 62,
    bottom: 98,
    width: 70,
    height: 67,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  boxGreenImage: {
    width: 72,
    height: 69,
  },
  boxTanImage: {
    width: 78,
    height: 75,
  },
  boxBlueImage: {
    width: 76,
    height: 73,
  },
  smokeWrap: {
    position: 'absolute',
    left: 8,
    bottom: 50,
    width: 86,
    height: 46,
    zIndex: 4,
  },
  smokePuff: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.72)',
  },
  smokeOne: {
    left: 14,
    bottom: 0,
  },
  smokeTwo: {
    left: 28,
    bottom: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  smokeThree: {
    left: 3,
    bottom: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
