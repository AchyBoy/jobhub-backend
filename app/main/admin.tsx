//JobHub/app/main/admin.tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../src/lib/apiClient';

export default function AdminScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await apiFetch('/api/tenant/users');
      setUsers(res.users ?? []);
    } catch (err) {
      console.warn('Failed to load users');
    }
  }

  async function addUser() {
    if (!email.trim()) return;

    setLoading(true);

    try {
      await apiFetch('/api/tenant/users/add', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          newRole: role,
        }),
      });

      setEmail('');
      await loadUsers();
      Alert.alert('Success', 'User added successfully.');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message ?? 'Failed to add user.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function deactivateUser(userId: string) {
    Alert.alert(
      'Deactivate User',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch('/api/tenant/users/deactivate', {
                method: 'POST',
                body: JSON.stringify({
                  targetUserId: userId,
                }),
              });

              await loadUsers();
            } catch {
              Alert.alert('Error', 'Failed to deactivate user.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Tenant Users</Text>

        {users.map((u: any) => (
          <View key={u.user_id} style={styles.userRow}>
            <View>
              <Text style={styles.userId}>
                {u.user_id}
              </Text>
              <Text style={styles.meta}>
                Role: {u.role} | {u.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>

            {u.role !== 'owner' && u.is_active && (
              <Pressable
                onPress={() => deactivateUser(u.user_id)}
              >
                <Text style={styles.deactivate}>
                  Deactivate
                </Text>
              </Pressable>
            )}
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.section}>
          Add User (by email)
        </Text>

        <TextInput
          placeholder="User email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
        />

        <View style={styles.roleRow}>
          <Pressable
            style={[
              styles.roleButton,
              role === 'member' && styles.roleSelected,
            ]}
            onPress={() => setRole('member')}
          >
            <Text>Member</Text>
          </Pressable>

          <Pressable
            style={[
              styles.roleButton,
              role === 'admin' && styles.roleSelected,
            ]}
            onPress={() => setRole('admin')}
          >
            <Text>Admin</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={addUser}
          disabled={loading}
        >
          <Text style={styles.addButtonText}>
            {loading ? 'Adding…' : 'Add User'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userId: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    opacity: 0.6,
  },
  deactivate: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  section: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  roleSelected: {
    backgroundColor: '#dbeafe',
  },
  addButton: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});