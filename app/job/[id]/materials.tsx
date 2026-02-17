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
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';
import { generateOrderPdf } from '../../../src/lib/pdfGenerator';
import * as Linking from 'expo-linking';


export default function MaterialsScreen() {
  const { id } = useLocalSearchParams();
  const jobId = id as string;
  const [ordering, setOrdering] = useState(false);
const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [jobName, setJobName] = useState<string>('');
  const [phases, setPhases] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
const [supplierMap, setSupplierMap] = useState<Record<string, any>>({});
const [phasePickerOpen, setPhasePickerOpen] = useState(false);
const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhase, setNewPhase] = useState<string | null>(null);
  const [newSupplierId, setNewSupplierId] = useState<string | null>(null);
  const [newItemCode, setNewItemCode] = useState<string | null>(null);
function isOrdered(material: any) {
  const fulfilled =
    (material.qty_ordered ?? 0) +
    (material.qty_from_storage ?? 0);

  return (
    fulfilled >= (material.qty_needed ?? 0) &&
    (material.qty_needed ?? 0) > 0
  );
}
// Group by phase
const materialsByPhase = materials.reduce((acc: any, m: any) => {
  if (!acc[m.phase]) acc[m.phase] = [];
  acc[m.phase].push(m);
  return acc;
}, {});

// Group by supplier
const materialsBySupplier = materials.reduce((acc: any, m: any) => {
  if (!m.supplier_id) return acc;

  if (!acc[m.supplier_id]) acc[m.supplier_id] = [];
  acc[m.supplier_id].push(m);

  return acc;
}, {});

const activeSupplierIds = Object.keys(materialsBySupplier);

// ✅ ADD THIS HERE
const internalMaterials = materials.filter(
  m =>
    (m.qty_from_storage ?? 0) > 0 ||
    (m.qty_on_hand_applied ?? 0) > 0
);

  useEffect(() => {
    loadMaterials();
    loadPhases();
    loadSuppliers();
    loadJob();
    loadSelections();

    setTimeout(() => flushSyncQueue(), 50);
  }, [jobId]);

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

