import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

type AppLogoProps = {
  size?: number;
  animated?: boolean;
  style?: ViewStyle;
};

const LOGO_COLOR = colors.primary;
const GAP = 2;

export function AppLogo({ size = 56, animated = false, style }: AppLogoProps) {
  const cellSize = (size - GAP) / 2;
  const borderWidth = size < 30 ? 1.5 : 2;
  const baseRadius = size < 30 ? 2 : 4;

  if (animated) {
    return (
      <AnimatedLogo
        size={size}
        cellSize={cellSize}
        borderWidth={borderWidth}
        baseRadius={baseRadius}
        style={style}
      />
    );
  }

  return (
    <View style={[styles.grid, { width: size, height: size }, style]}>
      <QuadrantTopLeft cellSize={cellSize} borderWidth={borderWidth} baseRadius={baseRadius} />
      <QuadrantTopRight cellSize={cellSize} />
      <QuadrantBottomLeft cellSize={cellSize} borderWidth={borderWidth} baseRadius={baseRadius} />
      <QuadrantBottomRight cellSize={cellSize} borderWidth={borderWidth} baseRadius={baseRadius} />
    </View>
  );
}

function QuadrantTopLeft({
  cellSize,
  borderWidth,
  baseRadius,
}: {
  cellSize: number;
  borderWidth: number;
  baseRadius: number;
}) {
  return (
    <View
      style={{
        width: cellSize,
        height: cellSize,
        borderWidth,
        borderColor: LOGO_COLOR,
        borderTopLeftRadius: baseRadius + 1,
        borderTopRightRadius: baseRadius,
        borderBottomLeftRadius: baseRadius,
        borderBottomRightRadius: baseRadius,
      }}
    />
  );
}

function QuadrantTopRight({ cellSize }: { cellSize: number }) {
  return (
    <View
      style={{
        width: cellSize,
        height: cellSize,
        backgroundColor: LOGO_COLOR,
        borderRadius: cellSize / 2,
      }}
    />
  );
}

function QuadrantBottomLeft({
  cellSize,
  borderWidth,
  baseRadius,
}: {
  cellSize: number;
  borderWidth: number;
  baseRadius: number;
}) {
  return (
    <View
      style={{
        width: cellSize,
        height: cellSize,
        borderWidth,
        borderColor: LOGO_COLOR,
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: baseRadius,
        borderBottomLeftRadius: baseRadius + 1,
        borderBottomRightRadius: baseRadius,
      }}
    />
  );
}

function QuadrantBottomRight({
  cellSize,
  borderWidth,
  baseRadius,
}: {
  cellSize: number;
  borderWidth: number;
  baseRadius: number;
}) {
  return (
    <View
      style={{
        width: cellSize,
        height: cellSize,
        borderWidth,
        borderColor: LOGO_COLOR,
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: baseRadius,
        borderBottomLeftRadius: baseRadius,
        borderBottomRightRadius: baseRadius + 1,
      }}
    />
  );
}

function AnimatedLogo({
  size,
  cellSize,
  borderWidth,
  baseRadius,
  style,
}: {
  size: number;
  cellSize: number;
  borderWidth: number;
  baseRadius: number;
  style?: ViewStyle;
}) {
  const spread = cellSize * 0.6;

  const anim0 = useRef(new Animated.ValueXY({ x: -spread, y: -spread })).current;
  const anim1 = useRef(new Animated.ValueXY({ x: spread, y: -spread })).current;
  const anim2 = useRef(new Animated.ValueXY({ x: -spread, y: spread })).current;
  const anim3 = useRef(new Animated.ValueXY({ x: spread, y: spread })).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anims = [anim0, anim1, anim2, anim3];

    function assemble() {
      return Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.stagger(
          80,
          anims.map((a) =>
            Animated.spring(a, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              damping: 14,
              stiffness: 100,
            })
          )
        ),
      ]);
    }

    function scatter() {
      const targets = [
        { x: -spread, y: -spread },
        { x: spread, y: -spread },
        { x: -spread, y: spread },
        { x: spread, y: spread },
      ];
      return Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.stagger(
          60,
          anims.map((a, i) =>
            Animated.timing(a, {
              toValue: targets[i],
              duration: 300,
              useNativeDriver: true,
            })
          )
        ),
      ]);
    }

    const loop = Animated.loop(
      Animated.sequence([assemble(), Animated.delay(2200), scatter(), Animated.delay(400)])
    );

    loop.start();
    return () => loop.stop();
  }, []);

  const cellStyles = [
    {
      transform: [{ translateX: anim0.x }, { translateY: anim0.y }],
      borderWidth,
      borderColor: LOGO_COLOR,
      borderTopLeftRadius: baseRadius + 1,
      borderTopRightRadius: baseRadius,
      borderBottomLeftRadius: baseRadius,
      borderBottomRightRadius: baseRadius,
    },
    {
      transform: [{ translateX: anim1.x }, { translateY: anim1.y }],
      backgroundColor: LOGO_COLOR,
      borderRadius: cellSize / 2,
    },
    {
      transform: [{ translateX: anim2.x }, { translateY: anim2.y }],
      borderWidth,
      borderColor: LOGO_COLOR,
      borderTopLeftRadius: baseRadius,
      borderTopRightRadius: baseRadius,
      borderBottomLeftRadius: baseRadius + 1,
      borderBottomRightRadius: baseRadius,
    },
    {
      transform: [{ translateX: anim3.x }, { translateY: anim3.y }],
      borderWidth,
      borderColor: LOGO_COLOR,
      borderTopLeftRadius: baseRadius,
      borderTopRightRadius: baseRadius,
      borderBottomLeftRadius: baseRadius,
      borderBottomRightRadius: baseRadius + 1,
    },
  ];

  return (
    <Animated.View style={[styles.grid, { width: size, height: size, opacity }, style]}>
      {cellStyles.map((cellStyle, i) => (
        <Animated.View key={i} style={[{ width: cellSize, height: cellSize }, cellStyle]} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});
