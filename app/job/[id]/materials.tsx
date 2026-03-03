//JobHub/app/job/[id]/materials.tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';
import { generateOrderPdf } from '../../../src/lib/pdfGenerator';
import {
  persistLocalPdf,
  getValidLocalPdf,
  downloadAndPersistPdf,
} from '../../../src/lib/pdfLocalStore';
import * as Linking from 'expo-linking';
import { useRef } from 'react';
import { useRouter } from 'expo-router';


export default function MaterialsScreen() {
  const { id } = useLocalSearchParams();
  const jobId = id as string;
const router = useRouter();
  const [ordering, setOrdering] = useState(false);
const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const [phases, setPhases] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
const [vendorMap, setVendorMap] = useState<Record<string, any>>({});

const [newVendorId, setNewVendorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
const [showSearch, setShowSearch] = useState(false);
const [highlightedMaterial, setHighlightedMaterial] = useState<string | null>(null);
const lastTapRef = useRef<Record<string, number>>({});
const scrollRef = useRef<ScrollView>(null);
// (move these LOWER after newName is declared)
const scrollYRef = useRef(0);

// Anchor = “which item was in view”, not “what scrollY was”
const anchorMaterialIdRef = useRef<string | null>(null);
const anchorOffsetRef = useRef<number>(0);
const [helpOpen, setHelpOpen] = useState<null | 'edit' | 'add'>(null);

const EDIT_HELP = [
  'Edit Mode is for office/admin changes.',
  'Tap “☐ Select” on items to select multiple materials.',
  'When you have selections, a blue bar appears to bulk-change Supplier for those items.',
  'You can edit Qty Needed using the number box or +/− buttons.',
  'On-Hand lets you allocate stock (it reduces what will be ordered).',
  'If an item is already “✓ Ordered”, it is locked from Qty edits.',
  'Hold an item to delete (owner/admin only).',
  'Tip: Double-tap an item to collapse its Phase bucket.',
];

const ADD_HELP = [
  'Step 1: Select a Phase.',
  'Step 2: Select either a Supplier OR a Vendor (only one can be active).',
  'Use “Has Qty” to quickly pick parties that already have items with qty.',
  'The Order button sends only what’s still needed (Qty Needed - Ordered - From Storage).',
  'Internal/On-Hand supplier: Order will pull On-Hand allocations into “From Storage”.',
  'Add Items: enter Item name + Qty + optional code, then tap “Add Material”.',
  'Tip: Your last selected Phase is remembered.',
];

function HelpCard(props: {
  title: string;
  bullets: string[];
  onClose: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontWeight: '800' }}>{props.title}</Text>

        <Pressable onPress={props.onClose}>
          <Text style={{ fontWeight: '800', color: '#2563eb' }}>Got it</Text>
        </Pressable>
      </View>

      {props.bullets.map((b, idx) => (
        <Text key={idx} style={{ marginTop: 6, opacity: 0.85 }}>
          • {b}
        </Text>
      ))}
    </View>
  );
}

/**
 * Pick the material whose layout.y is closest to (but not greater than)
 * the current viewport “anchor line”.
 */
function rememberAnchor() {
  const anchorLine = scrollYRef.current + 80; // 80px down from top feels natural

  let bestId: string | null = null;
  let bestY = -Infinity;

  for (const [id, y] of Object.entries(materialPositions.current)) {
    if (y <= anchorLine && y > bestY) {
      bestY = y;
      bestId = id;
    }
  }

  anchorMaterialIdRef.current = bestId;
  anchorOffsetRef.current = bestId ? (anchorLine - bestY) : 0;
}

function restoreAnchorSoon() {
  const id = anchorMaterialIdRef.current;
  if (!id) return;

  // We run twice because layout often settles over 1–2 frames on iOS
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const y = materialPositions.current[id];
      if (y == null) return;

            // 👇 Simplified: anchor item near top
      const targetY = Math.max(0, y - 20);
      scrollRef.current?.scrollTo({ y: targetY, animated: false });

      anchorMaterialIdRef.current = null;
      anchorOffsetRef.current = 0;
    });
  });
}
const materialPositions = useRef<Record<string, number>>({});
const [supplierMap, setSupplierMap] = useState<Record<string, any>>({});
const [phasePickerOpen, setPhasePickerOpen] = useState(false);
const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

const nameSuggestions = useMemo(() => {
  const map = new Map<string, { name: string; code?: string | null }>();

  for (const m of materials) {
    const raw = String(m.item_name ?? '').trim();
    if (!raw) continue;

    const key = raw.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { name: raw, code: m.item_code ?? null });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}, [materials]);

const filteredNameSuggestions = useMemo(() => {
  const q = String(newName ?? '').trim().toLowerCase();
  if (!q) return [];

  return nameSuggestions
    .filter(s => s.name.toLowerCase().includes(q))
    .slice(0, 10);
}, [newName, nameSuggestions]);
  const [newPhase, setNewPhase] = useState<string | null>(null);
  const [newSupplierId, setNewSupplierId] = useState<string | null>(null);
  const [newItemCode, setNewItemCode] = useState<string | null>(null);
const [newQtyNeeded, setNewQtyNeeded] = useState<string>(''); // typed qty in add bar
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
const [showActiveOnly, setShowActiveOnly] = useState(false);
const [addMode, setAddMode] = useState(false);
const [orderPreviewOpen, setOrderPreviewOpen] = useState(false);
const [pendingOrderItems, setPendingOrderItems] = useState<
  { materialId: string; qtyOrdered: number }[]
>([]);

