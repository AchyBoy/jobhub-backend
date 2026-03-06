// JobHub/app/job/[id]/pdf-editor.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Dimensions,
  Text,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Pdf from "react-native-pdf";
import Svg, { Path, Circle } from "react-native-svg";
import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { usePreventRemove } from "@react-navigation/native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";

import { apiFetch } from "../../../src/lib/apiClient";
// ✅ only used for EXPORT (flatten copy for sending)
import { drawPathOnPdf } from "../../../components/pdf2/pdfWriter";

type Tool = "draw" | "erase" | "pan" | "lasso";

type Point = { x: number; y: number }; // normalized 0..1
type Stroke = {
  id: string;
  page: number;
  layerId: string;
  points: Point[];
  color: string;
  width: number;
};

type Layer = {
  id: string;
  name: string;
  visible: boolean;
};

const DEBUG = true;
function dbg(...args: any[]) {
  if (DEBUG) console.log(...args);
}

function isStylus(e: any) {
  return e?.nativeEvent?.pointerType === "pen";
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pointsToPath(points: Point[]) {
  if (!points || points.length < 2) return "";

  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;

    d += ` Q ${points[i].x},${points[i].y} ${midX},${midY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x},${last.y}`;

  return d;
}

// Distance from point p to segment ab (all normalized)
function distPointToSeg(p: Point, a: Point, b: Point) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);

  const t = c1 / c2;
  const proj = { x: a.x + t * vx, y: a.y + t * vy };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

function strokeHitTest(stroke: Stroke, p: Point, radius: number) {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return false;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distPointToSeg(p, pts[i], pts[i + 1]) <= radius) return true;
  }
  return false;
}

// ✂️ Split stroke when eraser hits it
function splitStrokeByEraser(stroke: Stroke, p: Point, radius: number): Stroke[] {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return [stroke];

  const segments: Point[][] = [];
  let current: Point[] = [];

  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];

    const dist = Math.hypot(pt.x - p.x, pt.y - p.y);

    if (dist <= radius) {
      // erase point
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [];
      continue;
    }

    current.push(pt);
  }

  if (current.length >= 2) {
    segments.push(current);
  }

return segments.map((seg) => ({
  id: makeId(),
  page: stroke.page,
  layerId: stroke.layerId,
  points: seg,
  color: stroke.color,
  width: stroke.width,
}));
}

export default function PdfEditor() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
const [pageCount, setPageCount] = useState(1);
const [page, setPage] = useState(1);
  const { width, height } = Dimensions.get("window");
  const [renderHeight, setRenderHeight] = useState(width * 1.8);

  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // ✅ Base PDF path (immutable, never overwritten)
  const basePdfPathRef = useRef<string | null>(null);

  // ✅ overlay file path (json)
  const overlayPathRef = useRef<string | null>(null);

  // === Overlay State ===
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const strokesRef = useRef<Stroke[]>([]);
  const loadingOverlayRef = useRef(true);
  // Upload throttling
const uploadTimerRef = useRef<any>(null);
const lastUploadRef = useRef(0);

const UPLOAD_INTERVAL = 6000; // 6 seconds
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

const [layersByPage, setLayersByPage] = useState<Record<number, Layer[]>>({});
const [activeLayerByPage, setActiveLayerByPage] = useState<Record<number, string>>({});
const layers = layersByPage[page] ?? [];
const activeLayer = activeLayerByPage[page];

  // Undo/redo (stores whole stroke arrays; simple + reliable)
  const undoRef = useRef<Stroke[][]>([]);
  const redoRef = useRef<Stroke[][]>([]);

  const pushUndo = (nextStrokes: Stroke[]) => {
    // store previous state
    undoRef.current.push(strokesRef.current);
    redoRef.current = [];
    setStrokes(nextStrokes);
  };

  // live drawing
  const [tool, setTool] = useState<Tool>("pan");
  const livePointsRef = useRef<Point[]>([]);
  const [livePoints, setLivePoints] = useState<Point[]>([]);
  const [strokeWidth, setStrokeWidth] = useState(3);