async function loadMaterials() {
  const key = `job:${jobId}:materials`;

  try {
    const res = await apiFetch(`/api/materials?jobId=${jobId}`);
    const list = res?.materials ?? [];
    setMaterials(list);
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    const local = await AsyncStorage.getItem(key);
    if (local) setMaterials(JSON.parse(local));
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

  async function loadSelections() {
  try {
    const savedPhase = await AsyncStorage.getItem('materials:selectedPhase');
    const savedSupplier = await AsyncStorage.getItem('materials:selectedSupplier');

    if (savedPhase) setNewPhase(savedPhase);
    if (savedSupplier) setNewSupplierId(savedSupplier);
  } catch {}
}

  async function createMaterial() {
    if (!newName) return;

if (!newPhase && !newSupplierId) {
  alert('Please select phase and supplier');
  return;
}

if (!newPhase) {
  alert('Please select phase');
  return;
}

if (!newSupplierId) {
  alert('Please select supplier');
  return;
}

    const localMaterial = {
      id: makeId(),
      job_id: jobId,
      item_name: newName,
      item_code: newItemCode,
      phase: newPhase,
      supplier_id: newSupplierId,
      qty_needed: 0,
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
    supplierId: newSupplierId,
    qtyNeeded: 0,
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
  }

   async function changeSupplier(material: any, supplierId: string) {
  const updated = materials.map(m =>
    m.id === material.id
      ? { ...m, supplier_id: supplierId }
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
    (material.qty_ordered ?? 0);

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

async function updateQty(material: any, delta: number) {
  const current = material.qty_needed ?? 0;
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

async function openInMail(args: {
  supplierEmail: string;
  subject: string;
  body: string;
}) {
  const mailto =
    `mailto:${args.supplierEmail}` +
    `?subject=${encodeURIComponent(args.subject)}` +
    `&body=${encodeURIComponent(args.body)}`;

  await Linking.openURL(mailto);
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
  if (!newPhase || !newSupplierId) {
    alert('Select phase and supplier first');
    return;
  }

  const supplier = supplierMap[newSupplierId];
  const supplierEmail =
    supplier?.contacts?.find((c: any) => c.type === 'email')?.value;

  if (!supplierEmail) {
    alert('Supplier has no email');
    return;
  }

let itemsToOrder: { materialId: string; qtyOrdered: number }[] = [];

if (supplier?.isInternal) {
  // Internal / On-Hand flow
  itemsToOrder = materials
    .filter(
      m =>
        m.phase === newPhase &&
        (m.qty_on_hand_applied ?? 0) > 0
    )
    .map(m => ({
      materialId: m.id,
      qtyOrdered: m.qty_on_hand_applied ?? 0,
    }));
} else {
  // Normal supplier flow
  itemsToOrder = materials
    .filter(
      m =>
        m.phase === newPhase &&
        m.supplier_id === newSupplierId &&
        m.qty_needed >
  ((m.qty_ordered ?? 0) + (m.qty_from_storage ?? 0))
    )
    .map(m => ({
      materialId: m.id,
qtyOrdered:
  m.qty_needed -
  (m.qty_ordered ?? 0) -
  (m.qty_from_storage ?? 0),
    }));
}

  if (!itemsToOrder.length) {
    alert('Nothing to order');
    return;
  }
try {
    const supplierName =
      supplierMap[newSupplierId]?.name ?? 'Supplier';

const { orderId, uri } = await generateOrderPdf({
  jobId,
  phase: newPhase!,
  supplierName,
  items: itemsToOrder.map(it => {
    const m = materials.find(x => x.id === it.materialId);
    return {
      name: m?.item_name ?? '',
      code: m?.item_code,
      qty: it.qtyOrdered,
    };
  }),
});

    // 1️⃣ Upload order to backend
    await apiFetch('/api/orders/create', {
      method: 'POST',
      body: createFormData({
        orderId,
        jobId,
        phase: newPhase!,
        supplierId: newSupplierId!,
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
      supplierEmail,
      subject,
      body,
    });

    // ✅ Mark supplier items as ordered
if (!supplier?.isInternal) {
  const updated = materials.map(m => {
    const orderedItem = itemsToOrder.find(
      it => it.materialId === m.id
    );

    if (orderedItem) {
      return {
        ...m,
        qty_ordered:
          (m.qty_ordered ?? 0) + orderedItem.qtyOrdered,
      };
    }

    return m;
  });

  setMaterials(updated);
  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  // persist to backend
for (const it of itemsToOrder) {
  const material = materials.find(m => m.id === it.materialId);
  if (!material) continue;

  const newQtyOrdered =
    (material.qty_ordered ?? 0) + it.qtyOrdered;

  await apiFetch(`/api/materials/${it.materialId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      qtyOrdered: newQtyOrdered,
    }),
  });
}
}

    // Mark internal items as ordered
if (supplier?.isInternal) {
  const updated = materials.map(m => {
    if (
      m.phase === newPhase &&
      (m.qty_on_hand_applied ?? 0) > 0
    ) {
      return {
        ...m,
        qty_from_storage:
          (m.qty_from_storage ?? 0) + (m.qty_on_hand_applied ?? 0),
        qty_on_hand_applied: 0,
      };
    }
    return m;
  });

  setMaterials(updated);
  await AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );
}

alert('Email draft opened');

} catch (err) {
    console.warn('Order failed — enqueueing', err);

    alert('Order failed before upload');

    flushSyncQueue();

    alert('Offline — order queued');
  }
}

return (
  <>
<Stack.Screen
  options={{
    title: jobName
      ? `${jobName} - Materials`
      : 'Materials',
  }}
/>
<SafeAreaView style={{ flex: 1 }} edges={['left','right','bottom']}>
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={90}
  >
    <View style={styles.container}>

  <Pressable
    onPress={() => {
      setEditMode(v => !v);
      setSelectedMaterialIds([]);
    }}
    style={{ marginBottom: 12 }}
  >
    <Text style={{ fontWeight: '700', color: '#2563eb' }}>
      {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
    </Text>
  </Pressable>

  <ScrollView
      contentContainerStyle={{ paddingBottom: editMode ? 140 : 60 }}
      showsVerticalScrollIndicator={false}
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
    style={styles.selectorCollapsed}
  >
    <Text style={{ fontWeight: '600' }}>
      Supplier: {supplierMap[newSupplierId || '']?.name || 'Select Supplier'}
    </Text>
  </Pressable>

  {supplierPickerOpen && (
    <View>
      {suppliers.map(s => (
        <Pressable
          key={s.id}
          onPress={async () => {
            setNewSupplierId(s.id);
            await AsyncStorage.setItem('materials:selectedSupplier', s.id);
            setSupplierPickerOpen(false);
          }}
          style={styles.selectorOption}
        >
          <Text>{s.name}</Text>
        </Pressable>
      ))}
    </View>
  )}

</View>

{/* ORDER BUTTON */}
<Pressable
  disabled={ordering}
onPress={() => {
  if (ordering) return;

  Alert.alert(
    'Confirm Order',
    'Are you sure you want to generate and send this material order?',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          setOrdering(true);
          await handleCreateOrder();
          setOrdering(false);
        },
      },
    ]
  );
}}
  style={{
    backgroundColor: ordering ? '#94a3b8' : '#2563eb',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
  }}
>
  <Text style={{ color: '#fff', fontWeight: '700' }}>
    {ordering
      ? 'Processing...'
      : 'Order Materials For Selected Phase/Supplier'}
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
onPress={() => {
  const updated = materials.map(m =>
    selectedMaterialIds.includes(m.id)
      ? { ...m, supplier_id: s.id }
      : m
  );

  setMaterials(updated);
  AsyncStorage.setItem(
    `job:${jobId}:materials`,
    JSON.stringify(updated)
  );

  // fire & forget backend sync (non-blocking)
  selectedMaterialIds.forEach(id => {
    const material = materials.find(m => m.id === id);
    if (!material) return;

    apiFetch(`/api/materials/${material.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ supplierId: s.id }),
    }).catch(() => {
      enqueueSync({
        id: makeId(),
        type: 'material_update',
        coalesceKey: `material_update:${material.id}`,
        createdAt: nowIso(),
        payload: {
          materialId: material.id,
          updates: { supplierId: s.id },
        },
      });
    });
  });

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
      style={{
        backgroundColor: '#dbeafe',
        padding: 12,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 16 }}>
        {phase} {expandedPhases[phase] ? '▲' : '▼'}
      </Text>
    </Pressable>

    {/* Phase Materials */}
    {expandedPhases[phase] &&
      materialsByPhase[phase].map((material: any) => (
<View
  key={material.id}
style={[
  styles.card,

(material.qty_on_hand_applied ?? 0) > 0 && {
  backgroundColor: '#f0fdf4',
},

  editMode &&
  selectedMaterialIds.includes(material.id) && {
    borderWidth: 2,
    borderColor: '#2563eb'
  }
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

  {isOrdered(material) && (
  <Text style={{ color: '#15803d', fontWeight: '700', marginTop: 4 }}>
    ✓ Ordered
  </Text>
)}

  {material.item_code && (
    <Text style={styles.meta}>
      Item ID: {material.item_code}
    </Text>
  )}

{/* Supplier Name */}
<Text style={styles.meta}>
  Supplier: {supplierMap[material.supplier_id]?.name || '—'}
</Text>

{/* Qty */}
<Text style={styles.meta}>
  Qty: {material.qty_needed ?? 0}
</Text>
</View>

{/* RIGHT SIDE */}
<View style={{ alignItems: 'center' }}>

{editMode && !isOrdered(material) && (() => {
  const onHand = material.qty_on_hand_applied ?? 0;

  return (
    <>
      {/* + Needed Button */}
      <Pressable
        onPress={() => updateQty(material, 1)}
        style={{ marginBottom: 4 }}
      >
        <Text style={styles.qtyBtn}>+</Text>
      </Pressable>

      {/* Qty Box */}
      <TextInput
        editable
        value={String(material.qty_needed ?? 0)}
        keyboardType="numeric"
        onChangeText={(val) => {
          const num = parseInt(val || '0', 10);
          if (!isNaN(num)) {
            updateQty(material, num - (material.qty_needed ?? 0));
          }
        }}
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          paddingVertical: 4,
          paddingHorizontal: 10,
          textAlign: 'center',
          minWidth: 60,
          marginBottom: 4,
        }}
      />

      {/* − Needed Button */}
      <Pressable
        onPress={() => updateQty(material, -1)}
      >
        <Text style={styles.qtyBtn}>−</Text>
      </Pressable>

      {/* On-Hand Controls */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 12, opacity: 0.6 }}>
          On-Hand: {onHand}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => applyOnHand(material, 1)}>
            <Text style={{ color: '#16a34a', fontWeight: '700' }}>
              + On-Hand
            </Text>
          </Pressable>

          <Pressable onPress={() => applyOnHand(material, -1)}>
            <Text style={{ color: '#dc2626', fontWeight: '700' }}>
              − On-Hand
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
})()}

</View>

  </View>
</View>
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
          <View key={material.id} style={styles.card}>
            <Text style={styles.itemTitle}>
              {material.item_name}
            </Text>

            {material.item_code && (
              <Text style={styles.meta}>
                Item ID: {material.item_code}
              </Text>
            )}

            <Text style={styles.meta}>
              Pulled From Storage: {
  (material.qty_from_storage ?? 0) +
  (material.qty_on_hand_applied ?? 0)
}
            </Text>

            <Text style={styles.meta}>
              Job: {jobName || jobId}
            </Text>
          </View>
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
      const supplier = supplierMap[supplierId];
      if (!supplier) return null;

      const supplierMaterials = materialsBySupplier[supplierId];
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
                <View key={material.id} style={styles.card}>
                  <Text style={styles.itemTitle}>
                    {material.item_name}
                  </Text>

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
                </View>
              ))}
            </View>
          )}
        </View>
      );
    })}
  </View>
)}

    </ScrollView>
    {editMode && (
  <View style={styles.bottomAddBar}>
    <TextInput
      placeholder="Item name"
      value={newName}
      onChangeText={setNewName}
      style={styles.input}
    />

    <TextInput
      placeholder="Item code (optional)"
      value={newItemCode ?? ''}
      onChangeText={setNewItemCode}
      style={styles.input}
    />

    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        createMaterial();
      }}
      style={styles.addMaterialButton}
    >
      <Text style={{ color: '#fff', fontWeight: '700' }}>
        Add Material
      </Text>
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