async function markUndelivered(material: any) {
  if (role !== 'owner' && role !== 'admin') return;

  Alert.alert(
    'Mark Undelivered?',
    'This will reset ordered quantity for this item.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          const updated = materials.map(m =>
            m.id === material.id
              ? {
                  ...m,
                  qty_ordered: 0,
                  date_ordered: null,
                  order_id: null,
                }
              : m
          );

          setMaterials(updated);

          await AsyncStorage.setItem(
            `job:${jobId}:materials`,
            JSON.stringify(updated)
          );

          try {
            await apiFetch(`/api/materials/${material.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                qtyOrdered: 0,
                dateOrdered: null,
                orderId: null,
              }),
            });
          } catch {
            await enqueueSync({
              id: makeId(),
              type: 'material_update',
              coalesceKey: `material_update:${material.id}`,
              createdAt: nowIso(),
              payload: {
                materialId: material.id,
                updates: {
                  qtyOrdered: 0,
                  dateOrdered: null,
                  orderId: null,
                },
              },
            });
          }

          flushSyncQueue();
        },
      },
    ]
  );
}

async function deleteMaterial(materialId: string) {
  if (role !== 'owner' && role !== 'admin') return;

  const updated = materials.filter(m => m.id !== materialId);

  setMaterials(updated);

  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  try {
    await apiFetch(`/api/materials/${materialId}`, {
      method: 'DELETE',
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'material_delete',
      coalesceKey: `material_delete:${materialId}`,
      createdAt: nowIso(),
      payload: { materialId },
    });
  }

  flushSyncQueue();
}

async function loadRole() {
  try {
    const res = await apiFetch('/api/tenant/me');
        console.log('ROLE RESPONSE:', res);

    setRole(res?.role ?? null);
  } catch {
    setRole(null);
  }
}

function handleSupplierMaterialTap(materialId: string, supplierId: string) {
  const now = Date.now();
  const lastTap = lastTapRef.current[materialId] ?? 0;

  if (now - lastTap < 250) {
    setExpandedSuppliers(prev => ({
      ...prev,
      [supplierId]: false,
    }));
  }

  lastTapRef.current[materialId] = now;
}

function isPhaseOrdered(material: any) {
  const needed = material.qty_needed ?? 0;
  const ordered = material.qty_ordered ?? 0;
  const fromStorage = material.qty_from_storage ?? 0;

  const fulfilled = ordered + fromStorage;

  return fulfilled >= needed && needed > 0;
}

function isStorageOrdered(material: any) {
  const fromStorage = material.qty_from_storage ?? 0;
  const onHand = material.qty_on_hand_applied ?? 0;

  return fromStorage > 0 && fromStorage === onHand;
}

// Group by phase
const {
  materialsByPhase,
  materialsBySupplier,
  internalMaterials,
  activeSupplierIds,
} = useMemo(() => {
  const byPhase: Record<string, any[]> = {};
  const bySupplier: Record<string, any[]> = {};
  const internal: any[] = [];

  for (const m of materials) {

  if (showActiveOnly) {
    const hasActivity =
      (m.qty_needed ?? 0) > 0 ||
      (m.qty_ordered ?? 0) > 0 ||
      (m.qty_from_storage ?? 0) > 0 ||
      (m.qty_on_hand_applied ?? 0) > 0;

    if (!hasActivity) continue;
  }
    // group by phase
    if (!byPhase[m.phase]) byPhase[m.phase] = [];
    byPhase[m.phase].push(m);

    // group by supplier
if (m.supplier_id) {
  if (!bySupplier[m.supplier_id]) bySupplier[m.supplier_id] = [];
  bySupplier[m.supplier_id].push(m);
}

if (m.vendor_id) {
  if (!bySupplier[m.vendor_id]) bySupplier[m.vendor_id] = [];
  bySupplier[m.vendor_id].push(m);
}

    // internal bucket
    if (
      (m.qty_from_storage ?? 0) > 0 ||
      (m.qty_on_hand_applied ?? 0) > 0
    ) {
      internal.push(m);
    }
  }

// compute supplier activity based on qty > 0
const activeSuppliers = Object.keys(bySupplier).filter(supplierId =>
  bySupplier[supplierId].some((m: any) =>
    (m.qty_needed ?? 0) > 0 ||
    (m.qty_ordered ?? 0) > 0 ||
    (m.qty_from_storage ?? 0) > 0 ||
    (m.qty_on_hand_applied ?? 0) > 0
  )
);


return {
  materialsByPhase: byPhase,
  materialsBySupplier: bySupplier,
  internalMaterials: internal,
  activeSupplierIds: activeSuppliers,
};

}, [materials, showActiveOnly]);

const selectedSupplierHasItems =
  !!newSupplierId &&
  activeSupplierIds.includes(newSupplierId);

useEffect(() => {
  loadMaterials();
  loadPhases();
  loadSuppliers();
  loadJobVendors();
  loadJob();
  loadSelections();
  loadRole();

  setTimeout(() => flushSyncQueue(), 50);
}, [jobId]);

function phaseHasQtyToOrder(phase: string) {
  const list = materialsByPhase[phase] ?? [];

  return list.some((m: any) => {
    const needed = m.qty_needed ?? 0;
    const ordered = m.qty_ordered ?? 0;
    const fromStorage = m.qty_from_storage ?? 0;

    const remaining = needed - ordered - fromStorage;

    return remaining > 0;
  });
}

function phaseHasAnyQty(phase: string) {
  const list = materialsByPhase[phase] ?? [];

  return list.some((m: any) => (m.qty_needed ?? 0) > 0);
}

async function loadJob() {
  try {
    const res = await apiFetch(`/api/job/${jobId}`);
    if (res?.job?.name) {
      setJobName(res.job.name);
    }
  } catch (e) {
    console.log('Failed to load job name');
  }
}

function handleMaterialTap(materialId: string, phase: string) {
  const now = Date.now();
  const lastTap = lastTapRef.current[materialId] ?? 0;

  if (now - lastTap < 250) {
    // collapse entire phase bucket
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: false,
    }));
  }

  lastTapRef.current[materialId] = now;
}

async function loadMaterials() {
  const key = `job:${jobId}:materials`;

  // 1️⃣ LOAD LOCAL FIRST (instant render)
  const local = await AsyncStorage.getItem(key);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      setMaterials(parsed);
    } catch {}
  }

  // 2️⃣ THEN REFRESH FROM API (non-blocking feel)
  try {
const res = await apiFetch(`/api/materials?jobId=${jobId}`);
const serverList = res?.materials ?? [];

const localRaw = await AsyncStorage.getItem(key);
const localList = localRaw ? JSON.parse(localRaw) : [];

const localMap: Record<string, any> = {};
localList.forEach((m: any) => {
  localMap[m.id] = m;
});

const merged = serverList.map((serverItem: any) => {
  const localItem = localMap[serverItem.id];

  if (!localItem) return serverItem;

  const serverUpdated = new Date(serverItem.updated_at ?? 0).getTime();
  const localUpdated = new Date(localItem.updated_at ?? 0).getTime();

  return serverUpdated >= localUpdated
    ? serverItem
    : localItem;
});

setMaterials(merged);
await AsyncStorage.setItem(key, JSON.stringify(merged));
  } catch {
    // silently ignore — offline mode
  }
}

  async function loadPhases() {
    const local = await AsyncStorage.getItem('phases');
    if (local) setPhases(JSON.parse(local));

try {
      const res = await apiFetch('/api/phases');
      const names = res?.phases?.map((p: any) => p.name) ?? [];
      setPhases(names);
      await AsyncStorage.setItem('phases', JSON.stringify(names));
    } catch {}
  }

async function loadSuppliers() {
  const key = 'suppliers_v1';

  // 1️⃣ LOAD LOCAL FIRST (instant UI)
  const local = await AsyncStorage.getItem(key);
  if (local) {
    const list = JSON.parse(local);
    setSuppliers(list);

    const map: Record<string, any> = {};
    list.forEach((s: any) => {
      map[s.id] = s;
    });
    setSupplierMap(map);
  }

  // 2️⃣ THEN REFRESH FROM API
  try {
    const res = await apiFetch('/api/suppliers');
    const list = res?.suppliers ?? [];

    setSuppliers(list);
    await AsyncStorage.setItem(key, JSON.stringify(list));

    const map: Record<string, any> = {};
    list.forEach((s: any) => {
      map[s.id] = s;
    });
    setSupplierMap(map);
  } catch {}
}

async function loadJobVendors() {
  const key = `job:${jobId}:vendors`;

  // 1️⃣ LOAD LOCAL FIRST (instant render)
  const local = await AsyncStorage.getItem(key);
  if (local) {
    try {
      const list = JSON.parse(local);
      setVendors(list);

      const map: Record<string, any> = {};
      list.forEach((v: any) => {
        map[v.id] = v;
      });
      setVendorMap(map);
    } catch {}
  }

  // 2️⃣ THEN REFRESH FROM API (non-blocking)
  try {
    const res = await apiFetch(`/api/jobs/${jobId}/vendor`);
    const vendor = res?.vendor;

const list = vendor
  ? [{
      id: vendor.vendorId,
      name: vendor.name,
      contacts: vendor.contacts ?? [],
    }]
  : [];

    setVendors(list);
    await AsyncStorage.setItem(key, JSON.stringify(list));

    const map: Record<string, any> = {};
    list.forEach((v: any) => {
      map[v.id] = v;
    });
    setVendorMap(map);
  } catch {
    // offline — do nothing
  }
}

async function loadSelections() {
  try {
    const savedPhase = await AsyncStorage.getItem('materials:selectedPhase');

    if (savedPhase) setNewPhase(savedPhase);

    // 🔥 Force clean start for party selection
    setNewSupplierId(null);
    setNewVendorId(null);

    await AsyncStorage.removeItem('materials:selectedSupplier');
    await AsyncStorage.removeItem('materials:selectedVendor');
  } catch {}
}

  async function createMaterial() {
    if (!newName) return;

if (!newPhase) {
  alert('Please select phase');
  return;
}

if (!newSupplierId && !newVendorId) {
  alert('Select a Supplier OR Vendor');
  return;
}

    const localMaterial = {
      id: makeId(),
      job_id: jobId,
      item_name: newName,
      item_code: newItemCode,
      phase: newPhase,
      supplier_id: newVendorId ? null : newSupplierId,
vendor_id: newVendorId ?? null,
      qty_needed: Math.max(0, parseInt(newQtyNeeded || '0', 10) || 0),
      status: 'draft',
    };

    const updated = [...materials, localMaterial];
setMaterials(updated);

// fire & forget (do NOT await)
AsyncStorage.setItem(
  `job:${jobId}:materials`,
  JSON.stringify(updated)
);

apiFetch('/api/materials', {
  method: 'POST',
  body: JSON.stringify({
    id: localMaterial.id,
    jobId,
    itemName: newName,
    itemCode: newItemCode,
    phase: newPhase,
    supplierId: newVendorId ? null : newSupplierId,
vendorId: newVendorId ?? null,
        qtyNeeded: Math.max(0, parseInt(newQtyNeeded || '0', 10) || 0),
  }),
}).catch(() => {
  enqueueSync({
    id: makeId(),
    type: 'material_create',
    coalesceKey: `material_create:${localMaterial.id}`,
    createdAt: nowIso(),
    payload: {
      ...localMaterial,
    },
  });
});

    setNewName('');
    setNewItemCode(null);
    setNewQtyNeeded('');   // reset qty field
    // ✅ keep addMode open for rapid entry
  }

   async function changeSupplier(material: any, supplierId: string) {
  const updated = materials.map(m =>
    m.id === material.id
      ? { ...m, supplier_id: supplierId, vendor_id: null }
      : m
  );

  setMaterials(updated);

  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  try {
    await apiFetch(`/api/materials/${material.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        supplierId,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'material_update',
      coalesceKey: `material_update:${material.id}`,
      createdAt: nowIso(),
      payload: {
        materialId: material.id,
        updates: {
          supplierId,
        },
      },
    });
  }

  flushSyncQueue();
}

