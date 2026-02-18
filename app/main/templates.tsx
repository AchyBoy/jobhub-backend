// JobHub/app/main/templates.tsx

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../../src/lib/apiClient';

type Template = {
  id: string;
  name: string;
  createdAt: string;
};

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const res = await apiFetch('/api/templates');
      setTemplates(res?.templates ?? []);
    } catch (err) {
      console.warn('Failed to load templates', err);
      Alert.alert('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Templates</Text>

      {loading ? (
        <Text style={styles.empty}>Loading templates…</Text>
      ) : templates.length === 0 ? (
        <Text style={styles.empty}>No templates yet.</Text>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/main/add-job',
                  params: {
                    templateId: item.id,
                    templateName: item.name,
                  },
                })
              }
            >
              <Text style={styles.name}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  empty: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
});