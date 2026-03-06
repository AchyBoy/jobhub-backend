// JobHub/components/pdf/GestureLayer.tsx
import React, { useRef } from "react";
import { Animated, Dimensions } from "react-native";
import {
  PinchGestureHandler,
  PanGestureHandler,
  State,
} from "react-native-gesture-handler";

export default function GestureLayer({
  scale,        // Animated.Value base scale (committed)
  translateX,   // Animated.Value live pan
  translateY,   // Animated.Value live pan
  panEnabled = true,
  children,
}: any) {
  // persistent pan offsets
  const lastX = useRef(0);
  const lastY = useRef(0);

  // persistent scale
  const lastScale = useRef(1);

  // live pinch values (native-driven)
  const pinchScale = useRef(new Animated.Value(1)).current;
  const focalX = useRef(new Animated.Value(0)).current;
  const focalY = useRef(new Animated.Value(0)).current;

  const { width, height } = Dimensions.get("window");

const focalXCentered = useRef(Animated.subtract(focalX, width / 2)).current;
const focalYCentered = useRef(Animated.subtract(focalY, height / 2)).current;

const negFocalXCentered = useRef(Animated.multiply(focalXCentered, -1)).current;
const negFocalYCentered = useRef(Animated.multiply(focalYCentered, -1)).current;

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  // refs so pinch + pan can run simultaneously (2-finger pan + pinch)
  const panRef = useRef<any>(null);
  const pinchRef = useRef<any>(null);

  // effective scale while pinching = base * pinch
const effectiveScale = useRef(
  Animated.multiply(scale, pinchScale)
).current;


  const content = (
<PinchGestureHandler
  ref={pinchRef}
  enabled={panEnabled}
  simultaneousHandlers={panRef}
  onBegan={() => {
    pinchScale.setValue(1);
  }}
  
      onGestureEvent={Animated.event(
        [{ nativeEvent: { scale: pinchScale, focalX, focalY } }],
        { useNativeDriver: true }
      )}
      onHandlerStateChange={(event) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
          // commit the scale at end of pinch (clamped)
let nextScale = lastScale.current * event.nativeEvent.scale;
nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));

const scaleFactor = nextScale / lastScale.current;

// adjust pan offsets relative to screen center
lastX.current *= scaleFactor;
lastY.current *= scaleFactor;

translateX.setOffset(lastX.current);
translateY.setOffset(lastY.current);

lastScale.current = nextScale;
scale.setValue(nextScale);

pinchScale.setValue(1);
        }
      }}
    >
      <Animated.View
        style={{
          flex: 1,
transform: [
  // Commit pan first (base offset)
  { translateX },
  { translateY },
  // Then focal zoom group: translate to focal → scale → translate back
{ translateX: focalXCentered },
{ translateY: focalYCentered },
{ scale: effectiveScale },
{ translateX: negFocalXCentered },
{ translateY: negFocalYCentered },
],
        }}
      >
        {children}
      </Animated.View>
    </PinchGestureHandler>
  );

  if (!panEnabled) {
    return <Animated.View style={{ flex: 1 }}>{content}</Animated.View>;
  }

  return (
    <PanGestureHandler
      ref={panRef}
      simultaneousHandlers={pinchRef}
      maxPointers={2} // allow 2-finger pan
      onGestureEvent={Animated.event(
        [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
        { useNativeDriver: true }
      )}
      onHandlerStateChange={(event) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
          lastX.current += event.nativeEvent.translationX;
          lastY.current += event.nativeEvent.translationY;

          translateX.setOffset(lastX.current);
          translateX.setValue(0);

          translateY.setOffset(lastY.current);
          translateY.setValue(0);
        }
      }}
    >
      <Animated.View style={{ flex: 1 }}>{content}</Animated.View>
    </PanGestureHandler>
  );
}