async function applyOnHand(material: any, delta: number) {
  const current = material.qty_on_hand_applied ?? 0;

const maxAllowed =
  (material.qty_needed ?? 0) -
  (material.qty_ordered ?? 0) -
  (material.qty_from_storage ?? 0);

  const newValue = Math.max(
    0,
    Math.min(current + delta, maxAllowed)
  );

  const updated = materials.map(m =>
    m.id === material.id
      ? { ...m, qty_on_hand_applied: newValue }
      : m
  );

  setMaterials(updated);

  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  try {
    await apiFetch(`/api/materials/${material.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        qtyOnHandApplied: newValue,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'material_update',
      coalesceKey: `material_update:${material.id}`,
      createdAt: nowIso(),
      payload: {
        materialId: material.id,
        updates: { qtyOnHandApplied: newValue },
      },
    });
  }

  flushSyncQueue();
}

function updateOnHandLocal(materialId: string, delta: number) {
  setMaterials(prev =>
    prev.map(m => {
      if (m.id !== materialId) return m;

      const current = m.qty_on_hand_applied ?? 0;

const maxAllowed =
  (m.qty_needed ?? 0) -
  (m.qty_ordered ?? 0) -
  (m.qty_from_storage ?? 0);

      const newValue = Math.max(
        0,
        Math.min(current + delta, maxAllowed)
      );

      return { ...m, qty_on_hand_applied: newValue };
    })
  );
}

function updateQtyLocal(materialId: string, delta: number) {
  setMaterials(prev =>
    prev.map(m => {
      if (m.id !== materialId) return m;

      const current = m.qty_needed ?? 0;
      const next = Math.max(0, current + delta);

      return {
        ...m,
        qty_needed: next,
        updated_at: new Date().toISOString(),
      };
    })
  );
}

async function updateQty(material: any, delta: number) {
  const current =
  materials.find(m => m.id === material.id)?.qty_needed ?? 0;

const newQty = Math.max(0, current + delta);

  const updated = materials.map(m =>
    m.id === material.id
      ? { ...m, qty_needed: newQty }
      : m
  );

  setMaterials(updated);
  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  try {
    await apiFetch(`/api/materials/${material.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ qtyNeeded: newQty }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'material_update',
      coalesceKey: `material_update:${material.id}`,
      createdAt: nowIso(),
      payload: {
        materialId: material.id,
        updates: { qtyNeeded: newQty },
      },
    });
  }

  flushSyncQueue();
}
const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const holdDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  restoreAnchorSoon();
}, [editMode]);

