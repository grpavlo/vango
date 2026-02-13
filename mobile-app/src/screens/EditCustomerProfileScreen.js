import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Screen from "../components/Screen";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import PhotoPicker from "../components/PhotoPicker";
import { colors } from "../components/Colors";
import { apiFetch, HOST_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";

function fullUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${HOST_URL}${path}`;
}

function parseFullName(fullName) {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", lastName: "", patronymic: "" };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "", patronymic: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "", patronymic: "" };
  return {
    lastName: parts[0],
    firstName: parts[1],
    patronymic: parts.length > 2 ? parts.slice(2).join(" ") : "",
  };
}

function normalizeUri(input) {
  if (!input) return null;
  const v = Array.isArray(input) ? input[0] : input;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v) return v.uri || v.url || v.path || null;
  return null;
}

function isLocalFile(u) {
  return (
    typeof u === "string" &&
    (u.startsWith("file:") || u.startsWith("content:"))
  );
}

function appendFile(fd, fieldName, value) {
  const u = normalizeUri(value);
  if (!u) return;
  if (!isLocalFile(u)) return;
  const last = u.split("/").pop() || `${fieldName}.jpg`;
  const clean = last.split("?")[0];
  const ext = (clean.match(/\.([a-z0-9]+)$/i)?.[1] || "jpg").toLowerCase();
  const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
  fd.append(fieldName, { uri: u, name: clean, type });
}

export default function EditCustomerProfileScreen({ navigation, route }) {
  const user = route.params?.user;
  const { token } = useAuth();
  const toast = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selfiePhoto, setSelfiePhoto] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const driverData = await apiFetch("/driver-profile/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);

        setPhone(me?.phone ?? user?.phone ?? "");

        setEmail(String(me?.email ?? driverData?.user?.email ?? user?.email ?? "").trim());

        if (me?.firstName || me?.lastName || me?.patronymic) {
          setFirstName(me.firstName ?? "");
          setLastName(me.lastName ?? "");
          setPatronymic(me.patronymic ?? "");
        } else if (driverData?.fullName) {
          const parsed = parseFullName(driverData.fullName);
          setFirstName(parsed.firstName);
          setLastName(parsed.lastName);
          setPatronymic(parsed.patronymic);
        } else if (me?.name) {
          const parsed = parseFullName(me.name);
          setFirstName(parsed.firstName);
          setLastName(parsed.lastName);
          setPatronymic(parsed.patronymic);
        }

        const selfieSrc =
          fullUrl(me?.selfiePhoto) || fullUrl(driverData?.selfiePhoto);
        setSelfiePhoto(selfieSrc || null);
      } catch (e) {
        if (user) {
          setPhone(user.phone ?? "");
          if (user.name) {
            const parsed = parseFullName(user.name);
            setFirstName(parsed.firstName);
            setLastName(parsed.lastName);
            setPatronymic(parsed.patronymic);
          }
        }
      }
    })();
  }, [token, user]);

  async function saveProfile() {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPatronymic = patronymic.trim();
    const trimmedPhone = phone.trim();

    const fullName = [trimmedLastName, trimmedFirstName, trimmedPatronymic]
      .filter(Boolean)
      .join(" ");

    if (!fullName) {
      toast.show("Вкажіть ім'я, прізвище або по-батькові");
      return;
    }
    if (!trimmedPhone) {
      toast.show("Вкажіть номер телефону");
      return;
    }
    const phoneDigits = trimmedPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast.show("Некоректний номер телефону");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("firstName", trimmedFirstName);
      fd.append("lastName", trimmedLastName);
      fd.append("patronymic", trimmedPatronymic);
      fd.append("phone", trimmedPhone);
      if (email.trim()) fd.append("email", email.trim());
      appendFile(fd, "selfiePhoto", selfiePhoto);

      await apiFetch("/auth/customer-profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      toast.show("Профіль збережено");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Помилка", err?.message || "Не вдалося зберегти профіль");
    }
  }

  return (
    <Screen>
      <SafeAreaView style={styles.safeAreaContainer}>
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={80}
          enableOnAndroid
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.appBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <AppText style={styles.title}>Мій профіль</AppText>
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.container}
              keyboardShouldPersistTaps="handled"
            >
              <AppText style={styles.sectionTitle}>ПІБ</AppText>
              <AppInput
                label="Прізвище"
                placeholder="Прізвище"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
              <AppInput
                label="Ім'я"
                placeholder="Ім'я"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <AppInput
                label="По-батькові"
                placeholder="По-батькові"
                value={patronymic}
                onChangeText={setPatronymic}
                autoCapitalize="words"
              />

              <AppText style={styles.sectionTitle}>Контакти</AppText>
              <AppInput
                label="Номер телефону"
                placeholder="380..."
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <AppInput
                label="Електронна адреса"
                placeholder="example@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <AppText style={styles.sectionTitle}>Селфі</AppText>
              <PhotoPicker
                label="Ваше фото"
                photos={selfiePhoto ? [selfiePhoto] : []}
                onChange={(arr) => setSelfiePhoto(arr?.[0] || null)}
              />

              <View style={{ height: 24 }} />
              <AppButton title="Зберегти" onPress={saveProfile} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  safeAreaContainer: { flex: 1, paddingTop: 24 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginRight: 90,
  },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 10,
    marginRight: 10,
  },
  iconButton: { padding: 10 },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    fontWeight: "700",
    fontSize: 16,
    color: colors.text,
  },
});
