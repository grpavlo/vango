// src/screens/EditProfile.js
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
import CheckBox from "../components/CheckBox";
import { colors } from "../components/Colors";
import { apiFetch, HOST_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";

export default function EditProfile({ navigation, route }) {
  const user = route.params?.user;
  const { token } = useAuth();
  const toast = useToast();

  // Текстові поля
  const [fullName, setFullName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [noInn, setNoInn] = useState(false);
  const [inn, setInn] = useState("");

  const [passportSeries, setPassportSeries] = useState("");
  const [passportNumber, setPassportNumber] = useState("");

  const [driverLicenseSeries, setDriverLicenseSeries] = useState("");
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("");

  const [vehicleTechSeries, setVehicleTechSeries] = useState("");
  const [vehicleTechNumber, setVehicleTechNumber] = useState("");

  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carLengthMm, setCarLengthMm] = useState("");
  const [carWidthMm, setCarWidthMm] = useState("");
  const [carHeightMm, setCarHeightMm] = useState("");

  // Фото (зберігаємо URI)
  const [innDocPhoto, setInnDocPhoto] = useState(null);
  const [passportPhotoMain, setPassportPhotoMain] = useState(null);
  const [passportPhotoRegistration, setPassportPhotoRegistration] =
    useState(null);
  const [driverLicensePhoto, setDriverLicensePhoto] = useState(null);
  const [vehicleTechPhoto, setVehicleTechPhoto] = useState(null);
  const [carPhotoFrontRight, setCarPhotoFrontRight] = useState(null);
  const [carPhotoRearLeft, setCarPhotoRearLeft] = useState(null);
  const [carPhotoInterior, setCarPhotoInterior] = useState(null);
  const [selfiePhoto, setSelfiePhoto] = useState(null);

  function fullUrl(path) {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${HOST_URL}${path}`;
  }

  // Підтягнути наявний профіль (якщо є)
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/driver-profile/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data) {
          setFullName(data.fullName ?? user?.name ?? "");
          setPhone(data.user?.phone ?? user?.phone ?? "");

          setNoInn(Boolean(data.noInn));
          setInn(data.inn ?? "");

          setPassportSeries(data.passportSeries ?? "");
          setPassportNumber(data.passportNumber ?? "");

          setDriverLicenseSeries(data.driverLicenseSeries ?? "");
          setDriverLicenseNumber(data.driverLicenseNumber ?? "");

          setVehicleTechSeries(data.vehicleTechSeries ?? "");
          setVehicleTechNumber(data.vehicleTechNumber ?? "");

          setCarMake(data.carMake ?? "");
          setCarModel(data.carModel ?? "");
          setCarYear(data.carYear ? String(data.carYear) : "");
          setCarPlate(data.carPlate ?? "");
          setCarLengthMm(data.carLengthMm ? String(data.carLengthMm) : "");
          setCarWidthMm(data.carWidthMm ? String(data.carWidthMm) : "");
          setCarHeightMm(data.carHeightMm ? String(data.carHeightMm) : "");

          // ���� (���� ��� ������� URL)
          setInnDocPhoto(fullUrl(data.innDocPhoto) || null);
          setPassportPhotoMain(fullUrl(data.passportPhotoMain) || null);
          setPassportPhotoRegistration(
            fullUrl(data.passportPhotoRegistration) || null
          );
          setDriverLicensePhoto(fullUrl(data.driverLicensePhoto) || null);
          setVehicleTechPhoto(fullUrl(data.vehicleTechPhoto) || null);
          setCarPhotoFrontRight(fullUrl(data.carPhotoFrontRight) || null);
          setCarPhotoRearLeft(fullUrl(data.carPhotoRearLeft) || null);
          setCarPhotoInterior(fullUrl(data.carPhotoInterior) || null);
          setSelfiePhoto(fullUrl(data.selfiePhoto) || null);
        } else if (user) {
          if (user?.name) setFullName(user.name);
          if (user?.phone) setPhone(user.phone);
        }
      } catch (e) {
        // ок, якщо ще не створено
      }
    })();
  }, [token]);

  // function appendFile(fd, fieldName, uri) {
  //   if (!uri) return;
  //   const filename = uri.split("/").pop() || `${fieldName}.jpg`;
  //   const match = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  //   const type = match ? `image/${match[1].toLowerCase()}` : "image/jpeg";
  //   fd.append(fieldName, { uri, name: filename, type });
  // }

  // Приймає: string | {uri:string}| Array<...>
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
    // Якщо це вже URL з сервера (/uploads/ або http/https) — не переаплоадимо
    if (!isLocalFile(u)) return;
    const last = u.split("/").pop() || `${fieldName}.jpg`;
    const clean = last.split("?")[0];
    const ext = (clean.match(/\.([a-z0-9]+)$/i)?.[1] || "jpg").toLowerCase();
    const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
    fd.append(fieldName, { uri: u, name: clean, type });
  }

  async function saveProfile() {
    try {
      const trimmedFullName = fullName.trim();
      const trimmedPhone = phone.trim();
      const trimmedInn = inn.trim();
      const trimmedPassportNumber = passportNumber.trim();
      const trimmedDriverLicenseNumber = driverLicenseNumber.trim();
      const trimmedVehicleTechNumber = vehicleTechNumber.trim();
      const trimmedCarMake = carMake.trim();
      const trimmedCarModel = carModel.trim();
      const trimmedCarPlate = carPlate.trim();

      const requireValue = (condition, message) => {
        if (!condition) {
          toast.show(message);
          return false;
        }
        return true;
      };

      if (!requireValue(trimmedFullName, "Вкажіть ПІБ")) return;
      if (!requireValue(trimmedPhone, "Вкажіть номер телефону")) return;
      const phoneDigits = trimmedPhone.replace(/\D/g, "");
      if (!requireValue(phoneDigits.length >= 10, "Некоректний номер телефону"))
        return;

      if (!noInn && !requireValue(trimmedInn, "Вкажіть ІПН або поставте відмітку"))
        return;
      if (noInn && !requireValue(Boolean(innDocPhoto), "Додайте підтвердження відсутності ІПН"))
        return;

      if (!requireValue(trimmedPassportNumber, "Вкажіть номер паспорта")) return;
      if (!requireValue(Boolean(passportPhotoMain), "Додайте фото паспорта (1 сторінка)"))
        return;
      if (!requireValue(Boolean(passportPhotoRegistration), "Додайте фото паспорта (прописка)"))
        return;

      if (!requireValue(trimmedDriverLicenseNumber, "Вкажіть номер посвідчення водія"))
        return;
      if (!requireValue(Boolean(driverLicensePhoto), "Додайте фото посвідчення водія"))
        return;

      if (!requireValue(trimmedVehicleTechNumber, "Вкажіть номер техпаспорта")) return;
      if (!requireValue(Boolean(vehicleTechPhoto), "Додайте фото техпаспорта"))
        return;

      if (!requireValue(trimmedCarPlate, "Вкажіть державний номер авто")) return;
      if (!requireValue(trimmedCarMake, "Вкажіть марку авто")) return;
      if (!requireValue(trimmedCarModel, "Вкажіть модель авто")) return;

      const carYearValue = Number.parseInt(carYear.trim(), 10);
      if (!requireValue(Number.isFinite(carYearValue) && carYearValue > 1900, "Вкажіть рік випуску авто"))
        return;

      const carLengthValue = Number.parseInt(carLengthMm.trim(), 10);
      if (!requireValue(Number.isFinite(carLengthValue) && carLengthValue > 0, "Вкажіть довжину авто, мм"))
        return;

      const carWidthValue = Number.parseInt(carWidthMm.trim(), 10);
      if (!requireValue(Number.isFinite(carWidthValue) && carWidthValue > 0, "Вкажіть ширину авто, мм"))
        return;

      const carHeightValue = Number.parseInt(carHeightMm.trim(), 10);
      if (!requireValue(Number.isFinite(carHeightValue) && carHeightValue > 0, "Вкажіть висоту авто, мм"))
        return;

      if (!requireValue(Boolean(carPhotoFrontRight), "Додайте фото авто (передній правий кут)"))
        return;
      if (!requireValue(Boolean(carPhotoRearLeft), "Додайте фото авто (задній лівий кут)"))
        return;
      if (!requireValue(Boolean(carPhotoInterior), "Додайте фото салону")) return;
      if (!requireValue(Boolean(selfiePhoto), "Додайте селфі")) return;

      const fd = new FormData();
      fd.append("fullName", trimmedFullName);
      fd.append("noInn", noInn ? "true" : "false");
      if (!noInn) {
        fd.append("inn", trimmedInn);
      }

      fd.append("passportSeries", passportSeries.trim());
      fd.append("passportNumber", trimmedPassportNumber);
      fd.append("driverLicenseSeries", driverLicenseSeries.trim());
      fd.append("driverLicenseNumber", trimmedDriverLicenseNumber);
      fd.append("vehicleTechSeries", vehicleTechSeries.trim());
      fd.append("vehicleTechNumber", trimmedVehicleTechNumber);

      fd.append("carMake", trimmedCarMake);
      fd.append("carModel", trimmedCarModel);
      fd.append("carYear", String(carYearValue));
      fd.append("carPlate", trimmedCarPlate);
      fd.append("carLengthMm", String(carLengthValue));
      fd.append("carWidthMm", String(carWidthValue));
      fd.append("carHeightMm", String(carHeightValue));

      // �����
      appendFile(fd, "innDocPhoto", innDocPhoto);
      appendFile(fd, "passportPhotoMain", passportPhotoMain);
      appendFile(fd, "passportPhotoRegistration", passportPhotoRegistration);
      appendFile(fd, "driverLicensePhoto", driverLicensePhoto);
      appendFile(fd, "vehicleTechPhoto", vehicleTechPhoto);
      appendFile(fd, "carPhotoFrontRight", carPhotoFrontRight);
      appendFile(fd, "carPhotoRearLeft", carPhotoRearLeft);
      appendFile(fd, "carPhotoInterior", carPhotoInterior);
      appendFile(fd, "selfiePhoto", selfiePhoto);

      await apiFetch("/driver-profile/me", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      await apiFetch("/auth/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmedFullName, phone: trimmedPhone }),
      });

      toast.show("Анкету збережено");
      navigation.goBack();
    } catch (err) {
      console.log(err);
      Alert.alert("Помилка", "Не вдалося зберегти анкету");
    }
  }
  const hasFooter = AppButton.length > 0;
  return (
    <Screen hasFooter={hasFooter}>
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
            <AppText style={styles.title}>Редагування профілю</AppText>
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.container}
              keyboardShouldPersistTaps="handled"
            >
              {/* ПІБ */}
              <AppText style={styles.sectionTitle}>ПІБ</AppText>
              <AppInput
                label="ПІБ"
                placeholder="Вкажіть повне ім'я"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <AppInput
                label="Номер телефону"
                placeholder="380..."
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="next"
              />

              {/* ІПН */}
              <AppText style={styles.sectionTitle}>ІПН</AppText>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <AppInput
                  style={{ marginRight: 8, flex: 1 }}
                  label="ІПН"
                  placeholder="XXXXXXXXXX"
                  value={inn}
                  onChangeText={setInn}
                  editable={!noInn}
                  keyboardType="number-pad"
                />
                <CheckBox
                  value={noInn}
                  onChange={setNoInn}
                  label="Не маю ІПН"
                />
              </View>
              {noInn && (
                <AppText style={styles.secondaryText}>
                  Завантажте фото розділу з паспорта про відсутність ІПН
                </AppText>
              )}
              {noInn && (
                <PhotoPicker
                  label="Фото з паспорта (розділ про відсутність ІПН)"
                  photos={innDocPhoto ? [innDocPhoto] : []}
                  onChange={(arr) => setInnDocPhoto(arr?.[0] || null)}
                />
              )}

              {/* Паспорт */}
              <AppText style={styles.sectionTitle}>Паспорт</AppText>
              <View style={styles.row}>
                <AppInput
                  style={styles.col}
                  label="Серія"
                  placeholder="Серія"
                  value={passportSeries}
                  onChangeText={setPassportSeries}
                />
                <AppInput
                  style={styles.col}
                  label="Номер"
                  placeholder="Номер"
                  value={passportNumber}
                  onChangeText={setPassportNumber}
                  keyboardType="number-pad"
                />
              </View>
              <AppText style={styles.secondaryText}>
                Фото 1-ї сторінки паспорта
              </AppText>
              <PhotoPicker
                photos={passportPhotoMain ? [passportPhotoMain] : []}
                onChange={(arr) => setPassportPhotoMain(arr?.[0] || "")}
              />
              <AppText style={styles.secondaryText}>Фото з пропискою</AppText>
              <PhotoPicker
                label="Фото з пропискою"
                photos={
                  passportPhotoRegistration ? [passportPhotoRegistration] : []
                }
                onChange={(arr) =>
                  setPassportPhotoRegistration(arr?.[0] || null)
                }
              />

              {/* Водійське */}
              <AppText style={styles.sectionTitle}>
                Водійське посвідчення
              </AppText>
              <View style={styles.row}>
                <AppInput
                  style={styles.col}
                  label="Серія"
                  placeholder="Серія"
                  value={driverLicenseSeries}
                  onChangeText={setDriverLicenseSeries}
                />
                <AppInput
                  style={styles.col}
                  label="Номер"
                  placeholder="Номер"
                  value={driverLicenseNumber}
                  onChangeText={setDriverLicenseNumber}
                  keyboardType="number-pad"
                />
              </View>
              <AppText style={styles.secondaryText}>Фото посвідчення</AppText>
              <PhotoPicker
                label="Фото посвідчення"
                photos={driverLicensePhoto ? [driverLicensePhoto] : []}
                onChange={(arr) => setDriverLicensePhoto(arr?.[0] || null)}
              />

              {/* Техпаспорт */}
              <AppText style={styles.sectionTitle}>Техпаспорт авто</AppText>
              <View style={styles.row}>
                <AppInput
                  style={styles.col}
                  label="Серія"
                  placeholder="Серія"
                  value={vehicleTechSeries}
                  onChangeText={setVehicleTechSeries}
                />
                <AppInput
                  style={styles.col}
                  label="Номер"
                  placeholder="Номер"
                  value={vehicleTechNumber}
                  onChangeText={setVehicleTechNumber}
                />
              </View>
              <AppText style={styles.secondaryText}>Фото техпаспорта</AppText>
              <PhotoPicker
                label="Фото техпаспорта"
                photos={vehicleTechPhoto ? [vehicleTechPhoto] : []}
                onChange={(arr) => setVehicleTechPhoto(arr?.[0] || null)}
              />

              {/* Авто */}
              <AppText style={styles.sectionTitle}>Автомобіль</AppText>
              {/* <AppText style={styles.secondaryText}>Держномер</AppText> */}
              <AppInput
                label="Держномер"
                placeholder="Держномер"
                autoCapitalize="characters"
                value={carPlate}
                onChangeText={setCarPlate}
              />
              <View style={styles.row}>
                <AppInput
                  style={styles.col}
                  label="Марка"
                  placeholder="Марка"
                  value={carMake}
                  onChangeText={setCarMake}
                />
                <AppInput
                  style={styles.col}
                  label="Модель"
                  placeholder="Модель"
                  value={carModel}
                  onChangeText={setCarModel}
                />
              </View>
              <AppInput
                label="Рік випуску"
                placeholder="Рік випуску"
                value={carYear}
                onChangeText={setCarYear}
                keyboardType="number-pad"
              />

              <AppText style={styles.sectionTitle}>Габарити (мм)</AppText>
              <View style={styles.row}>
                <AppInput
                  style={styles.col}
                  label="Довжина"
                  placeholder="Довжина"
                  value={carLengthMm}
                  onChangeText={setCarLengthMm}
                  keyboardType="number-pad"
                />
                <AppInput
                  style={styles.col}
                  label="Ширина"
                  placeholder="Ширина"
                  value={carWidthMm}
                  onChangeText={setCarWidthMm}
                  keyboardType="number-pad"
                />
                <AppInput
                  style={styles.col}
                  label="Висота"
                  placeholder="Висота"
                  value={carHeightMm}
                  onChangeText={setCarHeightMm}
                  keyboardType="number-pad"
                />
              </View>

              <AppText style={styles.sectionTitle}>Фото авто</AppText>
              <AppText style={styles.secondaryText}>
                Передній правий кут
              </AppText>
              <PhotoPicker
                label="Передній правий кут"
                photos={carPhotoFrontRight ? [carPhotoFrontRight] : []}
                onChange={(arr) => setCarPhotoFrontRight(arr?.[0] || null)}
              />
              <AppText style={styles.secondaryText}>Задній лівий кут</AppText>
              <PhotoPicker
                label="Задній лівий кут"
                photos={carPhotoRearLeft ? [carPhotoRearLeft] : []}
                onChange={(arr) => setCarPhotoRearLeft(arr?.[0] || null)}
              />

              <AppText style={styles.secondaryText}>Кузов всередині</AppText>
              <PhotoPicker
                label="Кузов всередині"
                photos={carPhotoInterior ? [carPhotoInterior] : []}
                onChange={(arr) => setCarPhotoInterior(arr?.[0] || null)}
              />
              <AppText style={styles.sectionTitle}>Селфі</AppText>
              <PhotoPicker
                label="Селфі"
                photos={selfiePhoto ? [selfiePhoto] : []}
                onChange={(arr) => setSelfiePhoto(arr?.[0] || null)}
              />

              <View style={{ height: 12 }} />
              <AppButton title="Зберегти анкету" onPress={saveProfile} />
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
  back: {
    position: "absolute",
    top: 40,
    left: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 6,
    zIndex: 100,
  },
  row: { flexDirection: "row", gap: 12 },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  col: { flex: 1 },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    fontWeight: "700",
    fontSize: 16,
    color: colors.text,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
});