useEffect(() => {
  return () => {
    if (holdDelayRef.current) {
      clearTimeout(holdDelayRef.current);
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
  };
}, []);

function startHold(action: () => void) {
  // Always clear any existing timers first
  stopHold();

  action(); // single tap

  holdDelayRef.current = setTimeout(() => {
    holdIntervalRef.current = setInterval(() => {
      action();
    }, 80);
  }, 250);
}

function stopHold() {
  if (holdDelayRef.current) {
    clearTimeout(holdDelayRef.current);
  }

  if (holdIntervalRef.current) {
    clearInterval(holdIntervalRef.current);
  }

  holdDelayRef.current = null;
  holdIntervalRef.current = null;
}

function isStorageLocked(material: any) {
  return (material.qty_from_storage ?? 0) > 0;
}

async function setQtyDirect(material: any, newQty: number) {
  const minAllowed =
  (material.qty_ordered ?? 0) +
  (material.qty_from_storage ?? 0);

const safeQty = Math.max(minAllowed, newQty);

  const updated = materials.map(m =>
    m.id === material.id
      ? {
    ...m,
    qty_needed: safeQty,
    updated_at: new Date().toISOString(),
  }
      : m
  );

  setMaterials(updated);

  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  try {
    await apiFetch(`/api/materials/${material.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ qtyNeeded: safeQty }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'material_update',
      coalesceKey: `material_update:${material.id}`,
      createdAt: nowIso(),
      payload: {
        materialId: material.id,
        updates: { qtyNeeded: safeQty },
      },
    });
  }

  flushSyncQueue();
}

async function openInMail(args: {
  email: string;
  subject: string;
  body: string;
}) {
  const mailto =
    `mailto:${args.email}` +
    `?subject=${encodeURIComponent(args.subject)}` +
    `&body=${encodeURIComponent(args.body)}`;

  const can = await Linking.canOpenURL(mailto);
  if (!can) {
    Alert.alert(
      'Cannot open Mail',
      'Your device cannot open a mail draft (no mail app/account configured).'
    );
    return false;
  }

  try {
    await Linking.openURL(mailto);
    return true;
  } catch (e) {
    Alert.alert('Cannot open Mail', 'Failed to open email draft.');
    return false;
  }
}

function createFormData(args: {
  orderId: string;
  jobId: string;
  phase: string;
  supplierId: string;
  items: { materialId: string; qtyOrdered: number }[];
  pdfUri: string;
}) {
  const form = new FormData();

  form.append('orderId', args.orderId);
  form.append('jobId', args.jobId);
  form.append('phase', args.phase);
  form.append('supplierId', args.supplierId);
  form.append('itemsJson', JSON.stringify(args.items));
  form.append('bccTenant', 'true');

  form.append('pdf', {
    uri: args.pdfUri,
    name: 'order.pdf',
    type: 'application/pdf',
  } as any);

  return form;
}

async function handleCreateOrder() {
  if (!newPhase || (!newSupplierId && !newVendorId)) {
    alert('Select phase and a Supplier OR Vendor first');
    return;
  }

  const recipient =
    newVendorId ? vendorMap[newVendorId] : supplierMap[newSupplierId!];

const recipientEmails =
  recipient?.contacts
    ?.filter((c: any) => c.type === 'email' && c.value?.trim())
    .map((c: any) => c.value.trim()) ?? [];

if (!recipientEmails.length) {
  alert(`${newVendorId ? 'Vendor' : 'Supplier'} has no email`);
  return;
}

  const recipientName = recipient?.name ?? (newVendorId ? 'Vendor' : 'Supplier');
  const recipientId = newVendorId ?? newSupplierId!;

let itemsToOrder: { materialId: string; qtyOrdered: number }[] = [];

const supplier = !newVendorId ? supplierMap[newSupplierId!] : null;

if (!newVendorId && supplier?.isInternal) {
  // Internal / On-Hand flow (supplier only)
  itemsToOrder = materials
    .filter(
      m =>
        m.phase === newPhase &&
        (m.qty_on_hand_applied ?? 0) > 0 &&
        (m.qty_from_storage ?? 0) < (m.qty_on_hand_applied ?? 0)
    )
    .map(m => ({
      materialId: m.id,
      qtyOrdered: m.qty_on_hand_applied ?? 0,
    }));
} else {
  // External flow (supplier OR vendor)
  itemsToOrder = materials
    .filter(m => {
      const matchesParty = newVendorId
        ? m.vendor_id === newVendorId
        : m.supplier_id === newSupplierId;

      return (
        m.phase === newPhase &&
        matchesParty &&
        (m.qty_needed ?? 0) >
          ((m.qty_ordered ?? 0) + (m.qty_from_storage ?? 0))
      );
    })
    .map(m => ({
      materialId: m.id,
      qtyOrdered:
        (m.qty_needed ?? 0) -
        (m.qty_ordered ?? 0) -
        (m.qty_from_storage ?? 0),
    }));
}

  if (!itemsToOrder.length) {
    alert('Nothing to order');
    return;
  }
try {
    const supplierName = recipientName;

      //pdf generation logic
const { orderId, uri } = await generateOrderPdf({
  jobId,
  phase: newPhase!,
  supplierName,
items: itemsToOrder.map(it => {
  const m = materials.find(x => x.id === it.materialId);

  let pdfQty = 0;

  if (supplier?.isInternal) {
    // Internal → show exactly what is being pulled
    pdfQty = m?.qty_on_hand_applied ?? 0;
  } else {
    // External supplier → subtract on-hand
    pdfQty = Math.max(
      0,
      (m?.qty_needed ?? 0) -
      (m?.qty_on_hand_applied ?? 0)
    );
  }

  return {
    name: m?.item_name ?? '',
    code: m?.item_code,
    qty: pdfQty,
  };
}),
});

// 🔐 Persist locally for 7 days
await persistLocalPdf(orderId, uri);

    // 1️⃣ Upload order to backend
    await apiFetch('/api/orders/create', {
      method: 'POST',
      body: createFormData({
        orderId,
        jobId,
        phase: newPhase!,
        supplierId: recipientId,
        items: itemsToOrder,
        pdfUri: uri,
      }),
    });

    // 2️⃣ Fetch signed PDF URL
    const pdfRes = await apiFetch(`/api/orders/${orderId}/pdf`);
    const pdfUrl = pdfRes?.url;

const safeJobName = (jobName || '').trim();
const displayJobName = safeJobName.length ? safeJobName : jobId;

const subject = `Material Order - ${displayJobName} - ${newPhase} - ${supplierName}`;

const body =
  `Phase: ${newPhase}\r\n` +
  `Job Name: ${displayJobName}\r\n` +
  `Job ID: ${jobId}\r\n\r\n` +
  `Please find the material order PDF here:\r\n` +
  `${pdfUrl}\r\n`;

await openInMail({
  email: recipientEmails.join(','),
  subject,
  body,
});

    // ✅ Mark supplier items as ordered - this handles qty_needed and qty_ordered
if (!supplier?.isInternal) {

  const now = new Date().toISOString();

  const updated = materials.map(m => {
    const orderedItem = itemsToOrder.find(
      it => it.materialId === m.id
    );

    if (orderedItem) {
return {
  ...m,
  qty_ordered:
    (m.qty_ordered ?? 0) + orderedItem.qtyOrdered,
  date_ordered: now,
  order_id: orderId,
};
    }

    return m;
  });

  setMaterials(updated);
  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

// persist to backend (non-blocking safe)
for (const it of itemsToOrder) {
  const material = updated.find(m => m.id === it.materialId);
  if (!material) continue;

  const newQtyOrdered = material.qty_ordered ?? 0;

  console.log('PATCH MATERIAL ORDER:', {
    materialId: it.materialId,
    qtyOrdered: newQtyOrdered,
    orderId,
  });

  try {
    await apiFetch(`/api/materials/${it.materialId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        qtyOrdered: newQtyOrdered,
        dateOrdered: now,
        orderId,
      }),
    });
  } catch (err) {
    console.warn('Material PATCH failed (queued):', it.materialId);

    await enqueueSync({
      id: makeId(),
      type: 'material_update',
      coalesceKey: `material_update:${it.materialId}`,
      createdAt: nowIso(),
      payload: {
        materialId: it.materialId,
        updates: {
          qtyOrdered: newQtyOrdered,
          dateOrdered: now,
          orderId,
        },
      },
    });
  }
}

flushSyncQueue();
}