const [strokeColor, setStrokeColor] = useState("#ff0000");
  const [eraserSize, setEraserSize] = useState(22); // px-ish, UI feel
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);
// LASSO
const [lassoStart, setLassoStart] = useState<Point | null>(null);
const [lassoEnd, setLassoEnd] = useState<Point | null>(null);
const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
// DRAG SELECTED
const [dragStart, setDragStart] = useState<Point | null>(null);
  // === View system (pinch + pan) ===
  // NOTE: Overlay is drawn in same transformed container as PDF, so they stay aligned.
  const baseScale = useSharedValue(1);
  const pinchScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startPanX = useSharedValue(0);
  const startPanY = useSharedValue(0);
  const startBaseScale = useSharedValue(1);
  const focalX = useSharedValue(0);
const focalY = useSharedValue(0);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  useEffect(() => {
  panX.value = 0;
  panY.value = 0;
}, []);

const animatedStyle = useAnimatedStyle(() => {
  return {
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: baseScale.value },
    ],
  };
});

  // === Coordinate conversion ===
  // This stays exactly how you like it: local touch to normalized doc coords.
function toDocNormalized(lx: number, ly: number): Point {
  return {
    x: clamp01(lx / width),
    y: clamp01(ly / renderHeight),
  };
}

  // === Persistence ===
async function saveOverlay(next?: Stroke[]) {
  if (loadingOverlayRef.current) return;
  const path = overlayPathRef.current;
  if (!path) return;

  const payload = {
    strokes: next ?? strokesRef.current,
    layersByPage,
activeLayerByPage
  };

const json = JSON.stringify(payload);

await FileSystem.writeAsStringAsync(
  path,
  json,
  { encoding: "utf8" }
);
// ☁️ debounced upload
const now = Date.now();

if (now - lastUploadRef.current > UPLOAD_INTERVAL) {
  lastUploadRef.current = now;

  try {
    dbg("☁️ uploading overlay");

    await apiFetch(`/api/job-overlays/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    dbg("☁️ overlay uploaded");
  } catch (e) {
    console.warn("overlay upload failed", e);
  }

} else {

  if (uploadTimerRef.current) {
    clearTimeout(uploadTimerRef.current);
  }

  uploadTimerRef.current = setTimeout(async () => {
    try {
      dbg("☁️ delayed overlay upload");

      await apiFetch(`/api/job-overlays/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      });

      lastUploadRef.current = Date.now();

      dbg("☁️ overlay uploaded (delayed)");

    } catch (e) {
      console.warn("overlay upload failed", e);
    }
  }, UPLOAD_INTERVAL);

}

  dbg("💾 overlay saved", {
    strokes: payload.strokes.length,
    pagesWithLayers: Object.keys(payload.layersByPage).length
  });
}

async function loadOverlay() {
  const path = overlayPathRef.current;
  if (!path) return;

  try {
    const info = await FileSystem.getInfoAsync(path);

if (!info.exists) {
  setStrokes([]);
strokesRef.current = [];
setLayersByPage({});
setActiveLayerByPage({});
  setLayersByPage({});
  setActiveLayerByPage({});
  return;
}

    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw);

    const loadedStrokes: Stroke[] =
      Array.isArray(parsed?.strokes) ? parsed.strokes : [];

const loadedLayersByPage = parsed?.layersByPage ?? {};
const loadedActiveLayerByPage = parsed?.activeLayerByPage ?? {};

setLayersByPage(loadedLayersByPage);
setActiveLayerByPage(loadedActiveLayerByPage);

setStrokes(loadedStrokes);
strokesRef.current = loadedStrokes;

loadingOverlayRef.current = false;

dbg("📥 overlay loaded", {
  strokes: loadedStrokes.length,
  pagesWithLayers: Object.keys(loadedLayersByPage).length
});

  } catch (e) {
    console.warn("overlay load failed", e);
    setStrokes([]);
strokesRef.current = [];
setLayersByPage({});
setActiveLayerByPage({});
  }
}

useEffect(() => {
  return () => {
    if (uploadTimerRef.current) {
      clearTimeout(uploadTimerRef.current);
    }
  };
}, []);

