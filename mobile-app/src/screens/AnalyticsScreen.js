import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import Skeleton from "../components/Skeleton";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import { colors } from "../components/Colors";

function NumberValue({ value, suffix = "" }) {
  if (value === null || value === undefined) return <AppText>-</AppText>;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return <AppText>-</AppText>;
  return (
    <AppText style={styles.metricValue}>
      {numeric.toLocaleString("uk-UA")} {suffix}
    </AppText>
  );
}

function MetricRow({ label, value, suffix }) {
  return (
    <View style={styles.metricRow}>
      <AppText style={styles.metricLabel}>{label}</AppText>
      <NumberValue value={value} suffix={suffix} />
    </View>
  );
}

function MetricCard({ title, children }) {
  return (
    <View style={styles.card}>
      <AppText style={styles.cardTitle}>{title}</AppText>
      {children}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      const res = await apiFetch("/admin/analytics/overview?days=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res);
    } catch (err) {
      setError(err?.message || "Не вдалося завантажити аналітику");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !data) {
    return (
      <View style={styles.container}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppText style={styles.title}>Аналітика маркетплейсу</AppText>
      <AppText style={styles.subTitle}>Тестова панель для перевірки метрик</AppText>

      {!!error && <AppText style={styles.error}>{error}</AppText>}

      <MetricCard title="GMV (Gross Merchandise Volume)">
        <MetricRow label="Весь час" value={data?.gmv?.allTime} suffix="грн" />
        <MetricRow label="Останні 30 днів" value={data?.gmv?.period?.value} suffix="грн" />
      </MetricCard>

      <MetricCard title="Активні користувачі">
        <MetricRow label="DAU" value={data?.activeUsers?.dau} />
        <MetricRow label="WAU" value={data?.activeUsers?.wau} />
        <MetricRow label="MAU" value={data?.activeUsers?.mau} />
        <MetricRow label="DAU / MAU" value={data?.activeUsers?.dauToMauPercent} suffix="%" />
      </MetricCard>

      <MetricCard title="Liquidity">
        <MetricRow label="% замовлень, що знайшли водія" value={data?.liquidity?.foundDriverPercent} suffix="%" />
        <MetricRow label="Середній час закриття" value={data?.liquidity?.avgTimeToCloseHours} suffix="год" />
        <MetricRow label="Відгуків на 1 замовлення" value={data?.liquidity?.responsesPerOrder} />
      </MetricCard>

      <MetricCard title="Retention водіїв">
        <MetricRow label="7 днів" value={data?.retention?.retention7d?.percent} suffix="%" />
        <MetricRow label="30 днів" value={data?.retention?.retention30d?.percent} suffix="%" />
        <MetricRow label="90 днів" value={data?.retention?.retention90d?.percent} suffix="%" />
      </MetricCard>

      <AppButton title={loading ? "Оновлення..." : "Оновити"} onPress={load} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  subTitle: {
    marginTop: 4,
    marginBottom: 10,
    color: colors.textSecondary,
  },
  error: {
    marginBottom: 8,
    color: colors.red,
  },
  card: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  metricLabel: {
    color: colors.textSecondary,
    flex: 1,
    paddingRight: 10,
  },
  metricValue: {
    fontWeight: "700",
    color: colors.text,
  },
  skeleton: {
    height: 22,
    marginVertical: 6,
    borderRadius: 8,
  },
});