// Mark internal items as ordered
if (supplier?.isInternal) {

  const updated = materials.map(m => {
    if (
      m.phase === newPhase &&
      (m.qty_on_hand_applied ?? 0) > 0
    ) {
const now = new Date().toISOString();

return {
  ...m,
  qty_from_storage: m.qty_on_hand_applied ?? 0,
  date_storage_ordered: now,
  storage_order_id: orderId,
};
    }
    return m;
  });

  setMaterials(updated);

  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

    // 🔥 Persist storage changes to backend
  // Only patch items that were part of this storage "order"
  for (const it of itemsToOrder) {
    const m = updated.find(x => x.id === it.materialId);
    if (!m) continue;

const now = new Date().toISOString();

await apiFetch(`/api/materials/${m.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    qtyFromStorage: m.qty_from_storage ?? 0,
    dateStorageOrdered: now,
    storageOrderId: orderId,
  }),
});

  }
    await loadMaterials(); // 🔥 force refresh so UI reflects new DB state

}

alert('Email draft opened');

} catch (err) {
  console.warn('Order failed — not enqueueing duplicate order', err);

  alert('Order failed before upload');

  // 🔒 Do NOT enqueue order creation here.
  // Orders are only persisted after successful upload.
}
}

return (
  <>
<Stack.Screen
  options={{
    title: jobName
      ? `${jobName} - Materials`
      : 'Materials',
    headerShadowVisible: false,
  }}
/>
<SafeAreaView style={{ flex: 1 }} edges={['left','right','bottom']}>
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={90}
  >
  
<View style={styles.container}>

  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    }}
  >
    {/* LEFT — Edit Mode + Help */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={() => {
          rememberAnchor();
          setEditMode(v => !v);
          setSelectedMaterialIds([]);
        }}
      >
        <Text style={{ fontWeight: '700', color: '#2563eb' }}>
          {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setHelpOpen(helpOpen === 'edit' ? null : 'edit')}
      >
        <Text style={{ fontWeight: '900', color: '#2563eb' }}>?</Text>
      </Pressable>
    </View>

    {/* RIGHT — Add Items + Help */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={() => {
          setEditMode(false);
          setAddMode(v => !v);
        }}
      >
        <Text style={{ fontWeight: '700', color: '#16a34a' }}>
          {addMode ? 'Cancel Add' : 'Add Items'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setHelpOpen(helpOpen === 'add' ? null : 'add')}
      >
        <Text style={{ fontWeight: '900', color: '#16a34a' }}>?</Text>
      </Pressable>
    </View>
  </View>

  {/* HELP CARDS (insert right here, before SEARCH) */}
  {helpOpen === 'edit' && (
    <HelpCard
      title="Materials • Edit Mode Help"
      bullets={EDIT_HELP}
      onClose={() => setHelpOpen(null)}
    />
  )}

  {helpOpen === 'add' && (
    <HelpCard
      title="Materials • Add Items Help"
      bullets={ADD_HELP}
      onClose={() => setHelpOpen(null)}
    />
  )}

{/* SEARCH */}
<View style={{ marginBottom: 12, zIndex: 1000 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <TextInput
      placeholder="Search materials..."
      value={searchQuery}
      onChangeText={setSearchQuery}
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 10,
        padding: 10,
        backgroundColor: '#fff',
      }}
    />

    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        setSearchQuery('');
      }}
      style={{ marginLeft: 8 }}
    >
      <Text style={{ fontWeight: '600', color: '#2563eb' }}>
        Clear
      </Text>
    </Pressable>
  </View>

  {searchQuery.length > 0 && (
    <View
      style={{
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        maxHeight: 250,
        elevation: 10,
      }}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
{materials
  .filter(m =>
    (
      m.item_name +
      ' ' +
      (m.item_code ?? '') +
      ' ' +
      (supplierMap[m.supplier_id]?.name ?? '') +
      ' ' +
      (vendorMap[m.vendor_id]?.name ?? '')
    )
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  )
          .slice(0, 20)
          .map(m => (
            <Pressable
              key={m.id}
              onPress={() => {
                setSearchQuery('');
                Keyboard.dismiss();

                setExpandedPhases(prev => ({
                  ...prev,
                  [m.phase]: true,
                }));

                setHighlightedMaterial(m.id);

                setTimeout(() => {
                  const y = materialPositions.current[m.id];
                  if (y != null && scrollRef.current) {
                    scrollRef.current.scrollTo({
                      y: y - 20,
                      animated: true,
                    });
                  }
                  setHighlightedMaterial(null);
                }, 150);
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text style={{ fontWeight: '700' }}>
                {m.item_name}
              </Text>

              {m.item_code ? (
                <Text style={{ fontSize: 13, opacity: 0.6 }}>
                  ID: {m.item_code}
                </Text>
              ) : null}

              <Text style={{ fontSize: 12, opacity: 0.6 }}>
                {m.phase} • {
  m.vendor_id
    ? vendorMap[m.vendor_id]?.name
    : supplierMap[m.supplier_id]?.name
  ?? '—'
}
              </Text>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  )}
</View>

<ScrollView
  ref={scrollRef}
  nestedScrollEnabled
  keyboardShouldPersistTaps="handled"
  contentContainerStyle={{ paddingBottom: editMode ? 140 : 60 }}
  showsVerticalScrollIndicator={false}
  onScroll={(e) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }}
  scrollEventThrottle={16}
>

{/* SELECTORS */}
<View style={styles.selectorBar}>

  {/* PHASE */}
  <Pressable
    onPress={() => setPhasePickerOpen(!phasePickerOpen)}
    style={styles.selectorCollapsed}
  >
    <Text style={{ fontWeight: '600' }}>
      Phase: {newPhase || 'Select Phase'}
    </Text>
  </Pressable>

  {phasePickerOpen && (
    <View style={{ marginBottom: 10 }}>
      {phases.map(p => (
        <Pressable
          key={p}
          onPress={async () => {
            setNewPhase(p);
            await AsyncStorage.setItem('materials:selectedPhase', p);
            setPhasePickerOpen(false);
          }}
          style={styles.selectorOption}
        >
          <Text>{p}</Text>
        </Pressable>
      ))}
    </View>
  )}

{/* SUPPLIER */}
<Pressable
  onPress={() => setSupplierPickerOpen(!supplierPickerOpen)}
  style={[
    styles.selectorCollapsed,
    newSupplierId && !newVendorId && {
      backgroundColor: '#dcfce7',
      borderWidth: 1,
      borderColor: '#16a34a',
    },
  ]}
>
<Text
  style={{
    fontWeight: '600',
    color: newSupplierId && !newVendorId ? '#15803d' : '#000',
  }}
>
  Supplier: {
    newSupplierId
      ? supplierMap[newSupplierId]?.name
      : 'Select Supplier'
  }
  {selectedSupplierHasItems ? ' • Has Qty' : ''}
</Text>
</Pressable>

{supplierPickerOpen && (
  <View style={{ marginBottom: 10 }}>
    {suppliers.map(s => {
      const hasItems = activeSupplierIds.includes(s.id);

      return (
        <Pressable
          key={s.id}
          onPress={async () => {
            setNewSupplierId(s.id);
            setNewVendorId(null);
            await AsyncStorage.setItem('materials:selectedSupplier', s.id);
            setSupplierPickerOpen(false);
          }}
          style={[
            styles.selectorOption,
            hasItems && {
  borderWidth: 2,
  borderColor: '#3b82f6',
},
          ]}
        >
<Text
  style={{
    fontWeight: hasItems ? '600' : '400',
    color: hasItems ? '#1e3a8a' : '#6b7280',
  }}
>
  {s.name}
  {hasItems ? ' • Has Qty' : ''}
</Text>
        </Pressable>
      );
    })}
  </View>
)}

{/* VENDOR — separate button */}
{vendors.length > 0 && (
  <>
<Pressable
  onPress={() => setVendorPickerOpen(v => !v)}
  style={[
    styles.selectorCollapsed,
    newVendorId && {
      backgroundColor: '#dcfce7',
      borderWidth: 1,
      borderColor: '#16a34a',
    },
  ]}
>
  <Text
    style={{
      fontWeight: '600',
      color: newVendorId ? '#15803d' : '#000',
    }}
  >
    Vendor: {
      newVendorId
        ? vendorMap[newVendorId]?.name
        : 'Select Vendor'
    }
  </Text>
</Pressable>

    {vendorPickerOpen && (
      <View style={{ marginBottom: 10 }}>
        {vendors.map(v => (
          <Pressable
            key={v.id}
            onPress={async () => {
              setNewVendorId(v.id);
              setNewSupplierId(null);
              await AsyncStorage.setItem('materials:selectedVendor', v.id);
              setVendorPickerOpen(false);
            }}
            style={styles.selectorOption}
          >
            <Text>{v.name}</Text>
          </Pressable>
        ))}
      </View>
    )}
  </>
)}

</View>

{orderPreviewOpen && (
  <View
    style={{
      backgroundColor: '#f8fafc',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
    }}
  >
    <Text style={{ fontWeight: '700', marginBottom: 10 }}>
      Order Preview
    </Text>

<ScrollView
  style={{ maxHeight: 220 }}
  showsVerticalScrollIndicator
  nestedScrollEnabled
>

      {pendingOrderItems.map(it => {
        const m = materials.find(x => x.id === it.materialId);
        return (
          <View key={it.materialId} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: '600' }}>
              {m?.item_name}
            </Text>
            <Text style={{ fontSize: 12, opacity: 0.6 }}>
              ID: {m?.item_code ?? '—'}
            </Text>
            <Text style={{ fontSize: 12 }}>
              Qty: {it.qtyOrdered}
            </Text>
          </View>
        );
      })}
    </ScrollView>

    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
      }}
    >
      <Pressable onPress={() => setOrderPreviewOpen(false)}>
        <Text style={{ color: '#64748b', fontWeight: '600' }}>
          Cancel
        </Text>
      </Pressable>

<Pressable
  onPress={() => {
    Alert.alert(
      'Send Order?',
      'This will generate the PDF and email draft.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setOrderPreviewOpen(false);
            setOrdering(true);
            await handleCreateOrder();
            setOrdering(false);
          },
        },
      ]
    );
  }}
>
        <Text style={{ color: '#dc2626', fontWeight: '700' }}>
          Send Order
        </Text>
      </Pressable>
    </View>
  </View>
)}

{/* ORDER BUTTON */}
<Pressable
disabled={
  ordering ||
  !newPhase ||
  (!newSupplierId && !newVendorId)
}
onPress={() => {
  if (ordering) return;
  if (!newPhase || (!newSupplierId && !newVendorId)) return;

const supplier = newVendorId
  ? vendorMap[newVendorId]
  : newSupplierId
    ? supplierMap[newSupplierId]
    : null;

  let itemsToOrder: { materialId: string; qtyOrdered: number }[] = [];

  if (supplier?.isInternal) {
    itemsToOrder = materials
      .filter(
        m =>
          m.phase === newPhase &&
          (m.qty_on_hand_applied ?? 0) > 0 &&
          (m.qty_from_storage ?? 0) < (m.qty_on_hand_applied ?? 0)
      )
      .map(m => ({
        materialId: m.id,
        qtyOrdered: m.qty_on_hand_applied ?? 0,
      }));
  } else {
    itemsToOrder = materials
      .filter(
        m =>
          m.phase === newPhase &&
          m.supplier_id === newSupplierId &&
          (m.qty_needed ?? 0) >
            ((m.qty_ordered ?? 0) + (m.qty_from_storage ?? 0))
      )
      .map(m => ({
        materialId: m.id,
        qtyOrdered:
          (m.qty_needed ?? 0) -
          (m.qty_ordered ?? 0) -
          (m.qty_from_storage ?? 0),
      }));
  }

  if (!itemsToOrder.length) {
    alert('Nothing to order');
    return;
  }

setPendingOrderItems(itemsToOrder);
setOrderPreviewOpen(true);

}}
  style={{
    backgroundColor: ordering ? '#94a3b8' : '#2563eb',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
  }}
>

<Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
{ordering
  ? 'Processing...'
  : newPhase && (newSupplierId || newVendorId)
    ? `Order ${newPhase} → ${
        newVendorId
          ? (vendorMap[newVendorId]?.name ?? '')
          : (supplierMap[newSupplierId!]?.name ?? '')
      }`
    : 'Select Phase & Supplier/Vendor'}
</Text>

</Pressable>

{editMode && selectedMaterialIds.length > 0 && (
  <View style={{
    backgroundColor: '#e0f2fe',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12
  }}>
    <Text style={{ fontWeight: '600', marginBottom: 6 }}>
      Change supplier for {selectedMaterialIds.length} items:
    </Text>

    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {suppliers.map(s => (
        <Pressable
          key={s.id}
onPress={async () => {

  const updated = materials.map(m =>
    selectedMaterialIds.includes(m.id)
? {
    ...m,
    supplier_id: s.id,
    vendor_id: null,
    updated_at: new Date().toISOString(),
  }
      : m
  );

  setMaterials(updated);

  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  // PATCH using UPDATED copy (not stale state)
  const moved = updated.filter(m =>
    selectedMaterialIds.includes(m.id)
  );

  for (const material of moved) {
    try {
      await apiFetch(`/api/materials/${material.id}`, {
        method: 'PATCH',
body: JSON.stringify({
  supplierId: s.id,
  vendorId: null,
}),
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'material_update',
        coalesceKey: `material_update:${material.id}`,
        createdAt: nowIso(),
        payload: {
          materialId: material.id,
          updates: {
  supplierId: s.id,
  vendorId: null,
},
        },
      });
    }
  }

  flushSyncQueue();
  setSelectedMaterialIds([]);
}}
          style={styles.selectorChip}
        >
          <Text>{s.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
)}

<View style={{ marginBottom: 12 }}>
  <Pressable
    onPress={() => setShowActiveOnly(v => !v)}
    style={{
      backgroundColor: showActiveOnly ? '#2563eb' : '#e5e7eb',
      padding: 10,
      borderRadius: 10,
      alignSelf: 'flex-start',
    }}
  >
    <Text
      style={{
        fontWeight: '600',
        color: showActiveOnly ? '#fff' : '#000',
      }}
    >
      {showActiveOnly ? 'Showing Active Only' : 'Show Active Only'}
    </Text>
  </Pressable>
</View>

{/* LIST GROUPED BY PHASE */}
{Object.keys(materialsByPhase).map(phase => (
  <View key={phase} style={{ marginBottom: 16 }}>

    {/* Phase Header */}
    <Pressable
      onPress={() =>
        setExpandedPhases(prev => ({
          ...prev,
          [phase]: !prev[phase],
        }))
      }
style={[
  {
    padding: 12,
    borderRadius: 12,
  },
  phaseHasQtyToOrder(phase)
    ? { backgroundColor: '#fee2e2' } // light red
    : phaseHasAnyQty(phase)
    ? { backgroundColor: '#dcfce7' } // light green
    : { backgroundColor: '#dbeafe' }, // default blue
]}
    >
      <Text style={{ fontWeight: '700', fontSize: 16 }}>
        {phase} {expandedPhases[phase] ? '▲' : '▼'}
      </Text>
    </Pressable>

{/* Phase Materials */}
{expandedPhases[phase] &&
  [...materialsByPhase[phase]]
    .sort((a: any, b: any) => {
      const aOrdered = isPhaseOrdered(a);
      const bOrdered = isPhaseOrdered(b);

      if (aOrdered === bOrdered) return 0;
      if (aOrdered) return 1;  // push ordered down
      return -1;              // keep unordered on top
    })
    .map((material: any) => (
<Pressable
  key={material.id}
  delayLongPress={600}
  onLongPress={() => {
    if (role !== 'owner' && role !== 'admin') return;

    Alert.alert(
      'Delete Material?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMaterial(material.id),
        },
      ]
    );
  }}
  onPress={() => handleMaterialTap(material.id, phase)}
      onLayout={e => {
        materialPositions.current[material.id] = e.nativeEvent.layout.y;
      }}
      style={[
        styles.card,
        highlightedMaterial === material.id && {
          borderWidth: 2,
          borderColor: '#2563eb',
        },
        isPhaseOrdered(material) && {
          backgroundColor: '#dcfce7',
        },
        editMode &&
        selectedMaterialIds.includes(material.id) && {
          borderWidth: 2,
          borderColor: '#2563eb',
        },
      ]}
    >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    
{/* LEFT SIDE */}
<View style={{ flex: 1 }}>

  {editMode && (
    <Pressable
      onPress={() => {
        setSelectedMaterialIds(prev =>
          prev.includes(material.id)
            ? prev.filter(id => id !== material.id)
            : [...prev, material.id]
        );
      }}
    >
      <Text style={{ marginBottom: 6 }}>
        {selectedMaterialIds.includes(material.id) ? '☑ Selected' : '☐ Select'}
      </Text>
    </Pressable>
  )}

  <Text style={styles.itemTitle}>
    {material.item_name}
  </Text>

  {(() => {
  console.log('Material Debug:', {
    id: material.id,
    needed: material.qty_needed,
    ordered: material.qty_ordered,
    fromStorage: material.qty_from_storage,
    fulfilled:
      (material.qty_ordered ?? 0) +
      (material.qty_from_storage ?? 0),
    isPhaseOrdered: isPhaseOrdered(material),
    order_id: material.order_id,
  });
  return null;
})()}

{isPhaseOrdered(material) && (
  <View style={{ marginTop: 4 }}>
    <Text style={{ color: '#15803d', fontWeight: '700' }}>
      ✓ Ordered
    </Text>

    {material.date_ordered && (
      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        {new Date(material.date_ordered).toLocaleDateString()}
      </Text>
    )}

{material.order_id && (
  <>
    <Pressable
      onPress={async () => {
        try {
          const orderId = material.order_id;

          const local = await getValidLocalPdf(orderId);
          if (local) {
            await Linking.openURL(local);
            return;
          }

          const res = await apiFetch(
            `/api/orders/${orderId}/pdf`
          );
          const signedUrl = res?.url;

          if (!signedUrl) {
            alert('Unable to load PDF');
            return;
          }

          const downloaded = await downloadAndPersistPdf(
            orderId,
            signedUrl
          );

          await Linking.openURL(downloaded);
        } catch {
          alert('Unable to load PDF');
        }
      }}
    >
      <Text style={{ color: '#2563eb', fontSize: 12 }}>
        View PDF
      </Text>
    </Pressable>

    {(role === 'owner' || role === 'admin') && (
      <Pressable
        onPress={() => markUndelivered(material)}
      >
        <Text style={{ color: '#dc2626', fontSize: 12 }}>
          Mark Undelivered
        </Text>
      </Pressable>
    )}
  </>
)}
  </View>
)}

  {material.item_code && (
    <Text style={styles.meta}>
      Item ID: {material.item_code}
    </Text>
  )}

{/* Supplier Name */}
<Text style={styles.meta}>
  Supplier: {
  material.vendor_id
    ? vendorMap[material.vendor_id]?.name
    : supplierMap[material.supplier_id]?.name
  || '—'
}
</Text>

{/* Qty */}
<Text style={styles.meta}>
  Qty: {material.qty_needed ?? 0}
</Text>
  <Text style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>
  {role === 'owner' || role === 'admin'
  ? 'Double tap to collapse section – Hold to delete'
  : 'Double tap to collapse section'}
</Text>
</View>

{/* RIGHT SIDE */}
<View style={{ alignItems: 'center' }}>

{editMode && !isPhaseOrdered(material) && (() => {
  const onHand = material.qty_on_hand_applied ?? 0;

  return (
<>
  {/* QTY DISPLAY */}
<TextInput
  editable
  defaultValue={String(material.qty_needed ?? 0)}
  keyboardType="numeric"
  onEndEditing={(e) => {
    const val = e.nativeEvent.text;
    const num = parseInt(val || '0', 10);

    if (!isNaN(num)) {
      setQtyDirect(material, num);
    }
  }}
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    textAlign: 'center',
    minWidth: 80,
    marginBottom: 12,
    fontWeight: '700',
    fontSize: 16,
  }}
/>

{/* +/- ROW */}
<View
  style={{
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 120,
    marginBottom: 12,
  }}
>
  {/* MINUS */}
{/* MINUS */}
<Pressable
  onPressIn={() => {
    startHold(() => {
      updateQtyLocal(material.id, -1);
    });
  }}
  onPressOut={async () => {
    stopHold();

    const latest = materials.find(m => m.id === material.id);
    if (!latest) return;

    await setQtyDirect(latest, latest.qty_needed ?? 0);
  }}
  style={{
    paddingHorizontal: 18,
    paddingVertical: 6,
  }}
>
  <Text style={[styles.qtyBtn, { fontSize: 26 }]}>−</Text>
</Pressable>

{/* PLUS */}
<Pressable
  onPressIn={() => {
    startHold(() => {
      updateQtyLocal(material.id, 1);
    });
  }}
  onPressOut={async () => {
    stopHold();

    const latest = materials.find(m => m.id === material.id);
    if (!latest) return;

    await setQtyDirect(latest, latest.qty_needed ?? 0);
  }}
  style={{
    paddingHorizontal: 18,
    paddingVertical: 6,
  }}
>
  <Text style={[styles.qtyBtn, { fontSize: 26 }]}>+</Text>
</Pressable>
</View>

  {/* On-Hand stays unchanged */}
<View style={{ marginTop: 8 }}>
  <Text style={{ fontSize: 12, opacity: 0.6 }}>
    On-Hand: {onHand}
  </Text>

  {isStorageLocked(material) ? (
    <Text style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
      On-Hand already ordered from storage
    </Text>
  ) : (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <Pressable
onPressIn={() => startHold(() => updateOnHandLocal(material.id, 1))}
onPressOut={() => {
  stopHold();
  const updatedMaterial = materials.find(m => m.id === material.id);
  if (updatedMaterial) {
    applyOnHand(updatedMaterial, 0); // persist final value
  }
}}
      >
        <Text style={{ color: '#16a34a', fontWeight: '700' }}>
          + On-Hand
        </Text>
      </Pressable>

      <Pressable
onPressIn={() => startHold(() => updateOnHandLocal(material.id, -1))}
onPressOut={() => {
  stopHold();
  const updatedMaterial = materials.find(m => m.id === material.id);
  if (updatedMaterial) {
    applyOnHand(updatedMaterial, 0); // persist final value
  }
}}
      >
        <Text style={{ color: '#dc2626', fontWeight: '700' }}>
                            − On-Hand
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
    </Pressable>
  ))}
  </View>
))}

{/* INTERNAL / ON-HAND BUCKET */}
{internalMaterials.length > 0 && (
  <View style={{ marginTop: 24 }}>
    <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
      Internal / On-Hand
    </Text>

    <Pressable
      onPress={() =>
        setExpandedSuppliers(prev => ({
          ...prev,
          __internal: !prev.__internal,
        }))
      }
      style={{
        backgroundColor: '#dcfce7',
        padding: 12,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 16 }}>
        Storage ({internalMaterials.length}) {expandedSuppliers.__internal ? '▲' : '▼'}
      </Text>
    </Pressable>

    {expandedSuppliers.__internal && (
      <View style={{ marginTop: 10 }}>
        {internalMaterials.map((material: any) => (
<Pressable
  key={material.id}
  delayLongPress={600}
  onLongPress={() => {
    if (role !== 'owner' && role !== 'admin') return;

    Alert.alert(
      'Delete Material?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMaterial(material.id),
        },
      ]
    );
  }}
  
  style={[
    styles.card,
    highlightedMaterial === material.id && {
      borderWidth: 2,
      borderColor: '#2563eb',
    },
    isStorageOrdered(material) && {
      backgroundColor: '#dcfce7',
    },
  ]}
>
            <Text style={styles.itemTitle}>
              {material.item_name}
            </Text>

{isStorageOrdered(material) && (
  <View style={{ marginTop: 4 }}>
    <Text style={{ color: '#15803d', fontWeight: '700' }}>
      ✓ Ordered
    </Text>

    {material.date_storage_ordered && (
      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        {new Date(material.date_storage_ordered).toLocaleDateString()}
      </Text>
    )}

{material.storage_order_id && (
  <Pressable
    onPress={async () => {
      try {
        const orderId = material.storage_order_id;

        const local = await getValidLocalPdf(orderId);
        if (local) {
          await Linking.openURL(local);
          return;
        }

        const res = await apiFetch(
          `/api/orders/${orderId}/pdf`
        );
        const signedUrl = res?.url;

        if (!signedUrl) {
          alert('Unable to load PDF');
          return;
        }

        const downloaded = await downloadAndPersistPdf(
          orderId,
          signedUrl
        );

        await Linking.openURL(downloaded);
      } catch {
        alert('Unable to load PDF');
      }
    }}
  >
    <Text style={{ color: '#2563eb', fontSize: 12 }}>
      View PDF
    </Text>
  </Pressable>
)}
  </View>
)}

            {material.item_code && (
              <Text style={styles.meta}>
                Item ID: {material.item_code}
              </Text>
            )}

            <Text style={styles.meta}>
Pulled From Storage: {
  material.qty_from_storage ?? 0
}
            </Text>

            <Text style={styles.meta}>
              Job: {jobName || jobId}
            </Text>
          </Pressable>
        ))}
      </View>
    )}
  </View>
)}

{/* SUPPLIER BUCKETS (Receipt View) */}
{activeSupplierIds.length > 0 && (

  <View style={{ marginTop: 24 }}>
    <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
      Supplier Buckets
    </Text>

    {activeSupplierIds.map((supplierId) => {
const supplier =
  supplierMap[supplierId] ||
  vendorMap[supplierId];

if (!supplier) return null;

      const supplierMaterials = (materialsBySupplier[supplierId] || []).filter(
  (m: any) =>
    (m.qty_needed ?? 0) > 0 ||
    (m.qty_ordered ?? 0) > 0 ||
    (m.qty_from_storage ?? 0) > 0 ||
    (m.qty_on_hand_applied ?? 0) > 0
);
if (!supplierMaterials.length) return null;
      const isExpanded = expandedSuppliers[supplierId];

      return (
        <View key={supplierId} style={{ marginBottom: 16 }}>

          {/* Header */}
          <Pressable
            onPress={() =>
              setExpandedSuppliers(prev => ({
                ...prev,
                [supplierId]: !prev[supplierId],
              }))
            }
            style={{
              backgroundColor: '#f1f5f9',
              padding: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 16 }}>
              {supplier.name} ({supplierMaterials.length}) {isExpanded ? '▲' : '▼'}
            </Text>
          </Pressable>

          {/* Bucket Contents */}
          {isExpanded && (
            <View style={{ marginTop: 10 }}>
{supplierMaterials.map((material: any) => (
<Pressable
  key={material.id}
  delayLongPress={600}
  onLongPress={() => {
    if (role !== 'owner' && role !== 'admin') return;

    Alert.alert(
      'Delete Material?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMaterial(material.id),
        },
      ]
    );
  }}
  onPress={() => {
    if (editMode) {
      setSelectedMaterialIds(prev =>
        prev.includes(material.id)
          ? prev.filter(id => id !== material.id)
          : [...prev, material.id]
      );
    } else {
      handleSupplierMaterialTap(material.id, supplierId);
    }
  }}
  
style={[
  styles.card,
  highlightedMaterial === material.id && {
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  isPhaseOrdered(material) && {
    backgroundColor: '#dcfce7',
  },
  editMode &&
  selectedMaterialIds.includes(material.id) && {
    borderWidth: 2,
    borderColor: '#2563eb',
  }
]}
>
                  <Text style={styles.itemTitle}>
                    {material.item_name}
                  </Text>


{isPhaseOrdered(material) && (
  <View style={{ marginTop: 4 }}>
    <Text style={{ color: '#15803d', fontWeight: '700' }}>
      ✓ Ordered
    </Text>

    {material.date_ordered && (
      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        {new Date(material.date_ordered).toLocaleDateString()}
      </Text>
    )}

{material.order_id && (
  <>
    <Pressable
      onPress={async () => {
        try {
          const orderId = material.order_id;

          const local = await getValidLocalPdf(orderId);
          if (local) {
            await Linking.openURL(local);
            return;
          }

          const res = await apiFetch(`/api/orders/${orderId}/pdf`);
          const signedUrl = res?.url;

          if (!signedUrl) {
            alert('Unable to load PDF');
            return;
          }

          const downloaded = await downloadAndPersistPdf(
            orderId,
            signedUrl
          );

          await Linking.openURL(downloaded);
        } catch {
          alert('Unable to load PDF');
        }
      }}
    >
      <Text style={{ color: '#2563eb', fontSize: 12 }}>
        View PDF
      </Text>
    </Pressable>

    {(role === 'owner' || role === 'admin') && (
      <Pressable
        onPress={() => markUndelivered(material)}
      >
        <Text style={{ color: '#dc2626', fontSize: 12 }}>
          Mark Undelivered
        </Text>
      </Pressable>
    )}
  </>
)}
  </View>
)}

                  {material.item_code && (
                    <Text style={styles.meta}>
                      Item ID: {material.item_code}
                    </Text>
                  )}

<Text style={styles.meta}>
  Needed: {
    (material.qty_needed ?? 0)
    - (material.qty_from_storage ?? 0)
  }
</Text>

                  <Text style={styles.meta}>
                    Ordered: {material.qty_ordered ?? 0}
                  </Text>

                  <Text style={styles.meta}>
                    On-Hand: {material.qty_on_hand_applied ?? 0}
                  </Text>
                    <Text style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>
  {role === 'owner' || role === 'admin'
  ? 'Double tap to collapse section – Hold to delete'
  : 'Double tap to collapse section'}
</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      );
    })}
  </View>
)}

    </ScrollView>
{addMode && (
<View style={styles.bottomAddBar}>
<View style={{ position: 'relative' }}>
  <TextInput
    placeholder="Item name"
    value={newName}
    onChangeText={(txt) => {
      setNewName(txt);
      setShowNameSuggestions(true);
    }}
    onFocus={() => setShowNameSuggestions(true)}
    onBlur={() => {
      // Delay so a tap on a suggestion still registers
      setTimeout(() => setShowNameSuggestions(false), 120);
    }}
    style={styles.input}
  />

  {addMode &&
    showNameSuggestions &&
    filteredNameSuggestions.length > 0 && (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 54, // pushes dropdown above the input
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#e5e7eb',
          borderRadius: 10,
          maxHeight: 220,
          zIndex: 9999,
          elevation: 20,
          overflow: 'hidden',
        }}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          {filteredNameSuggestions.map(s => (
            <Pressable
              key={s.name}
              onPress={() => {
                setNewName(s.name);

                // Optional behavior:
                // If you want tapping suggestion to auto-fill item code too,
                // uncomment this:
                // setNewItemCode(s.code ?? null);

                setShowNameSuggestions(false);
                Keyboard.dismiss();
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontWeight: '700' }}>{s.name}</Text>
              {s.code ? (
                <Text style={{ fontSize: 12, opacity: 0.6 }}>
                  ID: {s.code}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    )}
</View>

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TextInput
        placeholder="Qty"
        value={newQtyNeeded}
        onChangeText={setNewQtyNeeded}
        keyboardType="numeric"
        style={[styles.input, { flex: 0.35 }]}
      />

      <TextInput
        placeholder="Item code (optional)"
        value={newItemCode ?? ''}
        onChangeText={setNewItemCode}
        style={[styles.input, { flex: 0.65 }]}
      />
    </View>

<Pressable
  disabled={!newName.trim()}
  onPress={() => {
    Keyboard.dismiss();
     setShowNameSuggestions(false);
    createMaterial();
  }}
  style={[
    styles.addMaterialButton,
    !newName.trim() && { opacity: 0.5 },
  ]}
>
<View style={{ alignItems: 'center' }}>
  <Text style={{ color: '#fff', fontWeight: '700' }}>
    Add Material
  </Text>

  {(newVendorId || newSupplierId || newPhase) && (
    <Text
      style={{
        color: '#e2e8f0',
        fontSize: 12,
        marginTop: 2,
      }}
      numberOfLines={1}
    >
      {newVendorId
        ? `${vendorMap[newVendorId]?.name ?? ''}`
        : newSupplierId
          ? `${supplierMap[newSupplierId]?.name ?? ''}`
          : ''}

      {newPhase ? ` • ${newPhase}` : ''}
    </Text>
  )}
</View>
    </Pressable>
  </View>
  )}

      </View>
  </KeyboardAvoidingView>
</SafeAreaView>
  </>
);
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  paddingHorizontal: 20,
  paddingTop: 6,   // small gap under header
  backgroundColor: '#fff',
},
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
selectorBar: {
  marginTop: 4,
  marginBottom: 12,
},

selectorChip: {
  paddingVertical: 6,
  paddingHorizontal: 12,
  backgroundColor: '#e5e7eb',
  borderRadius: 999,
  marginRight: 8,
},
selectorCollapsed: {
  backgroundColor: '#e5e7eb',
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 12,
  marginBottom: 6,
},

selectorOption: {
  backgroundColor: '#f3f4f6',
  padding: 10,
  borderRadius: 10,
  marginBottom: 6,
},

selectorChipActive: {
  backgroundColor: '#2563eb',
},

selectorTextActive: {
  color: '#fff',
  fontWeight: '600',
},
bottomAddBar: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: 16,
  backgroundColor: '#ffffff',
  borderTopWidth: 1,
  borderColor: '#e5e7eb',
},

addMaterialButton: {
  marginTop: 8,
  backgroundColor: '#16a34a',
  paddingVertical: 12,
  borderRadius: 12,
  alignItems: 'center',
},
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  label: { fontWeight: '700', marginTop: 8 },
  selected: { color: '#2563eb', fontWeight: '700' },
  addBtn: { color: 'green', fontWeight: '700', marginTop: 12 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, opacity: 0.7 },
  qtyBtn: { fontSize: 20, fontWeight: '700' },
});