useEffect(() => {
  livePointsRef.current = [];
  setLivePoints([]);

  if (loading || loadingOverlayRef.current) return;

  const pageLayers = layersByPage[page] ?? [];
  if (pageLayers.length > 0) return;

  const id = makeId();

  setLayersByPage((prev) => ({
    ...prev,
    [page]: [{ id, name: "Markup", visible: true }],
  }));

  setActiveLayerByPage((prev) => ({
    ...prev,
    [page]: prev[page] ?? id,
  }));

  setTimeout(() => saveOverlay(), 0);
}, [page, loading]);

  // === App lifecycle: always persist overlay on leave/background ===
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background" || state === "inactive") {
        try {
          await saveOverlay();
          dbg("✅ overlay saved on background");
        } catch (e) {
          console.warn("overlay save on background failed", e);
        }
      }
    });
    return () => sub.remove();
  }, []);

  usePreventRemove(false, ({ data }) => {
    (async () => {
      try {
        await saveOverlay();
      } catch (e) {
        console.warn("overlay save before leave failed", e);
      }
      navigation.dispatch(data.action);
    })();
  });

  // === Load base PDF and overlay paths ===
  async function load() {
    try {
const job = await apiFetch(`/api/job/${id}`);
const pdfId = job.job.pdfId;

const pdf = await apiFetch(`/api/job-pdfs/${pdfId}/url`);
setPdfUrl(pdf.url);

const baseDir =
  (FileSystem as any)["documentDirectory"] || (FileSystem as any)["cacheDirectory"];

// ✅ include pdfId so cache invalidates when PDF changes
const basePdfPath = `${baseDir}jobpdf_${id}_${pdfId}.pdf`;

const overlayPath = `${baseDir}jobpdf_${id}.overlay.json`;

      basePdfPathRef.current = basePdfPath;
      overlayPathRef.current = overlayPath;

      // download base PDF if missing
      const info = await FileSystem.getInfoAsync(basePdfPath);
      if (!info.exists) {
        await FileSystem.downloadAsync(pdf.url, basePdfPath);
        dbg("📄 base pdf downloaded", basePdfPath);
      } else {
        dbg("📄 base pdf exists", basePdfPath);
      }

      // ☁️ try downloading overlay from server
try {
  dbg("☁️ requesting overlay url");

  const remote = await apiFetch(`/api/job-overlays/${id}/url`);

  if (remote?.url) {
    dbg("☁️ downloading overlay");

    const res = await fetch(remote.url);
    const text = await res.text();

    await FileSystem.writeAsStringAsync(
      overlayPath,
      text,
      { encoding: "utf8" }
    );

    dbg("☁️ overlay downloaded");
  }
} catch (e) {
  dbg("☁️ no remote overlay yet");
}

await loadOverlay();
    } catch (e) {
      console.warn("PDF load failed", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // === Gestures: only when tool=pan (or you can allow always and disable drawing touches) ===
 const PAN_MARGIN_X = 60;   // sides
const PAN_MARGIN_TOP = 20; // top
const PAN_MARGIN_BOTTOM = 160; // bottom (keep roomy)
  const panGesture = Gesture.Pan()
    .enabled(tool === "pan")
    .onBegin(() => {
      startPanX.value = panX.value;
      startPanY.value = panY.value;
    })
    
.onUpdate((e) => {
  const scale = baseScale.value;
  
const scaledWidth = width * scale;
const scaledHeight = renderHeight * scale;

// ... inside onUpdate
// 1. Calculate how much the content exceeds the screen dimensions
const overflowX = Math.max(0, (width * scale) - width);
const overflowY = Math.max(0, ((renderHeight + 300) * scale) - height);

const nextX = startPanX.value + e.translationX;
const nextY = startPanY.value + e.translationY;

// 2. Horizontal limits (Centered)
const limitX = overflowX / 2 + PAN_MARGIN_X;
panX.value = Math.max(-limitX, Math.min(limitX, nextX));

// 3. Vertical limits
// Since RN scales from the center, the "Top" of the view moves up 
// by (overflowY / 2). We allow panning by that amount plus your margin.
const limitY = (overflowY / 2) + PAN_MARGIN_TOP;

// We use -limitY and +limitY because the origin (0,0) is the screen center
panY.value = Math.max(-limitY, Math.min(limitY, nextY));
});

const pinchGesture = Gesture.Pinch()
  .enabled(tool === "pan")
  .onBegin((e) => {
    startBaseScale.value = baseScale.value;

    focalX.value = e.focalX;
    focalY.value = e.focalY;
  })
  .onUpdate((e) => {
    const prevScale = baseScale.value;

    const nextScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, startBaseScale.value * e.scale)
    );

    const scaleChange = nextScale / prevScale;

    // update focal every frame
    focalX.value = e.focalX;
    focalY.value = e.focalY;

    panX.value = focalX.value - (focalX.value - panX.value) * scaleChange;
    panY.value = focalY.value - (focalY.value - panY.value) * scaleChange;

    baseScale.value = nextScale;
  });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  // === Erase ===
function eraseAt(lx: number, ly: number) {
  const p = toDocNormalized(lx, ly);
  const r = eraserSize / width;

  const result: Stroke[] = [];

  for (const stroke of strokesRef.current) {
    if (!strokeHitTest(stroke, p, r)) {
      result.push(stroke);
      continue;
    }

    // ✂️ split stroke instead of deleting it
    const split = splitStrokeByEraser(stroke, p, r);
    result.push(...split);
  }

  if (result.length !== strokesRef.current.length) {
    pushUndo(result);
    saveOverlay(result);
  }
}

  // === Undo/redo ===
  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(strokesRef.current);
    setStrokes(prev);
    saveOverlay(prev);
  }

  function moveSelected(dx: number, dy: number) {
  if (selectedStrokeIds.length === 0) return;

  const next = strokesRef.current.map((s) => {
    if (!selectedStrokeIds.includes(s.id)) return s;

    return {
      ...s,
      points: s.points.map((p) => ({
        x: clamp01(p.x + dx),
        y: clamp01(p.y + dy),
      })),
    };
  });

  setStrokes(next);
  strokesRef.current = next;
}

