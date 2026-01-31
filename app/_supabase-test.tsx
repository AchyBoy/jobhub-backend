import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { supabase } from "../src/lib/supabase";

export default function SupabaseTest() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setStatus("error: " + error.message);
      } else if (data.session) {
        setStatus("session found for user: " + data.session.user.id);
      } else {
        setStatus("no session (expected if not logged in)");
      }
    });
  }, []);

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 16 }}>Supabase test:</Text>
      <Text style={{ marginTop: 12 }}>{status}</Text>
    </View>
  );
}
