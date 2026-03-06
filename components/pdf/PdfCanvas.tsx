//JobHub/components/pdf/PdfCanvas.tsx
import React from "react";
import { View } from "react-native";
import Pdf from "react-native-pdf";

export default function PdfCanvas({
  pdfUrl,
  width,
  height,
}: {
  pdfUrl: string;
  width: number;
  height: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        overflow: "hidden",
      }}
    >
      <Pdf
        source={{ uri: pdfUrl }}
        style={{
          position: "absolute",
          width,
          height,
        }}
        enablePaging={false}
        enableAnnotationRendering={false}
        enableDoubleTapZoom={false}
        scrollEnabled={false}

        // lock PDF scaling
        scale={1}
        minScale={1}
        maxScale={1}
        fitPolicy={0}
      />
    </View>
  );
}