function duplicateSelected() {
  if (selectedStrokeIds.length === 0) return;

  const copies: Stroke[] = strokesRef.current
    .filter((s) => selectedStrokeIds.includes(s.id))
    .map((s) => ({
      ...s,
      id: makeId(),
      points: s.points.map((p) => ({
        x: clamp01(p.x + 0.02),
        y: clamp01(p.y + 0.02),
      })),
    }));

  const next = [...strokesRef.current, ...copies];

  pushUndo(next);
  saveOverlay(next);
}

function deleteSelected() {
  if (selectedStrokeIds.length === 0) return;

  const next = strokesRef.current.filter(
    (s) => !selectedStrokeIds.includes(s.id)
  );

  pushUndo(next);
  saveOverlay(next);

  setSelectedStrokeIds([]);
}

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(strokesRef.current);
    setStrokes(next);
    saveOverlay(next);
  }

  // === Export flattened copy for sending (base stays untouched) ===
  async function exportFlattenedAndSend() {
    try {
      const base = basePdfPathRef.current;
      if (!base) return;

      if (strokesRef.current.length === 0) {
        Alert.alert("No Markup", "No overlay strokes to export.");
        return;
      }

      // Convert strokes → one merged PDF path string (your existing writer expects SVG-ish path)
      // Since our Path is normalized 0..1 already, we can directly feed.
      // drawPathOnPdf currently expects a merged path string like " M ... L ... M ... L ..."
const merged = strokesRef.current
  .filter((s) => s.page === page)
  .map((s) => pointsToPath(s.points))
  .filter(Boolean)
  .map((d) => ` ${d}`)
  .join("");

      const out = await drawPathOnPdf(base, merged);

      // out is a new temp pdf path. You can now share/email/upload it.
      // Example: just alert for now.
      Alert.alert("Exported", `Flattened copy created:\n${out}`);
    } catch (e) {
      console.warn("export failed", e);
      Alert.alert("Export Failed", "Could not create flattened copy.");
    }
  }

  // === UI ===
  if (loading || !pdfUrl || !basePdfPathRef.current) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* TOOLBAR */}
      <View style={{ position: "absolute", right: 10, top: 80, zIndex: 20 }}>
        <Pressable
          onPress={() => setTool("pan")}
          style={{
            backgroundColor: tool === "pan" ? "#ff9500" : "#333",
            padding: 8,
            marginBottom: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Pan/Zoom</Text>
        </Pressable>

        <Pressable
          onPress={() => setTool("draw")}
          style={{
            backgroundColor: tool === "draw" ? "#0a84ff" : "#333",
            padding: 8,
            marginBottom: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Draw</Text>
        </Pressable>

        <Pressable
          onPress={() => setTool("erase")}
          style={{
            backgroundColor: tool === "erase" ? "#0a84ff" : "#333",
            padding: 8,
            marginBottom: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Erase</Text>
        </Pressable>

        <Pressable
  onPress={() => setTool("lasso")}
  style={{
    backgroundColor: tool === "lasso" ? "#0a84ff" : "#333",
    padding: 8,
    marginBottom: 8,
    borderRadius: 6,
  }}
>
  <Text style={{ color: "white" }}>Lasso</Text>
</Pressable>

        <Pressable
          onPress={undo}
          style={{
            backgroundColor: "#444",
            padding: 8,
            marginBottom: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Undo</Text>
        </Pressable>

<Pressable
  onPress={redo}
  style={{
    backgroundColor: "#444",
    padding: 8,
    marginBottom: 8,
    borderRadius: 6,
  }}
>
  <Text style={{ color: "white" }}>Redo</Text>
</Pressable>

{selectedStrokeIds.length > 0 && (
<>
  <Pressable
    onPress={duplicateSelected}
    style={{
      backgroundColor: "#0a84ff",
      padding: 8,
      marginBottom: 8,
      borderRadius: 6,
    }}
  >
    <Text style={{ color: "white" }}>Duplicate</Text>
  </Pressable>

  <Pressable
    onPress={deleteSelected}
    style={{
      backgroundColor: "#ff3b30",
      padding: 8,
      marginBottom: 8,
      borderRadius: 6,
    }}
  >
    <Text style={{ color: "white" }}>Delete</Text>
  </Pressable>
</>
)}

        <View style={{ marginTop: 14 }}>
  <Text style={{ color: "white", marginBottom: 6 }}>Layers</Text>

  {layers.length === 0 && (
  <Text style={{ color: "#aaa", fontSize: 12 }}>
    No layers on this page
  </Text>
)}

{layers.map((l) => (
    <View key={l.id} style={{ flexDirection: "row", marginBottom: 4 }}>
      
      <Pressable
        onPress={() =>
  setActiveLayerByPage((prev) => ({
    ...prev,
    [page]: l.id
  }))
}
        style={{
          backgroundColor: activeLayer === l.id ? "#0a84ff" : "#333",
          padding: 6,
          marginRight: 4,
          borderRadius: 4
        }}
      >
        <Text style={{ color: "white" }}>{l.name}</Text>
      </Pressable>

<Pressable
  onPress={() =>
    setLayersByPage((prev) => {
      const pageLayers = prev[page] ?? [];

      const next = {
        ...prev,
        [page]: pageLayers.map((x) =>
          x.id === l.id ? { ...x, visible: !x.visible } : x
        ),
      };

      // persist change
      setTimeout(() => saveOverlay(), 0);

      return next;
    })
  }
  style={{
    backgroundColor: l.visible ? "#2ecc71" : "#444",
    padding: 6,
    borderRadius: 4,
  }}
>
  <Text style={{ color: "white" }}>
    {l.visible ? "👁" : "🚫"}
  </Text>
</Pressable>

    </View>
  ))}
</View>

<Pressable
  onPress={() => {
    const id = makeId();
setLayersByPage((prev) => {
  const pageLayers = prev[page] ?? [];

  const next = {
    ...prev,
    [page]: [
      ...pageLayers,
      { id, name: `Layer ${pageLayers.length + 1}`, visible: true }
    ]
  };

  setTimeout(() => saveOverlay(), 0);

  return next;
});

setActiveLayerByPage((prev) => ({
  ...prev,
  [page]: id
}));
  }}
  style={{
    backgroundColor: "#555",
    padding: 6,
    marginTop: 6,
    borderRadius: 4
  }}
>
  <Text style={{ color: "white" }}>+ Layer</Text>
</Pressable>

        <Pressable
  onPress={() => setShowOverlay(!showOverlay)}
  style={{
    backgroundColor: showOverlay ? "#0a84ff" : "#333",
    padding: 8,
    marginBottom: 8,
    borderRadius: 6,
  }}
>
  <Text style={{ color: "white" }}>
    {showOverlay ? "Hide Layer" : "Show Layer"}
  </Text>
</Pressable>

        <Pressable
          onPress={exportFlattenedAndSend}
          style={{
            backgroundColor: "#28a745",
            padding: 8,
            marginBottom: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white" }}>Export (Send)</Text>
        </Pressable>

{/* Eraser size quick buttons */}
{tool === "erase" && (
<View style={{ flexDirection: "row", marginTop: 8 }}>
  <Pressable
    onPress={() => setEraserSize(12)}
    style={{
      backgroundColor: eraserSize === 12 ? "#0a84ff" : "#333",
      padding: 6,
      marginRight: 4
    }}
  >
    <Text style={{ color: "white" }}>S</Text>
  </Pressable>

  <Pressable
    onPress={() => setEraserSize(22)}
    style={{
      backgroundColor: eraserSize === 22 ? "#0a84ff" : "#333",
      padding: 6,
      marginRight: 4
    }}
  >
    <Text style={{ color: "white" }}>M</Text>
  </Pressable>

  <Pressable
    onPress={() => setEraserSize(38)}
    style={{
      backgroundColor: eraserSize === 38 ? "#0a84ff" : "#333",
      padding: 6
    }}
  >
    <Text style={{ color: "white" }}>L</Text>
  </Pressable>
</View>
)}

{/* Stroke size */}
{tool === "draw" && (
<View style={{ flexDirection: "row", marginTop: 10 }}>
  <Pressable
    onPress={() => setStrokeWidth(2)}
    style={{
      backgroundColor: strokeWidth === 2 ? "#0a84ff" : "#333",
      padding: 6,
      marginRight: 4
    }}
  >
    <Text style={{ color: "white" }}>Thin</Text>
  </Pressable>

  <Pressable
    onPress={() => setStrokeWidth(4)}
    style={{
      backgroundColor: strokeWidth === 4 ? "#0a84ff" : "#333",
      padding: 6,
      marginRight: 4
    }}
  >
    <Text style={{ color: "white" }}>Med</Text>
  </Pressable>

  <Pressable
    onPress={() => setStrokeWidth(7)}
    style={{
      backgroundColor: strokeWidth === 7 ? "#0a84ff" : "#333",
      padding: 6
    }}
  >
    <Text style={{ color: "white" }}>Thick</Text>
  </Pressable>
</View>
)}

{tool === "draw" && (
<View style={{ flexDirection: "row", marginTop: 10 }}>
  {["#ff0000","#00ff00","#0066ff","#ffff00","#ffffff"].map((c) => (
    <Pressable
      key={c}
      onPress={() => setStrokeColor(c)}
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        backgroundColor: c,
        marginRight: 6,
        borderWidth: strokeColor === c ? 2 : 0,
        borderColor: "#fff"
      }}
    />
  ))}
</View>
)}

      </View>

      {/* INPUT LAYER (handles draw/erase only; pan/zoom handled by GestureDetector) */}
<View
  style={{ flex: 1, width }}
onStartShouldSetResponder={(e) => {
  const type = (e.nativeEvent as any).pointerType;

  // ignore palm / multiple fingers
  if (type === "touch" && tool === "draw") {
    return false;
  }

  const { locationX, locationY } = e.nativeEvent;

  if (locationX > width - 120 && locationY < 260) return false;

  if (tool === "draw" && !activeLayer) return false;

return tool === "draw" || tool === "erase" || tool === "lasso";
}}
        onResponderGrant={(e) => {
          const { locationX: lx, locationY: ly } = e.nativeEvent as any;

          if (tool === "erase") {
            setEraserCursor({ x: lx, y: ly });
            eraseAt(lx, ly);
            return;
          }

if (tool === "lasso") {
  const p = toDocNormalized(lx, ly);

  // if something already selected → start drag
  if (selectedStrokeIds.length > 0) {
    setDragStart(p);
    return;
  }

  // otherwise start new selection
  setLassoStart(p);
  setLassoEnd(p);
  return;
}

          if (tool === "draw") {
            const p = toDocNormalized(lx, ly);
            livePointsRef.current = [p];
            setLivePoints([p]);
          }
        }}
        onResponderMove={(e) => {
          const { locationX: lx, locationY: ly } = e.nativeEvent as any;

          if (tool === "erase") {
            setEraserCursor({ x: lx, y: ly });
            eraseAt(lx, ly);
            return;
          }

if (tool === "lasso") {
  const p = toDocNormalized(lx, ly);

  if (dragStart) {
    const dx = p.x - dragStart.x;
    const dy = p.y - dragStart.y;

    moveSelected(dx, dy);
    setDragStart(p);
    return;
  }

  setLassoEnd(p);
  return;
}

if (tool !== "draw") return;

          const p = toDocNormalized(lx, ly);
          const next = [...livePointsRef.current, p];
          livePointsRef.current = next;

          // throttle UI updates a bit
          if (next.length % 2 === 0) setLivePoints(next);
        }}
        onResponderRelease={() => {
            setEraserCursor(null);

if (tool === "lasso") {
  setDragStart(null);

  if (!lassoStart || !lassoEnd) return;

  const minX = Math.min(lassoStart.x, lassoEnd.x);
  const maxX = Math.max(lassoStart.x, lassoEnd.x);
  const minY = Math.min(lassoStart.y, lassoEnd.y);
  const maxY = Math.max(lassoStart.y, lassoEnd.y);

  const hits = strokesRef.current
    .filter(s => s.page === page)
    .filter(s =>
      s.points.some(p =>
        p.x >= minX &&
        p.x <= maxX &&
        p.y >= minY &&
        p.y <= maxY
      )
    )
    .map(s => s.id);

  setSelectedStrokeIds(hits);

  setLassoStart(null);
  setLassoEnd(null);

  return;
}

if (tool !== "draw") return;

          const pts = livePointsRef.current;
          livePointsRef.current = [];
          setLivePoints([]);

          if (!pts || pts.length < 2) return;

if (!activeLayer) return;

const stroke: Stroke = {
  id: makeId(),
  page,
  layerId: activeLayer,
  points: pts,
  color: strokeColor,
  width: strokeWidth
};

          const next = [...strokesRef.current, stroke];
          pushUndo(next);
          saveOverlay(next);

          dbg("🖊️ stroke committed", { n: pts.length, total: next.length });
        }}
      >
        {/* VIEW SYSTEM */}
        {tool === "pan" && pageCount > 1 && (
<View
  style={{
    position: "absolute",
    left: 8,
    top: 120,
    zIndex: 30,
    backgroundColor: "#0009",
    borderRadius: 8,
    paddingVertical: 6
  }}
>
  {Array.from({ length: pageCount }).map((_, i) => {
    const p = i + 1;

    return (
      <Pressable
        key={p}
        onPress={() => setPage(p)}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
          backgroundColor: p === page ? "#0a84ff" : "transparent"
        }}
      >
        <Text style={{ color: "white", fontSize: 12 }}>
          {p}
        </Text>
      </Pressable>
    );
  })}
</View>
)}
        <GestureDetector gesture={composed}>
          <Animated.View style={[{ width, height: renderHeight + 300 }, animatedStyle]}>
            {/* PDF (immutable) */}
            <Pdf
onLoadComplete={(pages, filePath, size) => {
  setPageCount(pages);

  if (size?.width && size?.height) {
    const ratio = size.height / size.width;
    const next = width * ratio;
    if (Math.abs(next - renderHeight) > 1) setRenderHeight(next);
  }
}}
            page={page}
              source={{ uri: basePdfPathRef.current! }}
                style={{ width, height: renderHeight, top: 100, position: "absolute" }}
              enablePaging={false}
              enableDoubleTapZoom={false}
              scrollEnabled={false}
              scale={1}
              minScale={1}
              maxScale={1}
            />

            {/* OVERLAY (same transform container as PDF) */}
            {showOverlay && (
<Svg
              width={width}
              height={renderHeight}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
style={{
  position: "absolute",
  top: 100,
  left: 0,
}}
              pointerEvents="none"
            >
              {/* committed strokes */}
              {strokes
.filter(
  s =>
    s.page === page &&
    layers.find(l => l.id === s.layerId)?.visible
)
.map((s) => (
                <Path
                  key={s.id}
                  d={pointsToPath(s.points)}
                  stroke={selectedStrokeIds.includes(s.id) ? "#0a84ff" : s.color}
                  // width normalization: convert px-ish to viewBox units using width
                  strokeWidth={s.width / 500}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* lasso selection box */}
{tool === "lasso" && lassoStart && lassoEnd && (
  <Path
    d={`M ${lassoStart.x},${lassoStart.y}
        L ${lassoEnd.x},${lassoStart.y}
        L ${lassoEnd.x},${lassoEnd.y}
        L ${lassoStart.x},${lassoEnd.y}
        Z`}
    stroke="#0a84ff"
    strokeWidth={0.002}
    fill="rgba(10,132,255,0.1)"
  />
)}

              {/* live stroke */}
              {livePoints.length >= 2 ? (
                <Path
                  d={pointsToPath(livePoints)}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth / 500}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
            )}

            {/* Optional: show eraser cursor while erasing (simple visual) */}
{tool === "erase" && eraserCursor && (
  <Circle
    cx={eraserCursor.x / width}
    cy={eraserCursor.y / renderHeight}
    r={(eraserSize / width) * 0.5}
    stroke="white"
    strokeWidth={0.002}
    fill="rgba(255,255,255,0.2)"
  />
)}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}