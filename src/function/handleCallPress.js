import {Alert, Linking, Platform} from "react-native";

const handleCallPress = async (phone) => {
    let url = '';

    if (Platform.OS === 'android') {
        url = `tel:${phone}`;
    } else {
        url = `telprompt:${phone}`;
    }

    const supported = await Linking.canOpenURL(url);

    if (supported) {
        Linking.openURL(url).catch(err => console.error('Не вдалося зробити виклик:', err));
    } else {
        Alert.alert('Помилка', 'Ваш пристрій не підтримує телефонні дзвінки.');
    }
};

export {handleCallPress}