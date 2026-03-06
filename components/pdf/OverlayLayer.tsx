// JobHub/components/pdf/OverlayLayer.tsx
import React from "react";
import { View, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";

export default function OverlayLayer({
  overlays,
  width,
  height,
  activeLayer,
}: any) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
      }}
    >
      {overlays
        .filter((o: any) => o.layer === activeLayer)
        .map((item: any) => {
          // ✅ draw paths are stored normalized (0..1), so render in a normalized viewBox
          if (item.type === "draw") {
            const d = item.textContent || item.path || "";
            if (!d) return null;

            return (
              <Svg
                key={item.id}
                width={width}
                height={height}
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={{ position: "absolute", top: 0, left: 0 }}
              >
                <Path d={d} stroke="red" strokeWidth={0.004} fill="none" />
              </Svg>
            );
          }

          // boxes are stored normalized too, so multiply to pixels
          return (
            <Pressable
              key={item.id}
              style={{
                position: "absolute",
                left: Number(item.x) * width,
                top: Number(item.y) * height,
                width: Number(item.width) * width,
                height: Number(item.height) * height,
                backgroundColor: item.color || "rgba(255,0,0,0.3)",
                borderWidth: 1,
                borderColor: item.color || "red",
              }}
            />
          );
        })}
    </View>
  );
}