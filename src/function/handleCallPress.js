import { Linking, Platform } from "react-native";
import { showAppAlert } from "../store/useAppAlertStore";

const handleCallPress = async (phone) => {
    const scheme = Platform.OS === "android" ? "tel" : "telprompt";
    const url = `${scheme}:${phone}`;

    const supported = await Linking.canOpenURL(url);

    if (supported) {
        Linking.openURL(url).catch((error) => {
            console.error("Phone dialer open error:", error);
        });
        return;
    }

    showAppAlert({
        title: "Calling Not Supported",
        message: "This device does not support phone calls from the app.",
        variant: "warning",
    });
};

export { handleCallPress };

